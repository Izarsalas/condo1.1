import React, { useState, useMemo } from 'react';
import { Search, Clock, Printer, Trash2, AlertTriangle, X } from 'lucide-react';
import { Sale } from '../types';
import { storage } from '../lib/storage';

interface DailySalesViewProps {
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  generateInvoicePDF: (sale: Sale, format?: '58mm' | '80mm' | 'letter') => void;
}

export function DailySalesView({ sales, setSales, generateInvoicePDF }: DailySalesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const matchesSearch = 
        sale.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (sale.clientName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sale.reference?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const saleDate = sale.date.split('T')[0];
      const matchesDate = !dateFilter || saleDate === dateFilter;

      return matchesSearch && matchesDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, searchQuery, dateFilter]);

  const handleDelete = (id: string) => {
    const updated = sales.filter(s => s.id !== id);
    setSales(updated);
    setShowDeleteConfirm(null);
  };

  const handleReprint = (sale: Sale) => {
    // We'll show a menu for format selection in a real app, 
    // but here we'll default to 80mm as it's common.
    generateInvoicePDF(sale, '80mm');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Search */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200">
               <Clock size={20} />
             </div>
             <div>
               <h3 className="text-lg font-black text-slate-800 italic uppercase">Ventas del Día</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historial y gestión de facturación</p>
             </div>
          </div>

          <div className="flex gap-2">
             <div className="relative flex-1 md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
               <input 
                 type="text" 
                 placeholder="Ref, Cliente o ID..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
               />
             </div>
             <input 
               type="date" 
               value={dateFilter}
               onChange={(e) => setDateFilter(e.target.value)}
               className="h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
             />
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID / Fecha</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Método</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic font-medium">
                    No se encontraron ventas para los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-800 uppercase truncate max-w-[120px]">{sale.id}</span>
                        <span className="text-[9px] text-slate-400 font-bold">{new Date(sale.date).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-slate-700 uppercase">{sale.clientName || 'Venta Mostrador'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        sale.paymentMethod === 'Efectivo' ? 'bg-emerald-100 text-emerald-700' : 
                        sale.paymentMethod === 'Tarjeta' ? 'bg-blue-100 text-blue-700' : 
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-slate-800 font-mono">${sale.total.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleReprint(sale)}
                          className="h-8 w-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                          title="Reimprimir Ticket"
                        >
                          <Printer size={14} />
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(sale.id)}
                          className="h-8 w-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
                          title="Eliminar Factura"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200">
            <div className="flex flex-col items-center text-center space-y-4">
               <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                 <AlertTriangle size={32} />
               </div>
               <div>
                 <h3 className="text-xl font-black text-slate-800 uppercase italic">¿Eliminar Factura?</h3>
                 <p className="text-xs font-medium text-slate-400 mt-2 leading-relaxed">
                   Esta acción es irreversible y eliminará el registro de venta del sistema.
                 </p>
               </div>
               <div className="w-full flex gap-3 pt-2">
                 <button 
                   onClick={() => setShowDeleteConfirm(null)}
                   className="flex-1 h-11 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                 >
                   Cancelar
                 </button>
                 <button 
                   onClick={() => handleDelete(showDeleteConfirm)}
                   className="flex-1 h-11 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-200"
                 >
                   Eliminar
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
