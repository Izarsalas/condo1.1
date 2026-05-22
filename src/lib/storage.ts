import { 
  Condominio, 
  Transaction, 
  Category, 
  Concept, 
  TransactionType, 
  Unidad,
  Tarea,
  Mantenimiento,
  Reparacion,
  Conserje,
  Proveedor,
  Product,
  Sale,
  Client,
  Quote,
  TicketSettings,
  AppUser,
  Empleado,
  AreaTrabajo,
  Recibo,
  CorteCaja
} from '../types';

const STORAGE_KEYS = {
  CONDOS: 'condobill_condos',
  TRANSACTIONS: 'condobill_transactions',
  CATEGORIES: 'condobill_categories',
  CONCEPTS: 'condobill_concepts',
  UNITS: 'condobill_units',
  TASKS: 'condobill_tasks',
  MAINTENANCE: 'condobill_maintenance',
  REPAIRS: 'condobill_repairs',
  STAFF: 'condobill_staff',
  SUPPLIERS: 'condobill_suppliers',
  PRODUCTS: 'condobill_products',
  DEPARTMENTS: 'condobill_departments',
  SALES: 'condobill_sales',
  CLIENTS: 'condobill_clients',
  QUOTES: 'condobill_quotes',
  TICKET_SETTINGS: 'condobill_ticket_settings',
  AUTO_SAVE_SETTINGS: 'condobill_auto_save_settings',
  USERS: 'condobill_users',
  CURRENT_USER: 'condobill_current_user',
  EMPLOYEES: 'condobill_employees',
  WORK_AREAS: 'condobill_work_areas',
  RECEIPTS: 'condobill_receipts',
  CORTES: 'condobill_cortes'
};

export const DEFAULT_ADMIN_USER: AppUser = {
  id: 'user-admin',
  name: 'Administrador Principal',
  username: 'Admin',
  passwordHash: '12345',
  cargo: 'Administrador',
  permissions: ['dashboard', 'income', 'expense', 'billing', 'generalBilling', 'calculator', 'cashClose', 'condos', 'settings', 'users', 'personal', 'reporte_diario'],
  createdAt: new Date().toISOString()
};

export interface AutoSaveSettings {
  enabled: boolean;
  interval: number; // in minutes
}

export const DEFAULT_AUTO_SAVE: AutoSaveSettings = {
  enabled: false,
  interval: 30
};

export const DEFAULT_TICKET_SETTINGS: TicketSettings = {
  businessName: 'Y.G Facturación',
  address: 'Calle Principal #123, Sect',
  phone: '809-555-0123',
  rnc: '101-23456-7',
  logoUrl: 'https://picsum.photos/seed/shop/200/200',
  farewellMessage: '¡Gracias por su compra!',
  printSize: 'POS 80mm (Estándar)',
  typography: 'STANDARD',
  isBold: true,
  showLogo: true,
  openDrawer: true,
  fontSize: 10
};

export const INITIAL_DEPARTMENTS = [
  'Sin Departamento'
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-inc-ordinary', name: 'INGRESOS ORDINARIOS', type: TransactionType.INCOME, isSystem: true },
  { id: 'cat-inc-extraordinary', name: 'INGRESOS EXTRAORDINARIOS', type: TransactionType.INCOME, isSystem: true },
  { id: 'cat-inc-others', name: 'Otros Ingresos', type: TransactionType.INCOME, isSystem: false },
  
  { id: 'cat-exp-basic', name: 'SERVICIOS BÁSICOS', type: TransactionType.EXPENSE, isSystem: true },
  { id: 'cat-exp-mant', name: 'MANTENIMIENTO', type: TransactionType.EXPENSE, isSystem: true },
  { id: 'cat-exp-admin', name: 'GASTOS ADMINISTRATIVO', type: TransactionType.EXPENSE, isSystem: true },
  { id: 'cat-exp-security', name: 'SEGURIDAD', type: TransactionType.EXPENSE, isSystem: true },
  { id: 'cat-exp-services', name: 'PRESTACIÓN DE SERVICIO', type: TransactionType.EXPENSE, isSystem: true },
  { id: 'cat-exp-supplies', name: 'SUMINISTROS Y COMPRAS', type: TransactionType.EXPENSE, isSystem: true },
  { id: 'cat-exp-payroll', name: 'NÓMINA', type: TransactionType.EXPENSE, isSystem: true },
  { id: 'cat-exp-others', name: 'Otros Gastos', type: TransactionType.EXPENSE, isSystem: false },
];

