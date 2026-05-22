/**
 * types.ts
 * Type definitions for the CondoBill RD application.
 */

export interface GasRate {
  id: string;
  name: string;
  pricePerGallon: number;
  isCustom: boolean;
  lastUpdated?: string;
}

export interface CalculationResult {
  gallons: number;
  rate: GasRate;
  total: number;
  date: string;
  condoId?: string;
  unidadId?: string;
  unitNumber?: string;
  m3?: number;
  conversionFactor?: number;
  lecturaActual?: number;
  lecturaAnterior?: number;
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface Condominio {
  id: string;
  name: string;
  address: string;
  photo?: string;
  createdAt: number;
  reminderStartDay?: number; // Día del mes para empezar a enviar recordatorios
}

export interface Unidad {
  id: string;
  condominioId: string;
  numero: string; // e.g., "101", "A-2"
  ownerName: string;
  photo?: string; // Photo of the unit or the owner
  whatsapp: string;
  email?: string;
  maintenanceFee?: number; // Cuota de mantenimiento mensual
}

export interface Transaction {
  id: string;
  condominioId: string;
  type: TransactionType;
  category: string; // e.g., 'Servicios Básicos', 'Suministros'
  concept: string;  // e.g., 'Energía eléctrica', 'Consumo de gas'
  amount: number;
  date: string;
  description?: string;
  employeeId?: string;
  corteId?: string;
  m3?: number;
  conversionFactor?: number;
  lecturaActual?: number;
  lecturaAnterior?: number;
  unidadId?: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  isSystem?: boolean; // System categories cannot be deleted
}

export interface Concept {
  id: string;
  categoryId: string;
  name: string;
  isSystem?: boolean;
}

export interface Tarea {
  id: string;
  condominioId: string;
  title: string;
  isCompleted: boolean;
  dueDate?: string;
}

export interface Mantenimiento {
  id: string;
  condominioId: string;
  description: string;
  date: string;
  frequency: 'mensual' | 'trimestral' | 'anual' | 'unico';
}

export interface Reparacion {
  id: string;
  condominioId: string;
  description: string;
  date: string;
  status: 'pendiente' | 'en_proceso' | 'completada';
}

export interface Conserje {
  id: string;
  condominioId: string;
  name: string;
  phone: string;
  shift: string; // e.g., 'Mañana', 'Noche'
  photo?: string;
}

export interface Proveedor {
  id: string;
  condominioId: string;
  name: string;
  service: string; // e.g., 'Agua', 'Plomería', 'Jardinería'
  phone: string;
  email?: string;
}

export interface Product {
  id: string;
  barcode: string;
  description: string;
  sellType: string;
  costPrice: number;
  salePrice: number;
  wholesalePrice: number;
  department: string;
  useInventory: boolean;
  currentStock: number;
  minStock: number;
  image?: string;
}

export interface SaleItem {
  productId: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Sale {
  id: string;
  date: string; // ISO string
  items: SaleItem[];
  subtotal: number;
  itbis: number;
  total: number;
  paymentMethod: string;
  clientName?: string;
  notes?: string;
  bank?: string;
  reference?: string;
  exchangeRate?: number;
  usdAmount?: number;
  corteId?: string;
}

export interface Client {
  id: string;
  fullName: string;
  whatsapp: string;
  address: string;
  rnc: string;
  email: string;
  createdAt: string;
}

export interface TicketSettings {
  businessName: string;
  address: string;
  phone: string;
  rnc: string;
  logoUrl: string;
  farewellMessage: string;
  printSize: string;
  typography: string;
  isBold: boolean;
  showLogo: boolean;
  openDrawer: boolean;
  fontSize: number;
}

export interface QuoteItem {
  productId: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Quote {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  items: QuoteItem[];
  subtotal: number;
  itbis: number;
  total: number;
  status: 'Pendiente' | 'Facturado' | 'Vencido';
}

export interface AppUser {
  id: string;
  name: string;
  username: string;
  passwordHash: string; // we store the password directly or hashed (using plain text as per user requirement)
  cargo: string;
  permissions: string[]; // e.g. ['dashboard', 'income', 'expense', 'billing', 'generalBilling', 'calculator', 'cashClose', 'condos', 'settings']
  createdAt: string;
}

export interface AreaTrabajo {
  id: string;
  name: string;
  createdAt: number;
}

export interface Empleado {
  id: string;
  name: string;
  phone: string;
  address: string;
  photo?: string;
  role: string;
  areaId: string;
  createdAt: number;
}

export interface Recibo {
  id: string;
  transactionId?: string;
  saleId?: string;
  tipo: "ingreso" | "egreso" | "nomina" | "venta" | "pago_mantenimiento";
  sequence: string;
  concepto: string;
  monto: number;
  fecha: string;
  descripcion?: string;
  beneficiario: string;
  condominioId?: string;
  createdAt: number;
  m3?: number;
  conversionFactor?: number;
  lecturaActual?: number;
  lecturaAnterior?: number;
  unidadId?: string;
}

export interface CorteCaja {
  id: string;
  date: string; // ISO String representation of when the cut was made
  salesCount: number;
  totalSales: number;
  totalOtherIncome: number;
  totalExpenses: number;
  totalCOGS: number;
  netProfit: number;
  salesIds: string[];
  transactionIds: string[];
  notes?: string;
  cashExpected: number;
  cashReported: number;
  difference: number;
  closedBy: string; // User who made the cut
}


