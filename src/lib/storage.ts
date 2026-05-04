/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AppData, Customer, Loan, Payment, User } from '../types.ts';

const STORAGE_KEY = 'presta_control_data';

const initialData: AppData = {
  customers: [],
  loans: [],
  payments: [],
  users: [],
};

export function useLocalStorage() {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: Ensure users array exists
        if (!parsed.users) parsed.users = [];
        return parsed;
      } catch (e) {
        console.error('Error loading data from localStorage', e);
        return initialData;
      }
    }
    return initialData;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const registerUser = (user: Omit<User, 'id' | 'createdAt'>) => {
    if (data.users.find(u => u.username === user.username)) {
      return null;
    }

    const newUser: User = {
      ...user,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    setData(prev => ({
      ...prev,
      users: [...prev.users, newUser]
    }));
    return newUser;
  };

  const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const newCustomer: Customer = {
      ...customer,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setData(prev => ({ ...prev, customers: [...prev.customers, newCustomer] }));
    return newCustomer;
  };

  const updateCustomer = (id: string, updates: Partial<Omit<Customer, 'id' | 'createdAt'>>) => {
    setData(prev => ({
      ...prev,
      customers: prev.customers.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const addLoan = (loan: Omit<Loan, 'id' | 'totalPaid' | 'remainingBalance'>) => {
    const newLoan: Loan = {
      ...loan,
      id: crypto.randomUUID(),
      totalPaid: 0,
      remainingBalance: loan.installments.reduce((acc, inst) => acc + inst.amount, 0),
    };
    setData(prev => ({ ...prev, loans: [...prev.loans, newLoan] }));
    return newLoan;
  };

  const addPayment = (loanId: string, amount: number) => {
    const paymentId = crypto.randomUUID();
    const receiptNumber = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPayment: Payment = {
      id: paymentId,
      loanId,
      amount,
      date: Date.now(),
      receiptNumber,
    };

    setData(prev => {
      const updatedLoans = prev.loans.map(loan => {
        if (loan.id === loanId) {
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
          
          return {
            ...loan,
            installments: updatedInstallments as any,
            totalPaid,
            remainingBalance: Math.max(0, totalExpected - totalPaid),
            status: totalPaid >= totalExpected ? 'completed' : 'active',
          };
        }
        return loan;
      });

      return {
        ...prev,
        loans: updatedLoans,
        payments: [...prev.payments, newPayment],
      };
    });

    return newPayment;
  };

  const deleteLoan = (loanId: string) => {
    setData(prev => ({
      ...prev,
      loans: prev.loans.filter(l => l.id !== loanId),
      payments: prev.payments.filter(p => p.loanId !== loanId)
    }));
  };

  const deletePayment = (paymentId: string) => {
    setData(prev => {
      const payment = prev.payments.find(p => p.id === paymentId);
      if (!payment) return prev;

      const loanId = payment.loanId;
      const loan = prev.loans.find(l => l.id === loanId);
      if (!loan) {
        return {
          ...prev,
          payments: prev.payments.filter(p => p.id !== paymentId)
        };
      }

      // Recalculate loan stats based on remaining payments
      const remainingPayments = prev.payments.filter(p => p.id !== paymentId && p.loanId === loanId);
      const totalPaid = remainingPayments.reduce((acc, p) => acc + p.amount, 0);
      const totalExpected = loan.installments.reduce((acc, i) => {
        // We need the original installment amount. Assumed fixed.
        // But since we modify installments in place, we should rely on the initial total if possible.
        // For simplicity in this logic, we'll reset installment paidAmounts and redistribute the balance.
        return acc + i.amount;
      }, 0);

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

      const updatedLoans = prev.loans.map(l => {
        if (l.id === loanId) {
          return {
            ...l,
            installments: updatedInstallments as any,
            totalPaid,
            remainingBalance: Math.max(0, totalExpected - totalPaid),
            status: totalPaid >= totalExpected ? 'completed' : 'active'
          };
        }
        return l;
      });

      return {
        ...prev,
        loans: updatedLoans,
        payments: prev.payments.filter(p => p.id !== paymentId)
      };
    });
  };

  return {
    data,
    addCustomer,
    updateCustomer,
    addLoan,
    deleteLoan,
    addPayment,
    deletePayment,
    registerUser,
  };
}