export const INITIAL_CONCEPTS: Concept[] = [
  { id: 'con-inc-1', categoryId: 'cat-inc-ordinary', name: 'Cuotas de Mantenimientos', isSystem: true },
  { id: 'con-inc-2', categoryId: 'cat-inc-ordinary', name: 'Consumo de Gas', isSystem: true },
  { id: 'con-inc-3', categoryId: 'cat-inc-extraordinary', name: 'MORA', isSystem: true },
  { id: 'con-inc-4', categoryId: 'cat-inc-extraordinary', name: 'Otros Ingresos Extraordinarios', isSystem: true },

  { id: 'con-exp-1', categoryId: 'cat-exp-basic', name: 'Energía Eléctrica', isSystem: true },
  
  { id: 'con-exp-2', categoryId: 'cat-exp-mant', name: 'Mantenimiento', isSystem: true },
  { id: 'con-exp-3', categoryId: 'cat-exp-mant', name: 'Instalaciones Eléctricas', isSystem: true },
  { id: 'con-exp-4', categoryId: 'cat-exp-mant', name: 'Mantenimiento de Motor', isSystem: true },
  { id: 'con-exp-5', categoryId: 'cat-exp-mant', name: 'Mantenimiento de Piscina', isSystem: true },
  { id: 'con-exp-6', categoryId: 'cat-exp-mant', name: 'Reparaciones', isSystem: true },

  { id: 'con-exp-7', categoryId: 'cat-exp-admin', name: 'Gastos Administrativos', isSystem: true },

  { id: 'con-exp-8', categoryId: 'cat-exp-security', name: 'Servicio de Guardianía', isSystem: true },

  { id: 'con-exp-9', categoryId: 'cat-exp-services', name: 'Servicio de Limpieza', isSystem: true },

  { id: 'con-exp-10', categoryId: 'cat-exp-supplies', name: 'Herramientas y Ferretería', isSystem: true },
  { id: 'con-exp-11', categoryId: 'cat-exp-supplies', name: 'Compra de Gas Propano', isSystem: true },

  { id: 'con-exp-12', categoryId: 'cat-exp-payroll', name: 'Salario', isSystem: true },
  { id: 'con-exp-13', categoryId: 'cat-exp-payroll', name: 'Beneficios de Ley', isSystem: true },
];

