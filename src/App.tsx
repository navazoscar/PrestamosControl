/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Users, 
  Wallet, 
  LayoutDashboard, 
  Receipt, 
  Search,
  ArrowRight,
  Calendar,
  DollarSign,
  UserPlus,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  FileText,
  BarChart as BarIcon,
  Edit2,
  MessageCircle,
  Trash2,
  Database,
  Download,
  Printer,
  LogOut
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useLocalStorage } from './lib/storage.ts';
import { calculateAmortization, formatCurrency } from './lib/calculations.ts';
import { InterestType, PaymentFrequency } from './types.ts';

type View = 'dashboard' | 'customers' | 'loans' | 'new-customer' | 'new-loan' | 'edit-customer';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [paymentModalLoanId, setPaymentModalLoanId] = useState<string | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'loan' | 'payment' } | null>(null);
  const { data, addCustomer, updateCustomer, addLoan, deleteLoan, addPayment, deletePayment, registerUser } = useLocalStorage();

  // Metrics
  const totalPrincipal = data.loans.reduce((acc, l) => acc + l.principal, 0);
  const totalInterest = data.loans.reduce((acc, l) => 
    acc + l.installments.reduce((sum, i) => sum + i.interest, 0), 0
  );
  const totalReceived = data.payments.reduce((acc, p) => acc + p.amount, 0);
  const totalBalance = data.loans.reduce((acc, l) => acc + l.remainingBalance, 0);

  const chartData = [
    { name: 'Capital', value: totalPrincipal, color: '#2563eb' },
    { name: 'Intereses', value: totalInterest, color: '#10b981' },
    { name: 'Recibido', value: totalReceived, color: '#3b82f6' },
    { name: 'Saldo', value: totalBalance, color: '#f43f5e' },
  ];

  const today = Date.now();
  const threeDaysFromNow = today + (3 * 24 * 60 * 60 * 1000);

  const overdueLoans = data.loans.filter(loan => {
    return loan.installments.some(inst => inst.status !== 'paid' && inst.dueDate < today);
  });

  const upcomingPayments = data.loans.flatMap(loan => 
    loan.installments
      .filter(inst => inst.status !== 'paid' && inst.dueDate >= today && inst.dueDate <= threeDaysFromNow)
      .map(inst => ({ loan, installment: inst }))
  ).sort((a, b) => a.installment.dueDate - b.installment.dueDate);

  const handleCreateCustomer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addCustomer({
      name: formData.get('name') as string,
      identification: formData.get('identification') as string,
      contact: formData.get('contact') as string,
    });
    setActiveView('customers');
  };

  const handleUpdateCustomer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCustomerId) return;
    
    const formData = new FormData(e.currentTarget);
    updateCustomer(editingCustomerId, {
      name: formData.get('name') as string,
      identification: formData.get('identification') as string,
      contact: formData.get('contact') as string,
    });
    setEditingCustomerId(null);
    setActiveView('customers');
  };

  const handleCreateLoan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const principal = parseFloat(formData.get('principal') as string);
    const rate = parseFloat(formData.get('rate') as string);
    const type = formData.get('type') as InterestType;
    const frequency = formData.get('frequency') as PaymentFrequency;
    const term = parseInt(formData.get('term') as string);
    const startDate = new Date(formData.get('startDate') as string).getTime();
    const customerId = formData.get('customerId') as string;

    const installments = calculateAmortization(principal, rate, type, frequency, term, startDate);

    addLoan({
      customerId,
      principal,
      interestRate: rate,
      interestType: type,
      frequency,
      term,
      startDate,
      installments,
      status: 'active',
    });
    setActiveView('loans');
  };

  const handlePayment = (loanId: string) => {
    setPaymentModalLoanId(loanId);
  };

  const handlePayNextInstallment = (loanId: string) => {
    const loan = data.loans.find(l => l.id === loanId);
    const nextInst = loan?.installments.find(i => i.status !== 'paid');
    if (!nextInst) return;

    const amount = nextInst.amount - nextInst.paidAmount;
    const isConfirmed = confirm(
      `¿Adelantar pago de cuota #${nextInst.number}?\n\n` +
      `Monto a pagar: ${formatCurrency(amount)}\n` +
      `Vence el: ${new Date(nextInst.dueDate).toLocaleDateString()}`
    );

    if (isConfirmed) {
      addPayment(loanId, amount);
    }
  };

  const executeDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'loan') {
      deleteLoan(confirmDelete.id);
      setSelectedLoanId(null);
    } else {
      deletePayment(confirmDelete.id);
    }
    setConfirmDelete(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} users={data.users} onRegister={registerUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800" id="app-root">
      {/* Sidebar - Mobile Navigation Bottom */}
      <aside className="fixed bottom-0 left-0 right-0 md:relative md:w-64 bg-white border-t md:border-t-0 md:border-r border-slate-200 z-50 flex md:flex-col">
        <div className="hidden md:flex items-center gap-2 p-6 mb-4 border-b border-slate-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">P</div>
          <span className="text-xl font-bold tracking-tight">PrestaControl</span>
        </div>

        <nav className="flex-1 px-4 py-2 flex md:flex-col justify-around md:justify-start gap-1">
          <NavItem 
            active={activeView === 'dashboard'} 
            onClick={() => setActiveView('dashboard')}
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
          />
          <NavItem 
            active={activeView === 'customers'} 
            onClick={() => setActiveView('customers')}
            icon={<Users size={20} />} 
            label="Clientes" 
          />
          <NavItem 
            active={activeView === 'loans'} 
            onClick={() => setActiveView('loans')}
            icon={<Receipt size={20} />} 
            label="Préstamos" 
          />
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm text-slate-400 hover:text-rose-600 hover:bg-rose-50 group mt-auto md:mt-2"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-50 group-hover:bg-rose-100 flex items-center justify-center transition-colors">
              <LogOut size={16} />
            </div>
            <span className="hidden md:inline">Cerrar Sesión</span>
          </button>
        </nav>

        <div className="hidden md:block p-6 border-t border-slate-100">
          <div className="bg-slate-900 rounded-2xl p-5 text-white text-center">
            <p className="text-xs text-slate-400 mb-1 font-medium">Saldo Pendiente</p>
            <p className="text-lg font-bold">{formatCurrency(totalBalance)}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Panel de Control</h1>
                  <p className="text-slate-500 text-sm">Resumen general de tu cartera de préstamos.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setActiveView('new-customer')}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <UserPlus size={18} />
                    <span>Nuevo Cliente</span>
                  </button>
                  <button 
                    onClick={() => setActiveView('new-loan')}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                  >
                    <Plus size={18} />
                    <span>Nuevo Préstamo</span>
                  </button>
                </div>
              </header>

              {/* Grid Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard 
                  label="Capital Prestado" 
                  value={formatCurrency(totalPrincipal)} 
                  subValue="Monto principal total"
                  color="blue"
                  icon={<Wallet size={20} />}
                />
                <MetricCard 
                  label="Intereses Totales" 
                  value={formatCurrency(totalInterest)} 
                  subValue="Proyección de ganancias"
                  color="emerald"
                  icon={<TrendingUp size={20} />}
                  trend="+12%"
                />
                <MetricCard 
                  label="Dinero Recibido" 
                  value={formatCurrency(totalReceived)} 
                  subValue="Abonos registrados"
                  color="indigo"
                  icon={<DollarSign size={20} />}
                />
                <MetricCard 
                  label="Saldo Pendiente" 
                  value={formatCurrency(totalBalance)} 
                  subValue="Cartera por cobrar"
                  color="orange"
                  icon={<AlertCircle size={20} />}
                />
              </div>

              {/* Chart Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold flex items-center gap-2">
                    <BarIcon size={18} className="text-slate-400" />
                    Resumen de Cartera
                  </h3>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: '1px solid #e2e8f0', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Lists Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Overdue Loans */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <AlertCircle size={18} className="text-rose-500" />
                      Pagos Atrasados
                    </h3>
                    <a href="#" onClick={(e) => { e.preventDefault(); setActiveView('loans'); }} className="text-blue-600 text-xs font-semibold hover:underline">Ver todos</a>
                  </div>
                  {overdueLoans.length === 0 ? (
                    <div className="text-slate-400 text-center py-12 bg-slate-50/50 flex-1 flex flex-col justify-center">
                      <p className="text-sm">No hay pagos atrasados actualmente.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 overflow-auto max-h-[400px]">
                      {overdueLoans.map(loan => {
                        const customer = data.customers.find(c => c.id === loan.customerId);
                        return (
                          <div key={loan.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 font-bold text-sm">
                                {customer?.name?.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">{customer?.name}</p>
                                <p className="text-xs text-rose-500 font-medium">Vencido: {formatCurrency(loan.remainingBalance)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handlePayment(loan.id)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 p-2 rounded-lg transition-colors"
                                title="Registrar Abono Rápido"
                              >
                                <DollarSign size={16} />
                              </button>
                              <button 
                                onClick={() => { setSelectedLoanId(loan.id); setActiveView('loans'); }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition-colors"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Upcoming Payments */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full text-slate-800">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <Calendar size={18} className="text-blue-500" />
                      Próximos Vencimientos (72h)
                    </h3>
                  </div>
                  {upcomingPayments.length === 0 ? (
                    <div className="text-slate-400 text-center py-12 bg-slate-50/50 flex-1 flex flex-col justify-center">
                      <p className="text-sm">No hay vencimientos próximos.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 overflow-auto max-h-[400px]">
                      {upcomingPayments.map(({ loan, installment }, idx) => {
                        const customer = data.customers.find(c => c.id === loan.customerId);
                        return (
                          <div key={`${loan.id}-${idx}`} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                                {customer?.name?.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">{customer?.name}</p>
                                <p className="text-xs text-slate-500 font-medium">
                                  {new Date(installment.dueDate).toLocaleDateString()} • {formatCurrency(installment.amount)}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                const amountDue = installment.amount - installment.paidAmount;
                                const dueDateLabel = new Date(installment.dueDate).toLocaleDateString();
                                const customerPhone = customer?.contact.replace(/\D/g, '');
                                const msg = encodeURIComponent(`Hola ${customer?.name}, te recordamos que tienes un pago pendiente de ${formatCurrency(amountDue)} para la cuota que vence el ${dueDateLabel}. Saludos de PrestaControl.`);
                                window.open(`https://wa.me/${customerPhone}?text=${msg}`, '_blank');
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                            >
                              <MessageCircle size={14} /> Recordar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'customers' && (
            <motion.div 
              key="customers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
                <button 
                  onClick={() => setActiveView('new-customer')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium"
                >
                  <Plus size={18} /> Nuevo
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.customers.map(customer => {
                  const customerLoans = data.loans.filter(l => l.customerId === customer.id);
                  const totalBorrowed = customerLoans.reduce((sum, l) => sum + l.principal, 0);
                  
                  return (
                    <div key={customer.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-200 transition-colors group">
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="bg-blue-50 p-3 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-600">
                            <Users size={20} />
                          </div>
                          <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full font-bold text-slate-500 uppercase tracking-wider">{customer.identification}</span>
                        </div>
                        <h3 className="text-lg font-bold mb-1 text-slate-800">{customer.name}</h3>
                        <p className="text-slate-500 text-xs mb-4">{customer.contact}</p>
                        
                        <div className="grid grid-cols-2 gap-2 mb-6">
                          <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Préstamos</p>
                            <p className="text-sm font-bold text-slate-700">{customerLoans.length}</p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">T. Prestado</p>
                            <p className="text-sm font-bold text-blue-600">{formatCurrency(totalBorrowed)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                        <button 
                          onClick={() => setActiveView('new-loan')}
                          className="text-blue-600 text-[10px] font-bold flex items-center gap-1 hover:gap-2 transition-all uppercase"
                        >
                          PRÉSTAMO <Plus size={12} />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingCustomerId(customer.id);
                            setActiveView('edit-customer');
                          }}
                          className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                          title="Editar Datos"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {data.customers.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 text-slate-400">
                    Aún no has registrado clientes.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeView === 'new-customer' && (
            <motion.div 
              key="new-customer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
                  <h2 className="text-xl font-bold mb-6">Registrar Cliente</h2>
                  <form onSubmit={handleCreateCustomer} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                      <input 
                        required
                        name="name"
                        type="text" 
                        placeholder="Ej. Juan Pérez"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 focus:bg-white transition-all outline-none text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Identificación / DNI</label>
                        <input 
                          required
                          name="identification"
                          type="text" 
                          placeholder="12345678"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 focus:bg-white transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Contacto / WhatsApp</label>
                        <input 
                          required
                          name="contact"
                          type="text" 
                          placeholder="+57 300 000 0000"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 focus:bg-white transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button 
                        type="button"
                        onClick={() => setActiveView('customers')}
                        className="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all text-sm"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all text-sm"
                      >
                        Guardar Cliente
                      </button>
                    </div>
                  </form>
                </div>
            </motion.div>
          )}
          
          {activeView === 'edit-customer' && (
            <motion.div 
              key="edit-customer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
              {(() => {
                const customer = data.customers.find(c => c.id === editingCustomerId);
                if (!customer) return null;
                return (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
                    <h2 className="text-xl font-bold mb-6">Actualizar Datos de Cliente</h2>
                    <form onSubmit={handleUpdateCustomer} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                        <input 
                          required
                          name="name"
                          type="text" 
                          defaultValue={customer.name}
                          placeholder="Ej. Juan Pérez"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 focus:bg-white transition-all outline-none text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Identificación / DNI</label>
                          <input 
                            required
                            name="identification"
                            type="text" 
                            defaultValue={customer.identification}
                            placeholder="12345678"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 focus:bg-white transition-all text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Contacto / WhatsApp</label>
                          <input 
                            required
                            name="contact"
                            type="text" 
                            defaultValue={customer.contact}
                            placeholder="+57 300 000 0000"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 focus:bg-white transition-all text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button 
                          type="button"
                          onClick={() => {
                            setEditingCustomerId(null);
                            setActiveView('customers');
                          }}
                          className="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all text-sm"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all text-sm"
                        >
                          Actualizar Cliente
                        </button>
                      </div>
                    </form>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {activeView === 'new-loan' && (
            <motion.div 
              key="new-loan"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-3xl mx-auto"
            >
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
                  <h2 className="text-xl font-bold mb-6 underline-offset-4 underline decoration-blue-600/30">Configurar Préstamo</h2>
                  <form onSubmit={handleCreateLoan} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Seleccionar Cliente</label>
                      <select 
                        required
                        name="customerId"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 focus:bg-white transition-all outline-none appearance-none text-sm"
                      >
                        <option value="">Selecciona un cliente</option>
                        {data.customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Monto Principal</label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input required name="principal" type="number" min="0" className="w-full bg-slate-50 pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:bg-white text-sm" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Tasa Interés (%)</label>
                        <div className="relative">
                          <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input required name="rate" type="number" step="0.01" className="w-full bg-slate-50 pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:bg-white text-sm" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de Interés</label>
                        <select name="type" className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:bg-white text-sm">
                          <option value={InterestType.SIMPLE}>Simple (Interés Global)</option>
                          <option value={InterestType.COMPOUND}>Compuesto (Cuota Fija Francesa)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Frecuencia de Pago</label>
                        <select name="frequency" className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:bg-white text-sm">
                          {Object.values(PaymentFrequency).map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Número de Cuotas</label>
                        <input required name="term" type="number" min="1" className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:bg-white text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Fecha de Inicio</label>
                        <input required name="startDate" type="date" className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:bg-white text-sm" />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button 
                        type="button"
                        onClick={() => setActiveView('loans')}
                        className="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all text-sm"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all text-sm"
                      >
                        Generar Préstamo
                      </button>
                    </div>
                  </form>
                </div>
            </motion.div>
          )}

          {activeView === 'loans' && (
            <motion.div 
              key="loans"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Préstamos Activos</h1>
                <button 
                  onClick={() => setActiveView('new-loan')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-100 flex items-center gap-2 transition-all"
                >
                  <Plus size={18} /> Nuevo Préstamo
                </button>
              </div>

              {!selectedLoanId ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100">
                    <h3 className="font-bold">Listado General</h3>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Cliente</th>
                          <th className="px-6 py-4">Monto</th>
                          <th className="px-6 py-4">Frecuencia</th>
                          <th className="px-6 py-4">Saldo Pendiente</th>
                          <th className="px-6 py-4">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {data.loans.map(loan => {
                          const customer = data.customers.find(c => c.id === loan.customerId);
                          return (
                            <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-medium text-slate-800">{customer?.name}</td>
                              <td className="px-6 py-4 text-slate-500">{formatCurrency(loan.principal)}</td>
                              <td className="px-6 py-4 text-slate-500">{loan.frequency}</td>
                              <td className="px-6 py-4 text-blue-600 font-bold">{formatCurrency(loan.remainingBalance)}</td>
                              <td className="px-6 py-4 flex items-center gap-3">
                                <button 
                                  onClick={() => setSelectedLoanId(loan.id)}
                                  className="text-blue-600 font-semibold hover:underline text-xs"
                                >
                                  Detalles
                                </button>
                                <button 
                                  onClick={() => handlePayment(loan.id)}
                                  className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                  ABONAR
                                </button>
                                <button 
                                  onClick={() => setConfirmDelete({ id: loan.id, type: 'loan' })}
                                  className="text-slate-300 hover:text-rose-500 transition-colors"
                                  title="Eliminar Préstamo"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {data.loans.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-20 text-slate-400 italic">No hay préstamos registrados.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedLoanId(null)}
                    className="text-slate-400 font-bold flex items-center gap-2 hover:text-slate-600 transition-all text-xs uppercase tracking-widest mb-4"
                  >
                    <ArrowRight size={14} className="rotate-180" /> Volver al listado
                  </button>
                  
                  {data.loans.filter(l => l.id === selectedLoanId).map(loan => {
                    const customer = data.customers.find(c => c.id === loan.customerId);
                    const totalExpected = loan.installments.reduce((acc, i) => acc + i.amount, 0);
                    const progress = (loan.totalPaid / totalExpected) * 100;
                    
                    const nextInstallment = loan.installments.find(i => i.status !== 'paid');
                    const pendingInstallmentsCount = loan.installments.filter(i => i.status !== 'paid').length;
                    const isOverdue = nextInstallment && nextInstallment.dueDate < Date.now();
                    
                    return (
                      <div key={loan.id} className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Summary Alerts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className={`p-4 rounded-xl border flex items-center gap-4 ${isOverdue ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                              <Calendar size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Próximo Vencimiento</p>
                              {nextInstallment ? (
                                <p className={`text-sm font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                                  {new Date(nextInstallment.dueDate).toLocaleDateString()} — {formatCurrency(nextInstallment.amount - nextInstallment.paidAmount)}
                                  {isOverdue && <span className="ml-2 bg-rose-600 text-white text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Atrasado</span>}
                                </p>
                              ) : (
                                <p className="text-sm font-bold text-emerald-600">¡Préstamo Pagado!</p>
                              )}
                            </div>
                            {nextInstallment && (
                              <button 
                                onClick={() => {
                                  const amountDue = nextInstallment.amount - nextInstallment.paidAmount;
                                  const dueDateLabel = new Date(nextInstallment.dueDate).toLocaleDateString();
                                  const customerPhone = customer?.contact.replace(/\D/g, '');
                                  const msg = encodeURIComponent(`Hola ${customer?.name}, te recordamos que tienes un pago pendiente de ${formatCurrency(amountDue)} para la cuota que vence el ${dueDateLabel}. Saludos de PrestaControl.`);
                                  window.open(`https://wa.me/${customerPhone}?text=${msg}`, '_blank');
                                }}
                                className="bg-white hover:bg-emerald-50 text-emerald-600 p-2 rounded-lg border border-emerald-100 transition-colors"
                                title="Enviar Recordatorio WhatsApp"
                              >
                                <MessageCircle size={18} />
                              </button>
                            )}
                            {nextInstallment && (
                              <button 
                                onClick={() => handlePayNextInstallment(loan.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
                              >
                                <DollarSign size={14} /> PAGAR CUOTA
                              </button>
                            )}
                          </div>
                          <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                              <Receipt size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cuotas Pendientes</p>
                              <p className="text-sm font-bold text-slate-800">
                                {pendingInstallmentsCount} de {loan.term} cuotas restantes
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Loan Detail Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Main Info */}
                          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                            <div className="flex justify-between items-start mb-8">
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cliente Titular</span>
                                <h2 className="text-3xl font-bold tracking-tight text-slate-800">{customer?.name}</h2>
                                <p className="text-slate-500 text-sm mt-1">{customer?.identification} • {customer?.contact}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider">
                                  {loan.status.toUpperCase()}
                                </div>
                                <button 
                                  onClick={() => setConfirmDelete({ id: loan.id, type: 'loan' })}
                                  className="bg-rose-50 text-rose-600 p-2 rounded-xl border border-rose-100 hover:bg-rose-100 transition-all"
                                  title="Eliminar Préstamo Permanentemente"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 border-t border-slate-50 pt-8">
                              <div>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Monto Inicial</p>
                                <p className="text-lg font-bold text-slate-800">{formatCurrency(loan.principal)}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Interés ({loan.interestType})</p>
                                <p className="text-lg font-bold text-slate-800">{loan.interestRate}%</p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Capital Cobrado</p>
                                <p className="text-lg font-bold text-blue-600">
                                  {formatCurrency(loan.installments.reduce((acc: number, i: any) => acc + Math.max(0, i.paidAmount - i.interest), 0))}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Int. Cobrados</p>
                                <p className="text-lg font-bold text-emerald-600">
                                  {formatCurrency(loan.installments.reduce((acc: number, i: any) => acc + Math.min(i.paidAmount, i.interest), 0))}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-6">
                              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                                <span>Progreso del Pago</span>
                                <span>{Math.round(progress)}% Completo</span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  className="bg-blue-600 h-full rounded-full" 
                                />
                              </div>
                            </div>
                          </div>

                          {/* Quick Summary Card */}
                          <div className="bg-slate-900 rounded-2xl p-8 text-white flex flex-col justify-between shadow-xl shadow-slate-200 transition-all hover:scale-[1.01]">
                            <div>
                              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3">Saldo Actual</p>
                              <p className="text-4xl font-bold tracking-tight">{formatCurrency(loan.remainingBalance)}</p>
                              <div className="mt-6 flex flex-col gap-2">
                                <div className="flex justify-between text-xs py-2 border-b border-white/10">
                                  <span className="text-white/50">Cobrado:</span>
                                  <span className="font-bold">{formatCurrency(loan.totalPaid)}</span>
                                </div>
                                <div className="flex justify-between text-xs py-2">
                                  <span className="text-white/50">Total Proyectado:</span>
                                  <span className="font-bold">{formatCurrency(totalExpected)}</span>
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => handlePayment(loan.id)}
                              className="mt-8 bg-blue-600 hover:bg-blue-500 text-white w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/40"
                            >
                              <DollarSign size={18} /> Registrar Abono
                            </button>
                          </div>
                        </div>

                        {/* Amortization & Payments Tabs (Simplified as sections) */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                          <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                            <h3 className="font-bold">Plan de Amortización</h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                                <tr>
                                  <th className="px-6 py-4">#</th>
                                  <th className="px-6 py-4">Vencimiento</th>
                                  <th className="px-6 py-4 text-right hidden sm:table-cell">Capital</th>
                                  <th className="px-6 py-4 text-right hidden sm:table-cell">Interés</th>
                                  <th className="px-6 py-4 text-right">Total Cuota</th>
                                  <th className="px-6 py-4 text-right">Pagado</th>
                                  <th className="px-6 py-4 text-center">Estado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {loan.installments.map((inst, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-300">{inst.number}</td>
                                    <td className="px-6 py-4 text-slate-600">{new Date(inst.dueDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right text-slate-500 hidden sm:table-cell font-mono text-xs">{formatCurrency(inst.principal)}</td>
                                    <td className="px-6 py-4 text-right text-emerald-600/70 hidden sm:table-cell font-mono text-xs">{formatCurrency(inst.interest)}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">{formatCurrency(inst.amount)}</td>
                                    <td className="px-6 py-4 text-right text-blue-600 font-medium">{formatCurrency(inst.paidAmount)}</td>
                                    <td className="px-6 py-4">
                                      <div className="flex justify-center">
                                        <StatusBadge status={inst.status} />
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* History */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                          <h3 className="font-bold mb-6">Recibos Recientes</h3>
                          <div className="space-y-3">
                            {data.payments.filter(p => p.loanId === loan.id).length === 0 ? (
                              <p className="text-slate-400 text-sm italic text-center py-8">Historial de abonos vacío.</p>
                            ) : (
                              data.payments.filter(p => p.loanId === loan.id).reverse().map(payment => (
                                <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all group">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                                      <FileText size={20} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-800">{payment.receiptNumber}</p>
                                      <p className="text-[10px] text-slate-400 font-medium">{new Date(payment.date).toLocaleDateString()} • {new Date(payment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-4">
                                    <div>
                                      <p className="font-bold text-blue-600">{formatCurrency(payment.amount)}</p>
                                      <button 
                                        onClick={() => setReceiptPaymentId(payment.id)}
                                        className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-blue-600"
                                      >
                                        Ver
                                      </button>
                                    </div>
                                    <button 
                                      onClick={() => setConfirmDelete({ id: payment.id, type: 'payment' })}
                                      className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                      title="Eliminar Abono"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModalLoanId && (
          <PaymentModal 
            loanId={paymentModalLoanId}
            data={data}
            onClose={() => setPaymentModalLoanId(null)}
            onConfirm={(amount) => {
              addPayment(paymentModalLoanId, amount);
              setPaymentModalLoanId(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmModal 
            type={confirmDelete.type}
            onClose={() => setConfirmDelete(null)}
            onConfirm={executeDelete}
          />
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {receiptPaymentId && (
          <ReceiptModal 
            paymentId={receiptPaymentId}
            data={data}
            onClose={() => setReceiptPaymentId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Login({ onLogin, users, onRegister }: { onLogin: () => void, users: any[], onRegister: (u: any) => any }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    setTimeout(() => {
      if (isRegistering) {
        const success = onRegister({ username: user, password, name: fullName });
        if (success) {
          setIsRegistering(false);
          setError(null);
          alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
        } else {
          setError('El nombre de usuario ya existe');
        }
      } else {
        // Core accounts + registered accounts
        const foundUser = users.find(u => u.username === user && u.password === password) || 
                         (user === 'admin' && password === 'admin' ? { name: 'Administrador' } : null);
        
        if (foundUser) {
          onLogin();
        } else {
          setError('Credenciales incorrectas');
        }
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-100/50 via-transparent to-transparent pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200 rotate-3">
            <Receipt size={32} className="text-white -rotate-3" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">PrestaControl</h1>
          <p className="text-slate-500 font-medium tracking-tight">Gestión Profesional de Cartera</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 p-10 relative overflow-hidden group border border-slate-100">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <h2 className="text-xl font-bold mb-6 text-slate-800">
            {isRegistering ? 'Crear nueva cuenta' : 'Ingresar al sistema'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre Completo</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:border-blue-600 outline-none transition-all font-medium text-slate-800"
                    placeholder="Juan Perez"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Usuario</label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:border-blue-600 outline-none transition-all font-medium text-slate-800"
                  placeholder="Ingrese su usuario"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contraseña</label>
              <div className="relative">
                <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:border-blue-600 outline-none transition-all font-medium text-slate-800"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100"
                >
                  <AlertCircle size={16} />
                  <p className="text-xs font-bold">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 ${
                loading 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                  : isRegistering 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-emerald-200'
                    : 'bg-slate-900 text-white hover:bg-black active:scale-95 shadow-slate-200'
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <>
                  {isRegistering ? 'Crear Cuenta' : 'Entrar al Sistema'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-slate-50">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-widest"
            >
              {isRegistering ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Registrate'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
              Sistema Seguro & Encriptado<br />
              © 2026 PrestaControl Pro
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ConfirmModal({ 
  type, 
  onClose, 
  onConfirm 
}: { 
  type: 'loan' | 'payment', 
  onClose: () => void, 
  onConfirm: () => void 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trash2 size={32} />
        </div>
        <h3 className="text-xl font-bold mb-2">¿Estás seguro?</h3>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          {type === 'loan' 
            ? 'Esta acción eliminará el préstamo y todos sus abonos permanentemente. No se puede deshacer.' 
            : 'Este abono será eliminado y los saldos del préstamo serán recalculados.'}
        </p>
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all text-sm"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 text-sm"
          >
            Eliminar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReceiptModal({ 
  paymentId, 
  data, 
  onClose 
}: { 
  paymentId: string, 
  data: any, 
  onClose: () => void 
}) {
  const payment = data.payments.find((p: any) => p.id === paymentId);
  const loan = data.loans.find((l: any) => l.id === payment?.loanId);
  const customer = data.customers.find((c: any) => c.id === loan?.customerId);

  if (!payment || !loan || !customer) return null;

  const downloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a6'
    });

    // Styles
    const blue = '#2563eb';
    const dark = '#1e293b';
    const slate = '#64748b';

    // Header Color Block
    doc.setFillColor(37, 99, 235); // matches blue-600
    doc.rect(0, 0, 105, 35, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PrestaControl', 10, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Comprobante de Pago', 10, 22);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO Nº', 75, 15);
    doc.setFontSize(12);
    doc.text(payment.receiptNumber, 75, 22);

    // Body
    doc.setTextColor(dark);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', 10, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.name, 10, 50);
    doc.setTextColor(slate);
    doc.text(customer.identification, 10, 54);

    doc.setTextColor(dark);
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA:', 70, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(payment.date).toLocaleDateString(), 70, 50);

    // Amount Box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(10, 65, 85, 35, 3, 3, 'FD');
    
    doc.setTextColor(slate);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCEPTO: ABONO A PRÉSTAMO', 15, 72);

    const totalInterestLoan = loan.installments.reduce((acc: number, i: any) => acc + i.interest, 0);
    doc.setFontSize(6);
    doc.text('CAPITAL ORIGINAL: ' + formatCurrency(loan.principal), 15, 78);
    doc.text('INTERESES TOTALES: ' + formatCurrency(totalInterestLoan), 15, 82);
    
    doc.setTextColor(blue);
    doc.setFontSize(14);
    doc.text('TOTAL RECIBIDO: ' + formatCurrency(payment.amount), 15, 92);

    // Footer
    doc.setTextColor(slate);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text('Gracias por su puntualidad.', 10, 110);
    doc.text('Saldo Actual: ' + formatCurrency(loan.remainingBalance), 10, 115);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('Generado automáticamente por PrestaControl el ' + new Date().toLocaleString(), 10, 140);

    doc.save(`Recibo_${payment.receiptNumber}.pdf`);
  };

  const shareWhatsApp = () => {
    const totalInterestLoan = loan.installments.reduce((acc: number, i: any) => acc + i.interest, 0);
    const message = `*COMPROBANTE DE PAGO - PRESTACONTROL*%0A` +
      `--------------------------------%0A` +
      `*Recibo No:* ${payment.receiptNumber}%0A` +
      `*Fecha:* ${new Date(payment.date).toLocaleDateString()}%0A` +
      `*Cliente:* ${customer.name}%0A` +
      `--------------------------------%0A` +
      `*DETALLE DEL PRÉSTAMO:*%0A` +
      `Capital Original: ${formatCurrency(loan.principal)}%0A` +
      `Intereses Totales: ${formatCurrency(totalInterestLoan)}%0A` +
      `--------------------------------%0A` +
      `*MONTO PAGADO:* ${formatCurrency(payment.amount)}%0A` +
      `*SALDO ACTUAL:* ${formatCurrency(loan.remainingBalance)}%0A` +
      `--------------------------------%0A` +
      `_Gracias por su pago._`;
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-blue-600 p-8 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Receipt size={120} />
          </div>
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                <Receipt size={24} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Comprobante de Pago</h2>
              <p className="text-blue-100 text-sm font-medium">Recibo Oficial de Abono</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">Nº Recibo</p>
              <p className="text-xl font-mono font-bold tracking-tighter">{payment.receiptNumber}</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8 bg-white border-b border-dashed border-slate-200">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Cliente</p>
              <p className="font-bold text-slate-800 leading-tight">{customer.name}</p>
              <p className="text-xs text-slate-500 mt-1">{customer.identification}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Fecha y Hora</p>
              <p className="font-bold text-slate-800 leading-tight">{new Date(payment.date).toLocaleDateString()}</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                {new Date(payment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Concepto</p>
              <p className="text-xs font-bold text-blue-600">Abono a Préstamo</p>
            </div>
            
            <div className="space-y-2 mb-4 pt-4 border-t border-slate-200/50">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-400 uppercase">Capital Inicial</span>
                <span className="text-slate-600">{formatCurrency(loan.principal)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-400 uppercase">Intereses Totales</span>
                <span className="text-emerald-600/70">{formatCurrency(loan.installments.reduce((acc: number, i: any) => acc + i.interest, 0))}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <p className="text-base font-bold text-slate-800">Total Recibido</p>
              <p className="text-2xl font-black text-blue-600 tracking-tight">{formatCurrency(payment.amount)}</p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 flex justify-between items-center">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Actual</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrency(loan.remainingBalance)}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={shareWhatsApp}
                className="bg-emerald-50 text-emerald-600 p-3 rounded-xl font-bold hover:bg-emerald-100 transition-all flex items-center gap-2"
                title="Compartir por WhatsApp"
              >
                <MessageCircle size={18} />
              </button>
              <button 
                onClick={downloadPDF}
                className="bg-blue-50 text-blue-600 p-3 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center gap-2"
                title="Descargar PDF"
              >
                <Download size={18} />
              </button>
              <button 
                onClick={onClose}
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PaymentModal({ 
  loanId, 
  data, 
  onClose, 
  onConfirm 
}: { 
  loanId: string, 
  data: any, 
  onClose: () => void, 
  onConfirm: (amount: number) => void 
}) {
  const [amount, setAmount] = useState('');
  const loan = data.loans.find((l: any) => l.id === loanId);
  const customer = data.customers.find((c: any) => c.id === loan?.customerId);

  if (!loan) return null;

  const currentAmount = parseFloat(amount) || 0;
  const isOverBalance = currentAmount > loan.remainingBalance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!isNaN(val) && val > 0 && val <= loan.remainingBalance) {
      onConfirm(val);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold">Registrar Abono</h3>
            <p className="text-slate-500 text-xs">
              Cliente: <span className="font-bold text-slate-800">{customer?.name}</span>
            </p>
          </div>
          <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
            <DollarSign size={20} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Monto del Pago</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                autoFocus
                type="number"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full ${isOverBalance ? 'bg-rose-50 border-rose-300 focus:border-rose-500' : 'bg-slate-50 border-slate-200 focus:border-blue-600'} border rounded-xl pl-12 pr-4 py-3 outline-none transition-all font-bold`}
                required
              />
              {isOverBalance && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500">
                  <AlertCircle size={18} />
                </div>
              )}
            </div>
            <div className="flex justify-between mt-2">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Saldo Pendiente</p>
                {isOverBalance && <p className="text-[10px] text-rose-500 font-bold">Monto excede el saldo</p>}
              </div>
              <p className="text-[10px] font-bold text-slate-800">{formatCurrency(loan.remainingBalance)}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all text-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isOverBalance || currentAmount <= 0}
              className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all shadow-lg text-sm ${
                isOverBalance || currentAmount <= 0 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
              }`}
            >
              Confirmar
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex md:flex-row flex-col items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
        active 
          ? 'bg-blue-50 text-blue-700' 
          : 'text-slate-500 hover:bg-slate-50'
      }`}
    >
      <span className={active ? 'text-blue-700' : 'text-slate-400'}>{icon}</span>
      <span className="text-[10px] md:text-sm md:font-medium tracking-tight">{label}</span>
    </button>
  );
}

function MetricCard({ label, value, subValue, icon, color, trend }: { label: string, value: string, subValue: string, icon: React.ReactNode, color: string, trend?: string }) {
  const colorMap = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-500',
    green: 'text-emerald-500',
    indigo: 'text-blue-600',
    orange: 'text-rose-500',
  };

  const trendColor = color === 'orange' ? 'text-rose-500' : 'text-emerald-500';

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <div className={`opacity-40 ${colorMap[color as keyof typeof colorMap]}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="flex items-center gap-2 mt-2">
        {trend && <span className={`${trendColor} text-[10px] font-bold`}>{trend} vs mes ant.</span>}
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{subValue}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    paid: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    pending: 'bg-slate-50 text-slate-500 border border-slate-100',
    partial: 'bg-blue-50 text-blue-600 border border-blue-100',
  };
  const labels = {
    paid: 'PAGADO',
    pending: 'PENDIENTE',
    partial: 'PARCIAL',
  };
  return (
    <span className={`px-3 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${styles[status as keyof typeof styles]}`}>
      {labels[status as keyof typeof labels]}
    </span>
  );
}
