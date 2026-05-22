import React, { useState, useMemo } from "react";
import { Recibo, TicketSettings } from "../types";
import { 
  Search, 
  Calendar, 
  Filter, 
  Printer, 
  Download, 
  Eye, 
  Trash2, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  User, 
  Building, 
  ShoppingBag, 
  CalendarDays,
  X,
  FileText,
  BadgeAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

interface DailyReportViewProps {
  receipts: Recibo[];
  setReceipts: React.Dispatch<React.SetStateAction<Recibo[]>>;
  ticketSettings: TicketSettings;
  onPrintReceipt: (receipt: Recibo) => void;
}

export default function DailyReportView({
  receipts,
  setReceipts,
  ticketSettings,
  onPrintReceipt
}: DailyReportViewProps) {
  // Safe default to today's date in local time
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [dateFilter, setDateFilter] = useState<string>(getTodayDateString());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedReceiptForModal, setSelectedReceiptForModal] = useState<Recibo | null>(null);

  // Filter receipts logic
  const filteredReceipts = useMemo(() => {
    return receipts.filter((rec) => {
      // 1. Filter by specific date if set
      if (dateFilter && rec.fecha !== dateFilter) {
        return false;
      }

      // 2. Filter by type
      if (typeFilter !== "all" && rec.tipo !== typeFilter) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesSeq = rec.sequence.toLowerCase().includes(query);
        const matchesConcept = rec.concepto.toLowerCase().includes(query);
        const matchesBeneficiary = rec.beneficiario.toLowerCase().includes(query);
        const matchesDesc = rec.descripcion ? rec.descripcion.toLowerCase().includes(query) : false;

        return matchesSeq || matchesConcept || matchesBeneficiary || matchesDesc;
      }

      return true;
    });
  }, [receipts, dateFilter, typeFilter, searchQuery]);

  // Totals calculations
  const stats = useMemo(() => {
    let incomeTotal = 0;
    let expenseTotal = 0;
    let payrollTotal = 0;
    let saleTotal = 0;

    filteredReceipts.forEach((r) => {
      if (r.tipo === "ingreso") incomeTotal += r.monto;
      else if (r.tipo === "egreso") expenseTotal += r.monto;
      else if (r.tipo === "nomina") payrollTotal += r.monto;
      else if (r.tipo === "venta") saleTotal += r.monto;
      else if (r.tipo === "pago_mantenimiento") incomeTotal += r.monto;
    });

    const netCashflow = (incomeTotal + saleTotal) - (expenseTotal + payrollTotal);

    return {
      incomeTotal,
      expenseTotal,
      payrollTotal,
      saleTotal,
      netCashflow,
      count: filteredReceipts.length
    };
  }, [filteredReceipts]);

  // Export to Excel function
  const handleExportExcel = () => {
    if (filteredReceipts.length === 0) return;

    const dataToExport = filteredReceipts.map((r) => ({
      Secuencia: r.sequence,
      Fecha: r.fecha,
      Tipo: r.tipo.toUpperCase(),
      Concepto: r.concepto,
      Monto: r.monto,
      Beneficiario: r.beneficiario,
      Nota: r.descripcion || "",
      "Creado El": new Date(r.createdAt).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recibos Diarios");

    // Autofit column widths
    const maxLens = Object.keys(dataToExport[0]).map(() => 15);
    dataToExport.forEach((row) => {
      Object.values(row).forEach((val, colIdx) => {
        const len = String(val).length;
        if (len > maxLens[colIdx]) maxLens[colIdx] = len;
      });
    });
    worksheet["!cols"] = maxLens.map((w) => ({ wch: w + 2 }));

    XLSX.writeFile(workbook, `Reporte_Recibos_${dateFilter || "Todos"}.xlsx`);
  };

  // Generate general daily summary PDF
  const handleExportPDF = () => {
    if (filteredReceipts.length === 0) return;

    const doc = new jsPDF({
      unit: "mm",
      format: "letter",
    });

    const width = 215.9;
    let y = 15;

    // Header bar
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, width, 5, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);

    if (ticketSettings.showLogo && ticketSettings.logoUrl) {
      try {
        doc.addImage(ticketSettings.logoUrl, "JPEG", width / 2 - 12, y, 24, 24);
        y += 28;
      } catch (e) {
        console.error("Error adding logo to PDF", e);
      }
    }

    doc.text((ticketSettings.businessName || "SISTEMA DE GESTIÓN").toUpperCase(), width / 2, y, { align: "center" });
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    if (ticketSettings.address) {
      doc.text(ticketSettings.address, width / 2, y, { align: "center" });
      y += 5;
    }
    doc.text(`RNC: ${ticketSettings.rnc || "N/D"}  |  Tel: ${ticketSettings.phone || "N/D"}`, width / 2, y, { align: "center" });
    y += 10;

    // Report Info
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, width - 15, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(13, 148, 136);
    doc.text("REPORTE DIARIO DE CAJA Y TRANSACCIONES", 15, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Fecha del Reporte: ${dateFilter || "Todos los registros"}`, 15, y);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, width - 15, y, { align: "right" });
    y += 12;

    // Summary Statistics Block
    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, width - 30, 22, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y, width - 30, 22, "D");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("INGRESOS (+)", 25, y + 6);
    doc.text("VENTAS POS (+)", 65, y + 6);
    doc.text("EGRESOS (-)", 105, y + 6);
    doc.text("NÓMINA (-)", 145, y + 6);
    doc.text("NETO ABSOLUTO", 185, y + 6, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129); // Green
    doc.text(`RD$ ${stats.incomeTotal.toLocaleString("es-DO")}`, 25, y + 14);
    doc.text(`RD$ ${stats.saleTotal.toLocaleString("es-DO")}`, 65, y + 14);
    
    doc.setTextColor(239, 68, 68); // Red
    doc.text(`RD$ ${stats.expenseTotal.toLocaleString("es-DO")}`, 105, y + 14);
    doc.text(`RD$ ${stats.payrollTotal.toLocaleString("es-DO")}`, 145, y + 14);

    if (stats.netCashflow >= 0) {
      doc.setTextColor(16, 185, 129);
    } else {
      doc.setTextColor(239, 68, 68);
    }
    doc.text(`RD$ ${stats.netCashflow.toLocaleString("es-DO")}`, 185, y + 14, { align: "right" });
    y += 30;

    // Table of Receipts
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("SEC.", 16, y);
    doc.text("TIPO", 35, y);
    doc.text("CONCEPTO / DESCRIPCIÓN", 60, y);
    doc.text("BENEFICIARIO", 130, y);
    doc.text("MONTO", 200, y, { align: "right" });
    
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(15, y + 3, width - 15, y + 3);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    filteredReceipts.forEach((r, idx) => {
      // Check if page overflow
      if (y > 260) {
        doc.addPage();
        y = 20;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text("SEC.", 16, y);
        doc.text("TIPO", 35, y);
        doc.text("CONCEPTO / DESCRIPCIÓN", 60, y);
        doc.text("BENEFICIARIO", 130, y);
        doc.text("MONTO", 200, y, { align: "right" });
        doc.line(15, y + 3, width - 15, y + 3);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
      }

      doc.text(r.sequence, 16, y);
      
      const typeStr = r.tipo === "ingreso" ? "INGRESO" : r.tipo === "egreso" ? "EGRESO" : r.tipo === "nomina" ? "NÓMINA" : r.tipo === "venta" ? "VENTA POS" : "MANTENIMIENTO";
      doc.text(typeStr, 35, y);

      const conceptStr = r.concepto.length > 35 ? `${r.concepto.substring(0, 32)}...` : r.concepto;
      doc.text(conceptStr, 60, y);

      const beneStr = r.beneficiario.length > 35 ? `${r.beneficiario.substring(0, 32)}...` : r.beneficiario;
      doc.text(beneStr, 130, y);

      doc.text(`RD$ ${r.monto.toLocaleString("es-DO")}`, 200, y, { align: "right" });
      
      // Draw subline
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y + 2.5, width - 15, y + 2.5);
      y += 6.5;
    });

    y += 15;
    // Sign line
    if (y > 250) {
      doc.addPage();
      y = 30;
    }

    doc.setDrawColor(148, 163, 184);
    doc.line(width / 2 - 35, y, width / 2 + 35, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Firma de Cajero / Supervisor Autorizado", width / 2, y + 4, { align: "center" });

    doc.save(`Reporte_Caja_${dateFilter || "Historico"}.pdf`);
  };

  const handleDeleteReceiptConfirm = (id: string) => {
    if (confirm("¿Está seguro que desea eliminar este recibo del archivo del sistema?")) {
      setReceipts((prev) => prev.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions Panel */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <CalendarDays className="text-teal-600" size={20} />
              Archivo de Recibos y Reporte Diario
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Visualice, imprima y exporte los comprobantes emitidos en el sistema.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportPDF}
              disabled={filteredReceipts.length === 0}
              className={`h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                filteredReceipts.length === 0
                  ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                  : "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
              }`}
            >
              <Printer size={14} />
              Imprimir Reporte
            </button>
            <button
              onClick={handleExportExcel}
              disabled={filteredReceipts.length === 0}
              className={`h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                filteredReceipts.length === 0
                  ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <FileSpreadsheet size={14} />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Filters control block */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          {/* Date Selector */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              Filtrar por Fecha
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Type Selector */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              Tipo de Comprobante
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-teal-500 focus:bg-white transition-all appearance-none"
              >
                <option value="all">Todos los comprobantes</option>
                <option value="ingreso">Ingresos / Cobros</option>
                <option value="egreso">Gastos / Egresos Directos</option>
                <option value="nomina">Nóminas / Sueldos</option>
                <option value="venta">Ventas POS (Productos / Tienda)</option>
              </select>
            </div>
          </div>

          {/* Search query */}
          <div className="md:col-span-2 space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              Búsqueda Rápida
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Busque por secuencia (e.g. REC-0001), concepto o colaborador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Clear filters trigger */}
        {(dateFilter || typeFilter !== "all" || searchQuery) && (
          <div className="flex justify-start">
            <button
              onClick={() => {
                setDateFilter("");
                setTypeFilter("all");
                setSearchQuery("");
              }}
              className="text-[10px] font-black text-teal-600 hover:text-teal-800 uppercase tracking-wider flex items-center gap-1 transition-all"
            >
              <X size={12} />
              Limpiar todos los filtros y ver todo el histórico
            </button>
          </div>
        )}
      </div>

      {/* Grid of calculations / stats for the day */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Incomes */}
        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">INGRESOS DE CAJA</span>
            <span className="text-lg font-black text-slate-800 mt-1 block">
              RD$ {(stats.incomeTotal + stats.saleTotal).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">
              Includes {stats.count} Transacciones
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Total Expenses / Margins */}
        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">EGRESOS & COMPRAS</span>
            <span className="text-lg font-black text-slate-800 mt-1 block text-rose-600">
              RD$ {stats.expenseTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Módulos de egresos directos</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
            <TrendingDown size={18} />
          </div>
        </div>

        {/* Payroll Out */}
        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">NÓMINAS EMITIDAS</span>
            <span className="text-lg font-black text-slate-800 mt-1 block text-purple-600">
              RD$ {stats.payrollTotal.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] font-bold text-purple-500 block mt-0.5">Pagos a colaboradores</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
            <User size={18} />
          </div>
        </div>

        {/* Net cash for day */}
        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">CAJA NETO DEL PERÍODO</span>
            <span className={`text-lg font-black mt-1 block ${stats.netCashflow >= 0 ? "text-teal-600" : "text-rose-600"}`}>
              RD$ {stats.netCashflow.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Resultado neto</span>
          </div>
          <div className={`p-3 rounded-xl ${stats.netCashflow >= 0 ? "bg-teal-50 text-teal-600" : "bg-rose-50 text-rose-600"}`}>
            <DollarSign size={18} />
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
            Listado de Recibos ({filteredReceipts.length} encontrados)
          </h4>
          <span className="text-xs font-bold text-slate-400">
            {dateFilter ? `Fecha: ${dateFilter}` : "Todos los tiempos"}
          </span>
        </div>

        {filteredReceipts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Secuencia</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Concepto</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Beneficiario / Cliente</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Monto</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 text-xs font-black text-slate-700 font-mono">
                      {rec.sequence}
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-500">
                      {rec.fecha}
                    </td>
                    <td className="p-4 text-xs">
                      {rec.tipo === "ingreso" && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                          INGRESO
                        </span>
                      )}
                      {rec.tipo === "egreso" && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-100">
                          EGRESO
                        </span>
                      )}
                      {rec.tipo === "nomina" && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-100">
                          NÓMINA
                        </span>
                      )}
                      {rec.tipo === "venta" && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100">
                          VENTA POS
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-800">
                      <div>
                        {rec.concepto}
                        {rec.descripcion && (
                          <div className="text-[10px] font-normal text-slate-400 mt-0.5 italic">
                            {rec.descripcion}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-600">
                      {rec.beneficiario}
                    </td>
                    <td className="p-4 text-xs font-black text-slate-800 text-right font-mono">
                      RD$ {rec.monto.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-xs text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedReceiptForModal(rec)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all"
                          title="Visualizar Comprobante"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => onPrintReceipt(rec)}
                          className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 hover:text-teal-800 transition-all"
                          title="Descargar PDF"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteReceiptConfirm(rec.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all"
                          title="Eliminar Registro"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3 border border-slate-100">
              <FileText size={20} />
            </div>
            <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">No se encontraron recibos</h5>
            <p className="text-[11px] font-bold text-slate-400 mt-1 max-w-sm mx-auto">
              {dateFilter 
                ? `No se emitieron comprobantes en la fecha ${dateFilter}. Intente seleccionando otro día o borre el filtro para ver todo el archivo.`
                : "No se han emitido transacciones ni comprobantes aún en el sistema de caja."
              }
            </p>
          </div>
        )}
      </div>

      {/* Receipt Details Dialog / Thermal Mockup */}
      <AnimatePresence>
        {selectedReceiptForModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-100 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="bg-slate-800 text-white p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black tracking-widest uppercase text-slate-400">Detalles de Comprobante</h3>
                  <span className="text-sm font-black font-mono text-teal-400">{selectedReceiptForModal.sequence}</span>
                </div>
                <button
                  onClick={() => setSelectedReceiptForModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Virtual Receipt Paper representation */}
              <div className="p-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4 font-sans relative">
                  {/* Jagged border representation */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-[radial-gradient(circle,transparent_20%,#f1f5f9_20%,#f1f5f9_30%,transparent_30%)] bg-[length:8px_8px] -translate-y-1"></div>

                  <div className="text-center pb-4 border-b border-dashed border-slate-200">
                    {ticketSettings.showLogo && ticketSettings.logoUrl && (
                      <div className="flex justify-center mb-3">
                        <img 
                          src={ticketSettings.logoUrl} 
                          alt="Logo de la empresa" 
                          className="h-12 w-auto object-contain max-h-12 rounded"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      {ticketSettings.businessName || "SISTEMA DE GESTIÓN"}
                    </h4>
                    {ticketSettings.address && (
                      <p className="text-[10px] text-slate-400 mt-1">{ticketSettings.address}</p>
                    )}
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                      Tel: {ticketSettings.phone || "N/A"} | RNC: {ticketSettings.rnc || "N/A"}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Comprobante:</span>
                      <span className="font-extrabold text-slate-700">
                        {selectedReceiptForModal.tipo === "ingreso" && "INGRESO"}
                        {selectedReceiptForModal.tipo === "egreso" && "EGRESO"}
                        {selectedReceiptForModal.tipo === "nomina" && "PAGO NÓMINA"}
                        {selectedReceiptForModal.tipo === "venta" && "VENTA POS"}
                        {selectedReceiptForModal.tipo === "pago_mantenimiento" && "PAGO MANT."}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Fecha Emisión:</span>
                      <span className="font-bold text-slate-700">{selectedReceiptForModal.fecha}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Beneficiario:</span>
                      <span className="font-bold text-slate-700 text-right max-w-[200px] truncate">{selectedReceiptForModal.beneficiario}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Detalle de Caja</span>
                    <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-xs font-bold text-slate-600 max-w-[240px] truncate">{selectedReceiptForModal.concepto}</span>
                      <span className="text-xs font-mono font-black text-slate-800">
                        RD$ {selectedReceiptForModal.monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {selectedReceiptForModal.descripcion && (
                    <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 text-[10px] text-amber-700 font-bold leading-normal italic">
                      Nota: {selectedReceiptForModal.descripcion}
                    </div>
                  )}

                  <div className="border-t border-dashed border-slate-200 pt-4 text-center">
                    <span className="text-[14px] font-mono font-black text-teal-600 block">
                      TOTAL RD$ {selectedReceiptForModal.monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[8px] text-slate-400 block mt-2 font-black tracking-widest uppercase">
                      *** VALIDADO EN CAJA ***
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      onPrintReceipt(selectedReceiptForModal);
                    }}
                    className="flex-1 h-11 bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-teal-700 transition-all shadow-lg shadow-teal-200"
                  >
                    <Download size={14} />
                    Descargar en PDF
                  </button>
                  <button
                    onClick={() => onPrintReceipt(selectedReceiptForModal)}
                    className="h-11 px-4 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-900 transition-all border border-slate-700"
                  >
                    <Printer size={14} />
                    Imprimir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
