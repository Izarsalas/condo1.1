import React, { useState, useEffect, useMemo } from 'react';
import { 
  Flame, 
  History, 
  RotateCcw, 
  Info, 
  Plus, 
  Trash2, 
  Settings as SettingsIcon,
  Minus,
  Calculator,
  Printer,
  Download,
  Share2,
  X,
  Check,
  FileDown,
  Send,
  Search,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { GasRate, CalculationResult, Condominio, Unidad, Transaction, TransactionType } from '../types';
import { storage } from '../lib/storage';

const INITIAL_GAS_RATES: GasRate[] = [
  {
    id: 'glp-domestico',
    name: 'GLP Doméstico (Tanque)',
    pricePerGallon: 132.60,
    isCustom: false,
    lastUpdated: new Date().toISOString(),
  }
];

const STORAGE_KEY_GAS_RATES = 'gas_calc_dr_rates_v2';
const STORAGE_KEY_GAS_HISTORY = 'gas_calc_dr_history';

interface CalculatorViewProps {
  condos: Condominio[];
  units: Unidad[];
  onRegisterTransaction: (transaction: Omit<Transaction, 'id'>) => void;
}

export function CalculatorView({ condos, units, onRegisterTransaction }: CalculatorViewProps) {
  // ==========================================
  // STATE DEFINITIONS FOR: CALCULADORA DE GAS
  // ==========================================
  const [rates, setRates] = useState<GasRate[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_GAS_RATES);
    return saved ? JSON.parse(saved) : INITIAL_GAS_RATES;
  });

  const [history, setHistory] = useState<CalculationResult[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_GAS_HISTORY);
    return saved ? JSON.parse(saved) : [];
  });

  const [gallons, setGallons] = useState<string>('');
  const [gasInputMode, setGasInputMode] = useState<'gallons' | 'm3'>(() => {
    return (localStorage.getItem('gas_calc_input_mode') as 'gallons' | 'm3') || 'gallons';
  });
  const [m3Value, setM3Value] = useState<string>('');
  const [appliedCurrentReading, setAppliedCurrentReading] = useState<string>('');
  const [appliedPreviousReading, setAppliedPreviousReading] = useState<string>('');
  const gasConversionFactor = 1.2;

  const [selectedRateId, setSelectedRateId] = useState<string>(rates[0]?.id || '');
  const [selectedCondoId, setSelectedCondoId] = useState<string>(condos[0]?.id || '');

  // Filter units by selected condo (declared early for subtractor access)
  const filteredUnits = useMemo(() => 
    units.filter(u => u.condominioId === selectedCondoId),
    [units, selectedCondoId]
  );

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSubtractor, setShowSubtractor] = useState(false);

  // Subtractor states for cubic meters calculation
  const [currentReading, setCurrentReading] = useState<string>('');
  const [previousReading, setPreviousReading] = useState<string>('');

  const readingDifference = useMemo(() => {
    const current = parseFloat(currentReading);
    const previous = parseFloat(previousReading);
    if (isNaN(current) || isNaN(previous)) return null;
    return current - previous;
  }, [currentReading, previousReading]);

  // Subtractor unit selection and custom reading history
  const [subtractorUnitId, setSubtractorUnitId] = useState<string>('');
  const [subtractorSearchQuery, setSubtractorSearchQuery] = useState<string>('');
  const [isSubtractorDropdownOpen, setIsSubtractorDropdownOpen] = useState(false);

  const [unitLastReadings, setUnitLastReadings] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('gas_unit_last_readings');
    return saved ? JSON.parse(saved) : {};
  });

  const subtractorUnits = useMemo(() => {
    if (!subtractorSearchQuery.trim()) return filteredUnits;
    const query = subtractorSearchQuery.toLowerCase();
    return filteredUnits.filter(u => 
      (u.numero || '').toLowerCase().includes(query) || 
      (u.ownerName || '').toLowerCase().includes(query)
    );
  }, [filteredUnits, subtractorSearchQuery]);

  const selectedSubtractorUnit = useMemo(() => {
    return units.find(u => u.id === subtractorUnitId);
  }, [units, subtractorUnitId]);

  const handleSubtractorUnitSelect = (unitId: string) => {
    setSubtractorUnitId(unitId);
    setIsSubtractorDropdownOpen(false);
    setSubtractorSearchQuery('');
    
    const savedLastReading = unitLastReadings[unitId] || '';
    setPreviousReading(savedLastReading);
  };

  useEffect(() => {
    if (showSubtractor && selectedUnitId) {
      setSubtractorUnitId(selectedUnitId);
      const savedLastReading = unitLastReadings[selectedUnitId] || '';
      setPreviousReading(savedLastReading);
    }
  }, [showSubtractor, selectedUnitId]);

  // filteredUnits is declared early above to prevent compilation sequence warnings

  const searchableUnits = useMemo(() => {
    if (!unitSearchQuery.trim()) return filteredUnits;
    const query = unitSearchQuery.toLowerCase();
    return filteredUnits.filter(u => 
      (u.numero || '').toLowerCase().includes(query) || 
      (u.ownerName || '').toLowerCase().includes(query)
    );
  }, [filteredUnits, unitSearchQuery]);

  const selectedUnitForDisplay = useMemo(() => {
    return units.find(u => u.id === selectedUnitId);
  }, [units, selectedUnitId]);

  // Reset selected unit if condo changes
  useEffect(() => {
    setSelectedUnitId('');
    setUnitSearchQuery('');
    setIsUnitDropdownOpen(false);
  }, [selectedCondoId]);

  // Rate form state
  const [isAddingRate, setIsAddingRate] = useState(false);
  const [newRate, setNewRate] = useState<Partial<GasRate>>({
    name: '',
    pricePerGallon: 0
  });

  // Premium receipt & sharing states
  const [activeReceipt, setActiveReceipt] = useState<CalculationResult | null>(null);
  const [receiptWhatsappPhone, setReceiptWhatsappPhone] = useState<string>('');

  useEffect(() => {
    if (activeReceipt && activeReceipt.unidadId) {
      const selectedUnit = units.find(u => u.id === activeReceipt.unidadId);
      if (selectedUnit) {
        setReceiptWhatsappPhone(selectedUnit.whatsapp || '');
      } else {
        setReceiptWhatsappPhone('');
      }
    } else {
      setReceiptWhatsappPhone('');
    }
  }, [activeReceipt, units]);

  // Saving settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GAS_RATES, JSON.stringify(rates));
  }, [rates]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GAS_HISTORY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('gas_calc_input_mode', gasInputMode);
  }, [gasInputMode]);

  // Calculations
  const selectedRate = useMemo(() => 
    rates.find(r => r.id === selectedRateId), 
    [rates, selectedRateId]
  );

  const calculatedGallonsValue = useMemo(() => {
    if (gasInputMode === 'm3') {
      const m3 = parseFloat(m3Value) || 0;
      return m3 * gasConversionFactor;
    }
    return parseFloat(gallons) || 0;
  }, [gasInputMode, m3Value, gallons, gasConversionFactor]);

  const total = useMemo(() => {
    const qty = calculatedGallonsValue;
    const price = selectedRate?.pricePerGallon || 0;
    return qty * price;
  }, [calculatedGallonsValue, selectedRate]);

  // Gas handlers
  const handleCalculateGas = () => {
    const qty = calculatedGallonsValue;
    if (qty <= 0 || !selectedRate) return;

    const selectedUnit = filteredUnits.find(u => u.id === selectedUnitId);

    const result: CalculationResult = {
      gallons: qty,
      rate: selectedRate,
      total: total,
      date: new Date().toLocaleString('es-DO', { 
        timeZone: 'America/Santo_Domingo' 
      }),
      condoId: selectedCondoId,
      unidadId: selectedUnitId,
      unitNumber: selectedUnit?.numero,
      m3: gasInputMode === 'm3' ? parseFloat(m3Value) : undefined,
      conversionFactor: gasInputMode === 'm3' ? gasConversionFactor : undefined,
      lecturaActual: gasInputMode === 'm3' && appliedCurrentReading ? parseFloat(appliedCurrentReading) : undefined,
      lecturaAnterior: gasInputMode === 'm3' && appliedPreviousReading ? parseFloat(appliedPreviousReading) : undefined,
    };

    setHistory([result, ...history].slice(0, 50));
    setActiveReceipt(result);

    // If unit is selected, register transaction
    if (selectedUnitId) {
      let gSourceStr = '';
      if (gasInputMode === 'm3') {
        if (appliedCurrentReading && appliedPreviousReading) {
          gSourceStr = ` (${parseFloat(m3Value).toFixed(2)} m³ [Lecturas: ${parseFloat(appliedCurrentReading).toFixed(2)} - ${parseFloat(appliedPreviousReading).toFixed(2)}] @ x${gasConversionFactor.toFixed(2)} factor)`;
        } else {
          gSourceStr = ` (${parseFloat(m3Value).toFixed(2)} m³ @ x${gasConversionFactor.toFixed(2)} factor)`;
        }
      }

      onRegisterTransaction({
        condominioId: selectedCondoId,
        type: TransactionType.INCOME,
        category: 'INGRESOS ORDINARIOS',
        concept: 'Consumo de Gas',
        amount: total,
        date: new Date().toISOString(),
        description: `Gas: ${qty.toFixed(2)} GLS${gSourceStr} @ RD$ ${selectedRate.pricePerGallon.toFixed(2)} - Unidad ${selectedUnit?.numero}`,
        m3: gasInputMode === 'm3' ? parseFloat(m3Value) : undefined,
        conversionFactor: gasInputMode === 'm3' ? gasConversionFactor : undefined,
        lecturaActual: gasInputMode === 'm3' && appliedCurrentReading ? parseFloat(appliedCurrentReading) : undefined,
        lecturaAnterior: gasInputMode === 'm3' && appliedPreviousReading ? parseFloat(appliedPreviousReading) : undefined,
        unidadId: selectedUnitId
      });
      
      setM3Value('');
      setGallons('');
      setAppliedCurrentReading('');
      setAppliedPreviousReading('');
      setSelectedUnitId('');
    }
  };

  const clearGasInputs = () => {
    setGallons('');
    setM3Value('');
    setAppliedCurrentReading('');
    setAppliedPreviousReading('');
  };

  // Receipt Actions: PDF, Print, WhatsApp
  const handleDownloadPDF = (receipt: CalculationResult) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const width = 215.9; // Letter width in mm
      let y = 15;

      const currentSettings = storage.getTicketSettings();
      const bizName = currentSettings?.businessName || "SERVICIOS PROFESIONALES CARLOSMT";
      const address = currentSettings?.address || "Calle Principal #123, Sect";
      const phone = currentSettings?.phone || "809-555-0123";
      const rnc = currentSettings?.rnc || "101-23456-7";
      const logoUrl = currentSettings?.logoUrl;
      const showLogo = currentSettings?.showLogo;

      const condo = condos.find(c => c.id === receipt.condoId);
      const condoName = condo?.name || 'Brisas del Norte';
      const condoAddress = condo?.address || 'SANTIAGO DE LOS CABALLEROS';
      const unitNum = receipt.unitNumber || 'Sin Unidad';
      const selectedUnit = units.find(u => u.id === receipt.unidadId);
      const ownerName = selectedUnit?.ownerName || 'Propietario / Consumidor';

      // 1. Company Logo
      if (showLogo && logoUrl) {
        try {
          doc.addImage(logoUrl, 'JPEG', width / 2 - 18, y, 36, 24);
          y += 28;
        } catch (e) {
          console.error("Error drawing company logo:", e);
          y += 5;
        }
      } else {
        // Draw an elegant geometric logo to replicate corporate branding (building shapes in cyan/blue)
        doc.setDrawColor(37, 162, 218); // #25a2da
        doc.setFillColor(37, 162, 218);
        
        // Draw elegant modern building silhouettes on center top of page
        // Left Building
        doc.rect(width / 2 - 12, y + 2, 6, 15, 'F');
        // Center taller building with windows
        doc.rect(width / 2 - 4, y - 3, 8, 20, 'F');
        // Right building
        doc.rect(width / 2 + 6, y + 5, 6, 12, 'F');
        
        // Let's add some white accent lines/windows inside the tall building
        doc.setFillColor(255, 255, 255);
        doc.rect(width / 2 - 2, y + 1, 1.5, 2, 'F');
        doc.rect(width / 2 + 0.5, y + 1, 1.5, 2, 'F');
        doc.rect(width / 2 - 2, y + 5, 1.5, 2, 'F');
        doc.rect(width / 2 + 0.5, y + 5, 1.5, 2, 'F');
        doc.rect(width / 2 - 2, y + 9, 1.5, 2, 'F');
        doc.rect(width / 2 + 0.5, y + 9, 1.5, 2, 'F');
        doc.rect(width / 2 - 2, y + 13, 1.5, 2, 'F');
        doc.rect(width / 2 + 0.5, y + 13, 1.5, 2, 'F');
        
        y += 26;
      }

      // Title & Branding Text (exactly as CARLOSMT/Business Name in photo)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(37, 162, 218); // Elegant cyan brand color
      doc.text(bizName.toUpperCase(), width / 2, y, { align: 'center' });
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Administración de Junta de Condominio", width / 2, y, { align: 'center' });
      y += 4;

      if (address) {
        doc.text(address, width / 2, y, { align: 'center' });
        y += 4;
      }
      if (phone || rnc) {
        let contactStr = "";
        if (phone) contactStr += `Tel: ${phone}  `;
        if (rnc) contactStr += `RNC: ${rnc}`;
        doc.text(contactStr, width / 2, y, { align: 'center' });
        y += 5;
      }

      // Thick Cyan Separator Strip matching image
      doc.setFillColor(37, 162, 218);
      doc.rect(15, y, width - 30, 1.5, 'F');
      y += 8;

      // Residencial details Box (Left Aligned) & Receipt Details (Right Aligned)
      const detailsStartY = y;
      
      // Left details: Residencial Name & Apt
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("RESIDENCIAL", 15, y);
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(15, 23, 42); // slate-900
      const condoLabelFull = `${condoName.toUpperCase()}${condoAddress ? ` / ${condoAddress.toUpperCase()}` : ''}`;
      doc.text(condoLabelFull, 15, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("APTO", 15, y);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(unitNum.toUpperCase(), 32, y);

      // Save this coordinates base
      const textBaseY = y;

      // Real Dates calculation
      let dateStr = '';
      let timeStr = '';
      try {
        const d = new Date(receipt.date);
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().split('T')[0];
          timeStr = d.toTimeString().split(' ')[0];
        } else {
          dateStr = receipt.date.split(' ')[0] || receipt.date;
          timeStr = receipt.date.split(' ')[1] || '';
        }
      } catch (e) {
        dateStr = receipt.date;
      }

      // Dynamic REC- Sequence calculation
      let seq = 'REC-0001';
      try {
        const d = new Date(receipt.date);
        if (!isNaN(d.getTime())) {
          const yr = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const dy = String(d.getDate()).padStart(2, '0');
          const hr = String(d.getHours()).padStart(2, '0');
          const mn = String(d.getMinutes()).padStart(2, '0');
          seq = `REC-${yr}${mo}${dy}-${hr}${mn}`;
        }
      } catch (e) {
        seq = 'REC-0001';
      }

      // Right Column Content - Receipt header metadata right aligned
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(seq, width - 15, detailsStartY + 2, { align: 'right' });

      doc.setFontSize(10);
      doc.text(`Fecha de Emisión: ${dateStr}`, width - 15, detailsStartY + 7, { align: 'right' });
      if (timeStr) {
        doc.text(`HORA: ${timeStr}`, width - 15, detailsStartY + 12, { align: 'right' });
      }

      // Break to table block
      y = textBaseY + 10;

      // Table Header Blocks with cyan colors
      const cols = [
        { title: 'UNIDAD', x: 15, w: 22 },
        { title: 'DESCRIPCIÓN', x: 38.5, w: 46 },
        { title: 'CONSUMO ACTUAL', x: 86, w: 31 },
        { title: 'CONSUMO ANTERIOR', x: 118.5, w: 31 },
        { title: 'VALOR', x: 151, w: 24 },
        { title: 'TOTAL', x: 176.5, w: 24.4 },
      ];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255); // White text

      cols.forEach(col => {
        doc.setFillColor(37, 162, 218); // #25a2da
        doc.rect(col.x, y, col.w, 7.5, 'F');
        
        const textX = col.x + (col.w / 2);
        doc.text(col.title, textX, y + 4.8, { align: 'center' });
      });
      y += 9.5;

      // Row content
      const valUnidad = unitNum.toUpperCase();
      const valDesc = "CONSUMO DE GAS";
      const valActual = receipt.lecturaActual !== undefined ? receipt.lecturaActual.toFixed(3) : receipt.m3?.toFixed(3) || '0.000';
      const valAnterior = receipt.lecturaAnterior !== undefined ? receipt.lecturaAnterior.toFixed(3) : '0.000';
      const valMonto = `$${receipt.total.toFixed(2)}`;
      const valTotal = `$${receipt.total.toFixed(2)}`;

      const rowValues = [valUnidad, valDesc, valActual, valAnterior, valMonto, valTotal];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59); // slate-800

      cols.forEach((col, idx) => {
        doc.setFillColor(241, 245, 249); // slate-100 / cool gray box
        doc.rect(col.x, y, col.w, 8.5, 'F');
        
        const textX = col.x + (col.w / 2);
        doc.text(rowValues[idx], textX, y + 5.5, { align: 'center' });
      });
      y += 18;

      // Totals section (Subtotal and Total in colored blocks)
      const totalBlockX = 140;
      const totalBlockW = 60.9;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Subtotal:", totalBlockX + 5, y);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`$${receipt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, width - 15, y, { align: 'right' });
      y += 6;
      
      doc.setFillColor(37, 162, 218); // #25a2da cyan box
      doc.rect(totalBlockX, y, totalBlockW, 9.5, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(255, 255, 255); // White text
      doc.text("Total:", totalBlockX + 5, y + 6);
      doc.text(`$${receipt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, width - 18, y + 6, { align: 'right' });
      y += 28;

      // Signatures
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.4);
      
      doc.line(15, y, 75, y);
      doc.line(width - 75, y, width - 15, y);
      
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text("FIRMA DE ENTREGA / DESPACHO", 45, y, { align: 'center' });
      doc.text("FIRMA CONFORME / BENEFICIARIO", width - 45, y, { align: 'center' });
      y += 18;

      // Bottom statement with elegant horizontal cyan bars
      doc.setFillColor(37, 162, 218);
      doc.rect(15, y, width - 30, 1.2, 'F');
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Este es un comprobante electrónico oficial de caja guardado en el sistema", width / 2, y, { align: 'center' });
      y += 8;
      
      doc.setFillColor(37, 162, 218);
      doc.rect(15, y, width - 30, 1.2, 'F');

      doc.save(`Comprobante_Gas_${unitNum.replace(/\s/g, '_')}_${receipt.date.replace(/[\/:\s]/g, '_')}.pdf`);
    } catch (e) {
      console.error('Error generating PDF:', e);
      alert('Error al generar el archivo PDF del comprobante.');
    }
  };

  const handleShareWhatsApp = (receipt: CalculationResult, targetPhone?: string) => {
    const condoName = condos.find(c => c.id === receipt.condoId)?.name || 'Condominio';
    const unitText = receipt.unitNumber ? `Unidad ${receipt.unitNumber}` : 'General / Sin unidad';
    const selectedUnit = units.find(u => u.id === receipt.unidadId);
    const ownerName = selectedUnit?.ownerName || 'Propietario / Consumidor';

    let m3Text = '';
    if (receipt.m3 !== undefined) {
      if (receipt.lecturaActual !== undefined && receipt.lecturaAnterior !== undefined) {
        m3Text = `🔹 *Lectura Anterior:* ${receipt.lecturaAnterior.toFixed(2)} m³\n🔹 *Lectura Actual:* ${receipt.lecturaActual.toFixed(2)} m³\n🔹 *Consumo Neto:* ${receipt.m3.toFixed(2)} m³ (${receipt.lecturaActual.toFixed(2)} - ${receipt.lecturaAnterior.toFixed(2)})\n🔹 *Factor de Conversión:* ${receipt.conversionFactor?.toFixed(3)}\n`;
      } else {
        m3Text = `🔹 *Lectura m³:* ${receipt.m3.toFixed(2)} m³\n🔹 *Factor de Conversión:* ${receipt.conversionFactor?.toFixed(3)}\n`;
      }
    }

    const text = `*COMPROBANTE DE CONSUMO DE GAS* 🇩🇴⛽

*Condominio:* ${condoName}
*Unidad:* ${unitText}
*Propietario:* ${ownerName}
*Fecha/Hora:* ${receipt.date}

----------------------------------------------
${m3Text}🔹 *Volumen Equivalente:* ${receipt.gallons.toFixed(2)} GLS
🔹 *Precio por Galón:* RD$ ${receipt.rate.pricePerGallon.toFixed(2)}
🔸 *Monto Liquidado:* *RD$ ${receipt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*
----------------------------------------------
_¡Comprobante oficial para el propietario. Mantenga sus pagos al día!_
_Generado automáticamente por CONDOBill RD_`;

    const cleanPhone = (targetPhone || receiptWhatsappPhone || '').replace(/\D/g, '');
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  };

  const handlePrintReceipt = (receipt: CalculationResult) => {
    try {
      const printIframe = document.createElement('iframe');
      printIframe.id = 'receipt-print-iframe-gas';
      printIframe.style.position = 'absolute';
      printIframe.style.top = '-9999px';
      document.body.appendChild(printIframe);

      const condoName = condos.find(c => c.id === receipt.condoId)?.name || 'Condominio';
      const unitText = receipt.unitNumber ? `Unidad ${receipt.unitNumber}` : 'General';
      const selectedUnit = units.find(u => u.id === receipt.unidadId);
      const ownerName = selectedUnit?.ownerName || 'Propietario / Consumidor';

      const printDocument = printIframe.contentDocument || printIframe.contentWindow?.document;
      if (printDocument) {
        printDocument.write(`
          <html>
            <head>
              <title>Recibo de Gas - CONDOBill</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  padding: 24px;
                  color: #1e293b;
                  max-width: 380px;
                  margin: 0 auto;
                  font-size: 13px;
                }
                .header {
                  text-align: center;
                  margin-bottom: 20px;
                  border-bottom: 2px dashed #e2e8f0;
                  padding-bottom: 12px;
                }
                .title {
                  font-size: 20px;
                  font-weight: 800;
                  margin: 0;
                  color: #0f172a;
                }
                .subtitle {
                  font-size: 10px;
                  font-weight: 700;
                  color: #10b981;
                  margin-top: 4px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                .date {
                  font-size: 10px;
                  color: #94a3b8;
                  margin-top: 2px;
                }
                .row {
                  display: flex;
                  justify-content: space-between;
                  margin: 8px 0;
                }
                .label {
                  color: #64748b;
                  font-weight: 500;
                }
                .val {
                  color: #0f172a;
                  font-weight: 700;
                  text-align: right;
                }
                .divider {
                  border-top: 1px solid #e2e8f0;
                  margin: 12px 0;
                }
                .total-box {
                  background-color: #f0fdf4;
                  border: 1px solid #bbf7d0;
                  padding: 12px;
                  border-radius: 6px;
                  text-align: center;
                  margin-top: 16px;
                }
                .total-label {
                  font-size: 9px;
                  font-weight: 800;
                  color: #166534;
                  text-transform: uppercase;
                }
                .total-amount {
                  font-size: 22px;
                  font-weight: 950;
                  color: #15803d;
                  margin-top: 2px;
                }
                .footer {
                  text-align: center;
                  margin-top: 24px;
                  font-size: 9px;
                  color: #94a3b8;
                  border-top: 1px dashed #e2e8f0;
                  padding-top: 12px;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="title">CONDOBill RD</div>
                <div class="subtitle">Comprobante de Consumo de Gas</div>
                <div class="date">${receipt.date}</div>
              </div>
              
              <div class="row">
                <span class="label">Condominio:</span>
                <span class="val">${condoName}</span>
              </div>
              <div class="row">
                <span class="label">Unidad:</span>
                <span class="val">${unitText}</span>
              </div>
              <div class="row">
                <span class="label">Propietario:</span>
                <span class="val">${ownerName}</span>
              </div>
              
              <div class="divider"></div>
              
              <div class="row">
                <span class="label">Tarifa Aplicada:</span>
                <span class="val">${receipt.rate.name}</span>
              </div>
              
              ${receipt.m3 !== undefined ? (
                receipt.lecturaActual !== undefined && receipt.lecturaAnterior !== undefined ? `
                  <div class="row">
                    <span class="label">Lectura Anterior:</span>
                    <span class="val">${receipt.lecturaAnterior.toFixed(2)} m³</span>
                  </div>
                  <div class="row">
                    <span class="label">Lectura Actual:</span>
                    <span class="val">${receipt.lecturaActual.toFixed(2)} m³</span>
                  </div>
                  <div class="row" style="font-size: 11px; background-color: #f8fafc; padding: 4px; border-radius: 4px; margin: 4px 0;">
                    <span class="label" style="font-style: italic;">Operación:</span>
                    <span class="val" style="font-family: monospace;">${receipt.lecturaActual.toFixed(2)} - ${receipt.lecturaAnterior.toFixed(2)}</span>
                  </div>
                  <div class="row">
                    <span class="label">Consumo Neto m³:</span>
                    <span class="val" style="color: #4f46e5; font-weight: 850;">${receipt.m3.toFixed(2)} m³</span>
                  </div>
                  <div class="row">
                    <span class="label">Factor Conversión:</span>
                    <span class="val">${receipt.conversionFactor?.toFixed(3) || '1.10'}</span>
                  </div>
                ` : `
                  <div class="row">
                    <span class="label">Consumo m³:</span>
                    <span class="val">${receipt.m3.toFixed(2)} m³</span>
                  </div>
                  <div class="row">
                    <span class="label">Factor Conversión:</span>
                    <span class="val">${receipt.conversionFactor?.toFixed(3) || '1.10'}</span>
                  </div>
                `
              ) : ''}
              
              <div class="row">
                <span class="label">Volumen Galones:</span>
                <span class="val">${receipt.gallons.toFixed(2)} GLS</span>
              </div>
              <div class="row">
                <span class="label">Precio por Galón:</span>
                <span class="val">RD$ ${receipt.rate.pricePerGallon.toFixed(2)}</span>
              </div>
              
              <div class="total-box">
                <div class="total-label">Monto Liquidado</div>
                <div class="total-amount">RD$ ${receipt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              
              <div class="footer">
                <p style="margin: 0; font-weight: bold;">Generado por CONDOBill RD • RD$ Gas Regulado</p>
                <p style="margin: 2px 0 0 0;">Copia de Control Interno / Propietario</p>
              </div>
            </body>
          </html>
        `);
        printDocument.close();
        
        setTimeout(() => {
          if (printIframe.contentWindow) {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
          }
          setTimeout(() => {
            document.body.removeChild(printIframe);
          }, 1000);
        }, 300);
      }
    } catch (e) {
      console.error('Error printing receipt:', e);
      alert('Error al procesar la cola de impresión. Puede guardar el comprobante como PDF.');
    }
  };

  const addRate = () => {
    if (!newRate.name || !newRate.pricePerGallon) return;

    const rate: GasRate = {
      id: `custom-${Date.now()}`,
      name: newRate.name,
      pricePerGallon: Number(newRate.pricePerGallon),
      isCustom: true,
      lastUpdated: new Date().toISOString()
    };

    setRates([...rates, rate]);
    setNewRate({ name: '', pricePerGallon: 0 });
    setIsAddingRate(false);
  };

  const deleteRate = (id: string) => {
    if (rates.length <= 1) return;
    setRates(rates.filter(r => r.id !== id));
    if (selectedRateId === id) {
      setSelectedRateId(rates.find(r => r.id !== id)?.id || '');
    }
  };

  const updateRatePrice = (id: string, newPrice: number) => {
    setRates(rates.map(r => 
      r.id === id 
        ? { ...r, pricePerGallon: newPrice, lastUpdated: new Date().toISOString() } 
        : r
    ));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-4">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-250 pb-6 bg-white p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600/10 text-emerald-600 rounded-2xl">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 uppercase italic leading-none tracking-tight">CÁLCULO DE PROPANO</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1">
              <span>MÓDULO DE CONSUMO DE GAS GLP</span>
              <span className="text-emerald-500 font-extrabold">• PRECIOS REGULADOS</span>
            </p>
          </div>
        </div>
      </div>

      <motion.div
        key="gas-pane"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-10"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Consumo de Gas Propano (GLP)</h4>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest mt-1">Sincronizado con tarifas del MICM</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              type="button"
              onClick={() => {
                setShowSubtractor(!showSubtractor);
                setShowHistory(false);
                setShowSettings(false);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer ${showSubtractor ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-600 shadow-sm'}`}
            >
              <Calculator className="w-4 h-4" />
              <span>Restar Lecturas m³</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                setShowHistory(!showHistory);
                setShowSettings(false);
                setShowSubtractor(false);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer ${showHistory ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-600 shadow-sm'}`}
            >
              <History className="w-4 h-4" />
              <span>Ver Historial</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                setShowSettings(!showSettings);
                setShowHistory(false);
                setShowSubtractor(false);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer ${showSettings ? 'bg-slate-900 text-white shadow-xl' : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-900 shadow-sm'}`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Configuración</span>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showSubtractor ? (
            <motion.section 
              key="subtractor-pane"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden font-sans"
            >
              <div className="p-8 md:p-10 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <span>Restar Lecturas de Metros Cúbicos (m³)</span>
                  </h4>
                  <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest mt-1">Calcula el consumo restando la lectura actual y anterior del medidor</p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setCurrentReading('');
                    setPreviousReading('');
                    setSubtractorUnitId('');
                  }}
                  className="px-4 py-2 text-[9px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest flex items-center gap-2 transition-colors border border-transparent hover:border-rose-100 hover:bg-rose-50 rounded-xl cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reiniciar
                </button>
              </div>

              <div className="p-8 md:p-10 space-y-8">
                {/* Selector de Unidad y Propietario en Restar Lecturas */}
                <div className="space-y-3 relative z-30">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block">
                    UNIDAD O PROPIETARIO A CALCULAR
                  </label>
                  
                  {isSubtractorDropdownOpen && (
                    <div 
                      className="fixed inset-0 z-10 cursor-default" 
                      onClick={() => {
                        setIsSubtractorDropdownOpen(false);
                        setSubtractorSearchQuery('');
                      }}
                    />
                  )}

                  <div className="relative z-20">
                    <button
                      type="button"
                      onClick={() => setIsSubtractorDropdownOpen(!isSubtractorDropdownOpen)}
                      className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-black text-slate-700 focus:border-blue-500 focus:outline-none focus:bg-white transition-all shadow-sm flex items-center justify-between text-left cursor-pointer"
                    >
                      <span className={subtractorUnitId ? "text-slate-800" : "text-slate-400 font-bold"}>
                        {selectedSubtractorUnit 
                          ? `Unidad ${selectedSubtractorUnit.numero} - ${selectedSubtractorUnit.ownerName}`
                          : "Seleccionar unidad o propietario..."}
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        {subtractorUnitId && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubtractorUnitId('');
                              setPreviousReading('');
                            }}
                            className="p-1 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                            title="Quitar selección"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        )}
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </button>

                    {isSubtractorDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden z-35 max-h-72 flex flex-col animate-in fade-in slide-in-from-top-2 duration-250">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                          <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                          <input
                            type="text"
                            value={subtractorSearchQuery}
                            onChange={(e) => setSubtractorSearchQuery(e.target.value)}
                            placeholder="Buscar por número o propietario..."
                            className="w-full bg-transparent border-none outline-none text-xs font-black text-slate-700 placeholder:text-slate-400 focus:ring-0"
                            autoFocus
                          />
                          {subtractorSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setSubtractorSearchQuery('')}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="overflow-y-auto flex-1 py-1 divide-y divide-slate-50 max-h-[220px]">
                          {subtractorUnits.length > 0 ? (
                            subtractorUnits.map(u => {
                              const remainsSelected = u.id === subtractorUnitId;
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    handleSubtractorUnitSelect(u.id);
                                  }}
                                  className={`w-full px-5 py-3.5 text-left text-xs font-bold transition-colors flex items-center justify-between cursor-pointer ${
                                    remainsSelected 
                                      ? "bg-blue-50 text-blue-800 font-extrabold" 
                                      : "hover:bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  <div className="flex flex-col text-left">
                                    <span className={`text-[13px] font-black ${remainsSelected ? "text-blue-800" : "text-slate-800"}`}>
                                      Unidad {u.numero}
                                    </span>
                                    <span className="text-[10px] text-slate-450 font-semibold mt-0.5">
                                      Propietario: {u.ownerName}
                                    </span>
                                  </div>
                                  {remainsSelected && <Check className="w-4 h-4 text-blue-600" />}
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-5 py-5 text-center text-xs text-slate-450 font-extrabold uppercase tracking-wider">
                              No se encontraron unidades en este condominio
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">LECTURA ACTUAL (m³)</label>
                    <div className="relative group">
                      <input 
                        type="number"
                        inputMode="decimal"
                        value={currentReading}
                        onChange={e => setCurrentReading(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-4xl p-8 pb-10 bg-slate-50 hover:bg-slate-100/50 rounded-[2rem] border border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-slate-700 font-black tracking-tighter shadow-inner text-center font-mono"
                      />
                      <div className="absolute right-6 bottom-8 select-none">
                        <span className="text-slate-350 font-black text-[10px] tracking-widest">m³ (FIN)</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">LECTURA ANTERIOR (m³)</label>
                    <div className="relative group">
                      <input 
                        type="number"
                        inputMode="decimal"
                        value={previousReading}
                        onChange={e => {
                          const val = e.target.value;
                          setPreviousReading(val);
                          if (subtractorUnitId) {
                            const updated = { ...unitLastReadings, [subtractorUnitId]: val };
                            setUnitLastReadings(updated);
                            localStorage.setItem('gas_unit_last_readings', JSON.stringify(updated));
                          }
                        }}
                        placeholder="0.00"
                        className="w-full text-4xl p-8 pb-10 bg-slate-50 hover:bg-slate-100/50 rounded-[2rem] border border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-slate-700 font-black tracking-tighter shadow-inner text-center font-mono"
                      />
                      <div className="absolute right-6 bottom-8 select-none">
                        <span className="text-slate-350 font-black text-[10px] tracking-widest">m³ (INICIO)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {readingDifference !== null && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-6 md:p-8 rounded-[2rem] border flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${
                      readingDifference < 0
                        ? 'bg-rose-50 border-rose-100 text-rose-800'
                        : 'bg-indigo-50/40 border-indigo-100 text-slate-800'
                    }`}
                  >
                    <div className="space-y-2 text-center md:text-left">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Consumo Calculado Resultante</span>
                      {readingDifference < 0 ? (
                        <p className="text-xs font-black text-rose-600 uppercase tracking-tight">
                          Error: La lectura actual debe ser mayor o igual a la lectura anterior.
                        </p>
                      ) : (
                        <div>
                          <p className="text-4xl font-black font-mono tracking-tight text-indigo-600">
                            {readingDifference.toFixed(2)} m³
                          </p>
                          <p className="text-[10.5px] uppercase font-bold text-slate-400 tracking-wider mt-1">
                            Operación: {parseFloat(currentReading).toFixed(2)} m³ - {parseFloat(previousReading).toFixed(2)} m³
                          </p>
                        </div>
                      )}
                    </div>

                    {readingDifference >= 0 && (
                      <button 
                        type="button"
                        onClick={() => {
                          setM3Value(readingDifference.toFixed(2));
                          setGasInputMode('m3');
                          setShowSubtractor(false);
                          setAppliedCurrentReading(currentReading);
                          setAppliedPreviousReading(previousReading);
                          
                          if (subtractorUnitId) {
                            setSelectedUnitId(subtractorUnitId);
                            // Set the current reading as the previous starting reading for next month
                            const updated = {
                              ...unitLastReadings,
                              [subtractorUnitId]: currentReading
                            };
                            setUnitLastReadings(updated);
                            localStorage.setItem('gas_unit_last_readings', JSON.stringify(updated));
                          }
                          
                          alert(`Excelente: Se cargó el consumo de ${readingDifference.toFixed(2)} m³ a la calculadora.`);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-200/50 cursor-pointer"
                      >
                        Aplicar Consumo a Calculadora
                      </button>
                    )}
                  </motion.div>
                )}

                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-start gap-4">
                  <div className="w-10 h-10 bg-white border border-slate-200 text-slate-400 rounded-xl flex items-center justify-center shrink-0">
                    <Info className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">¿Cómo utilizar este valor?</span>
                    <p className="text-[10px] text-slate-450 font-bold leading-relaxed uppercase tracking-tight">
                      Esta sub-calculadora resta la lectura inicial de la lectura final en metros cúbicos ($m^3$). Al hacer clic en "Aplicar Consumo a Calculadora", el resultado se insertará automáticamente en el campo de entrada del módulo de gas principal, listo para multiplicarse por el factor de conversión a galones y liquidarse en RD$.
                    </p>
                  </div>
                </div>

              </div>
            </motion.section>
          ) : showHistory ? (
            <motion.section 
              key="history-pane"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden"
            >
              <div className="p-8 md:p-10 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                     <History className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic font-sans">Historial de Cálculos de Gas</h4>
                </div>
                <button 
                  onClick={() => setHistory([])}
                  className="px-4 py-2 text-[9px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest flex items-center gap-2 transition-colors border border-transparent hover:border-rose-100 hover:bg-rose-50 rounded-xl cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Borrar todo
                </button>
              </div>
              <div className="overflow-x-auto min-h-[400px]">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                      <History className="w-10 h-10 opacity-20" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] italic">Sin registros de gas vigentes</p>
                  </div>
                ) : (
                  <table className="w-full text-left font-sans">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                        <th className="px-10 py-5">Fecha y Hora</th>
                        <th className="px-10 py-5">Tarifa Aplicada</th>
                        <th className="px-10 py-5">Galones</th>
                        <th className="px-10 py-5 text-right">Monto Liquidado</th>
                        <th className="px-10 py-5 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {history.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="px-10 py-6 text-xs font-bold text-slate-400 group-hover:text-slate-500">{item.date}</td>
                          <td className="px-10 py-6">
                            <span className="text-xs font-black text-slate-800 uppercase italic tracking-tighter">{item.rate.name}</span>
                          </td>
                          <td className="px-10 py-6">
                            <span className="text-xs font-black text-slate-600 font-mono italic block">{item.gallons.toFixed(2)} GLS</span>
                            {item.m3 !== undefined && (
                              <span className="text-[10px] text-emerald-600 font-extrabold block mt-0.5 uppercase tracking-wider">
                                de {item.m3.toFixed(2)} m³ (x{item.conversionFactor?.toFixed(2)})
                                {item.lecturaAnterior !== undefined && item.lecturaActual !== undefined && (
                                  <span className="text-[9px] text-indigo-500 font-semibold block mt-0.5 lowercase tracking-normal bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100/50 max-w-max">
                                    lecturas: {item.lecturaAnterior.toFixed(2)} → {item.lecturaActual.toFixed(2)}
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="px-10 py-6 text-right">
                            <span className="text-base font-black text-brand-green font-mono">RD$ {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-10 py-6">
                            <div className="flex items-center justify-center gap-2">
                              {/* Open interactive digital modal receipt */}
                              <button
                                onClick={() => setActiveReceipt(item)}
                                title="Ver Comprobante Digital"
                                className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </button>
                              
                              <button
                                onClick={() => handlePrintReceipt(item)}
                                title="Imprimir"
                                className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDownloadPDF(item)}
                                title="Descargar PDF"
                                className="p-2.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-xl transition-all cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  const selectedUnit = units.find(u => u.id === item.unidadId);
                                  handleShareWhatsApp(item, selectedUnit?.whatsapp);
                                }}
                                title="Enviar por WhatsApp"
                                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all cursor-pointer"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.section>
          ) : showSettings ? (
            <motion.section 
              key="settings-pane"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden font-sans"
            >
              <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Ajustes de Precios del Gas</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sincronización semanal MICM RD</p>
                </div>
                {!isAddingRate && (
                  <button 
                    onClick={() => setIsAddingRate(true)}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200/50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Tarifa
                  </button>
                )}
              </div>

              <div className="p-10 space-y-8">
                {isAddingRate && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="p-8 bg-slate-50 rounded-3xl border-2 border-emerald-600/10 space-y-6 shadow-inner"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Tarifa</label>
                        <input 
                          type="text"
                          value={newRate.name}
                          onChange={e => setNewRate({...newRate, name: e.target.value})}
                          placeholder="Ej: GLP Estándar"
                          className="w-full h-12 px-5 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-black text-sm uppercase tracking-tight"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">RD$ por Galón</label>
                        <input 
                          type="number"
                          value={newRate.pricePerGallon || ''}
                          onChange={e => setNewRate({...newRate, pricePerGallon: Number(e.target.value)})}
                          placeholder="0.00"
                          className="w-full h-12 px-5 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-black text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 justify-end pt-2">
                      <button 
                        onClick={() => setIsAddingRate(false)}
                        className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={addRate}
                        className="bg-emerald-600 text-white px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg cursor-pointer"
                      >
                        Confirmar
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4">
                  {rates.map(rate => (
                    <div 
                      key={rate.id}
                      className="group flex items-center justify-between p-6 rounded-[2rem] hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 group-hover:border-slate-300 shadow-sm flex items-center justify-center transition-all">
                          <Flame className={`w-7 h-7 ${rate.isCustom ? 'text-emerald-500' : 'text-orange-500'}`} />
                        </div>
                        <div>
                          <p className="text-[15px] font-black text-slate-800 uppercase italic tracking-tighter">{rate.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Precio actual registrado</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm focus-within:ring-2 focus-within:ring-brand-green/20 transition-all">
                          <span className="text-[11px] font-black text-slate-300 mr-3 uppercase tracking-widest">RD$</span>
                          <input 
                            type="number"
                            step="0.01"
                            value={rate.pricePerGallon}
                            onChange={e => updateRatePrice(rate.id, Number(e.target.value))}
                            className="w-24 text-right font-black text-slate-800 focus:outline-none bg-transparent font-mono text-lg"
                          />
                        </div>
                        <button 
                          onClick={() => deleteRate(rate.id)}
                          disabled={rates.length <= 1}
                          className="w-12 h-12 flex items-center justify-center text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl disabled:opacity-0 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          ) : (
            <motion.section 
              key="calculator-pane"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-10"
            >
              <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative font-sans" id="calc-card">
                <div className="p-8 md:p-14 relative z-1">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    
                    <div className="space-y-10">
                      <div>
                        <div className="inline-flex items-center px-4 py-1.5 bg-emerald-55/10 text-emerald-600 rounded-full mb-8">
                           <span className="text-[10px] font-black uppercase tracking-[0.1em]">PROPANO REGULADO</span>
                        </div>
                        <h2 className="text-5xl font-black text-slate-800 leading-[1.1] tracking-tight italic">
                          Calculadora <br /> de <span className="text-emerald-500">Gas Propano</span>
                        </h2>
                      </div>

                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CONDOMINIO</label>
                            <select
                              value={selectedCondoId}
                              onChange={(e) => setSelectedCondoId(e.target.value)}
                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-slate-700 focus:border-emerald-500 focus:outline-none transition-all shadow-sm"
                            >
                              <option value="">Seleccionar...</option>
                              {condos.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-3 relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block">UNIDAD (OPCIONAL)</label>
                            
                            {/* Backdrop to close dropdown when clicking outside */}
                            {isUnitDropdownOpen && (
                              <div 
                                className="fixed inset-0 z-10 cursor-default" 
                                onClick={() => {
                                  setIsUnitDropdownOpen(false);
                                  setUnitSearchQuery('');
                                }}
                              />
                            )}

                            <div className="relative z-20">
                              {/* Selection/Trigger Button */}
                              <button
                                type="button"
                                onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                                className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-slate-700 focus:border-blue-500 focus:outline-none transition-all shadow-sm flex items-center justify-between text-left cursor-pointer"
                              >
                                <span className={selectedUnitId ? "text-slate-800" : "text-slate-400 font-bold"}>
                                  {selectedUnitForDisplay 
                                    ? `Unidad ${selectedUnitForDisplay.numero} - ${selectedUnitForDisplay.ownerName}`
                                    : "Solo calcular..."}
                                </span>
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  {selectedUnitId && (
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedUnitId('');
                                      }}
                                      className="p-1 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                                      title="Desmarcar unidad"
                                    >
                                      <X className="w-3 h-3" />
                                    </span>
                                  )}
                                  <ChevronDown className="w-4 h-4" />
                                </div>
                              </button>

                              {/* Search & Results Panel */}
                              {isUnitDropdownOpen && (
                                <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden z-30 max-h-72 flex flex-col animate-in fade-in slide-in-from-top-2 duration-250">
                                  {/* Search Input Bar */}
                                  <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                                    <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                                    <input
                                      type="text"
                                      value={unitSearchQuery}
                                      onChange={(e) => setUnitSearchQuery(e.target.value)}
                                      placeholder="Buscar por número o propietario..."
                                      className="w-full bg-transparent border-none outline-none text-xs font-black text-slate-700 placeholder:text-slate-400 focus:ring-0"
                                      autoFocus
                                    />
                                    {unitSearchQuery && (
                                      <button
                                        type="button"
                                        onClick={() => setUnitSearchQuery('')}
                                        className="p-1 text-slate-400 hover:text-slate-600"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>

                                  {/* List of Units */}
                                  <div className="overflow-y-auto flex-1 py-1 divide-y divide-slate-50 max-h-[220px]">
                                    {/* Default "Solo calcular" option */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedUnitId('');
                                        setIsUnitDropdownOpen(false);
                                        setUnitSearchQuery('');
                                      }}
                                      className={`w-full px-5 py-3 text-left text-xs font-black transition-colors flex items-center justify-between cursor-pointer ${
                                        !selectedUnitId 
                                          ? "bg-emerald-50 text-emerald-700" 
                                          : "hover:bg-slate-50 text-slate-400"
                                      }`}
                                    >
                                      <span>Solo calcular...</span>
                                      {!selectedUnitId && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                    </button>

                                    {searchableUnits.length > 0 ? (
                                      searchableUnits.map(u => {
                                        const isSelected = u.id === selectedUnitId;
                                        return (
                                          <button
                                            key={u.id}
                                            type="button"
                                            onClick={() => {
                                              setSelectedUnitId(u.id);
                                              setIsUnitDropdownOpen(false);
                                              setUnitSearchQuery('');
                                            }}
                                            className={`w-full px-5 py-3.5 text-left text-xs font-bold transition-colors flex items-center justify-between cursor-pointer ${
                                              isSelected 
                                                ? "bg-blue-50 text-blue-800 font-extrabold" 
                                                : "hover:bg-slate-50 text-slate-600"
                                            }`}
                                          >
                                            <div className="flex flex-col text-left">
                                              <span className={`text-[13px] font-black ${isSelected ? "text-blue-800" : "text-slate-800"}`}>
                                                Unidad {u.numero}
                                              </span>
                                              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                                Propietario: {u.ownerName}
                                              </span>
                                            </div>
                                            {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                          </button>
                                        );
                                      })
                                    ) : (
                                      <div className="px-5 py-5 text-center text-xs text-slate-400 font-extrabold uppercase tracking-wider">
                                        No se encontraron unidades
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">TARIFA SELECCIONADA</label>
                          <div className="space-y-2">
                            {rates.filter(r => r.id === selectedRateId).map(rate => (
                              <div
                                key={rate.id}
                                className="flex items-center justify-between p-7 rounded-[2rem] border-2 border-emerald-400/35 bg-emerald-50/5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden"
                              >
                                <div className="flex items-center gap-5">
                                  <div className="w-11 h-11 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <Flame className="w-6 h-6 fill-current animate-bounce" />
                                  </div>
                                  <span className="text-lg font-black text-emerald-700 leading-tight">
                                    {rate.name.split(' (')[0]} <br />
                                    <span className="text-emerald-600/70 text-xs font-bold font-sans">({rate.name.split(' (')[1] || 'Sinc MICM'}</span>
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="block text-[10px] uppercase font-black text-slate-300 tracking-tight mb-1">PRECIO / GLS</span>
                                  <span className="text-xl font-black text-slate-800 font-sans tracking-tight">
                                    <span className="text-slate-450 text-sm mr-1 font-normal">RD$</span>
                                    {rate.pricePerGallon.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                         {/* Unidad de Lectura / Modo Selector */}
                         <div className="space-y-3 bg-slate-50/50 p-4 border border-slate-200/60 rounded-3xl">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block">Unidad de Medida de Entrada</label>
                           <div className="grid grid-cols-2 gap-2">
                             <button
                               type="button"
                               onClick={() => setGasInputMode('gallons')}
                               className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                 gasInputMode === 'gallons'
                                   ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10'
                                   : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800'
                               }`}
                             >
                               <span>1. Solo Galones (GLS)</span>
                             </button>
                             <button
                               type="button"
                               onClick={() => setGasInputMode('m3')}
                               className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                 gasInputMode === 'm3'
                                   ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10'
                                   : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800'
                               }`}
                             >
                               <span>2. Metros Cúbicos (m³)</span>
                             </button>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {gasInputMode === 'm3' ? (
                             <div className="space-y-3">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CANTIDAD DE METROS CÚBICOS (m³)</label>
                               <div className="relative group">
                                 <input 
                                   type="number"
                                   inputMode="decimal"
                                   value={m3Value}
                                   onChange={e => setM3Value(e.target.value)}
                                   placeholder="0.00"
                                   className="w-full text-4xl p-10 pb-12 bg-slate-50 hover:bg-slate-100/50 rounded-[2.5rem] border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:outline-none transition-all text-slate-700 font-black tracking-tighter shadow-inner text-center font-mono"
                                 />
                                 <div className="absolute right-8 bottom-8 flex flex-col items-center gap-2 select-none">
                                   <span className="text-slate-350 font-black text-[10px] tracking-widest">M³</span>
                                   <RotateCcw 
                                     onClick={clearGasInputs}
                                     className="w-4 h-4 text-slate-300 hover:text-blue-500 cursor-pointer transition-colors" 
                                   />
                                 </div>
                               </div>
                             </div>
                           ) : (
                             <div className="space-y-3">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CANTIDAD DE GALONES (GLS)</label>
                               <div className="relative group">
                                 <input 
                                   type="number"
                                   inputMode="decimal"
                                   value={gallons}
                                   onChange={e => setGallons(e.target.value)}
                                   placeholder="0.00"
                                   className="w-full text-4xl p-10 pb-12 bg-slate-50 hover:bg-slate-100/50 rounded-[2.5rem] border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:outline-none transition-all text-slate-700 font-black tracking-tighter shadow-inner text-center font-mono"
                                 />
                                 <div className="absolute right-8 bottom-8 flex flex-col items-center gap-2 select-none">
                                   <span className="text-slate-350 font-black text-[10px] tracking-widest">GLS</span>
                                   <RotateCcw 
                                     onClick={clearGasInputs}
                                     className="w-4 h-4 text-slate-300 hover:text-blue-500 cursor-pointer transition-colors" 
                                   />
                                 </div>
                               </div>
                             </div>
                           )}

                           <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">PRECIO POR GALÓN</label>
                             <div className="relative group">
                               <input 
                                 type="number"
                                 inputMode="decimal"
                                 value={selectedRate?.pricePerGallon || ''}
                                 onChange={e => selectedRate && updateRatePrice(selectedRate.id, Number(e.target.value))}
                                 placeholder="0.00"
                                 className="w-full text-4xl p-10 pb-12 bg-slate-50 hover:bg-slate-100/50 rounded-[2.5rem] border border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:outline-none transition-all text-slate-700 font-black tracking-tighter shadow-inner text-center font-mono"
                               />
                               <div className="absolute right-8 bottom-10 select-none">
                                  <span className="text-slate-350 font-black text-[10px] tracking-widest">RD$/GL</span>
                               </div>
                             </div>
                           </div>
                         </div>

                         {/* Dynamic Conversion Details if m3 is active - CUSTOM SECTIONS */}
                         {gasInputMode === 'm3' && (
                           <div className="p-6 bg-gradient-to-br from-indigo-50/70 to-emerald-50/30 border-2 border-dashed border-indigo-250 rounded-[2.5rem] space-y-6 animate-in fade-in duration-300">
                             {/* PASO 1 COMPLETO: CONVERSIÓN VISUAL DE METROS CÚBICOS A GALONES */}
                             <div className="bg-white p-6 rounded-3xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm relative z-10 font-sans">
                               <div className="space-y-2 text-left">
                                 <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                   <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                                   <span>Conversión de Medida (m³ a Galones)</span>
                                 </span>
                                 <p className="text-3xl font-black text-slate-800 leading-tight">
                                   {(parseFloat(m3Value) || 0).toFixed(2)} <span className="text-slate-400 text-lg font-bold">m³</span>
                                   <span className="mx-3 text-slate-350">➔</span>
                                   <span className="text-emerald-600">{calculatedGallonsValue.toFixed(2)}</span> <span className="text-emerald-500 text-lg font-bold font-sans">Galones (GLS)</span>
                                 </p>
                                 <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                                   Fórmula: {(parseFloat(m3Value) || 0).toFixed(2)} m³ × {gasConversionFactor.toFixed(3)} (factor) = {calculatedGallonsValue.toFixed(2)} GLS
                                 </p>
                               </div>
                               <div className="bg-emerald-50 border border-emerald-100 px-6 py-4 rounded-2xl text-center shrink-0">
                                 <span className="text-[9px] text-emerald-1000 uppercase font-black tracking-widest block mb-0.5">Equiv. Galones:</span>
                                 <span className="text-3xl font-black font-mono text-emerald-600">{calculatedGallonsValue.toFixed(2)} GLS</span>
                               </div>
                             </div>

                             {/* PASO 2 COMPLETO: CÁLCULO DE PRECIO EN PESOS */}
                             <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative z-10 font-sans">
                               <div className="space-y-1 text-left">
                                 <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                   <span className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center text-[10px] font-black">2</span>
                                   <span>Cálculo del Precio Estimado</span>
                                 </span>
                                 <p className="text-lg font-normal tracking-tight font-mono text-slate-200">
                                   {calculatedGallonsValue.toFixed(2)} GLS × RD$ {selectedRate?.pricePerGallon.toFixed(2)} / gl
                                 </p>
                                 <p className="text-[9px] text-slate-400/80 uppercase tracking-widest font-black leading-none">
                                   Precio oficial regulado por el MICM
                                 </p>
                                </div>
                               <div className="bg-black/40 px-6 py-4 rounded-2xl text-center md:text-right border border-slate-800 shrink-0">
                                 <span className="text-[9px] text-slate-300 uppercase font-black tracking-widest block mb-0.5">VALOR TOTAL DE ESTE CONSUMO:</span>
                                 <span className="text-3xl font-black font-mono text-emerald-400">RD$ {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                               </div>
                             </div>

                             <div className="w-full h-px bg-indigo-200/50 my-2" />
                             <div className="space-y-2">
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Factor de Conversión GLP (Fijo 1.20)</span>
                               <p className="text-[9px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight">
                                 Un metro cúbico (m³) rinde exactamente 1.20 galones de GLP. Este valor ha sido establecido como fijo y no editable.
                               </p>
                               <div className="flex items-center gap-3.5 bg-white/75 backdrop-blur-sm p-4 rounded-2xl border border-indigo-100 shadow-sm mb-4">
                                 <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl shrink-0">
                                   <Lock className="w-4 h-4" />
                                 </div>
                                 <div className="text-left font-sans">
                                   <p className="text-sm font-black text-slate-850 flex items-center gap-2">
                                     <span>1.20</span> 
                                     <span className="text-[9px] text-indigo-750 font-black uppercase tracking-widest bg-indigo-50/50 px-2 py-0.5 rounded-lg border border-indigo-100/50">
                                       Establecido
                                     </span>
                                   </p>
                                   <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-tight leading-normal mt-0.5">
                                     Factor Oficial de Conversión m³ a GLS
                                   </p>
                                 </div>
                               </div>

                             </div>

                             {/* Conversion mathematical blueprint trace */}
                             <div className="hidden">
                                <div className="text-xs">
                                  <span className="text-slate-400 font-extrabold text-[10px] uppercase block tracking-wider mb-1">Cálculo de Volumen:</span>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap justify-center sm:justify-start">
                                    <span className="px-2.5 py-1 bg-slate-50 rounded-lg text-slate-700 font-black">{(parseFloat(m3Value) || 0).toFixed(2)} m³</span>
                                    <span className="text-slate-400 font-bold">×</span>
                                    <span className="px-2.5 py-1 bg-slate-50 rounded-lg text-slate-700 font-black">{gasConversionFactor.toFixed(3)}</span>
                                    <span className="text-slate-400 font-bold">=</span>
                                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-black">{calculatedGallonsValue.toFixed(2)} GLS</span>
                                  </div>
                                </div>
                                <div className="text-xs hidden sm:block text-right">
                                  <span className="text-slate-400 font-extrabold text-[10px] uppercase block tracking-wider mb-1">Costo en Pesos Dominicanos:</span>
                                  <span className="text-xs font-black text-slate-800">
                                    {calculatedGallonsValue.toFixed(2)} GLS × RD$ {selectedRate?.pricePerGallon.toFixed(2)} = RD$ {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                             </div>
                           </div>
                         )}
                      </div>
                    </div>

                    <div className="bg-[#0B1527] rounded-[3.5rem] p-10 md:p-14 text-white shadow-3xl relative overflow-hidden flex flex-col justify-between min-h-[500px]">
                      {/* Background Accents */}
                      <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full -mr-32 -mt-32 blur-[80px]" />
                         <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600 rounded-full -ml-32 -mb-32 blur-[80px]" />
                      </div>

                      <div className="relative z-1 text-center space-y-2">
                         <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">TOTAL ESTIMADO LIQUIDABLE</p>
                         <div className="flex flex-col items-center w-full overflow-hidden px-2">
                            <span className="text-emerald-500 font-black text-2xl mb-1">RD$</span>
                            <motion.span 
                              key={total}
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className={`${total.toLocaleString().length > 10 ? 'text-3xl md:text-4xl' : 'text-5xl md:text-6xl'} font-black text-white font-mono tracking-tight leading-none break-all text-center`}
                            >
                              {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </motion.span>
                         </div>
                      </div>

                      <div className="relative z-1 space-y-4">
                         {gasInputMode === 'm3' && (
                           <div className="flex justify-between items-center py-4 border-t border-white/5 font-mono">
                              <span className="text-slate-500 font-bold text-sm">Lectura m³</span>
                              <span className="text-2xl font-black italic text-emerald-400">{(parseFloat(m3Value) || 0).toFixed(2)} m³</span>
                           </div>
                         )}
                         <div className="flex justify-between items-center py-4 border-t border-white/5 font-mono">
                            <span className="text-slate-500 font-bold text-sm">Equiv. Galones</span>
                            <span className="text-2xl font-black italic">{calculatedGallonsValue.toFixed(2)} GLS</span>
                         </div>
                         <div className="flex justify-between items-center py-4 border-t border-white/5 font-mono">
                            <span className="text-slate-500 font-bold text-sm">Precio/gl</span>
                            <span className="text-2xl font-black text-emerald-400 italic">RD$ {selectedRate?.pricePerGallon.toFixed(2)}</span>
                         </div>

                         <button 
                           onClick={handleCalculateGas}
                           disabled={calculatedGallonsValue <= 0}
                           className="w-full h-20 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-20 rounded-[2rem] font-black text-white transition-all flex items-center justify-center text-sm uppercase tracking-widest shadow-xl shadow-emerald-600/20 mt-4 cursor-pointer"
                         >
                           {(calculatedGallonsValue <= 0) ? (
                             "Esperando cantidad..."
                           ) : selectedUnitId ? (
                             "REGISTRAR COBRO A UNIDAD"
                           ) : (
                             "CALCULAR (SIN COBRO)"
                           )}
                         </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-[3rem] p-10 flex items-center gap-8 shadow-xl shadow-slate-200/20 relative overflow-hidden group font-sans">
                <div className="absolute top-0 right-0 w-[50%] h-full bg-slate-50 -skew-x-[30deg] translate-x-32 group-hover:translate-x-24 transition-transform duration-1000" />
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl shrink-0 flex items-center justify-center shadow-inner relative z-10">
                   <Info size={32} />
                </div>
                <div className="space-y-2 relative z-10">
                  <p className="font-black text-slate-800 uppercase italic tracking-tighter text-lg">Información de Seguridad Gas RD</p>
                  <p className="text-xs text-slate-400 font-bold leading-relaxed max-w-2xl uppercase tracking-tight">
                    Toda la información calculada se mantiene localmente en el navegador. El precio del gas propano es ajustado semanalmente por el MICM. Recuerde revisar la tarifa oficial y efectuar cambios en el botón de ajustes.
                  </p>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Receipt Action Overlay Modal */}
      <AnimatePresence>
        {activeReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-100 max-w-lg w-full rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden font-sans my-8"
            >
              {/* Header */}
              <div className="bg-slate-900 text-white px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest leading-none">Cálculo Completado</h4>
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-1">Comprobante de consumo de gas</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Receipt Body */}
              <div className="p-8 space-y-6">
                
                {/* Visual receipt print card */}
                <div className="bg-white border-2 border-slate-200/60 rounded-3xl p-6 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-indigo-500" />
                  
                  <div className="text-center pb-4 border-b border-dashed border-slate-200">
                    <h5 className="text-xl font-black text-slate-800 tracking-tight leading-none">CONDOBill RD</h5>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Comprobante Digital de Consumo</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">{activeReceipt.date}</p>
                  </div>

                  <div className="py-4 space-y-2 text-xs border-b border-dashed border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase">Condominio:</span>
                      <span className="text-slate-800 font-black text-right truncate max-w-[200px]">
                        {condos.find(c => c.id === activeReceipt.condoId)?.name || 'General'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase">Unidad:</span>
                      <span className="text-slate-800 font-black">{activeReceipt.unitNumber ? `Unidad ${activeReceipt.unitNumber}` : 'General / Sin unidad'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase">Propietario:</span>
                      <span className="text-slate-800 font-black">
                        {units.find(u => u.id === activeReceipt.unidadId)?.ownerName || 'Consumidor / Propietario'}
                      </span>
                    </div>
                  </div>

                  <div className="py-4 space-y-2 text-xs border-b border-dashed border-slate-200 font-semibold text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase">Tarifa Utilizada:</span>
                      <span className="text-slate-800 font-black italic">{activeReceipt.rate.name}</span>
                    </div>
                    {activeReceipt.m3 !== undefined && (
                      <>
                        {activeReceipt.lecturaAnterior !== undefined && activeReceipt.lecturaActual !== undefined ? (
                          <>
                            <div className="flex justify-between font-mono text-xs">
                              <span className="text-slate-400 font-bold uppercase">Lectura Anterior:</span>
                              <span className="text-slate-800 font-black">{activeReceipt.lecturaAnterior.toFixed(2)} m³</span>
                            </div>
                            <div className="flex justify-between font-mono text-xs">
                              <span className="text-slate-400 font-bold uppercase">Lectura Actual:</span>
                              <span className="text-slate-800 font-black">{activeReceipt.lecturaActual.toFixed(2)} m³</span>
                            </div>
                            <div className="flex justify-between font-mono text-xs text-indigo-700 bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100/50 my-1">
                              <span className="font-bold uppercase">Fórmula:</span>
                              <span className="font-extrabold">{activeReceipt.lecturaActual.toFixed(2)} - {activeReceipt.lecturaAnterior.toFixed(2)} = {activeReceipt.m3.toFixed(2)} m³</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between font-mono text-xs">
                            <span className="text-slate-400 font-bold uppercase">Consumo m³:</span>
                            <span className="text-slate-800 font-black">{activeReceipt.m3.toFixed(2)} m³</span>
                          </div>
                        )}
                        <div className="flex justify-between font-mono text-xs">
                          <span className="text-slate-400 font-bold uppercase">Factor Conversión:</span>
                          <span className="text-slate-800 font-black">x{activeReceipt.conversionFactor?.toFixed(3)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-slate-400 font-bold uppercase">Equivalente GLS:</span>
                      <span className="text-emerald-600 font-extrabold">{activeReceipt.gallons.toFixed(2)} GLS</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-slate-400 font-bold uppercase">Precio por Galón:</span>
                      <span className="text-slate-800 font-extrabold">RD$ {activeReceipt.rate.pricePerGallon.toFixed(2)} / gl</span>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col items-center justify-center bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                    <span className="text-[10px] text-emerald-800 font-black uppercase tracking-widest text-center mb-0.5">Monto Total de Consumo:</span>
                    <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight">
                      RD$ {activeReceipt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* WhatsApp configuration input */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">WhatsApp del Propietario</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs">+</span>
                      <input
                        type="tel"
                        value={receiptWhatsappPhone}
                        onChange={(e) => setReceiptWhatsappPhone(e.target.value)}
                        placeholder="Ej: 18095551234"
                        className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 rounded-2xl py-3 pl-7 pr-4 text-xs font-black tracking-wider shadow-inner"
                      />
                    </div>
                    <button
                      onClick={() => handleShareWhatsApp(activeReceipt, receiptWhatsappPhone)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-2xl flex items-center justify-center transition-colors shadow-lg shadow-emerald-600/15 cursor-pointer text-xs uppercase tracking-wider font-extrabold gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Probar
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1.5 uppercase font-bold tracking-tight leading-relaxed">Úselo con formato internacional para abrir el chat directamente (ej: 18092223333)</p>
                </div>

                {/* Main Action Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => handlePrintReceipt(activeReceipt)}
                    className="h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer shadow-md shadow-slate-900/10"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir
                  </button>

                  <button
                    onClick={() => handleDownloadPDF(activeReceipt)}
                    className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer shadow-lg shadow-indigo-150"
                  >
                    <Download className="w-4 h-4" />
                    Descargar PDF
                  </button>

                  <button
                    onClick={() => handleShareWhatsApp(activeReceipt, receiptWhatsappPhone)}
                    className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer shadow-lg shadow-emerald-150"
                  >
                    <Share2 className="w-4 h-4" />
                    WhatsApp
                  </button>
                </div>

                <button
                  onClick={() => setActiveReceipt(null)}
                  className="w-full h-12 border-2 border-slate-200 text-slate-600 hover:border-slate-300 bg-transparent rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer block text-center"
                >
                  Cerrar Comprobante
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