export const storage = {
  getCondos: (): Condominio[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CONDOS);
    return data ? JSON.parse(data) : [];
  },
  saveCondos: (condos: Condominio[]) => {
    localStorage.setItem(STORAGE_KEYS.CONDOS, JSON.stringify(condos));
  },
  
  getTransactions: (): Transaction[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  },
  saveTransactions: (transactions: Transaction[]) => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },
  
  getCategories: (): Category[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return data ? JSON.parse(data) : INITIAL_CATEGORIES;
  },
  saveCategories: (categories: Category[]) => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  },
  
  getConcepts: (): Concept[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CONCEPTS);
    return data ? JSON.parse(data) : INITIAL_CONCEPTS;
  },
  saveConcepts: (concepts: Concept[]) => {
    localStorage.setItem(STORAGE_KEYS.CONCEPTS, JSON.stringify(concepts));
  },
  
  getUnits: (): Unidad[] => {
    const data = localStorage.getItem(STORAGE_KEYS.UNITS);
    return data ? JSON.parse(data) : [];
  },
  saveUnits: (units: Unidad[]) => {
    localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(units));
  },
  
  getTasks: (): Tarea[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    return data ? JSON.parse(data) : [];
  },
  saveTasks: (tasks: Tarea[]) => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  },
  
  getMaintenance: (): Mantenimiento[] => {
    const data = localStorage.getItem(STORAGE_KEYS.MAINTENANCE);
    return data ? JSON.parse(data) : [];
  },
  saveMaintenance: (m: Mantenimiento[]) => {
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(m));
  },
  
  getRepairs: (): Reparacion[] => {
    const data = localStorage.getItem(STORAGE_KEYS.REPAIRS);
    return data ? JSON.parse(data) : [];
  },
  saveRepairs: (r: Reparacion[]) => {
    localStorage.setItem(STORAGE_KEYS.REPAIRS, JSON.stringify(r));
  },
  
  getStaff: (): Conserje[] => {
    const data = localStorage.getItem(STORAGE_KEYS.STAFF);
    return data ? JSON.parse(data) : [];
  },
  saveStaff: (s: Conserje[]) => {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(s));
  },
  
  getSuppliers: (): Proveedor[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    return data ? JSON.parse(data) : [];
  },
  saveSuppliers: (s: Proveedor[]) => {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(s));
  },
  
  getProducts: (): Product[] => {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const products: Product[] = data ? JSON.parse(data) : [];
    const unwanted = ['Abarrotes', 'Electrónica', 'Hogar', 'Farmacia', 'Ferretería', 'Limpieza'];
    return products.map(p => 
      unwanted.includes(p.department) ? { ...p, department: 'Sin Departamento' } : p
    );
  },
  saveProducts: (p: Product[]) => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(p));
  },
  
  getDepartments: (): string[] => {
    const data = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
    const depts: string[] = data ? JSON.parse(data) : INITIAL_DEPARTMENTS;
    const unwanted = ['Abarrotes', 'Electrónica', 'Hogar', 'Farmacia', 'Ferretería', 'Limpieza'];
    return depts.filter(d => !unwanted.includes(d));
  },
  saveDepartments: (d: string[]) => {
    localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(d));
  },
  
  getSales: (): Sale[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SALES);
    return data ? JSON.parse(data) : [];
  },
  addSale: (s: Sale) => {
    const sales = storage.getSales();
    sales.push(s);
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
  },
  saveSales: (s: Sale[]) => {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(s));
  },
  
  getClients: (): Client[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    return data ? JSON.parse(data) : [];
  },
  saveClients: (c: Client[]) => {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(c));
  },
  
  getQuotes: (): Quote[] => {
    const data = localStorage.getItem(STORAGE_KEYS.QUOTES);
    return data ? JSON.parse(data) : [];
  },
  saveQuotes: (q: Quote[]) => {
    localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(q));
  },
  
  getTicketSettings: (): TicketSettings => {
    const data = localStorage.getItem(STORAGE_KEYS.TICKET_SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_TICKET_SETTINGS;
  },
  saveTicketSettings: (s: TicketSettings) => {
    localStorage.setItem(STORAGE_KEYS.TICKET_SETTINGS, JSON.stringify(s));
  },

  getAutoSaveSettings: (): AutoSaveSettings => {
    const data = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE_SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_AUTO_SAVE;
  },
  saveAutoSaveSettings: (s: AutoSaveSettings) => {
    localStorage.setItem(STORAGE_KEYS.AUTO_SAVE_SETTINGS, JSON.stringify(s));
  },

  getUsers: (): AppUser[] => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    let usersList: AppUser[] = [];
    if (!data) {
      usersList = [DEFAULT_ADMIN_USER];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(usersList));
    } else {
      try {
        usersList = JSON.parse(data);
        if (!Array.isArray(usersList)) {
          usersList = [DEFAULT_ADMIN_USER];
        }
      } catch (e) {
        usersList = [DEFAULT_ADMIN_USER];
      }
    }
    
    // Ensure that Admin user exists! If no user has admin username or id, always recover it
    const adminExists = usersList.some(
      (u) => u.id === "user-admin" || u.username.toLowerCase() === "admin"
    );
    let altered = !adminExists;
    if (!adminExists) {
      usersList.push({ ...DEFAULT_ADMIN_USER });
    }

    // Auto-update Admin user if permission 'users', 'personal' or 'reporte_diario' is missing
    const migratedUsers = usersList.map((u) => {
      if (u.id === "user-admin" || u.username.toLowerCase() === "admin") {
        let updatedPermissions = [...(u.permissions || [])];
        if (!updatedPermissions.includes("users")) {
          updatedPermissions.push("users");
          altered = true;
        }
        if (!updatedPermissions.includes("personal")) {
          updatedPermissions.push("personal");
          altered = true;
        }
        if (!updatedPermissions.includes("reporte_diario")) {
          updatedPermissions.push("reporte_diario");
          altered = true;
        }
        u.permissions = updatedPermissions;
        
        // Ensure admin has a password hash set
        if (!u.passwordHash) {
          u.passwordHash = "12345";
          altered = true;
        }
      }
      return u;
    });

    if (altered) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(migratedUsers));
    }
    return migratedUsers;
  },
  saveUsers: (users: AppUser[]) => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },
  getCurrentUser: (): AppUser | null => {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!data) return null;
    try {
      const user = JSON.parse(data) as AppUser;
      if (user && (user.id === "user-admin" || user.username.toLowerCase() === "admin")) {
        let updatedPermissions = [...user.permissions];
        let altered = false;
        if (!updatedPermissions.includes("users")) {
          updatedPermissions.push("users");
          altered = true;
        }
        if (!updatedPermissions.includes("personal")) {
          updatedPermissions.push("personal");
          altered = true;
        }
        if (!updatedPermissions.includes("reporte_diario")) {
          updatedPermissions.push("reporte_diario");
          altered = true;
        }
        if (altered) {
          user.permissions = updatedPermissions;
        }
      }
      return user;
    } catch (e) {
      return null;
    }
  },
  saveCurrentUser: (user: AppUser | null) => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },

  getEmployees: (): Empleado[] => {
    const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    return data ? JSON.parse(data) : [];
  },
  saveEmployees: (e: Empleado[]) => {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(e));
  },
  getWorkAreas: (): AreaTrabajo[] => {
    const data = localStorage.getItem(STORAGE_KEYS.WORK_AREAS);
    if (!data) {
      const initialAreas: AreaTrabajo[] = [
        { id: 'area-admin', name: 'Administración', createdAt: Date.now() },
        { id: 'area-ventas', name: 'Ventas', createdAt: Date.now() - 1000 },
        { id: 'area-soporte', name: 'Soporte y Operaciones', createdAt: Date.now() - 2000 }
      ];
      localStorage.setItem(STORAGE_KEYS.WORK_AREAS, JSON.stringify(initialAreas));
      return initialAreas;
    }
    return JSON.parse(data);
  },
  saveWorkAreas: (wa: AreaTrabajo[]) => {
    localStorage.setItem(STORAGE_KEYS.WORK_AREAS, JSON.stringify(wa));
  },
  getReceipts: (): Recibo[] => {
    const data = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    return data ? JSON.parse(data) : [];
  },
  saveReceipts: (r: Recibo[]) => {
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(r));
  },
  getCortes: (): CorteCaja[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CORTES);
    return data ? JSON.parse(data) : [];
  },
  saveCortes: (c: CorteCaja[]) => {
    localStorage.setItem(STORAGE_KEYS.CORTES, JSON.stringify(c));
  },

  exportAllData: () => {
    const allData: Record<string, any> = {};
    Object.values(STORAGE_KEYS).forEach(key => {
      const data = localStorage.getItem(key);
      if (data) allData[key] = JSON.parse(data);
    });
    return allData;
  },

  importAllData: (data: Record<string, any>) => {
    Object.entries(data).forEach(([key, value]) => {
      // Basic validation: only import keys that belong to this app
      if (Object.values(STORAGE_KEYS).includes(key)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    });
  }
};
