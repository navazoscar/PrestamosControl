/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InterestType, PaymentFrequency, Installment } from '../types.ts';

export const calculateAmortization = (
  principal: number,
  rate: number,
  type: InterestType,
  frequency: PaymentFrequency,
  term: number,
  startDate: number
): Installment[] => {
  const installments: Installment[] = [];
  const ratePerPeriod = rate / 100;
  let currentDate = new Date(startDate);

  const getNextDate = (date: Date, freq: PaymentFrequency) => {
    const newDate = new Date(date);
    if (freq === PaymentFrequency.DAILY) newDate.setDate(newDate.getDate() + 1);
    if (freq === PaymentFrequency.WEEKLY) newDate.setDate(newDate.getDate() + 7);
    if (freq === PaymentFrequency.BIWEEKLY) newDate.setDate(newDate.getDate() + 15);
    if (freq === PaymentFrequency.MONTHLY) newDate.setMonth(newDate.getMonth() + 1);
    return newDate;
  };

  if (type === InterestType.SIMPLE) {
    const totalInterest = principal * ratePerPeriod;
    const totalAmount = principal + totalInterest;
    const installmentAmount = totalAmount / term;
    const principalPerInstallment = principal / term;
    const interestPerInstallment = totalInterest / term;

    for (let i = 1; i <= term; i++) {
      currentDate = getNextDate(currentDate, frequency);
      installments.push({
        number: i,
        dueDate: currentDate.getTime(),
        amount: installmentAmount,
        principal: principalPerInstallment,
        interest: interestPerInstallment,
        status: 'pending',
        paidAmount: 0,
      });
    }
  } else {
    // Amortización Francesa (Cuota Fija)
    // Formula: A = P * [i(1+i)^n] / [(1+i)^n - 1]
    const i = ratePerPeriod; // Tasa por periodo
    const n = term;
    const installmentAmount = principal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    
    let remainingPrincipal = principal;

    for (let j = 1; j <= term; j++) {
      currentDate = getNextDate(currentDate, frequency);
      const interestForPeriod = remainingPrincipal * i;
      const principalForPeriod = installmentAmount - interestForPeriod;
      
      installments.push({
        number: j,
        dueDate: currentDate.getTime(),
        amount: installmentAmount,
        principal: principalForPeriod,
        interest: interestForPeriod,
        status: 'pending',
        paidAmount: 0,
      });

      remainingPrincipal -= principalForPeriod;
    }
  }

  return installments;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};
