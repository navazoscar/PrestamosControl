/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase.ts';
import { AppData, Customer, Loan, Payment } from '../types.ts';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const initialData: AppData = {
  customers: [],
  loans: [],
  payments: [],
};

export function useAppDatabase() {
  const [data, setData] = useState<AppData>(initialData);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        // Auto-signin anonymously for frictionless experience as requested
        signInAnonymously(auth).catch(e => console.error("Anon signin failed", e));
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribeCustomers = onSnapshot(
      query(collection(db, 'customers'), where('userId', '==', user.uid)),
      (snapshot) => {
        const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        setData(prev => ({ ...prev, customers }));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'customers')
    );

    const unsubscribeLoans = onSnapshot(
      query(collection(db, 'loans'), where('userId', '==', user.uid)),
      (snapshot) => {
        const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
        setData(prev => ({ ...prev, loans }));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'loans')
    );

    const unsubscribePayments = onSnapshot(
      query(collection(db, 'payments'), where('userId', '==', user.uid)),
      (snapshot) => {
        const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setData(prev => ({ ...prev, payments }));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'payments')
    );

    return () => {
      unsubscribeCustomers();
      unsubscribeLoans();
      unsubscribePayments();
    };
  }, [user]);

  const addCustomer = async (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    if (!user) return;
    const id = crypto.randomUUID();
    const newCustomer = {
      ...customer,
      userId: user.uid,
      createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, 'customers', id), newCustomer);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `customers/${id}`);
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Omit<Customer, 'id' | 'createdAt'>>) => {
    if (!user) return;
    const customerRef = doc(db, 'customers', id);
    try {
      const current = data.customers.find(c => c.id === id);
      if (!current) return;
      await setDoc(customerRef, { ...current, ...updates, userId: user.uid });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `customers/${id}`);
    }
  };

  const addLoan = async (loan: Omit<Loan, 'id' | 'totalPaid' | 'remainingBalance'>) => {
    if (!user) return;
    const id = crypto.randomUUID();
    const newLoan = {
      ...loan,
      userId: user.uid,
      totalPaid: 0,
      remainingBalance: loan.installments.reduce((acc, inst) => acc + inst.amount, 0),
    };
    try {
      await setDoc(doc(db, 'loans', id), newLoan);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `loans/${id}`);
    }
  };

  const addPayment = async (loanId: string, amount: number) => {
    if (!user) return;
    const loan = data.loans.find(l => l.id === loanId);
    if (!loan) return;

    const paymentId = crypto.randomUUID();
    const receiptNumber = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPayment = {
      loanId,
      amount,
      date: Date.now(),
      receiptNumber,
      userId: user.uid,
    };

    const batch = writeBatch(db);
    
    let remainingPayment = amount;
    const updatedInstallments = loan.installments.map(inst => {
      if (inst.status !== 'paid' && remainingPayment > 0) {
        const needed = inst.amount - inst.paidAmount;
        const paymentForThis = Math.min(remainingPayment, needed);
        const totalPaidForInst = inst.paidAmount + paymentForThis;
        remainingPayment -= paymentForThis;
        
        return {
          ...inst,
          paidAmount: totalPaidForInst,
          status: totalPaidForInst >= inst.amount ? 'paid' : 'partial',
        };
      }
      return inst;
    });

    const totalPaid = loan.totalPaid + amount;
    const totalExpected = loan.installments.reduce((acc, i) => acc + i.amount, 0);
    
    batch.set(doc(db, 'payments', paymentId), newPayment);
    batch.update(doc(db, 'loans', loanId), {
      installments: updatedInstallments,
      totalPaid,
      remainingBalance: Math.max(0, totalExpected - totalPaid),
      status: totalPaid >= totalExpected ? 'completed' : 'active',
    });

    try {
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `batch-payment-${paymentId}`);
    }
  };

  const deleteCustomer = async (customerId: string) => {
    if (!user) return;
    const batch = writeBatch(db);
    const loanIdsToDelete = data.loans
      .filter(l => l.customerId === customerId)
      .map(l => l.id);
    
    batch.delete(doc(db, 'customers', customerId));
    loanIdsToDelete.forEach(id => {
      batch.delete(doc(db, 'loans', id));
      data.payments
        .filter(p => p.loanId === id)
        .forEach(p => batch.delete(doc(db, 'payments', p.id)));
    });

    try {
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `customers/${customerId}`);
    }
  };

  const deleteLoan = async (loanId: string) => {
    if (!user) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'loans', loanId));
    data.payments
      .filter(p => p.loanId === loanId)
      .forEach(p => batch.delete(doc(db, 'payments', p.id)));

    try {
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `loans/${loanId}`);
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (!user) return;
    const payment = data.payments.find(p => p.id === paymentId);
    if (!payment) return;

    const loanId = payment.loanId;
    const loan = data.loans.find(l => l.id === loanId);
    if (!loan) {
      try {
        await deleteDoc(doc(db, 'payments', paymentId));
        return;
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `payments/${paymentId}`);
      }
    }

    const batch = writeBatch(db);
    const remainingPayments = data.payments.filter(p => p.id !== paymentId && p.loanId === loanId);
    const totalPaid = remainingPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalExpected = loan.installments.reduce((acc, i) => acc + i.amount, 0);

    let redistributeAmount = totalPaid;
    const updatedInstallments = loan.installments.map(inst => {
      const forThis = Math.min(redistributeAmount, inst.amount);
      redistributeAmount -= forThis;
      return {
        ...inst,
        paidAmount: forThis,
        status: forThis >= inst.amount ? 'paid' : (forThis > 0 ? 'partial' : 'pending')
      };
    });

    batch.delete(doc(db, 'payments', paymentId));
    batch.update(doc(db, 'loans', loanId), {
      installments: updatedInstallments,
      totalPaid,
      remainingBalance: Math.max(0, totalExpected - totalPaid),
      status: totalPaid >= totalExpected ? 'completed' : 'active'
    });

    try {
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `delete-payment-${paymentId}`);
    }
  };

  return {
    data,
    loading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addLoan,
    deleteLoan,
    addPayment,
    deletePayment,
  };
}
