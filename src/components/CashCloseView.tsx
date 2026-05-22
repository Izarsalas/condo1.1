import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Printer, 
  FileText, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  ArrowRightLeft,
  ChevronRight,
  Filter,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  History,
  BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';
import { Sale, Transaction, Product, TransactionType, Empleado, Condominio, CorteCaja, AppUser } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface CashCloseViewProps {
  sales: Sale[];
  setSales?: React.Dispatch<React.SetStateAction<Sale[]>>;
  transactions: Transaction[];
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
  products: Product[];
  employees?: Empleado[];
  condos?: Condominio[];
  cortes?: CorteCaja[];
  setCortes?: React.Dispatch<React.SetStateAction<CorteCaja[]>>;
  currentUser?: AppUser | null;
}

export function CashCloseView({ 
  sales, 
  setSales, 
  transactions, 
  setTransactions, 
  products, 
  employees = [], 
  condos = [], 
  cortes = [], 
  setCortes, 
  currentUser 
}: CashCloseViewProps) {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeDetailTab, setActiveDetailTab] = useState<'ventas' | 'otras'>('ventas');

  // New States for "Corte Hoy" and History
  const [corteMode, setCorteMode] = useState<'abierto' | 'historial'>('abierto');
  const [selectedHistoricalCorte, setSelectedHistoricalCorte] = useState<CorteCaja | null>(null);
  const [isCorteModalOpen, setIsCorteModalOpen] = useState(false);
  const [reportedCash, setReportedCash] = useState('');
  const [notesCorte, setNotesCorte] = useState('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Create products map for quick lookup
  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach(p => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach(e => {
      map[e.id] = `${e.name} (${e.role})`;
    });
    return map;
  }, [employees]);

  const condoMap = useMemo(() => {
    const map: Record<string, string> = {};
    condos.forEach(c => {
      map[c.id] = c.name;
    });
    return map;
  }, [condos]);

  // Determine relevant sales and transactions based on mode
  const currentPool = useMemo(() => {
    if (corteMode === 'abierto') {
      return {
        sales: sales.filter(s => !s.corteId),
        transactions: transactions.filter(t => !t.corteId)
      };
    } else if (selectedHistoricalCorte) {
      return {
        sales: sales.filter(s => s.corteId === selectedHistoricalCorte.id),
        transactions: transactions.filter(t => t.corteId === selectedHistoricalCorte.id)
      };
    } else {
      return { sales: [], transactions: [] };
    }
  }, [sales, transactions, corteMode, selectedHistoricalCorte]);

  const filteredData = useMemo(() => {
    if (corteMode === 'abierto') {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');

      const fSales = currentPool.sales.filter(s => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      });

      const fTransactions = currentPool.transactions.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });

      return { sales: fSales, transactions: fTransactions };
    } else {
      // In historical mode or when viewing details, always show everything belonging to that corte
      return { sales: currentPool.sales, transactions: currentPool.transactions };
    }
  }, [currentPool, startDate, endDate, corteMode]);

  const stats = useMemo(() => {
    let totalSales = 0;
    let totalCOGS = 0; // Cost of Goods Sold

    filteredData.sales.forEach(sale => {
      totalSales += sale.total;
      sale.items.forEach(item => {
        const prod = productMap[item.productId];
        if (prod) {
          totalCOGS += prod.costPrice * item.quantity;
        }
      });
    });

    let otherIncomeCount = 0;
    let totalOtherIncome = 0;
    let totalExpenses = 0;

    filteredData.transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
        totalOtherIncome += t.amount;
        otherIncomeCount++;
      } else {
        totalExpenses += t.amount;
      }
    });

    const totalRevenue = totalSales + totalOtherIncome;
    const totalCosts = totalCOGS + totalExpenses;
    const netProfit = totalRevenue - totalCosts;
    const marginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalSales,
      totalCOGS,
      totalOtherIncome,
      totalExpenses,
      totalRevenue,
      totalCosts,
      netProfit,
      marginPercent,
      salesCount: filteredData.sales.length,
      incomeCount: otherIncomeCount,
      expenseCount: filteredData.transactions.filter(t => t.type === TransactionType.EXPENSE).length
    };
  }, [filteredData, productMap]);

  // Calculate expected cash in drawer for the active/unclosed shift
  const expectedCashCalculated = useMemo(() => {
    const activeUnclosedSales = sales.filter(s => !s.corteId);
    const activeUnclosedTrans = transactions.filter(t => !t.corteId);

    // Sum cash payment methods
    const totalCashSales = activeUnclosedSales
      .filter(s => s.paymentMethod.toLowerCase().includes('efect'))
      .reduce((sum, s) => sum + s.total, 0);

    const totalCashIncome = activeUnclosedTrans
      .filter(t => t.type === TransactionType.INCOME && (!t.category || !t.category.toLowerCase().includes('banco')))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCashExpenses = activeUnclosedTrans
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    return totalCashSales + totalCashIncome - totalCashExpenses;
  }, [sales, transactions]);

  const handleDoCorte = () => {
    const activeUnclosedSales = sales.filter(s => !s.corteId);
    const activeUnclosedTrans = transactions.filter(t => !t.corteId);

    if (activeUnclosedSales.length === 0 && activeUnclosedTrans.length === 0) {
      alert("No hay ventas ni transacciones pendientes para cerrar en este turno.");
      return;
    }

    const corteId = 'corte-' + Date.now();
    const cashExpected = expectedCashCalculated;
    const cashReported = reportedCash === '' ? 0 : Number(reportedCash);
    const difference = cashReported - cashExpected;

    const totalSalesSum = activeUnclosedSales.reduce((sum, s) => sum + s.total, 0);
    const totalOtherIncomeSum = activeUnclosedTrans.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
    const totalExpensesSum = activeUnclosedTrans.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);

    let totalCOGSVal = 0;
    activeUnclosedSales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = productMap[item.productId];
        if (prod) {
          totalCOGSVal += prod.costPrice * item.quantity;
        }
      });
    });

    const totalRev = totalSalesSum + totalOtherIncomeSum;
    const totalCost = totalCOGSVal + totalExpensesSum;
    const netProf = totalRev - totalCost;

    const nuevoCorte: CorteCaja = {
      id: corteId,
      date: new Date().toISOString(),
      salesCount: activeUnclosedSales.length,
      totalSales: totalSalesSum,
      totalOtherIncome: totalOtherIncomeSum,
      totalExpenses: totalExpensesSum,
      totalCOGS: totalCOGSVal,
      netProfit: netProf,
      salesIds: activeUnclosedSales.map(s => s.id),
      transactionIds: activeUnclosedTrans.map(t => t.id),
      notes: notesCorte || undefined,
      cashExpected,
      cashReported,
      difference,
      closedBy: currentUser ? currentUser.name : 'Administrador Principal'
    };

    if (setSales) {
      setSales(prev => prev.map(s => !s.corteId ? { ...s, corteId } : s));
    }
    if (setTransactions) {
      setTransactions(prev => prev.map(t => !t.corteId ? { ...t, corteId } : t));
    }
    if (setCortes) {
      setCortes(prev => [nuevoCorte, ...prev]);
    }

    setReportedCash('');
    setNotesCorte('');
    setIsCorteModalOpen(false);
    
    setSaveSuccessMessage("¡Corte de caja registrado con éxito! El nuevo turno ha comenzado con balance limpio.");
    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 6000);
  };

  const setRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  const setMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setAnnualRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setFortnightRange = () => {
    const now = new Date();
    const day = now.getDate();
    let start, end;
    
    if (day <= 15) {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth(), 15);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 16);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Use landscape for details
    const title = selectedHistoricalCorte 
      ? `CORTE DE CAJA CERRADO - ${new Date(selectedHistoricalCorte.date).toLocaleDateString('es-DO')}`
      : 'REPORTE DETALLADO DE CORTE DE CAJA - CONDOBill';
    
    let period = `Período: ${startDate} al ${endDate}`;
    if (selectedHistoricalCorte) {
      period = `ID de Corte: ${selectedHistoricalCorte.id} | Cerrado por: ${selectedHistoricalCorte.closedBy}`;
    } else if (corteMode === 'abierto') {
      period = `Turno de Trabajo Abierto | Filtro: ${startDate} al ${endDate}`;
    }

    const formatDOP = (amount: number) => {
      return new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: 'DOP',
        minimumFractionDigits: 2
      }).format(amount);
    };
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // deep slate
    doc.text(title, 14, 22);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(period, 14, 30);
    
    if (selectedHistoricalCorte) {
      const detailsStr = `Efectivo Esperado: ${formatDOP(selectedHistoricalCorte.cashExpected)} | Efectivo Reportado: ${formatDOP(selectedHistoricalCorte.cashReported)} | Diferencia: ${formatDOP(selectedHistoricalCorte.difference)}`;
      doc.text(detailsStr, 14, 36);
      doc.text(`Fecha de Impresión: ${new Date().toLocaleString('es-DO')}`, 14, 42);
    } else {
      doc.text(`Fecha de Impresión: ${new Date().toLocaleString('es-DO')}`, 14, 36);
    }

    // Table 1: Financial Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("1. Resumen Financiero General", 14, selectedHistoricalCorte ? 52 : 46);

    const startYValue = selectedHistoricalCorte ? 56 : 50;

    autoTable(doc, {
      startY: startYValue,
      head: [['Concepto / Indicador', 'Fórmula o Descripción', 'Monto']],
      body: [
        ['Ventas Totales', 'Total facturado en ventas/productos', formatDOP(stats.totalSales)],
        ['Otros Ingresos', 'Cuotas, gas y transacciones de ingresos', formatDOP(stats.totalOtherIncome)],
        ['INGRESOS TOTALES (A)', 'Ventas totales + Otros ingresos', formatDOP(stats.totalRevenue)],
        ['Costo de Mercancía (COGS)', 'Costo de adquisición de productos', formatDOP(stats.totalCOGS)],
        ['Gastos Operativos', 'Egresos generales, reparaciones y servicios', formatDOP(stats.totalExpenses)],
        ['EGRESOS TOTALES (B)', 'Costo mercancía + Gastos operativos', formatDOP(stats.totalCosts)],
        ['UTILIDAD NETA (A - B)', 'Diferencia neta (Ganancia real)', formatDOP(stats.netProfit)],
        ['Margen de Utilidad (%)', 'Utilidad / Ingresos Totales', `${stats.marginPercent.toFixed(2)}%`],
      ],
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 12;

    // Table 2: Detailed Sales (if any)
    if (filteredData.sales.length > 0) {
      if (currentY + 40 > 190) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`2. Detalle de Ventas e Invoicing (${filteredData.sales.length} facturas)`, 14, currentY);
      
      autoTable(doc, {
        startY: currentY + 4,
        head: [['ID Factura', 'Fecha/Hora', 'Cliente / Origen', 'Productos Vendidos (Concepto)', 'Método / Comprobante', 'ITBIS', 'Total']],
        body: filteredData.sales.map(s => {
          const itemsStr = s.items.map(item => `${item.description} (x${item.quantity})`).join(', ');
          const reasonStr = s.notes ? `${itemsStr}\n[Obs: ${s.notes}]` : itemsStr;
          const methodStr = `${s.paymentMethod}` + 
            (s.bank ? ` - Bco: ${s.bank}` : '') + 
            (s.reference ? ` (Ref: ${s.reference})` : '');

          return [
            s.id.substring(0, 8),
            new Date(s.date).toLocaleString('es-DO', { hour12: false }),
            s.clientName || 'VENTA MOSTRADOR',
            reasonStr,
            methodStr,
            formatDOP(s.itbis),
            formatDOP(s.total)
          ];
        }),
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] }, // Indigo
        margin: { left: 14, right: 14 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // Table 3: Other Transactions (if any)
    if (filteredData.transactions.length > 0) {
      if (currentY + 40 > 190) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`3. Otras Transacciones (Ingresos y Egresos Directos)`, 14, currentY);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Fecha', 'Tipo', 'Categoría', 'Concepto / Motivo', 'Origen / Destinatario / Detalle', 'Monto']],
        body: filteredData.transactions.map(t => {
          let originName = '-';
          if (t.employeeId && employeeMap[t.employeeId]) {
            originName = `Empleado: ${employeeMap[t.employeeId]}`;
          } else if (t.condominioId && condoMap[t.condominioId]) {
            originName = `Condo: ${condoMap[t.condominioId]}`;
          } else if (t.description) {
            originName = t.description;
          }

          return [
            new Date(t.date).toLocaleDateString('es-DO'),
            t.type === TransactionType.INCOME ? 'INGRESO' : 'EGRESO',
            t.category,
            t.concept,
            originName,
            formatDOP(t.amount)
          ];
        }),
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [13, 148, 136] }, // Teal
        margin: { left: 14, right: 14 }
      });
    }

    if (selectedHistoricalCorte) {
      doc.save(`Corte_Caja_Cerrado_${selectedHistoricalCorte.id}.pdf`);
    } else {
      doc.save(`Corte_Caja_${startDate}_a_${endDate}.pdf`);
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const titleText = selectedHistoricalCorte ? 'REPORTE DE CORTE DE CAJA CERRADO' : 'REPORTE DE CORTE DE CAJA - CONDOBill';
    const periodText = selectedHistoricalCorte 
      ? `ID de Corte: ${selectedHistoricalCorte.id} | Cerrado por: ${selectedHistoricalCorte.closedBy} en ${new Date(selectedHistoricalCorte.date).toLocaleString('es-DO')}`
      : `Desde: ${startDate} Hasta: ${endDate}`;

    // Sheet 1: Financial Summary
    const customSummary = [
      [titleText],
      [periodText],
      ['Fecha de Emisión:', new Date().toLocaleString('es-DO')],
      [''],
      ['CONCEPTO', 'MÓDULO / DETALLE', 'MONTO (DOP)'],
      ['Ventas Totales', 'Total facturado en panel de ventas', stats.totalSales],
      ['Otros Ingresos Directos', 'Sueldos, cuotas, gas u otras entradas', stats.totalOtherIncome],
      ['INGRESOS TOTALES (A)', 'Suma de todas las ventas y depósito de ingresos', stats.totalRevenue],
      ['Costo de Mercancía (COGS)', 'Costo total de artículos vendidos', stats.totalCOGS],
      ['Gastos Operativos', 'Servicios, nóminas, reparaciones y egresos', stats.totalExpenses],
      ['EGRESOS TOTALES (B)', 'Costo de mercancía + Gastos operativos', stats.totalCosts],
      ['UTILIDAD NETA (A - B)', 'Margen neto obtenido real', stats.netProfit],
      ['Margen de Utilidad (%)', 'Porcentaje de rentabilidad neta', `${stats.marginPercent.toFixed(2)}%`]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(customSummary);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Financiero");

    // Sheet 2: Detailed Sales
    if (filteredData.sales.length > 0) {
      const salesRows = filteredData.sales.map(s => {
        const itemsStr = s.items.map(item => `${item.description} (x${item.quantity})`).join('; ');
        return {
          'ID Factura': s.id,
          'Fecha y Hora': new Date(s.date).toLocaleString('es-DO'),
          'Cliente / Origen': s.clientName || 'VENTA MOSTRADOR',
          'Detalle de Productos (Motivo)': itemsStr,
          'Método de Pago': s.paymentMethod,
          'Banco': s.bank || '-',
          'Referencia / Comprobante': s.reference || '-',
          'Notas / Observaciones': s.notes || '-',
          'Subtotal (RD$)': s.subtotal,
          'ITBIS (RD$)': s.itbis,
          'Total (RD$)': s.total
        };
      });
      const wsSales = XLSX.utils.json_to_sheet(salesRows);
      XLSX.utils.book_append_sheet(wb, wsSales, "Historial de Ventas");
    }

    // Sheet 3: Other Transactions
    if (filteredData.transactions.length > 0) {
      const transRows = filteredData.transactions.map(t => {
        let originName = '-';
        if (t.employeeId && employeeMap[t.employeeId]) {
          originName = `Empleado: ${employeeMap[t.employeeId]}`;
        } else if (t.condominioId && condoMap[t.condominioId]) {
          originName = `Condominio: ${condoMap[t.condominioId]}`;
        } else if (t.description) {
          originName = t.description;
        }

        return {
          'ID Transacción': t.id,
          'Fecha': new Date(t.date).toLocaleDateString('es-DO'),
          'Tipo': t.type === TransactionType.INCOME ? 'INGRESO' : 'EGRESO',
          'Categoría': t.category,
          'Concepto / Motivo': t.concept,
          'Origen / Destinatario / Detalle': originName,
          'Descripción Adicional': t.description || '-',
          'Monto (RD$)': t.amount
        };
      });
      const wsTrans = XLSX.utils.json_to_sheet(transRows);
      XLSX.utils.book_append_sheet(wb, wsTrans, "Otras Transacciones");
    }

    if (selectedHistoricalCorte) {
      XLSX.writeFile(wb, `Corte_Caja_Cerrado_${selectedHistoricalCorte.id}.xlsx`);
    } else {
      XLSX.writeFile(wb, `Corte_Caja_${startDate}_a_${endDate}.xlsx`);
    }
  };

  const handlePrint = () => {
    // Generar ventana limpia con diseño optimizado para impresión
    const printableWindow = window.open('', '_blank');
    if (!printableWindow) {
      // Si el bloqueador de ventanas emergentes interfiere, se recurre al PDF de alta calidad
      exportPDF();
      alert("El navegador bloqueó la ventana emergente de impresión. Se ha descargado automáticamente un reporte PDF de alta resolución.");
      return;
    }
    
    const formatDOP = (amount: number) => {
      return new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: 'DOP',
        minimumFractionDigits: 2
      }).format(amount);
    };

    const logoHtml = `<div style="font-family: 'Inter', sans-serif; font-size: 26px; font-weight: 900; color: #0b1329; tracking: -0.05em;"><span style="color: #3b82f6;">CONDO</span>Bill</div>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Impresión de Corte de Caja - CONDOBill</title>
        <!-- Cargamos Tailwind CSS para asegurar un diseño pulcro, moderno e idéntico al original -->
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            background-color: white;
            color: #1e293b;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0px; margin: 0px; }
          }
        </style>
      </head>
      <body class="p-10 max-w-5xl mx-auto">
        <div class="flex justify-between items-start border-b-2 border-slate-100 pb-6 mb-8">
          <div>
            ${logoHtml}
            <h1 class="text-2xl font-black uppercase tracking-tight text-slate-800 mt-2">
              ${selectedHistoricalCorte ? 'REPORTE DE CORTE DE CAJA CERRADO' : 'REPORTE OFICIAL: CORTE DE CAJA DETALLADO'}
            </h1>
            <p class="text-sm font-semibold text-slate-500">
              ${selectedHistoricalCorte 
                ? `ID de Corte: ${selectedHistoricalCorte.id} | Cerrado por: ${selectedHistoricalCorte.closedBy} en fecha ${new Date(selectedHistoricalCorte.date).toLocaleString('es-DO')}`
                : `Período de Conciliación: ${startDate} al ${endDate}`}
            </p>
          </div>
          <div class="text-right flex flex-col items-end">
            <button onclick="window.print()" class="no-print bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 px-6 rounded-xl shadow-md transition-all text-[11px] uppercase tracking-widest mb-2 flex items-center gap-2">
              🖨️ CONFIRMAR IMPRESIÓN
            </button>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fecha de Impresión: ${new Date().toLocaleString('es-DO')}</p>
          </div>
        </div>

        ${selectedHistoricalCorte ? `
        <section class="mb-8 bg-blue-50/50 p-6 border border-blue-100 rounded-3xl">
          <h2 class="text-sm font-black text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            🤝 DETALLES DE CONCILIACIÓN DE CAJA FISICA
          </h2>
          <div class="grid grid-cols-3 gap-6">
            <div>
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">EFECTIVO ESPERADO EN CAJA</span>
              <p class="text-lg font-black text-slate-800 font-mono mt-1">${formatDOP(selectedHistoricalCorte.cashExpected)}</p>
            </div>
            <div>
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">EFECTIVO REPORTADO POR CAJERO</span>
              <p class="text-lg font-black text-slate-800 font-mono mt-1">${formatDOP(selectedHistoricalCorte.cashReported)}</p>
            </div>
            <div>
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">DIFERENCIA (FALTANTE/SOBRANTE)</span>
              <p class="text-lg font-black ${selectedHistoricalCorte.difference < 0 ? 'text-rose-600' : selectedHistoricalCorte.difference > 0 ? 'text-emerald-600' : 'text-slate-600'} font-mono mt-1">
                ${selectedHistoricalCorte.difference > 0 ? '+' : ''}${formatDOP(selectedHistoricalCorte.difference)}
              </p>
            </div>
          </div>
          ${selectedHistoricalCorte.notes ? `
            <div class="mt-4 pt-4 border-t border-blue-100/50">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">NOTAS / OBSERVACIONES DE CIERRE</span>
              <p class="text-xs text-slate-700 font-medium italic mt-1">"${selectedHistoricalCorte.notes}"</p>
            </div>
          ` : ''}
        </section>
        ` : ''}

        <section class="mb-8">
          <h2 class="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="w-2.5 h-2.5 bg-blue-600 rounded-full"></span> 1. RESUMEN EJECUTIVO DE CAJA
          </h2>
          <div class="grid grid-cols-4 gap-4">
            <div class="p-4 border border-slate-100 rounded-2xl bg-slate-50">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">INGRESOS TOTALES</span>
              <p class="text-xl font-black text-emerald-600 mt-1">${formatDOP(stats.totalRevenue)}</p>
            </div>
            <div class="p-4 border border-slate-100 rounded-2xl bg-slate-50">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">EGRESOS TOTALES</span>
              <p class="text-xl font-black text-rose-500 mt-1">${formatDOP(stats.totalCosts)}</p>
            </div>
            <div class="p-4 border border-slate-100 rounded-2xl bg-slate-50 border-blue-100 bg-blue-50/20">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">UTILIDAD NETA RECUPERADA</span>
              <p class="text-xl font-black text-blue-600 mt-1">${formatDOP(stats.netProfit)}</p>
            </div>
            <div class="p-4 border border-slate-100 rounded-2xl bg-slate-50">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">MARGEN DE UTILIDAD</span>
              <p class="text-xl font-black text-slate-700 mt-1">${stats.marginPercent.toFixed(1)}%</p>
            </div>
          </div>
        </section>

        <section class="mb-8">
          <h2 class="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="w-2.5 h-2.5 bg-slate-800 rounded-full"></span> 2. CONCILIACIÓN DE CUENTAS GENERALES
          </h2>
          <table class="w-full text-left text-xs border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <thead>
              <tr class="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                <th class="p-4 text-left">Indicador Financiero</th>
                <th class="p-4 text-left">Fórmula Aplicable / Origen</th>
                <th class="p-4 text-right">Monto Neto (DOP)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              <tr class="hover:bg-slate-50/50">
                <td class="p-4 font-bold text-slate-800">Ventas Directas Registradas</td>
                <td class="p-4 text-slate-400">Total facturado en ventas e inventario de tienda</td>
                <td class="p-4 text-right font-black text-slate-800">${formatDOP(stats.totalSales)}</td>
              </tr>
              <tr class="hover:bg-slate-50/50">
                <td class="p-4 font-bold text-slate-800">Otros Ingresos Recibidos</td>
                <td class="p-4 text-slate-400">Cuotas de mantenimiento ordinarias/extraordinarias, gas y transacciones directas</td>
                <td class="p-4 text-right font-black text-slate-800">${formatDOP(stats.totalOtherIncome)}</td>
              </tr>
              <tr class="bg-emerald-50/40 text-emerald-900 font-bold">
                <td class="p-4 text-emerald-800 uppercase tracking-wider text-[11px]">Ingresos Brutos del Período (A)</td>
                <td class="p-4 text-emerald-600 font-medium">Suma acumulativa de todas las entradas y ventas</td>
                <td class="p-4 text-right font-black text-emerald-700 text-sm">${formatDOP(stats.totalRevenue)}</td>
              </tr>
              <tr class="hover:bg-slate-50/50">
                <td class="p-4 font-medium text-slate-800">Costo de Ventas (COGS)</td>
                <td class="p-4 text-slate-400">Costo de adquisición base de insumos y mercadería vendida</td>
                <td class="p-4 text-right font-black text-slate-800">${formatDOP(stats.totalCOGS)}</td>
              </tr>
              <tr class="hover:bg-slate-50/50">
                <td class="p-4 font-medium text-slate-800">Gastos Operativos Registrados</td>
                <td class="p-4 text-slate-400">Servicios básicos, seguridad, nóminas, mantenimientos y compras directas</td>
                <td class="p-4 text-right font-black text-slate-800">${formatDOP(stats.totalExpenses)}</td>
              </tr>
              <tr class="bg-rose-50/40 text-rose-900 font-bold">
                <td class="p-4 text-rose-800 uppercase tracking-wider text-[11px]">Gastos y Costos Consolidados (B)</td>
                <td class="p-4 text-rose-600 font-medium">Costo de mercancía + Gastos generales</td>
                <td class="p-4 text-right font-black text-rose-700 text-sm">${formatDOP(stats.totalCosts)}</td>
              </tr>
              <tr class="bg-blue-100/40 text-blue-900 font-bold border-t-2 border-blue-200">
                <td class="p-4 text-blue-800 uppercase tracking-wider text-[11px]">Flujo de Utilidad Neta (A - B)</td>
                <td class="p-4 text-blue-600 font-medium">Diferencia exacta que representa la ganancia operativa neta</td>
                <td class="p-4 text-right font-black text-blue-600 text-[15px]">${formatDOP(stats.netProfit)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        ${filteredData.sales.length > 0 ? `
        <section class="mb-8">
          <h2 class="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span> 3. DETALLE DE MOVIMIENTOS DE FACTURACIÓN Y VENTAS
          </h2>
          <table class="w-full text-left text-[11px] border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <thead>
              <tr class="bg-slate-900 text-white font-bold uppercase tracking-wider text-[9px] border-b border-slate-200">
                <th class="p-3">Factura</th>
                <th class="p-3">Fecha y Hora</th>
                <th class="p-3">Cliente / Origen</th>
                <th class="p-3">Productos Vendidos / Motivo</th>
                <th class="p-3">Método / Referencia</th>
                <th class="p-3 text-right">ITBIS</th>
                <th class="p-3 text-right">Monto Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-600">
              ${filteredData.sales.map(s => {
                const pItems = s.items.map(item => `<div class="font-medium text-slate-700">${item.description} <span class="text-slate-400">(x${item.quantity})</span></div>`).join('');
                const notesStr = s.notes ? `<div class="text-[9px] text-amber-600 mt-1 italic">Obs: ${s.notes}</div>` : '';
                const refStr = s.bank || s.reference ? `<div class="text-[9px] text-slate-400 mt-0.5">${s.bank || ''} ${s.reference ? '#' + s.reference : ''}</div>` : '';

                return `
                  <tr class="hover:bg-slate-50/40">
                    <td class="p-3 font-mono font-bold text-slate-900">${s.id.substring(0, 8)}...</td>
                    <td class="p-3 text-slate-500">${new Date(s.date).toLocaleString('es-DO', { hour12: false })}</td>
                    <td class="p-3 font-semibold text-slate-700">${s.clientName || 'VENTA MOSTRADOR'}</td>
                    <td class="p-3">${pItems}${notesStr}</td>
                    <td class="p-2.5">
                      <span class="font-bold text-slate-700 text-[10px]">${s.paymentMethod}</span>
                      ${refStr}
                    </td>
                    <td class="p-3 text-right font-mono text-slate-500">${formatDOP(s.itbis)}</td>
                    <td class="p-3 text-right font-mono font-black text-slate-800">${formatDOP(s.total)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </section>
        ` : ''}

        ${filteredData.transactions.length > 0 ? `
        <section class="mb-8">
          <h2 class="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="w-2.5 h-2.5 bg-teal-600 rounded-full"></span> 4. DETALLE DE OTRAS TRANSACCIONES DE CAJA
          </h2>
          <table class="w-full text-left text-[11px] border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <thead>
              <tr class="bg-slate-900 text-white font-bold uppercase tracking-wider text-[9px] border-b border-slate-200">
                <th class="p-3">Fecha</th>
                <th class="p-3">Tipo</th>
                <th class="p-3">Categoría de Cuenta</th>
                <th class="p-3">Concepto Registrado / Motivo</th>
                <th class="p-3">Origen / Destinatario / Detalle</th>
                <th class="p-3 text-right">Monto Neto</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-600">
              ${filteredData.transactions.map(t => {
                let originName = '-';
                if (t.employeeId && employeeMap[t.employeeId]) {
                  originName = `<span class="font-bold text-purple-700">${employeeMap[t.employeeId]}</span>`;
                } else if (t.condominioId && condoMap[t.condominioId]) {
                  originName = `<span class="font-bold text-blue-700">${condoMap[t.condominioId]}</span>`;
                } else if (t.description) {
                  originName = t.description;
                }

                return `
                  <tr class="hover:bg-slate-50/40">
                    <td class="p-3 text-slate-500">${new Date(t.date).toLocaleDateString('es-DO')}</td>
                    <td class="p-3">
                      <span class="inline-block px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${t.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                        ${t.type === TransactionType.INCOME ? 'INGRESO' : 'EGRESO'}
                      </span>
                    </td>
                    <td class="p-3 font-semibold text-slate-700">${t.category}</td>
                    <td class="p-3 text-slate-700">
                      <div class="font-bold">${t.concept}</div>
                      ${t.description ? `<div class="text-[9px] text-slate-400 italic">${t.description}</div>` : ''}
                    </td>
                    <td class="p-3 text-slate-600">${originName}</td>
                    <td class="p-3 text-right font-mono font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-500'}">
                      ${formatDOP(t.amount)}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </section>
        ` : ''}

        <div class="mt-20 flex justify-between gap-10 text-center text-xs">
          <div class="border-t border-slate-300 pt-4 w-1/3">
            <p class="font-bold text-slate-800">Elaborado por:</p>
            <p class="text-slate-400 mt-2 text-[10px] font-medium tracking-wide uppercase">Firma Responsable Caja</p>
          </div>
          <div class="border-t border-slate-300 pt-4 w-1/3">
            <p class="font-bold text-slate-800">Revisado por:</p>
            <p class="text-slate-400 mt-2 text-[10px] font-medium tracking-wide uppercase">Auditor / Administración</p>
          </div>
          <div class="border-t border-slate-300 pt-4 w-1/3">
            <p class="font-bold text-slate-800">Recibido por:</p>
            <p class="text-slate-400 mt-2 text-[10px] font-medium tracking-wide uppercase">Firma del Presidente / Supervisor</p>
          </div>
        </div>

        <script>
          window.focus();
          setTimeout(() => {
            window.print();
          }, 350);
        </script>
      </body>
      </html>
    `;

    printableWindow.document.write(htmlContent);
    printableWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* Upper Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 print:hidden">
        <div className="flex gap-4">
          <button
            onClick={() => {
              setCorteMode('abierto');
              setSelectedHistoricalCorte(null);
            }}
            className={`pb-3 text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              corteMode === 'abierto'
                ? 'border-blue-600 text-blue-600 shadow-b-sm'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen size={16} /> Turno Actual (Abierto)
          </button>
          <button
            onClick={() => {
              setCorteMode('historial');
              setSelectedHistoricalCorte(null);
            }}
            className={`pb-3 text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              corteMode === 'historial' && !selectedHistoricalCorte
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <History size={16} /> Historial de Cortes ({cortes.length})
          </button>
        </div>

        {corteMode === 'abierto' && (
          <button
            onClick={() => setIsCorteModalOpen(true)}
            className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm shadow-emerald-200"
          >
            <PlusCircle size={15} /> Hacer Corte Hoy
          </button>
        )}
      </div>

      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 shadow-md animate-in fade-in duration-300">
          <CheckCircle2 className="text-emerald-500 animate-bounce" size={20} />
          <span className="font-bold text-xs uppercase tracking-wider">{saveSuccessMessage}</span>
        </div>
      )}

      {/* Historical selection header */}
      {selectedHistoricalCorte && (
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Viendo Reporte de Corte Cerrado</h4>
              <p className="text-xs text-slate-500 font-medium">
                Corte ID: <span className="font-bold font-mono text-blue-600">{selectedHistoricalCorte.id}</span> • Realizado por: <span className="font-bold">{selectedHistoricalCorte.closedBy}</span> el {new Date(selectedHistoricalCorte.date).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedHistoricalCorte(null)}
            className="h-9 px-4 bg-white hover:bg-slate-100 border border-blue-200 text-blue-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft size={14} /> Volver al Historial
          </button>
        </div>
      )}

      {/* Main Panel logic depending on CorteMode and SelectedHistoricalCorte */}
      {corteMode === 'historial' && !selectedHistoricalCorte ? (
        /* Historial List UI */
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Registro General de Cortes</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Historial acumulativo de cierres financieros de caja</p>
            </div>
          </div>

          {cortes.length === 0 ? (
            <div className="text-center py-16 text-slate-400 flex flex-col items-center justify-center gap-3">
              <AlertCircle size={40} className="text-slate-300" />
              <p className="font-black uppercase tracking-wider text-xs">No hay cortes de caja guardados todavía.</p>
              <p className="text-xs text-slate-400 max-w-sm normal-case font-medium text-center">
                Cuando hagas cortes usando el botón "Hacer Corte Hoy" en el Turno Actual, se archivarán en esta sección para auditar y reimprimir cuando desees.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[10px] border-b border-slate-100">
                    <th className="p-4">Fecha y Hora</th>
                    <th className="p-4">Cajero / Admin</th>
                    <th className="p-4 text-right">Cant. Ventas</th>
                    <th className="p-4 text-right">Ventas Totales</th>
                    <th className="p-4 text-right">Efectivo Esperado</th>
                    <th className="p-4 text-right">Efectivo Reportado</th>
                    <th className="p-4 text-right">Diferencia</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700 font-sans">
                  {cortes.map((c) => {
                    const diffColor = c.difference < 0 ? 'text-rose-600 bg-rose-50' : c.difference > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-50';
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-slate-800 font-bold">
                          {new Date(c.date).toLocaleString('es-DO')}
                        </td>
                        <td className="p-4 text-slate-500">
                          {c.closedBy}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-400 font-semibold">
                          {c.salesCount} vts
                        </td>
                        <td className="p-4 text-right font-mono font-black text-slate-800">
                          ${c.totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-500 font-semibold">
                          ${c.cashExpected.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-800">
                          ${c.cashReported.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black font-mono ${diffColor}`}>
                            {c.difference > 0 ? '+' : ''}${c.difference.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedHistoricalCorte(c);
                            }}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black text-[9px] uppercase tracking-wide rounded-lg transition-all"
                          >
                            Ver Reporte
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Report View (Active Shift or Selected Historical Corte) */
        <>
          {/* File summary and filters panel */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-200 print:bg-slate-900 print:text-white print:shadow-none">
                   <BarChart3 size={28} />
                 </div>
                 <div>
                   <h2 className="text-2xl font-black text-slate-800 italic uppercase">
                     {selectedHistoricalCorte ? 'Corte de Caja Cerrado' : 'Turno de Caja Abierto'}
                   </h2>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest print:hidden">
                     {selectedHistoricalCorte ? 'Estadísticas finales consolidadas' : 'Cuentas activas acumuladas en el turno de trabajo'}
                   </p>
                   <p className="text-xs font-bold text-slate-600 uppercase tracking-widest hidden print:block">Período: {startDate} al {endDate}</p>
                 </div>
              </div>

              <div className="flex flex-wrap gap-3 print:hidden">
                 <button onClick={handlePrint} className="h-12 px-6 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all flex items-center gap-2 shadow-sm">
                    <Printer size={16} /> Imprimir original
                 </button>
                 <button onClick={exportPDF} className="h-12 px-6 bg-rose-50 hover:bg-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 transition-all flex items-center gap-2 shadow-sm border border-rose-100">
                    <FileText size={16} /> Exportar PDF
                 </button>
                 <button onClick={exportExcel} className="h-12 px-6 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600 transition-all flex items-center gap-2 shadow-sm border border-emerald-100">
                    <FileSpreadsheet size={16} /> Exportar Excel
                 </button>
              </div>
            </div>

            {/* Date selectors are only shown in OPEN/ACTIVO mode */}
            {corteMode === 'abierto' && (
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 pt-8 border-t border-slate-100 print:hidden animate-in fade-in duration-300">
                <div className="xl:col-span-2 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Filter size={12} /> Filtros de Fecha del Turno Abierto
                  </h4>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                     <div className="relative w-full">
                       <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input 
                         type="date" 
                         value={startDate}
                         onChange={(e) => setStartDate(e.target.value)}
                         className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-700 outline-none focus:border-blue-500/30 transition-all"
                       />
                     </div>
                     <span className="text-slate-300 font-black">-</span>
                     <div className="relative w-full">
                       <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input 
                         type="date" 
                         value={endDate}
                         onChange={(e) => setEndDate(e.target.value)}
                         className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-700 outline-none focus:border-blue-500/30 transition-all"
                       />
                     </div>
                  </div>
                </div>

                <div className="xl:col-span-2 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock size={12} /> Periodos Predefinidos
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'Diario', onClick: () => setRange(0) },
                      { label: 'Semanal', onClick: () => setRange(7) },
                      { label: 'Quincenal', onClick: setFortnightRange },
                      { label: 'Mensual', onClick: setMonthRange },
                      { label: 'Trimestral', onClick: () => setRange(90) },
                      { label: 'Semestral', onClick: () => setRange(180) },
                      { label: 'Anual', onClick: setAnnualRange }
                    ].map((period) => (
                      <button 
                        key={period.label}
                        onClick={period.onClick}
                        className="h-10 px-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-tight text-slate-500 transition-all border border-slate-200"
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {/* Income Card */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
               <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <TrendingUp size={24} />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-md">Entradas</span>
                  </div>
               </div>
               <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ingresos Totales</p>
                  <h3 className="text-3xl font-black text-slate-800 font-mono tracking-tighter">${stats.totalRevenue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</h3>
               </div>
               <div className="pt-4 border-t border-slate-50 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">De Ventas ({stats.salesCount})</span>
                    <span className="text-slate-700 font-mono">${stats.totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">De Otros ({stats.incomeCount})</span>
                    <span className="text-slate-700 font-mono">${stats.totalOtherIncome.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
            </div>

            {/* Expense Card */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
               <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <TrendingDown size={24} />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest bg-rose-50 px-2 py-1 rounded-md">Salidas</span>
                  </div>
               </div>
               <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Egresos Totales</p>
                  <h3 className="text-3xl font-black text-slate-800 font-mono tracking-tighter">${stats.totalCosts.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</h3>
               </div>
               <div className="pt-4 border-t border-slate-50 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Costo Mercancía</span>
                    <span className="text-slate-700 font-mono">${stats.totalCOGS.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Gasto Operativo</span>
                    <span className="text-slate-700 font-mono">${stats.totalExpenses.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
            </div>

            {/* Profit Card */}
            <div className="bg-blue-600 p-8 rounded-3xl border border-blue-500 shadow-xl shadow-blue-100 space-y-6 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-110 transition-transform duration-500" />
               <div className="relative z-1 space-y-6">
                  <div className="flex justify-between items-start">
                     <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center">
                       <Wallet size={24} />
                     </div>
                     <div className="text-right">
                       <span className="text-[10px] font-black text-white uppercase tracking-widest border border-white/20 px-2 py-1 rounded-md">Utilidad</span>
                     </div>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-1">Margen de Ganancia</p>
                     <h3 className="text-3xl font-black text-white font-mono tracking-tighter">${stats.netProfit.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex items-end justify-between">
                     <div>
                       <span className="text-[9px] font-black text-blue-200 uppercase tracking-widest block mb-1">Porcentaje</span>
                       <span className="text-2xl font-black text-white font-mono">{stats.marginPercent.toFixed(1)}%</span>
                     </div>
                     <div className={`flex items-center gap-1 ${stats.marginPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        <TrendingUp size={16} />
                     </div>
                  </div>
               </div>
            </div>

            {/* Summary / Difference Card */}
            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6 relative text-white">
               <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 text-blue-400 flex items-center justify-center">
                    <ArrowRightLeft size={24} />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-md">
                      {selectedHistoricalCorte ? 'Cuadre' : 'Cuentas'}
                    </span>
                  </div>
               </div>
               
               {selectedHistoricalCorte ? (
                 <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Efectivo Esperado</span>
                       <span className="text-xs font-mono font-bold">${selectedHistoricalCorte.cashExpected.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Efectivo Reportado</span>
                       <span className="text-xs font-mono font-bold">${selectedHistoricalCorte.cashReported.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Diferencia</span>
                       <span className={`text-sm font-mono font-black ${selectedHistoricalCorte.difference < 0 ? 'text-rose-400' : selectedHistoricalCorte.difference > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                         {selectedHistoricalCorte.difference > 0 ? '+' : ''}${selectedHistoricalCorte.difference.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                       </span>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Movimientos</span>
                       <span className="text-lg font-black font-mono">{stats.salesCount + stats.incomeCount + stats.expenseCount}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Efectivo Esperado</span>
                       <span className="text-sm font-black font-mono text-emerald-400">${expectedCashCalculated.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <a href="#transaction-details-section" className="flex items-center gap-2 pt-2 text-blue-400 group cursor-pointer">
                       <span className="text-[10px] font-black uppercase tracking-widest">Ver Detalles Completos</span>
                       <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </a>
                 </div>
               )}
            </div>
          </div>

          {/* Detailed Transaction table view */}
          <div id="transaction-details-section" className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 scroll-mt-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Desglose Detallado de Transacciones</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Verificación de origen, motivo e ítems facturados</p>
              </div>
              <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveDetailTab('ventas')}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    activeDetailTab === 'ventas'
                      ? 'bg-white text-slate-800 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-900 font-bold'
                  }`}
                >
                  Ventas / Facturas ({filteredData.sales.length})
                </button>
                <button
                  onClick={() => setActiveDetailTab('otras')}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    activeDetailTab === 'otras'
                      ? 'bg-white text-slate-800 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-900 font-bold'
                  }`}
                >
                  Otras Operaciones ({filteredData.transactions.length})
                </button>
              </div>
            </div>

            {activeDetailTab === 'ventas' ? (
              filteredData.sales.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
                  No hay ventas registradas en este período.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[10px] border-b border-slate-100">
                        <th className="p-4">Factura</th>
                        <th className="p-4">Fecha / Hora</th>
                        <th className="p-4">Cliente / Origen</th>
                        <th className="p-4">Productos Vendidos (Detalles / Motivo)</th>
                        <th className="p-4">Método / Banco</th>
                        <th className="p-4 text-right">ITBIS</th>
                        <th className="p-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700 font-sans">
                      {filteredData.sales.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-mono text-blue-600">#{s.id.substring(0, 8)}</td>
                          <td className="p-4 text-slate-400 font-semibold font-mono">
                            {new Date(s.date).toLocaleString('es-DO', { hour12: false })}
                          </td>
                          <td className="p-4 font-black text-slate-800">
                            {s.clientName || 'VENTA MOSTRADOR'}
                          </td>
                          <td className="p-4 space-y-1">
                            {s.items.map((item, idx) => (
                              <div key={idx} className="text-xs text-slate-600 font-medium">
                                {item.description} <span className="text-slate-400 font-bold">(x{item.quantity})</span>
                              </div>
                            ))}
                            {s.notes && (
                              <div className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 inline-block font-medium">
                                Obs: {s.notes}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md text-[10px] uppercase font-black">
                              {s.paymentMethod}
                            </span>
                            {(s.bank || s.reference) && (
                              <div className="text-[10px] text-slate-400 font-medium mt-1">
                                {s.bank && `Banco: ${s.bank}`} {s.reference && `[Ref: ${s.reference}]`}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono text-slate-500">
                            ${s.itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-right font-mono font-black text-slate-800">
                            ${s.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              filteredData.transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
                  No hay otras operaciones registradas en este período.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[10px] border-b border-slate-100">
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Categoría</th>
                        <th className="p-4">Concepto / Motivo</th>
                        <th className="p-4">Origen / Beneficiario</th>
                        <th className="p-4 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700 font-sans">
                      {filteredData.transactions.map((t) => {
                        let originName: React.ReactNode = <span className="text-slate-400 font-medium">-</span>;
                        if (t.employeeId && employeeMap[t.employeeId]) {
                          originName = <span className="text-purple-600 font-black">Emp: {employeeMap[t.employeeId]}</span>;
                        } else if (t.condominioId && condoMap[t.condominioId]) {
                          originName = <span className="text-blue-600 font-black">Condo: {condoMap[t.condominioId]}</span>;
                        } else if (t.description) {
                          originName = <span className="text-slate-600 font-semibold">{t.description}</span>;
                        }

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 text-slate-400 font-semibold font-mono">
                              {new Date(t.date).toLocaleDateString('es-DO')}
                            </td>
                            <td className="p-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                t.type === TransactionType.INCOME 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}>
                                {t.type === TransactionType.INCOME ? 'INGRESO' : 'EGRESO'}
                              </span>
                            </td>
                            <td className="p-4 font-black uppercase tracking-wider text-slate-400 text-[10px]">
                              {t.category}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-slate-800">{t.concept}</div>
                              {t.description && (
                                <div className="text-[10px] text-slate-400 font-medium italic mt-0.5">{t.description}</div>
                              )}
                            </td>
                            <td className="p-4">
                              {originName}
                            </td>
                            <td className={`p-4 text-right font-mono font-black ${
                              t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              ${t.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* Modern Dialog overlay modal for HACER CORTE HOY */}
      {isCorteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-250">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full border border-slate-100 shadow-2xl relative space-y-6 flex flex-col justify-between max-h-[90vh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-250">
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase">Hacer Corte de Turno</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Cierre de caja y conciliación física</p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs font-bold uppercase tracking-wide">
                <div className="flex justify-between text-slate-500">
                  <span>Facturas pendientes:</span>
                  <span className="font-mono text-slate-800">{sales.filter(s => !s.corteId).length}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Otras transacciones pend:</span>
                  <span className="font-mono text-slate-800">{transactions.filter(t => !t.corteId).length}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-slate-800 text-sm font-black">
                  <span>Efectivo Total Esperado:</span>
                  <span className="font-mono text-emerald-600">${expectedCashCalculated.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <p className="text-[10px] text-slate-400 italic font-medium pt-1 lowercase tracking-normal">
                  * El efectivo esperado incluye ventas en efectivo + ingresos directos - gastos pagados.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Efectivo Real en Caja (Físico)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 font-mono text-sm">RD$</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={reportedCash}
                      onChange={(e) => setReportedCash(e.target.value)}
                      className="w-full h-14 pl-14 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-base font-black text-slate-800 outline-none focus:border-emerald-500/30 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Observaciones / Notas de Cierre
                  </label>
                  <textarea
                    placeholder="Escribe comentarios sobre desajustes o notas de facturación de este turno acá..."
                    value={notesCorte}
                    onChange={(e) => setNotesCorte(e.target.value)}
                    rows={3}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold tracking-tight text-slate-700 outline-none focus:border-emerald-500/30 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 col-span-2">
              <button
                onClick={() => {
                  setIsCorteModalOpen(false);
                  setReportedCash('');
                  setNotesCorte('');
                }}
                className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all"
              >
                Cancelar Cierre
              </button>
              <button
                onClick={handleDoCorte}
                className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100"
              >
                Confirmar Corte Hoy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
