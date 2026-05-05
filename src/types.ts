/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum InterestType {
  SIMPLE = 'Simple',
  COMPOUND = 'Compuesto',
}

export enum PaymentFrequency {
  DAILY = 'Diaria',
  WEEKLY = 'Semanal',
  BIWEEKLY = 'Quincenal',
  MONTHLY = 'Mensual',
}

export interface Customer {
  id: string;
  name: string;
  identification: string;
  contact: string;
  createdAt: number;
}

export interface Installment {
  number: number;
  dueDate: number;
  amount: number;
  principal: number;
  interest: number;
  status: 'pending' | 'paid' | 'partial';
  paidAmount: number;
}

export interface Loan {
  id: string;
  customerId: string;
  principal: number;
  interestRate: number; // Percentage
  interestType: InterestType;
  frequency: PaymentFrequency;
  term: number; // Number of installments
  startDate: number;
  installments: Installment[];
  status: 'active' | 'completed' | 'default';
  totalPaid: number;
  remainingBalance: number;
}

export interface Payment {
  id: string;
  loanId: string;
  amount: number;
  date: number;
  receiptNumber: string;
}

export interface AppData {
  customers: Customer[];
  loans: Loan[];
  payments: Payment[];
}
