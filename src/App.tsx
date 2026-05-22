import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  MinusCircle,
  Building2,
  Settings as SettingsIcon,
  History,
  RotateCcw,
  Info,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Layers,
  ArrowRightLeft,
  Trash2,
  Edit2,
  Check,
  X,
  Menu,
  BadgeDollarSign,
  Droplets,
  Flame,
  Zap,
  ShieldCheck,
  Wrench,
  Users,
  HardHat,
  Package,
  Phone,
  Mail,
  Camera,
  Home,
  ReceiptText,
  ShoppingCart,
  Tag,
  ClipboardList,
  FileText,
  Plus,
  BarChart3,
  Image as ImageIcon,
  Box,
  AlertTriangle,
  Search,
  PlusSquare,
  ShoppingBag,
  ArrowLeftRight,
  Printer,
  Download,
  Upload,
  Database,
  Shield,
  Clock,
  Minus,
  DollarSign,
  FilePlus,
  MessageCircle,
  Briefcase,
  UserRound,
  Save,
  CreditCard,
  Type,
  Laptop,
  Sparkles,
  Cloud,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence } from "motion/react";
import { AutoSaveSettings, storage } from "./lib/storage";
import { DailySalesView } from "./components/DailySalesView";
import { CalculatorView } from "./components/CalculatorView";
import { CashCloseView } from "./components/CashCloseView";
import {
  GasRate,
  CalculationResult,
  Condominio,
  Transaction,
  TransactionType,
  Category,
  Concept,
  Unidad,
  Tarea,
  Mantenimiento,
  Reparacion,
  Conserje,
  Proveedor,
  Product,
  Sale,
  Client,
  SaleItem,
  Quote,
  QuoteItem,
  TicketSettings,
  AppUser,
  Empleado,
  AreaTrabajo,
  Recibo,
  CorteCaja,
} from "./types";
import * as XLSX from "xlsx";
import LoginView from "./components/LoginView";
import UsersView from "./components/UsersView";
import { PersonalView } from "./components/PersonalView";
import DailyReportView from "./components/DailyReportView";
import FirebaseSyncPanel from "./components/FirebaseSyncPanel";
import { auth, db } from "./lib/firebase";
import { uploadToCloud } from "./lib/firebaseSync";
import { PublicOwnerRegistration } from "./components/PublicOwnerRegistration";
import { onSnapshot, collection, doc, setDoc } from "firebase/firestore";

type AppTab =
  | "dashboard"
  | "income"
  | "expense"
  | "billing"
  | "generalBilling"
  | "personal"
  | "reporte_diario"
  | "calculator"
  | "cashClose"
  | "condos"
  | "settings"
  | "users";

// Helper for formatting currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(amount);
};

export default function App() {
  const isPublicRegistration = typeof window !== "undefined" && window.location.search.includes("register-owner=true");

  if (isPublicRegistration) {
    return <PublicOwnerRegistration />;
  }

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => storage.getCurrentUser());
  const [users, setUsers] = useState<AppUser[]>(() => storage.getUsers());
  const [pendingRegistrations, setPendingRegistrations] = useState<any[]>([]);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<"ticket" | "income" | "expense" | "security" | "brand">("ticket");
  const [processedCount, setProcessedCount] = useState(0);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupListener = (fbUser: any) => {
      if (!fbUser) return;
      const colRef = collection(db, "users", fbUser.uid, "owner_registrations");
      
      unsubscribe = onSnapshot(colRef, async (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });

        const pending = list.filter((r) => r.status === "pending");
        setPendingRegistrations(pending);

        if (pending.length > 0) {
          let unitsChanged = false;
          let updatedUnitsList = [...storage.getUnits()];

          for (const reg of pending) {
            const existingIndex = updatedUnitsList.findIndex(
              (u) =>
                u.condominioId === reg.condominioId &&
                u.numero.toLowerCase().trim() === reg.numero.toLowerCase().trim()
            );

            if (existingIndex > -1) {
              updatedUnitsList[existingIndex] = {
                ...updatedUnitsList[existingIndex],
                ownerName: reg.ownerName,
                whatsapp: reg.whatsapp,
                email: reg.email || updatedUnitsList[existingIndex].email,
                photo: reg.photo || updatedUnitsList[existingIndex].photo
              };
              unitsChanged = true;
            } else {
              const newUnit = {
                id: crypto.randomUUID(),
                condominioId: reg.condominioId,
                numero: reg.numero,
                ownerName: reg.ownerName,
                whatsapp: reg.whatsapp,
                email: reg.email || "",
                photo: reg.photo || "",
                maintenanceFee: 0
              };
              updatedUnitsList.push(newUnit);
              unitsChanged = true;
            }

            // Mark as processed in Firestore
            try {
              await setDoc(doc(db, "users", fbUser.uid, "owner_registrations", reg.id), {
                ...reg,
                status: "processed",
                processedAt: Date.now()
              });
            } catch (err) {
              console.error("Error setting status to processed in background:", err);
            }
          }

          if (unitsChanged) {
            setUnits(updatedUnitsList);
            storage.saveUnits(updatedUnitsList);
            setProcessedCount((prev) => prev + pending.length);
          }
        }
      }, (error) => {
        console.error("Error in owner registrations listener:", error);
      });
    };

    const authUnsubscribe = auth.onAuthStateChanged((fbUser) => {
      setFirebaseUser(fbUser);
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (fbUser) {
        setupListener(fbUser);
      }
    });

    return () => {
      authUnsubscribe();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [condos, setCondos] = useState<Condominio[]>(() => {
    const loaded = storage.getCondos();
    if (loaded.length === 0) {
      return [{
        id: "condo-default",
        name: "los parados citi",
        address: "Santo Domingo, RD",
        createdAt: Date.now(),
      }];
    }
    return loaded;
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => storage.getTransactions());
  const [categories, setCategories] = useState<Category[]>(() => storage.getCategories());
  const [concepts, setConcepts] = useState<Concept[]>(() => storage.getConcepts());
  const [units, setUnits] = useState<Unidad[]>(() => storage.getUnits());
  const [tasks, setTasks] = useState<Tarea[]>(() => storage.getTasks());
  const [maintenance, setMaintenance] = useState<Mantenimiento[]>(() => storage.getMaintenance());
  const [repairs, setRepairs] = useState<Reparacion[]>(() => storage.getRepairs());
  const [staff, setStaff] = useState<Conserje[]>(() => storage.getStaff());
  const [suppliers, setSuppliers] = useState<Proveedor[]>(() => storage.getSuppliers());
  const [products, setProducts] = useState<Product[]>(() => storage.getProducts());
  const [sales, setSales] = useState<Sale[]>(() => storage.getSales());
  const [cortes, setCortes] = useState<CorteCaja[]>(() => storage.getCortes());
  const [employees, setEmployees] = useState<Empleado[]>(() => storage.getEmployees());
  const [areas, setAreas] = useState<AreaTrabajo[]>(() => storage.getWorkAreas());
  const [receipts, setReceipts] = useState<Recibo[]>(() => storage.getReceipts());
  const [autoSaveSettings, setAutoSaveSettings] = useState<AutoSaveSettings>(
    storage.getAutoSaveSettings(),
  );
  const [selectedCondoId, setSelectedCondoId] = useState<string | null>(() => {
    const loaded = storage.getCondos();
    return loaded.length > 0 ? loaded[0].id : "condo-default";
  });
  const [ticketSettings, setTicketSettings] = useState<TicketSettings>(
    storage.getTicketSettings(),
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Estados de Personalización Libre de Marca
  const [appNameText, setAppNameText] = useState<string>(() => {
    return localStorage.getItem("condobill_custom_app_name") || "CONDOBill";
  });
  const [developerName, setDeveloperName] = useState<string>(() => {
    return localStorage.getItem("condobill_custom_dev_name") || "Izar Salas";
  });
  const [hideDeveloperName, setHideDeveloperName] = useState<boolean>(() => {
    return localStorage.getItem("condobill_custom_hide_dev") === "true";
  });

  // Guardar configuración de auto-guardado cuando cambie
  useEffect(() => {
    storage.saveAutoSaveSettings(autoSaveSettings);
  }, [autoSaveSettings]);

  // Lógica de respaldo automático
  useEffect(() => {
    if (!autoSaveSettings.enabled) return;

    const intervalId = setInterval(
      () => {
        const data = storage.exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `backup_auto_${new Date().toISOString().replace(/:/g, "-")}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      autoSaveSettings.interval * 60 * 1000,
    );

    return () => clearInterval(intervalId);
  }, [autoSaveSettings]);

  // Load data on start
  useEffect(() => {
    storage.saveTicketSettings(ticketSettings);
  }, [ticketSettings]);

  useEffect(() => {
    const loadedCondos = storage.getCondos();

    // Bootstrap a default condo if none exists for demo/first-run
    let finalCondos = [...loadedCondos];
    if (finalCondos.length === 0) {
      const defaultCondo: Condominio = {
        id: "condo-default",
        name: "los parados citi",
        address: "Santo Domingo, RD",
        createdAt: Date.now(),
      };
      finalCondos.push(defaultCondo);
    }

    const loadedTransactions = storage.getTransactions();
    const loadedCategories = storage.getCategories();
    const loadedConcepts = storage.getConcepts();

    // Ensure ordinary and extraordinary categories exist (for compatibility)
    let updatedCategories = [...loadedCategories];
    let updatedConcepts = [...loadedConcepts];

    if (!updatedCategories.some((c) => c.name === "INGRESOS ORDINARIOS")) {
      const ordId = "cat-inc-ordinary";
      updatedCategories.push({
        id: ordId,
        name: "INGRESOS ORDINARIOS",
        type: TransactionType.INCOME,
        isSystem: true,
      });
      if (!updatedConcepts.some((c) => c.categoryId === ordId)) {
        updatedConcepts.push({
          id: "con-inc-1-m",
          categoryId: ordId,
          name: "Cuotas de Mantenimientos",
          isSystem: true,
        });
        updatedConcepts.push({
          id: "con-inc-2-g",
          categoryId: ordId,
          name: "Consumo de Gas",
          isSystem: true,
        });
      }
    }
    if (!updatedCategories.some((c) => c.name === "INGRESOS EXTRAORDINARIOS")) {
      const extId = "cat-inc-extraordinary";
      updatedCategories.push({
        id: extId,
        name: "INGRESOS EXTRAORDINARIOS",
        type: TransactionType.INCOME,
        isSystem: true,
      });
      if (!updatedConcepts.some((c) => c.categoryId === extId)) {
        updatedConcepts.push({
          id: "con-inc-3-mr",
          categoryId: extId,
          name: "MORA",
          isSystem: true,
        });
      }
    }

    // Expense Categories Compatibility
    const expCats = [
      {
        id: "cat-exp-basic",
        name: "SERVICIOS BÁSICOS",
        concepts: ["Energía Eléctrica"],
      },
      {
        id: "cat-exp-mant",
        name: "MANTENIMIENTO",
        concepts: [
          "Mantenimiento",
          "Instalaciones Eléctricas",
          "Mantenimiento de Motor",
          "Mantenimiento de Piscina",
          "Reparaciones",
        ],
      },
      {
        id: "cat-exp-admin",
        name: "GASTOS ADMINISTRATIVO",
        concepts: ["Gastos Administrativos"],
      },
      {
        id: "cat-exp-security",
        name: "SEGURIDAD",
        concepts: ["Servicio de Guardianía"],
      },
      {
        id: "cat-exp-services",
        name: "PRESTACIÓN DE SERVICIO",
        concepts: ["Servicio de Limpieza"],
      },
      {
        id: "cat-exp-supplies",
        name: "SUMINISTROS Y COMPRAS",
        concepts: ["Herramientas y Ferretería", "Compra de Gas Propano"],
      },
      {
        id: "cat-exp-payroll",
        name: "NÓMINA",
        concepts: ["Salario", "Beneficios de Ley"],
      },
    ];

    expCats.forEach((catInfo) => {
      if (!updatedCategories.some((c) => c.name === catInfo.name)) {
        updatedCategories.push({
          id: catInfo.id,
          name: catInfo.name,
          type: TransactionType.EXPENSE,
          isSystem: true,
        });
        catInfo.concepts.forEach((name, i) => {
          if (
            !updatedConcepts.some(
              (c) => c.categoryId === catInfo.id && c.name === name,
            )
          ) {
            updatedConcepts.push({
              id: `${catInfo.id}-con-${i}`,
              categoryId: catInfo.id,
              name,
              isSystem: true,
            });
          }
        });
      }
    });

    const loadedUnits = storage.getUnits();
    const loadedTasks = storage.getTasks();
    const loadedMaintenance = storage.getMaintenance();
    const loadedRepairs = storage.getRepairs();
    const loadedStaff = storage.getStaff();
    const loadedSuppliers = storage.getSuppliers();
    const loadedProducts = storage.getProducts();
    const loadedSales = storage.getSales();
    const loadedEmployees = storage.getEmployees();
    const loadedAreas = storage.getWorkAreas();
    const loadedReceipts = storage.getReceipts();
    const loadedCortes = storage.getCortes();

    setCondos(finalCondos);
    setTransactions(loadedTransactions);
    setCategories(updatedCategories);
    setConcepts(updatedConcepts);
    setUnits(loadedUnits);
    setTasks(loadedTasks);
    setMaintenance(loadedMaintenance);
    setRepairs(loadedRepairs);
    setStaff(loadedStaff);
    setSuppliers(loadedSuppliers);
    setProducts(loadedProducts);
    setSales(loadedSales);
    setCortes(loadedCortes);
    setEmployees(loadedEmployees);
    setAreas(loadedAreas);
    setReceipts(loadedReceipts);
    setUsers(storage.getUsers());

    if (finalCondos.length > 0) {
      setSelectedCondoId(finalCondos[0].id);
    }
  }, []);

  const handleReloadFromLocalStorage = () => {
    setCondos(storage.getCondos());
    setTransactions(storage.getTransactions());
    setCategories(storage.getCategories());
    setConcepts(storage.getConcepts());
    setUnits(storage.getUnits());
    setTasks(storage.getTasks());
    setMaintenance(storage.getMaintenance());
    setRepairs(storage.getRepairs());
    setStaff(storage.getStaff());
    setSuppliers(storage.getSuppliers());
    setProducts(storage.getProducts());
    setSales(storage.getSales());
    setCortes(storage.getCortes());
    setEmployees(storage.getEmployees());
    setAreas(storage.getWorkAreas());
    setReceipts(storage.getReceipts());
    setUsers(storage.getUsers());
  };

  // Save users state changes
  useEffect(() => {
    storage.saveUsers(users);
  }, [users]);

  // Save data when it changes
  useEffect(() => {
    storage.saveCondos(condos);
  }, [condos]);

  useEffect(() => {
    storage.saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    storage.saveCategories(categories);
  }, [categories]);

  useEffect(() => {
    storage.saveConcepts(concepts);
  }, [concepts]);

  useEffect(() => {
    storage.saveUnits(units);
  }, [units]);

  useEffect(() => {
    storage.saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    storage.saveMaintenance(maintenance);
  }, [maintenance]);

  useEffect(() => {
    storage.saveRepairs(repairs);
  }, [repairs]);

  useEffect(() => {
    storage.saveStaff(staff);
  }, [staff]);

  useEffect(() => {
    storage.saveSuppliers(suppliers);
  }, [suppliers]);

  useEffect(() => {
    storage.saveProducts(products);
  }, [products]);

  useEffect(() => {
    storage.saveSales(sales);
  }, [sales]);

  useEffect(() => {
    storage.saveCortes(cortes);
  }, [cortes]);

  useEffect(() => {
    storage.saveEmployees(employees);
  }, [employees]);

  useEffect(() => {
    storage.saveWorkAreas(areas);
  }, [areas]);

  useEffect(() => {
    storage.saveReceipts(receipts);
  }, [receipts]);

  // Sincronización automática de datos local-nube en segundo plano
  useEffect(() => {
    const rawSyncSetting = localStorage.getItem("condobill_auto_cloud_sync");
    const isAutoSyncEnabled = rawSyncSetting === null ? true : rawSyncSetting === "true";
    if (!isAutoSyncEnabled) return;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    const timer = setTimeout(async () => {
      try {
        await uploadToCloud(firebaseUser.uid);
        console.log("[Firebase] Respaldo automático en segundo plano completado con éxito.");
      } catch (err) {
        console.warn("[Firebase] Error al respaldar automáticamente en la nube:", err);
      }
    }, 4500); // 4.5s debounce

    return () => clearTimeout(timer);
  }, [
    condos,
    transactions,
    categories,
    concepts,
    units,
    tasks,
    maintenance,
    repairs,
    staff,
    suppliers,
    products,
    sales,
    cortes,
    employees,
    areas,
    receipts,
  ]);

  const handleAddUser = (newUserData: Omit<AppUser, "createdAt">) => {
    const newUser: AppUser = {
      ...newUserData,
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [...prev, newUser]);
  };

  const handleUpdateUser = (updatedUser: AppUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      storage.saveCurrentUser(updatedUser);
    }
  };

  const handleDeleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleAddEmployee = (emp: Empleado) => {
    setEmployees((prev) => [...prev, emp]);
  };

  const handleUpdateEmployee = (emp: Empleado) => {
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
  };

  const handleDeleteEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const handleAddArea = (area: AreaTrabajo) => {
    setAreas((prev) => [...prev, area]);
  };

  const handleUpdateArea = (area: AreaTrabajo) => {
    setAreas((prev) => prev.map((a) => (a.id === area.id ? area : a)));
  };

  const handleDeleteArea = (id: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== id));
  };

  // Redirect to first allowed tab if user lacks privileges for the current tab
  useEffect(() => {
    if (currentUser && currentUser.username.toLowerCase() === "admin") {
      // Direct pass: master admin is never locked out of any view
      return;
    }
    if (currentUser && currentUser.permissions && currentUser.permissions.length > 0) {
      if (!currentUser.permissions.includes(activeTab)) {
        const allowedTabs = currentUser.permissions as AppTab[];
        if (allowedTabs.length > 0) {
          setActiveTab(allowedTabs[0]);
        }
      }
    }
  }, [currentUser, activeTab]);

  const selectedCondo = useMemo(
    () => condos.find((c) => c.id === selectedCondoId) || null,
    [condos, selectedCondoId],
  );

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => t.condominioId === selectedCondoId),
    [transactions, selectedCondoId],
  );

  const stats = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const addCondo = (
    name: string,
    address: string,
    photo?: string,
    reminderStartDay?: number,
  ) => {
    const newCondo: Condominio = {
      id: crypto.randomUUID(),
      name,
      address,
      photo,
      createdAt: Date.now(),
      reminderStartDay,
    };
    setCondos((prev) => [...prev, newCondo]);
    if (!selectedCondoId) setSelectedCondoId(newCondo.id);
  };

  const updateCondo = (
    id: string,
    name: string,
    address: string,
    photo?: string,
    reminderStartDay?: number,
  ) => {
    setCondos((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, name, address, photo, reminderStartDay } : c,
      ),
    );
  };

  const deleteCondo = (id: string) => {
    setCondos((prev) => prev.filter((c) => c.id !== id));
    setTransactions((prev) => prev.filter((t) => t.condominioId !== id));
    if (selectedCondoId === id) {
      setSelectedCondoId(condos.find((c) => c.id !== id)?.id || null);
    }
  };

  const addTransaction = (transaction: Omit<Transaction, "id">) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };
    setTransactions((prev) => [newTransaction, ...prev]);

    // Automatically generate a receipt record for the system
    let nextNum = 1;
    const loadedReceipts = storage.getReceipts();
    if (loadedReceipts.length > 0) {
      nextNum = loadedReceipts.length + 1;
    }
    const sequence = `REC-${String(nextNum).padStart(4, "0")}`;

    // Determine beneficiary / recipient info
    let beneficiario = "";
    if (newTransaction.employeeId) {
      const emp = employees.find((e) => e.id === newTransaction.employeeId);
      beneficiario = emp ? `${emp.name} (${emp.role})` : "Empleado / Colaborador";
    } else if (newTransaction.type === TransactionType.INCOME) {
      beneficiario = newTransaction.description || "Inquilino / Propietario / Cliente";
    } else {
      beneficiario = newTransaction.description || "Proveedor de Servicio / Suministros";
    }

    const isNomina = newTransaction.category === "NÓMINA" || 
                     (newTransaction.concept || "").toUpperCase() === "SALARIO" || 
                     (newTransaction.concept || "").toUpperCase() === "BENEFICIOS DE LEY" ||
                     newTransaction.employeeId !== undefined;

    const newReceipt: Recibo = {
      id: crypto.randomUUID(),
      transactionId: newTransaction.id,
      tipo: isNomina ? "nomina" : (newTransaction.type === TransactionType.INCOME ? "ingreso" : "egreso"),
      sequence,
      concepto: newTransaction.concept || newTransaction.category || "Transacción de Caja",
      monto: newTransaction.amount,
      fecha: newTransaction.date,
      descripcion: newTransaction.description,
      beneficiario,
      condominioId: newTransaction.condominioId,
      createdAt: Date.now(),
      m3: newTransaction.m3,
      conversionFactor: newTransaction.conversionFactor,
      lecturaActual: newTransaction.lecturaActual,
      lecturaAnterior: newTransaction.lecturaAnterior,
      unidadId: newTransaction.unidadId,
    };

    setReceipts((prev) => [newReceipt, ...prev]);

    // Automatically trigger PDF receipt download / print preview
    setTimeout(() => {
      generateReceiptPDF(newReceipt);
    }, 100);
  };

  const addUnit = (unit: Omit<Unidad, "id">) => {
    const newUnit: Unidad = { ...unit, id: crypto.randomUUID() };
    setUnits((prev) => [...prev, newUnit]);
  };

  const updateUnit = (id: string, updates: Partial<Unidad>) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    );
  };

  const deleteUnit = (id: string) => {
    setUnits((prev) => prev.filter((u) => u.id !== id));
  };

  // Task Handlers
  const addTask = (task: Omit<Tarea, "id">) => {
    const newTask: Tarea = { ...task, id: crypto.randomUUID() };
    setTasks((prev) => [...prev, newTask]);
  };

  const updateTask = (id: string, updates: Partial<Tarea>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Maintenance Handlers
  const addMaintenance = (m: Omit<Mantenimiento, "id">) => {
    const newM: Mantenimiento = { ...m, id: crypto.randomUUID() };
    setMaintenance((prev) => [...prev, newM]);
  };

  const updateMaintenance = (id: string, updates: Partial<Mantenimiento>) => {
    setMaintenance((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    );
  };

  const deleteMaintenance = (id: string) => {
    setMaintenance((prev) => prev.filter((m) => m.id !== id));
  };

  // Repair Handlers
  const addRepair = (r: Omit<Reparacion, "id">) => {
    const newR: Reparacion = { ...r, id: crypto.randomUUID() };
    setRepairs((prev) => [...prev, newR]);
  };

  const updateRepair = (id: string, updates: Partial<Reparacion>) => {
    setRepairs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );
  };

  const deleteRepair = (id: string) => {
    setRepairs((prev) => prev.filter((r) => r.id !== id));
  };

  // Staff Handlers
  const addStaff = (s: Omit<Conserje, "id">) => {
    const newS: Conserje = { ...s, id: crypto.randomUUID() };
    setStaff((prev) => [...prev, newS]);
  };

  const updateStaff = (id: string, updates: Partial<Conserje>) => {
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  };

  const deleteStaff = (id: string) => {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  };

  // Supplier Handlers
  const addSupplier = (s: Omit<Proveedor, "id">) => {
    const newS: Proveedor = { ...s, id: crypto.randomUUID() };
    setSuppliers((prev) => [...prev, newS]);
  };

  const deleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  const addConcept = (categoryId: string, name: string) => {
    const newCon: Concept = {
      id: crypto.randomUUID(),
      categoryId,
      name,
      isSystem: false,
    };
    setConcepts((prev) => [...prev, newCon]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const getIconForCategory = (catName: string) => {
    const name = catName.toLowerCase();
    if (name.includes("ordinario"))
      return <PlusCircle className="w-5 h-5 text-emerald-500" />;
    if (name.includes("extraordinario"))
      return <PlusSquare className="w-5 h-5 text-amber-500" />;
    if (name.includes("básico"))
      return <Zap className="w-5 h-5 text-yellow-500" />;
    if (name.includes("mantenimiento"))
      return <Wrench className="w-5 h-5 text-slate-500" />;
    if (name.includes("administrativo"))
      return <Briefcase className="w-5 h-5 text-blue-500" />;
    if (name.includes("seguridad"))
      return <ShieldCheck className="w-5 h-5 text-rose-500" />;
    if (name.includes("servicio"))
      return <UserRound className="w-5 h-5 text-teal-500" />;
    if (name.includes("suministro"))
      return <ShoppingBag className="w-5 h-5 text-orange-500" />;
    if (name.includes("nómina"))
      return <Users className="w-5 h-5 text-rose-600" />;
    if (name.includes("agua"))
      return <Droplets className="w-5 h-5 text-blue-500" />;
    if (name.includes("gas"))
      return <Flame className="w-5 h-5 text-orange-500" />;
    if (name.includes("energía") || name.includes("eléctrica"))
      return <Zap className="w-5 h-5 text-yellow-500" />;
    if (name.includes("seguridad"))
      return <ShieldCheck className="w-5 h-5 text-red-500" />;
    if (name.includes("mantenimiento"))
      return <Wrench className="w-5 h-5 text-green-600" />;
    if (
      name.includes("personal") ||
      name.includes("sueldo") ||
      name.includes("salario")
    )
      return <Users className="w-5 h-5 text-indigo-500" />;
    if (name.includes("limpieza"))
      return <HardHat className="w-5 h-5 text-cyan-500" />;
    if (name.includes("suministro") || name.includes("compra"))
      return <Package className="w-5 h-5 text-amber-600" />;
    return <Layers className="w-5 h-5 text-gray-400" />;
  };

  const handleNavClick = (tab: AppTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  if (!currentUser) {
    return (
      <LoginView
        onLogin={(user) => {
          setCurrentUser(user);
          storage.saveCurrentUser(user);
          if (user.permissions && user.permissions.length > 0) {
            setActiveTab(user.permissions[0] as AppTab);
          }
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-black flex items-center justify-between px-6 z-50 shadow-lg print:hidden">
        <h1 className="text-lg font-bold tracking-tight text-white">
          {appNameText.toLowerCase() === "condobill" ? (
            <>
              <span className="text-blue-500 font-extrabold">CONDO</span>Bill
            </>
          ) : (
            <span className="text-blue-500 font-extrabold">{appNameText}</span>
          )}
        </h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-white p-2 focus:outline-none"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop and Mobile Overlay */}
      <aside
        className={`
        fixed md:relative inset-y-0 left-0 z-40
        w-64 bg-black text-white flex flex-col border-r border-slate-900
        transform transition-transform duration-300 ease-in-out print:hidden
        ${mobileMenuOpen ? "translate-x-0 shadow-2xl shadow-blue-500/10" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="p-10 border-b border-slate-900 shrink-0 md:hidden">
          <h1 className="text-xl font-bold tracking-tight">
            {appNameText.toLowerCase() === "condobill" ? (
              <>
                <span className="text-blue-500 font-extrabold">CONDO</span>Bill
              </>
            ) : (
              <span className="text-blue-500 font-extrabold">{appNameText}</span>
            )}
          </h1>
        </div>
        <div className="p-6 border-b border-slate-900 shrink-0 hidden md:block">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              {appNameText.toLowerCase() === "condobill" ? (
                <>
                  <span className="text-blue-500 font-extrabold">CONDO</span>Bill
                </>
              ) : (
                <span className="text-blue-500 font-extrabold">{appNameText}</span>
              )}
            </h1>
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mt-2">
            Gestión Dominicana
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {currentUser && currentUser.permissions.includes("dashboard") && (
            <>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-2 mt-2">
                Navegación
              </div>
              <NavItem
                active={activeTab === "dashboard"}
                onClick={() => handleNavClick("dashboard")}
                icon={<LayoutDashboard size={18} />}
                label="Panel de Control"
              />
            </>
          )}

          {(currentUser && (
            currentUser.permissions.includes("income") ||
            currentUser.permissions.includes("expense") ||
            currentUser.permissions.includes("billing") ||
            currentUser.permissions.includes("generalBilling") ||
            currentUser.permissions.includes("personal") ||
            currentUser.permissions.includes("reporte_diario") ||
            currentUser.permissions.includes("calculator") ||
            currentUser.permissions.includes("cashClose")
          )) && (
            <div className="py-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-2">
                Módulos
              </p>
              {currentUser.permissions.includes("income") && (
                <NavItem
                  active={activeTab === "income"}
                  onClick={() => handleNavClick("income")}
                  icon={<PlusCircle size={18} className="text-emerald-400" />}
                  label="Ingresos"
                />
              )}
              {currentUser.permissions.includes("expense") && (
                <NavItem
                  active={activeTab === "expense"}
                  onClick={() => handleNavClick("expense")}
                  icon={<MinusCircle size={18} className="text-rose-400" />}
                  label="Egresos"
                />
              )}
              {currentUser.permissions.includes("billing") && (
                <NavItem
                  active={activeTab === "billing"}
                  onClick={() => handleNavClick("billing")}
                  icon={<ReceiptText size={18} className="text-blue-400" />}
                  label="Facturación Condominio"
                />
              )}
              {currentUser.permissions.includes("generalBilling") && (
                <NavItem
                  active={activeTab === "generalBilling"}
                  onClick={() => handleNavClick("generalBilling")}
                  icon={<FileText size={18} className="text-amber-500" />}
                  label="Facturación General"
                />
              )}
              {currentUser.permissions.includes("personal") && (
                <NavItem
                  active={activeTab === "personal"}
                  onClick={() => handleNavClick("personal")}
                  icon={<Users size={18} className="text-teal-500" />}
                  label="Personal de Trabajo"
                />
              )}
              {currentUser.permissions.includes("reporte_diario") && (
                <NavItem
                  active={activeTab === "reporte_diario"}
                  onClick={() => handleNavClick("reporte_diario")}
                  icon={<FileText size={18} className="text-emerald-500" />}
                  label="Reporte Diario"
                />
              )}
              {currentUser.permissions.includes("calculator") && (
                <NavItem
                  active={activeTab === "calculator"}
                  onClick={() => handleNavClick("calculator")}
                  icon={<Flame size={18} className="text-orange-500" />}
                  label="Calculadora Gas"
                />
              )}
              {currentUser.permissions.includes("cashClose") && (
                <NavItem
                  active={activeTab === "cashClose"}
                  onClick={() => handleNavClick("cashClose")}
                  icon={<BarChart3 size={18} className="text-purple-500" />}
                  label="Corte de Caja"
                />
              )}
            </div>
          )}

          {(currentUser && (
            currentUser.permissions.includes("condos") ||
            currentUser.permissions.includes("settings") ||
            currentUser.username.toLowerCase() === "admin" ||
            currentUser.permissions.includes("users")
          )) && (
            <div className="py-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-2">
                Administración
              </p>
              {currentUser.permissions.includes("condos") && (
                <NavItem
                  active={activeTab === "condos"}
                  onClick={() => handleNavClick("condos")}
                  icon={<Building2 size={18} />}
                  label="Condominios"
                />
              )}
              {currentUser.permissions.includes("settings") && (
                <NavItem
                  active={activeTab === "settings"}
                  onClick={() => handleNavClick("settings")}
                  icon={<SettingsIcon size={18} />}
                  label="Configuración"
                />
              )}
              {(currentUser.username.toLowerCase() === "admin" || currentUser.permissions.includes("users")) && (
                <NavItem
                  active={activeTab === "users"}
                  onClick={() => handleNavClick("users")}
                  icon={<Shield size={18} className="text-blue-500" />}
                  label="Usuarios"
                />
              )}
            </div>
          )}
        </nav>

        {/* Condo Selector at Bottom */}
        <div className="p-5 bg-slate-950 border-t border-slate-900">
          <p className="text-[10px] font-black text-slate-600 uppercase mb-3 tracking-widest">
            Condominio Activo
          </p>
          <select
            value={selectedCondoId || ""}
            onChange={(e) => setSelectedCondoId(e.target.value)}
            className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-blue-600 transition-all cursor-pointer appearance-none shadow-lg"
          >
            {condos.length === 0 && (
              <option value="">Crear condominio...</option>
            )}
            {condos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-col gap-1 text-[10px] text-slate-600 font-medium">
            <div className="flex justify-between">
              <span>v1.0.0 Stable</span>
              <span>Rep. Dom.</span>
            </div>
            {!hideDeveloperName && (
              <div className="text-center pt-2 border-t border-slate-900/50">
                <span className="font-bold text-slate-500 uppercase tracking-tighter">
                  Desarrollador: {developerName}
                </span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-900/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-extrabold text-xs text-white shrink-0 shadow-md">
                {currentUser?.name.substring(0, 1).toUpperCase()}
              </div>
              <div className="truncate text-left leading-none">
                <p className="text-[10px] font-black text-slate-200 truncate max-w-[100px]">{currentUser?.name}</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase truncate mt-1">{currentUser?.cargo}</p>
              </div>
            </div>
            {confirmLogout ? (
              <div className="flex items-center gap-1 shrink-0" onMouseLeave={() => setConfirmLogout(false)}>
                <button
                  onClick={() => {
                    setCurrentUser(null);
                    storage.saveCurrentUser(null);
                    setConfirmLogout(false);
                  }}
                  className="text-[8px] font-black text-rose-100 uppercase tracking-wider bg-rose-600 hover:bg-rose-700 px-2.5 py-1.5 rounded-lg transition-all"
                  title="Confirmar salida"
                >
                  ¿SALIR?
                </button>
                <button
                  onClick={() => setConfirmLogout(false)}
                  className="text-[8px] font-black text-slate-400 hover:text-slate-300 uppercase tracking-wider bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-lg transition-all"
                  title="Cancelar"
                >
                  NO
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmLogout(true)}
                className="text-[9px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 rounded-lg transition-all shrink-0"
                title="Cerrar sesión"
              >
                SALIR
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pt-16 md:pt-0">
        {/* Header Bar */}
        <header className="h-20 bg-white border-b border-slate-100 hidden md:flex items-center justify-between px-8 shrink-0 z-10 print:hidden">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black shadow-lg">
              {selectedCondo?.name.substring(0, 2).toUpperCase() || "LO"}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 leading-none tracking-tight">
                {activeTab === "income" && "Módulo de Ingresos"}
                {activeTab === "expense" && "Módulo de Egresos"}
                {activeTab === "dashboard" && "Panel de Control"}
                {activeTab === "billing" && "Facturación Condominio"}
                {activeTab === "generalBilling" && "Facturación General"}
                {activeTab === "personal" && "Personal de Trabajo"}
                {activeTab === "condos" && "Gestión de Condominios"}
                {activeTab === "settings" && "Personalización"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-bold">
                <span className="truncate max-w-[200px]">
                  {selectedCondo?.name || "los parados citi"}
                </span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-300">RNC: 1-32-45678-9</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 print:hidden">
            {(activeTab === "income" || activeTab === "expense") && (
              <div className="flex gap-8 border-r border-[#f1f5f9] pr-6 mr-1">
                <div className="text-right">
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">
                    BALANCE GENERAL
                  </p>
                  <p className="text-sm font-black text-emerald-600 font-mono leading-none">
                    RD$ {stats.balance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">
                    {activeTab === "income"
                      ? "INGRESOS DEL MES"
                      : "GASTOS DEL MES"}
                  </p>
                  <p
                    className={`text-sm font-black font-mono leading-none ${activeTab === "income" ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    RD$
                    {(activeTab === "income"
                      ? stats.income
                      : stats.expense
                    ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            {/* Cloud Sync Status/Trigger Pill Button */}
            <button
              onClick={() => {
                setSettingsSubTab("security");
                setActiveTab("settings");
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer shadow-sm select-none ${
                firebaseUser
                  ? "bg-emerald-50 border-emerald-200/60 text-emerald-800 hover:bg-emerald-100/50"
                  : "bg-blue-50 border-blue-200/60 text-blue-800 hover:bg-blue-100/50"
              }`}
              title={firebaseUser ? `Conectado como ${firebaseUser.email}. Haz clic para gestionar la nube.` : "Haz clic para sincronizar y conectar con Firebase"}
            >
              <div className="relative flex items-center">
                <Cloud size={15} className={firebaseUser ? "text-emerald-600" : "text-blue-600"} />
                {firebaseUser && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                {firebaseUser ? "Nube Activa" : "Vincular Nube"}
              </span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <AnimatePresence mode="wait">
            {!selectedCondoId && activeTab !== "condos" ? (
              <motion.div
                key="no-condo"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-md mx-auto mt-20 text-center p-10 bg-white rounded-3xl shadow-xl shadow-gray-200 border border-gray-100"
              >
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Building2 className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Comienza configurando un condominio
                </h3>
                <p className="text-gray-500 mb-8">
                  Debes crear al menos una junta de condominio para empezar a
                  registrar transacciones.
                </p>
                <button
                  onClick={() => setActiveTab("condos")}
                  className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  Ir a Condominios
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {activeTab === "dashboard" && (
                  <DashboardView
                    stats={stats}
                    transactions={filteredTransactions}
                  />
                )}
                {activeTab === "income" && selectedCondoId && (
                  <IncomeManager
                    condoId={selectedCondoId}
                    categories={categories.filter(
                      (c) => c.type === TransactionType.INCOME,
                    )}
                    concepts={concepts}
                    transactions={filteredTransactions}
                    stats={stats}
                    onSubmit={addTransaction}
                    onAddConcept={addConcept}
                    getIcon={getIconForCategory}
                  />
                )}
                {activeTab === "expense" && selectedCondoId && (
                  <ExpenseManager
                    condoId={selectedCondoId}
                    categories={categories.filter(
                      (c) => c.type === TransactionType.EXPENSE,
                    )}
                    concepts={concepts}
                    transactions={filteredTransactions}
                    stats={stats}
                    onSubmit={addTransaction}
                    onAddConcept={addConcept}
                    getIcon={getIconForCategory}
                    employees={employees}
                    areas={areas}
                  />
                )}
                {activeTab === "billing" && selectedCondoId && (
                  <BillingView
                    condo={selectedCondo}
                    units={units.filter(
                      (u) => u.condominioId === selectedCondoId,
                    )}
                    transactions={filteredTransactions}
                    onAddTransaction={addTransaction}
                  />
                )}
                {activeTab === "generalBilling" && (
                  <GeneralBillingView
                    settings={ticketSettings}
                    products={products}
                    setProducts={setProducts}
                    sales={sales}
                    setSales={setSales}
                    onAddReceipt={(rec) => {
                      setReceipts((prev) => [rec, ...prev]);
                    }}
                  />
                )}
                {activeTab === "personal" && (
                  <PersonalView
                    employees={employees}
                    areas={areas}
                    onAddEmployee={handleAddEmployee}
                    onUpdateEmployee={handleUpdateEmployee}
                    onDeleteEmployee={handleDeleteEmployee}
                    onAddArea={handleAddArea}
                    onDeleteArea={handleDeleteArea}
                    onUpdateArea={handleUpdateArea}
                  />
                )}
                {activeTab === "reporte_diario" && (
                  <DailyReportView
                    receipts={receipts}
                    setReceipts={setReceipts}
                    ticketSettings={ticketSettings}
                    onPrintReceipt={(rec) => generateReceiptPDF(rec, ticketSettings)}
                  />
                )}
                {activeTab === "calculator" && (
                  <CalculatorView
                    condos={condos}
                    units={units}
                    onRegisterTransaction={addTransaction}
                  />
                )}
                {activeTab === "cashClose" && (
                  <CashCloseView
                    sales={sales}
                    setSales={setSales}
                    transactions={transactions}
                    setTransactions={setTransactions}
                    products={products}
                    employees={employees}
                    condos={condos}
                    cortes={cortes}
                    setCortes={setCortes}
                    currentUser={currentUser}
                  />
                )}
                {activeTab === "condos" && (
                  <CondoView
                    condos={condos}
                    units={units}
                    tasks={tasks}
                    maintenance={maintenance}
                    repairs={repairs}
                    staff={staff}
                    onAdd={addCondo}
                    onUpdate={updateCondo}
                    onDelete={deleteCondo}
                    onSelect={setSelectedCondoId}
                    selectedId={selectedCondoId}
                    onAddUnit={addUnit}
                    onUpdateUnit={updateUnit}
                    onDeleteUnit={deleteUnit}
                    onAddTask={addTask}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                    onAddMaintenance={addMaintenance}
                    onUpdateMaintenance={updateMaintenance}
                    onDeleteMaintenance={deleteMaintenance}
                    onAddRepair={addRepair}
                    onUpdateRepair={updateRepair}
                    onDeleteRepair={deleteRepair}
                    onAddStaff={addStaff}
                    onUpdateStaff={updateStaff}
                    onDeleteStaff={deleteStaff}
                    suppliers={suppliers}
                    onAddSupplier={addSupplier}
                    onDeleteSupplier={deleteSupplier}
                  />
                )}
                {activeTab === "settings" && (
                  <SettingsView
                    categories={categories}
                    setCategories={setCategories}
                    concepts={concepts}
                    setConcepts={setConcepts}
                    ticketSettings={ticketSettings}
                    setTicketSettings={setTicketSettings}
                    autoSaveSettings={autoSaveSettings}
                    setAutoSaveSettings={setAutoSaveSettings}
                    appNameText={appNameText}
                    setAppNameText={setAppNameText}
                    developerName={developerName}
                    setDeveloperName={setDeveloperName}
                    hideDeveloperName={hideDeveloperName}
                    setHideDeveloperName={setHideDeveloperName}
                    onSyncComplete={handleReloadFromLocalStorage}
                    initialTab={settingsSubTab}
                    onTabChange={setSettingsSubTab}
                  />
                )}
                {activeTab === "users" && currentUser && (
                  <UsersView
                    users={users}
                    currentUser={currentUser}
                    onAddUser={handleAddUser}
                    onUpdateUser={handleUpdateUser}
                    onDeleteUser={handleDeleteUser}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// Sidebar Navigation Item
function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative ${
        active
          ? "bg-blue-600/10 text-white"
          : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
      }`}
    >
      <span
        className={`${active ? "text-blue-500" : "text-slate-600 group-hover:text-slate-300"} transition-colors`}
      >
        {icon}
      </span>
      <span
        className={`text-[13px] tracking-tight transition-all ${active ? "font-black" : "font-bold"}`}
      >
        {label}
      </span>
      {active && (
        <motion.div
          layoutId="active-pill"
          className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
        />
      )}
    </button>
  );
}

// Componentes del Panel de Control
function DashboardView({
  stats,
  transactions,
}: {
  stats: any;
  transactions: Transaction[];
}) {
  return (
    <div className="space-y-12 max-w-7xl mx-auto px-4">
      {/* Page Header inside Dashboard */}
      <div className="flex items-center gap-4">
        <div className="h-3 w-10 bg-blue-500 rounded-full"></div>
        <div>
          <h3 className="text-2xl font-black text-slate-800 uppercase italic leading-none">
            PANEL DE CONTROL
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
            RESUMEN FINANCIERO GENERAL
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          label="INGRESOS TOTALES"
          value={formatCurrency(stats.income)}
          icon={<TrendingUp size={24} />}
          color="emerald"
          sub="Basado en cobros liquidados"
        />
        <StatCard
          label="EGRESOS TOTALES"
          value={formatCurrency(stats.expense)}
          icon={<TrendingDown size={24} />}
          color="rose"
          sub="Pagos y desembolsos"
        />
        <StatCard
          label="CAJA Y BANCOS"
          value={formatCurrency(stats.balance)}
          icon={<Wallet size={24} />}
          color="blue"
          sub="Balance actual disponible"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Recent Transactions List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                <Clock size={16} />
              </div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight italic">
                Últimos Movimientos
              </h4>
            </div>
            <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">
              Ver Todo
            </button>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="divide-y divide-slate-50">
              {transactions.length === 0 ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase italic tracking-widest text-xs">
                  Sin registros financieros
                </div>
              ) : (
                transactions.slice(0, 10).map((t) => (
                  <div
                    key={t.id}
                    className="p-5 flex items-center gap-5 hover:bg-slate-50/50 transition-colors"
                  >
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${
                        t.type === TransactionType.INCOME
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : "bg-rose-50 text-rose-500 border-rose-100"
                      }`}
                    >
                      {t.type === TransactionType.INCOME ? (
                        <PlusCircle size={20} />
                      ) : (
                        <MinusCircle size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-slate-800 uppercase tracking-tight text-[13px]">
                          {t.category}
                        </span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {t.concept}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">
                        {new Date(t.date).toLocaleDateString("es-DO", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-black text-[15px] font-mono leading-none mb-1 ${t.type === TransactionType.INCOME ? "text-emerald-600" : "text-rose-500"}`}
                      >
                        {t.type === TransactionType.INCOME ? "+" : "-"}{" "}
                        {t.amount.toLocaleString("es-DO", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[120px]">
                        {t.description || "CONCEPTO GENERAL"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Sidebar / Summary */}
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-500/20 transition-all duration-700"></div>
            <h4 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-6">
              Estado de Cuenta
            </h4>

            <div className="space-y-6 relative z-10">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  Entradas del Mes
                </p>
                <p className="text-2xl font-black font-mono text-emerald-400">
                  RD$
                  {stats.income.toLocaleString("es-DO", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  Salidas del Mes
                </p>
                <p className="text-2xl font-black font-mono text-rose-400">
                  RD$
                  {stats.expense.toLocaleString("es-DO", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="h-[1px] bg-slate-800 w-full"></div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  Rentabilidad
                </p>
                <p className="text-2xl font-black font-mono text-white">
                  {stats.income > 0
                    ? Math.max(
                        0,
                        ((stats.income - stats.expense) / stats.income) * 100,
                      ).toFixed(1)
                    : "0.0"}
                  %
                </p>
              </div>
            </div>


          </div>


        </div>
      </div>

      <footer className="pt-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex gap-10">
          <div className="flex items-center gap-2">
            <span className="block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Sistema: Cloud_DR_v1
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="block h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Servicio: Rep. Dominicana
            </span>
          </div>
        </div>
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
          © 2026 CONDOBILL GESTIÓN INTELIGENTE
        </p>
      </footer>
    </div>
  );
}

// Income Manager Component
function IncomeManager({
  condoId,
  categories,
  concepts,
  transactions,
  stats,
  onSubmit,
  onAddConcept,
  getIcon,
}: {
  condoId: string;
  categories: Category[];
  concepts: Concept[];
  transactions: Transaction[];
  stats: any;
  onSubmit: (t: any) => void;
  onAddConcept: (catId: string, name: string) => void;
  getIcon: (s: string) => any;
}) {
  const [activeTab, setActiveTab] = useState<"register" | "history">(
    "register",
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const ordinaryCategory = categories.find(
    (c) => c.name === "INGRESOS ORDINARIOS",
  );
  const otherCategories = categories.filter(
    (c) =>
      c.name !== "INGRESOS ORDINARIOS" && c.type === TransactionType.INCOME,
  );

  const monthlyIncome = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    return transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const incomeHistory = useMemo(() => {
    let filtered = transactions.filter(
      (t) => t.type === TransactionType.INCOME,
    );

    if (startDate) {
      filtered = filtered.filter((t) => t.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((t) => t.date <= endDate);
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [transactions, startDate, endDate]);

  return (
    <div className="max-w-7xl mx-auto pb-10 space-y-12 px-4">
      <div className="flex items-center justify-between border-slate-200">
        <div className="flex items-center gap-4">
          <div className="h-3 w-10 bg-emerald-500 rounded-full"></div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 uppercase italic leading-none">
              GESTIÓN DE INGRESOS
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
              CONTROL DE RECAUDACIÓN DEL CONDOMINIO
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("register")}
            className={`px-8 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === "register" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            REGISTRAR
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-8 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === "history" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            HISTORIAL
          </button>
        </div>
      </div>

      {activeTab === "register" ? (
        <div className="space-y-10">
          {/* Main Category Banner - Large full-width card */}
          {ordinaryCategory && (
            <div className="bg-emerald-50/40 rounded-[2.5rem] p-10 md:p-14 border border-emerald-100/50 shadow-xl shadow-emerald-500/5 flex flex-col md:flex-row gap-12 items-start relative overflow-hidden group">
              <div className="flex items-center gap-6 shrink-0">
                <div className="w-16 h-16 bg-white text-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200/50 border border-emerald-50">
                  <BadgeDollarSign size={32} />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">
                    INGRESOS ORDINARIOS
                  </h4>
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-[0.2em] mt-3">
                    Cuotas y Cobros Recurrentes
                  </p>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 w-full">
                {concepts
                  .filter((c) => c.categoryId === ordinaryCategory.id)
                  .map((con) => (
                    <IncomeRecordItem
                      key={con.id}
                      con={con}
                      title="INGRESOS ORDINARIOS"
                      condoId={condoId || ""}
                      onRegister={onSubmit}
                      color="emerald"
                      actionLabel="PAGO"
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Grid for other categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Extraordinary category always first in grid if exists */}
            {categories.find((c) => c.name === "INGRESOS EXTRAORDINARIOS") && (
              <IncomeBox
                key="cat-inc-extraordinary"
                title="INGRESOS EXTRAORDINARIOS"
                category={categories.find(
                  (c) => c.name === "INGRESOS EXTRAORDINARIOS",
                )}
                concepts={concepts.filter(
                  (c) =>
                    c.categoryId ===
                    categories.find(
                      (c) => c.name === "INGRESOS EXTRAORDINARIOS",
                    )?.id,
                )}
                onRegister={onSubmit}
                onAddConcept={onAddConcept}
                condoId={condoId || ""}
              />
            )}

            {otherCategories
              .filter((c) => c.name !== "INGRESOS EXTRAORDINARIOS")
              .map((cat) => (
                <IncomeBox
                  key={cat.id}
                  title={cat.name}
                  category={cat}
                  concepts={concepts.filter((c) => c.categoryId === cat.id)}
                  onRegister={onSubmit}
                  onAddConcept={onAddConcept}
                  condoId={condoId || ""}
                />
              ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                <ClipboardList size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  Historial de Movimientos
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Registros guardados en el sistema
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="mb-1 text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                >
                  Limpiar Filtros
                </button>
              )}
            </div>

            {incomeHistory.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400 font-medium italic">
                  No hay ingresos registrados aún.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">Fecha</th>
                      <th className="pb-3 pr-4">Categoría</th>
                      <th className="pb-3 pr-4">Descripción</th>
                      <th className="pb-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {incomeHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="text-xs group hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-4 pr-4 font-bold text-slate-500">
                          {new Date(item.date).toLocaleDateString()}
                        </td>
                        <td className="py-4 pr-4">
                          <span className="px-2 py-1 rounded bg-slate-100 text-[9px] font-black uppercase text-slate-600">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-slate-400 font-medium max-w-xs truncate">
                          {item.description || "-"}
                        </td>
                        <td className="py-4 text-right">
                          <span className="font-black text-emerald-600 font-mono">
                            RD${" "}
                            {item.amount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeBox({
  title,
  category,
  concepts,
  onRegister,
  onAddConcept,
  condoId,
}: {
  title: string;
  category?: Category;
  concepts: Concept[];
  onRegister: (t: any) => void;
  onAddConcept: (catId: string, name: string) => void;
  condoId: string;
  key?: React.Key;
}) {
  const [showAddConcept, setShowAddConcept] = useState(false);
  const [newConceptName, setNewConceptName] = useState("");

  const handleAddConcept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConceptName.trim() || !category) return;
    onAddConcept(category.id, newConceptName);
    setNewConceptName("");
    setShowAddConcept(false);
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden flex flex-col h-full group">
      <div className="p-7 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-[0.15em] italic">
          {title}
        </h4>
        <button
          onClick={() => setShowAddConcept(!showAddConcept)}
          className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
        >
          {showAddConcept ? "CERRAR" : "+ NUEVO"}
        </button>
      </div>

      <div className="p-7 space-y-4">
        {showAddConcept && (
          <form
            onSubmit={handleAddConcept}
            className="bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-300 space-y-3 mb-6"
          >
            <input
              autoFocus
              className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Nombre..."
              value={newConceptName}
              onChange={(e) => setNewConceptName(e.target.value)}
            />
            <button
              type="submit"
              className="w-full h-11 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200"
            >
              AÑADIR CONCEPTO
            </button>
          </form>
        )}

        <div className="space-y-4">
          {concepts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center opacity-20">
              <Box size={32} className="mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest italic text-center">
                Sin registros
              </p>
            </div>
          ) : (
            concepts.map((con) => (
              <IncomeRecordItem
                key={con.id}
                con={con}
                title={title}
                condoId={condoId}
                onRegister={onRegister}
                color="slate"
                actionLabel="PAGO"
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function IncomeRecordItem({
  con,
  title,
  condoId,
  onRegister,
  color,
  actionLabel = "COBRO",
}: {
  con: Concept;
  title: string;
  condoId: string;
  onRegister: (t: any) => void;
  color: "emerald" | "slate";
  actionLabel?: string;
  key?: React.Key;
}) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [desc, setDesc] = useState("");

  const handleRegister = () => {
    if (!amount || isNaN(parseFloat(amount))) return;

    onRegister({
      condominioId: condoId,
      type: TransactionType.INCOME,
      category: title,
      concept: con.name,
      amount: parseFloat(amount),
      date,
      description: desc,
    });

    setAmount("");
    setDesc("");
    setIsRegistering(false);
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${isRegistering ? "bg-slate-50 border-slate-300 shadow-md ring-1 ring-slate-800/10" : "bg-slate-50 border-slate-100 hover:border-slate-300"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${color === "emerald" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600 shadow-sm"}`}
          >
            <DollarSign size={14} />
          </div>
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
            {con.name}
          </span>
        </div>
        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
            isRegistering
              ? "bg-rose-500 text-white hover:bg-rose-600"
              : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-900 hover:text-white"
          }`}
        >
          {isRegistering ? "X" : actionLabel}
        </button>
      </div>

      <AnimatePresence>
        {isRegistering && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-5 space-y-4 mt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Monto
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-xs font-black outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-xs font-black outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Descripción
                </label>
                <input
                  placeholder="Nota opcional..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-xs font-black outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={handleRegister}
                className="w-full h-12 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.1em] shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-[0.98]"
              >
                CONFIRMAR OPERACIÓN
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ExpenseManagerProps {
  condoId: string;
  categories: Category[];
  concepts: Concept[];
  transactions: Transaction[];
  stats: any;
  onSubmit: (t: any) => void;
  onAddConcept: (catId: string, name: string) => void;
  getIcon: (s: string) => any;
  employees?: Empleado[];
  areas?: AreaTrabajo[];
}

// Expense Manager Component
function ExpenseManager({
  condoId,
  categories,
  concepts,
  transactions,
  stats,
  onSubmit,
  onAddConcept,
  getIcon,
  employees = [],
  areas = [],
}: ExpenseManagerProps) {
  const [activeTab, setActiveTab] = useState<"register" | "history">(
    "register",
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const payrollCategory = categories.find((c) => c.name === "NÓMINA");
  const otherCategories = categories.filter(
    (c) => c.name !== "NÓMINA" && c.type === TransactionType.EXPENSE,
  );

  const monthlyExpense = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    return transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const expenseHistory = useMemo(() => {
    let filtered = transactions.filter(
      (t) => t.type === TransactionType.EXPENSE,
    );

    if (startDate) {
      filtered = filtered.filter((t) => t.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((t) => t.date <= endDate);
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [transactions, startDate, endDate]);

  return (
    <div className="max-w-7xl mx-auto pb-10 space-y-12 px-4">
      <div className="flex items-center justify-between border-slate-200">
        <div className="flex items-center gap-4">
          <div className="h-3 w-10 bg-rose-500 rounded-full"></div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 uppercase italic leading-none">
              GESTIÓN DE EGRESOS
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
              CONTROL DE RECAUDACIÓN DEL CONDOMINIO
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("register")}
            className={`px-8 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === "register" ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            REGISTRAR
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-8 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === "history" ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            HISTORIAL
          </button>
        </div>
      </div>

      {activeTab === "register" ? (
        <div className="space-y-10">
          {/* Payroll Banner - Large full-width card */}
          {payrollCategory && (
            <div className="bg-rose-50/40 rounded-[2.5rem] p-10 md:p-14 border border-rose-100/50 shadow-xl shadow-rose-500/5 flex flex-col md:flex-row gap-12 items-start relative overflow-hidden group">
              <div className="flex items-center gap-6 shrink-0">
                <div className="w-16 h-16 bg-white text-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200/50 border border-rose-50">
                  <Users size={32} />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">
                    MÓDULO DE NÓMINA
                  </h4>
                  <p className="text-[11px] font-bold text-rose-600 uppercase tracking-[0.2em] mt-3">
                    Sueldos y Beneficios de Ley
                  </p>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 w-full">
                {concepts
                  .filter((c) => c.categoryId === payrollCategory.id)
                  .map((con) => (
                    <ExpenseRecordItem
                      key={con.id}
                      con={con}
                      title="NÓMINA"
                      condoId={condoId || ""}
                      onRegister={onSubmit}
                      color="rose"
                      actionLabel="PAGO"
                      employees={employees}
                      areas={areas}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Grid for other categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {otherCategories.map((cat) => (
              <ExpenseBox
                key={cat.id}
                title={cat.name}
                category={cat}
                concepts={concepts.filter((c) => c.categoryId === cat.id)}
                onRegister={onSubmit}
                onAddConcept={onAddConcept}
                condoId={condoId || ""}
                employees={employees}
                areas={areas}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                <ClipboardList size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  Historial de Gastos
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Registros guardados en el sistema
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="mb-1 text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                >
                  Limpiar Filtros
                </button>
              )}
            </div>

            {expenseHistory.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400 font-medium italic">
                  No hay egresos registrados aún.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">Fecha</th>
                      <th className="pb-3 pr-4">Categoría</th>
                      <th className="pb-3 pr-4">Descripción</th>
                      <th className="pb-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {expenseHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="text-xs group hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-4 pr-4 font-bold text-slate-500">
                          {new Date(item.date).toLocaleDateString()}
                        </td>
                        <td className="py-4 pr-4">
                          <span className="px-2 py-1 rounded bg-slate-100 text-[9px] font-black uppercase text-slate-600">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-slate-400 font-medium max-w-xs truncate">
                          {item.description || "-"}
                        </td>
                        <td className="py-4 text-right">
                          <span className="font-black text-rose-600 font-mono">
                            RD${" "}
                            {item.amount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ExpenseBoxProps {
  title: string;
  category: Category;
  concepts: Concept[];
  onRegister: (t: any) => void;
  onAddConcept: (catId: string, name: string) => void;
  condoId: string;
  key?: React.Key;
  employees?: Empleado[];
  areas?: AreaTrabajo[];
}

function ExpenseBox({
  title,
  category,
  concepts,
  onRegister,
  onAddConcept,
  condoId,
  employees = [],
  areas = [],
}: ExpenseBoxProps) {
  const [showAddConcept, setShowAddConcept] = useState(false);
  const [newConceptName, setNewConceptName] = useState("");

  const handleAddConcept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConceptName.trim()) return;
    onAddConcept(category.id, newConceptName);
    setNewConceptName("");
    setShowAddConcept(false);
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden flex flex-col h-full group">
      <div className="p-7 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-[0.15em] italic">
          {title}
        </h4>
        <button
          onClick={() => setShowAddConcept(!showAddConcept)}
          className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
        >
          {showAddConcept ? "CERRAR" : "+ NUEVO"}
        </button>
      </div>

      <div className="flex-1 p-7 space-y-4">
        {showAddConcept && (
          <form
            onSubmit={handleAddConcept}
            className="bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-300 space-y-3 mb-6"
          >
            <input
              autoFocus
              className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Nombre del servicio..."
              value={newConceptName}
              onChange={(e) => setNewConceptName(e.target.value)}
            />
            <button
              type="submit"
              className="w-full h-11 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200"
            >
              AÑADIR CONCEPTO
            </button>
          </form>
        )}

        <div className="space-y-4">
          {concepts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center opacity-20">
              <Box size={32} className="mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest italic text-center">
                Sin registros
              </p>
            </div>
          ) : (
            concepts.map((con) => (
              <ExpenseRecordItem
                key={con.id}
                con={con}
                title={title}
                condoId={condoId}
                onRegister={onRegister}
                color="slate"
                actionLabel="PAGO"
                employees={employees}
                areas={areas}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ExpenseRecordItemProps {
  con: Concept;
  title: string;
  condoId: string;
  onRegister: (t: any) => void;
  color: "rose" | "slate";
  key?: React.Key;
  employees?: Empleado[];
  areas?: AreaTrabajo[];
}

function ExpenseRecordItem({
  con,
  title,
  condoId,
  onRegister,
  color,
  actionLabel = "PAGO",
  employees = [],
  areas = [],
}: ExpenseRecordItemProps & { actionLabel?: string }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [desc, setDesc] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const handleRegister = () => {
    if (!amount || isNaN(parseFloat(amount))) return;

    const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);
    const finalDescription = selectedEmp
      ? `Pago de nómina a: ${selectedEmp.name} (${selectedEmp.role})${desc ? ` - ${desc}` : ""}`
      : desc;

    onRegister({
      condominioId: condoId,
      type: TransactionType.EXPENSE,
      category: title,
      concept: con.name,
      amount: parseFloat(amount),
      date,
      description: finalDescription,
      employeeId: selectedEmployeeId || undefined,
    });

    setAmount("");
    setDesc("");
    setSelectedEmployeeId("");
    setIsRegistering(false);
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${isRegistering ? "bg-slate-50 border-slate-300 shadow-md ring-1 ring-slate-800/10" : "bg-slate-50 border-slate-100 hover:border-slate-300"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${color === "rose" ? "bg-rose-100 text-rose-600" : "bg-slate-200 text-slate-600"}`}
          >
            <MinusCircle size={14} />
          </div>
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
            {con.name}
          </span>
        </div>
        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
            isRegistering
              ? "bg-rose-500 text-white hover:bg-rose-600"
              : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-900 hover:text-white"
          }`}
        >
          {isRegistering ? "X" : actionLabel}
        </button>
      </div>

      <AnimatePresence>
        {isRegistering && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-5 space-y-4 mt-4 border-t border-slate-200">
              {title === "NÓMINA" && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Colaborador / Empleado
                  </label>
                  {employees.length > 0 ? (
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold outline-none focus:border-rose-500 text-slate-700"
                    >
                      <option value="">-- Seleccionar Colaborador --</option>
                      {areas.map((area) => {
                        const areaEmps = employees.filter((emp) => emp.areaId === area.id);
                        if (areaEmps.length === 0) return null;
                        return (
                          <optgroup key={area.id} label={area.name}>
                            {areaEmps.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} ({emp.role})
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                      {employees.filter((emp) => !areas.some((a) => a.id === emp.areaId)).length > 0 && (
                        <optgroup label="Otros / Sin Área">
                          {employees
                            .filter((emp) => !areas.some((a) => a.id === emp.areaId))
                            .map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} ({emp.role})
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                  ) : (
                    <div className="text-[10px] text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-100 font-medium">
                      No hay personal registrado en el sistema. Vaya a la pestaña "Personal de Trabajo" para agregarlos.
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Monto
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-xs font-black outline-none focus:border-rose-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-xs font-black outline-none focus:border-rose-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Descripción
                </label>
                <input
                  placeholder="Nota opcional..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-xs font-black outline-none focus:border-rose-500"
                />
              </div>
              <button
                onClick={handleRegister}
                className="w-full h-12 bg-rose-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.1em] shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-[0.98]"
              >
                CONFIRMAR PAGO
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
  sub: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
  };

  return (
    <div className="p-8 rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col justify-between h-44 hover:border-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer group">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
          {label}
        </span>
        <div
          className={`p-3 rounded-2xl ${colorMap[color]} shadow-sm group-hover:shadow-md transition-shadow`}
        >
          {icon}
        </div>
      </div>
      <div>
        <h4
          className={`text-3xl font-black tracking-tighter font-mono ${
            color === "emerald"
              ? "text-emerald-700"
              : color === "rose"
                ? "text-rose-600"
                : "text-slate-800"
          }`}
        >
          {value}
        </h4>
        <p className="text-[11px] font-bold text-slate-400 uppercase italic mt-2 tracking-tight">
          {sub}
        </p>
      </div>
    </div>
  );
}

// Transaction Entry Form
function TransactionForm({
  type,
  condoId,
  categories,
  concepts,
  onSubmit,
  getIcon,
}: {
  type: TransactionType;
  condoId: string;
  categories: Category[];
  concepts: Concept[];
  onSubmit: (t: any) => void;
  getIcon: (s: string) => any;
}) {
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || "");
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [desc, setDesc] = useState("");

  const filteredConcepts = concepts.filter(
    (c) => c.categoryId === selectedCatId,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const category = categories.find((c) => c.id === selectedCatId);
    const concept = concepts.find((c) => c.id === selectedConceptId);

    if (!category || !concept || !amount) {
      alert("Por favor completa todos los campos requeridos.");
      return;
    }

    onSubmit({
      condominioId: condoId,
      type,
      category: category.name,
      concept: concept.name,
      amount: parseFloat(amount),
      date,
      description: desc,
    });

    setAmount("");
    setDesc("");
    setSelectedConceptId("");
    alert("Movimiento registrado exitosamente.");
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center gap-4">
          <div className="h-2 w-8 bg-blue-500 rounded"></div>
          <div>
            <h3 className="text-lg font-bold uppercase tracking-tight text-slate-800 italic">
              Registro de{" "}
              {type === TransactionType.INCOME ? "Ingreso" : "Egreso"}
            </h3>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Transacción Local de Condominio
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Categoría Principal
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      setSelectedConceptId("");
                    }}
                    className={`p-3 rounded-lg border text-left transition-all flex items-center gap-2 ${
                      selectedCatId === cat.id
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {getIcon(cat.name)}
                    <span className="font-bold text-[10px] uppercase tracking-tighter leading-none">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Monto Estimado (RD$)
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-11 text-lg font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-4 focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-300 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Fecha Valor
                </label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-lg px-4 font-bold text-sm text-slate-700 focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Memorándum / Detalles
            </label>
            <textarea
              rows={2}
              placeholder="Referencia bancaria u observaciones..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="submit"
              className={`flex-1 py-4 rounded-lg font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.99] ${
                type === TransactionType.INCOME
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-rose-600 text-white hover:bg-rose-700"
              }`}
            >
              Procesar{" "}
              {type === TransactionType.INCOME ? "Deposito" : "Desembolso"}
            </button>
            <button
              type="button"
              className="px-8 bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// File Upload Helper
const handleFileUpload = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function ImageUpload({
  label,
  onImageSelected,
  currentImage,
}: {
  label: string;
  onImageSelected: (base64: string) => void;
  currentImage?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
        {label}
      </label>
      <div className="flex items-center gap-4">
        <label className="flex-1 cursor-pointer">
          <div className="flex items-center justify-center gap-2 h-11 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 hover:border-blue-400 transition-all">
            <Camera size={18} />
            <span className="text-xs font-bold uppercase tracking-tight">
              Seleccionar JPG
            </span>
          </div>
          <input
            type="file"
            accept=".jpg,.jpeg,image/jpeg"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  const base64 = await handleFileUpload(file);
                  onImageSelected(base64);
                } catch (err) {
                  alert("Error al cargar la imagen");
                }
              }
            }}
          />
        </label>
        {currentImage && (
          <div className="h-11 w-11 rounded-lg overflow-hidden border border-slate-200 shrink-0">
            <img
              src={currentImage}
              className="w-full h-full object-cover"
              alt="Vista previa"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Units Management Component
function UnitsManager({
  condoId,
  units,
  onAdd,
  onUpdate,
  onDelete,
}: {
  condoId: string;
  units: Unidad[];
  onAdd: (u: any) => void;
  onUpdate: (id: string, u: any) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [numero, setNumero] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [maintenanceFee, setMaintenanceFee] = useState<string>("");
  const [photo, setPhoto] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const condoUnits = units.filter((u) => u.condominioId === condoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero || !ownerName || !whatsapp) return;
    onAdd({
      condominioId: condoId,
      numero,
      ownerName,
      whatsapp,
      email,
      maintenanceFee: parseFloat(maintenanceFee) || 0,
      photo,
    });
    resetForm();
  };

  const resetForm = () => {
    setNumero("");
    setOwnerName("");
    setWhatsapp("");
    setEmail("");
    setMaintenanceFee("");
    setPhoto("");
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (u: Unidad) => {
    setEditingId(u.id);
    setNumero(u.numero);
    setOwnerName(u.ownerName);
    setWhatsapp(u.whatsapp);
    setEmail(u.email || "");
    setMaintenanceFee(u.maintenanceFee?.toString() || "");
    setPhoto(u.photo || "");
    setIsAdding(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    onUpdate(editingId, {
      numero,
      ownerName,
      whatsapp,
      email,
      maintenanceFee: parseFloat(maintenanceFee) || 0,
      photo,
    });
    resetForm();
  };

  return (
    <div className="mt-12 space-y-6">
      {/* Tarjeta de Recolección de Datos con Link de Registro Público */}
      <div id="recoleccion-datos-propietarios" className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg shrink-0 flex items-center justify-center">
              <Building2 size={20} />
            </div>
            <div>
              <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                Recolección de Datos de Propietarios
              </h5>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-lg mt-1">
                Comparte este enlace con los dueños de las viviendas. Al abrirlo, ingresarán su nombre completo, dirección, WhatsApp, correo y foto, ¡y sus datos se registrarán y crearán de forma automática aquí!
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-teal-50 text-teal-750 border border-teal-100 shadow-sm animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span> Receptor Activo
            </span>
          </div>
        </div>

        {/* Action Share Link Input Row */}
        <div className="mt-4 border-t border-slate-200/60 pt-4 flex flex-col md:flex-row gap-3">
          {auth.currentUser ? (
            (() => {
              const shareUrl = `${window.location.origin}/?register-owner=true&adminId=${auth.currentUser.uid}`;
              const whatsappShareText = encodeURIComponent(`Hola, por favor ingresa tus datos de propietario en este enlace para registrar tu unidad de manera oficial en la administración de nuestro residencial: ${shareUrl}`);
              
              return (
                <>
                  <div className="flex-1 flex gap-2">
                    <input
                      readOnly
                      type="text"
                      value={shareUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono select-all outline-none text-slate-600 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      id="btn-copiar-enlace"
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        alert("¡Enlace de autoregistro copiado al portapapeles con éxito!");
                      }}
                      className="px-4 h-10 bg-slate-800 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition-colors shrink-0 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      Copiar Enlace
                    </button>
                  </div>
                  <a
                    href={`https://api.whatsapp.com/send?text=${whatsappShareText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shrink-0 hover:no-underline active:scale-95 cursor-pointer"
                  >
                    <MessageCircle size={14} className="text-white fill-white" /> Compartir en WhatsApp
                  </a>
                </>
              );
            })()
          ) : (
            <div className="w-full flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-800 text-xs font-bold leading-relaxed">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              Sincroniza el sistema con Firebase (Nube) desde el Panel de Sincronización (botón de la nube en la barra superior) para activar tu enlace único y recibir los registros remotos.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Home size={20} className="text-blue-600" />
          <h4 className="text-md font-black text-slate-800 uppercase tracking-tight italic">
            Unidades y Condóminos
          </h4>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 hover:text-blue-700 transition-colors"
        >
          {isAdding ? <X size={14} /> : <PlusCircle size={14} />}
          {isAdding ? "Cerrar Registro" : "Registrar Unidad"}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-50 p-6 rounded-xl border border-slate-200"
          >
            <form
              onSubmit={editingId ? handleUpdate : handleSubmit}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Unidad / Apartamento
                  </label>
                  <input
                    required
                    placeholder="Ej. 101, A-2..."
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Nombre del Dueño
                  </label>
                  <input
                    required
                    placeholder="Nombre completo..."
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Cuota Mensual (DP$)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      placeholder="Ej. 2500"
                      value={maintenanceFee}
                      onChange={(e) => setMaintenanceFee(e.target.value)}
                      className="w-full h-10 pl-10 pr-3 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                    WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      required
                      placeholder="809-XXX-XXXX"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full h-10 pl-10 pr-3 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Correo Electrónico (Opcional)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 pl-10 pr-3 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <ImageUpload
                  label="Foto del Propietario / Unidad (JPG)"
                  onImageSelected={setPhoto}
                  currentImage={photo}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all"
                >
                  {editingId ? "Actualizar Registro" : "Registrar Unidad"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 bg-slate-200 text-slate-600 py-2 rounded-lg font-bold text-xs uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {condoUnits.length === 0 ? (
          <div className="md:col-span-2 p-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <p className="text-slate-400 text-sm font-bold italic">
              No hay unidades registradas en este condominio.
            </p>
          </div>
        ) : (
          condoUnits.map((u) => (
            <div
              key={u.id}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 group"
            >
              <div className="h-16 w-16 bg-slate-100 rounded-lg overflow-hidden border border-slate-100 shrink-0">
                {u.photo ? (
                  <img
                    src={u.photo}
                    alt={u.numero}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Home size={24} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-600 uppercase tracking-tighter">
                    Apto {u.numero}
                  </span>
                  <div className="flex gap-1 transition-opacity">
                    {confirmingId === u.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-100">
                        <button
                          onClick={() => {
                            onDelete(u.id);
                            setConfirmingId(null);
                          }}
                          className="text-[9px] font-black text-rose-600 uppercase px-1.5 hover:bg-rose-100 rounded"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="text-[9px] font-black text-slate-400 uppercase px-1.5 hover:bg-slate-100 rounded"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setConfirmingId(u.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <h5 className="text-sm font-bold text-slate-800 truncate">
                  {u.ownerName}
                </h5>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-black">
                    <Phone size={10} /> {u.whatsapp}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-blue-600 font-black">
                    <DollarSign size={10} /> RD${" "}
                    {u.maintenanceFee?.toLocaleString()}
                  </div>
                  {u.email && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold truncate">
                      <Mail size={10} /> {u.email}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Tasks Manager
function TasksManager({
  condoId,
  tasks,
  onAdd,
  onUpdate,
  onDelete,
}: {
  condoId: string;
  tasks: Tarea[];
  onAdd: (t: any) => void;
  onUpdate: (id: string, t: any) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const condoTasks = tasks.filter((t) => t.condominioId === condoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ condominioId: condoId, title, isCompleted: false, dueDate });
    setTitle("");
    setDueDate("");
    setIsAdding(false);
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Check size={18} className="text-emerald-500" />
          <h4 className="text-sm font-black text-slate-700 uppercase italic">
            Tareas y Pendientes
          </h4>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-[10px] font-black text-blue-600 uppercase tracking-widest"
        >
          {isAdding ? "Cerrar" : "+ Tarea"}
        </button>
      </div>
      {isAdding && (
        <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap">
          <input
            className="flex-1 min-w-[200px] h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            placeholder="¿Qué hay que hacer?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            type="date"
            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button
            type="submit"
            className="h-10 px-4 bg-blue-600 text-white rounded-lg text-xs font-black uppercase"
          >
            Añadir
          </button>
        </form>
      )}
      <div className="space-y-2">
        {condoTasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => onUpdate(t.id, { isCompleted: !t.isCompleted })}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${t.isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 text-transparent hover:border-emerald-400"}`}
              >
                <Check size={12} />
              </button>
              <div className="flex flex-col">
                <span
                  className={`text-xs font-bold ${t.isCompleted ? "line-through text-slate-400" : "text-slate-700"}`}
                >
                  {t.title}
                </span>
                {t.dueDate && (
                  <span className="text-[9px] font-black text-slate-400 uppercase">
                    {new Date(t.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              {confirmingId === t.id ? (
                <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                  <button
                    onClick={() => {
                      onDelete(t.id);
                      setConfirmingId(null);
                    }}
                    className="text-[9px] font-black text-rose-600 uppercase"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="text-[9px] font-black text-slate-400 uppercase"
                  >
                    X
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingId(t.id)}
                  className="p-1.5 text-rose-400 hover:text-rose-600 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Maintenance Manager
function MaintenanceManager({
  condoId,
  maintenance,
  onAdd,
  onDelete,
}: {
  condoId: string;
  maintenance: Mantenimiento[];
  onAdd: (m: any) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [freq, setFreq] = useState<
    "mensual" | "trimestral" | "anual" | "unico"
  >("mensual");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const condoMaint = maintenance.filter((m) => m.condominioId === condoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) return;
    onAdd({ condominioId: condoId, description: desc, date, frequency: freq });
    setDesc("");
    setDate("");
    setIsAdding(false);
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-blue-500" />
          <h4 className="text-sm font-black text-slate-700 uppercase italic">
            Cronograma de Mantenimiento
          </h4>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-[10px] font-black text-blue-600 uppercase tracking-widest"
        >
          {isAdding ? "Cerrar" : "+ Registro"}
        </button>
      </div>
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-4 gap-2"
        >
          <input
            className="md:col-span-2 h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            placeholder="Descripción de mantenimiento..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            required
          />
          <input
            type="date"
            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <select
            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            value={freq}
            onChange={(e) => setFreq(e.target.value as any)}
          >
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="anual">Anual</option>
            <option value="unico">Único</option>
          </select>
          <button
            type="submit"
            className="md:col-span-4 h-10 bg-blue-600 text-white rounded-lg text-xs font-black uppercase"
          >
            Programar Mantenimiento
          </button>
        </form>
      )}
      <div className="space-y-2">
        {condoMaint.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-lg shadow-sm group"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white rounded border border-slate-100 flex items-center justify-center text-blue-500">
                <Calendar size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                  {m.description}
                </span>
                <div className="flex gap-3 items-center">
                  <span className="text-[9px] font-bold text-slate-400">
                    Próximo: {new Date(m.date).toLocaleDateString()}
                  </span>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[8px] font-black uppercase">
                    {m.frequency}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              {confirmingId === m.id ? (
                <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                  <button
                    onClick={() => {
                      onDelete(m.id);
                      setConfirmingId(null);
                    }}
                    className="text-[9px] font-black text-rose-600 uppercase"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="text-[9px] font-black text-slate-400 uppercase"
                  >
                    X
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingId(m.id)}
                  className="p-1.5 text-rose-400 hover:text-rose-600 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Repairs Manager
function RepairsManager({
  condoId,
  repairs,
  onAdd,
  onUpdate,
  onDelete,
}: {
  condoId: string;
  repairs: Reparacion[];
  onAdd: (r: any) => void;
  onUpdate: (id: string, r: any) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const condoRepairs = repairs.filter((r) => r.condominioId === condoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) return;
    onAdd({
      condominioId: condoId,
      description: desc,
      date,
      status: "pendiente",
    });
    setDesc("");
    setDate("");
    setIsAdding(false);
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Wrench size={18} className="text-orange-500" />
          <h4 className="text-sm font-black text-slate-700 uppercase italic">
            Reparaciones en Curso
          </h4>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-[10px] font-black text-blue-600 uppercase tracking-widest"
        >
          {isAdding ? "Cerrar" : "+ Reporte"}
        </button>
      </div>
      {isAdding && (
        <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap">
          <input
            className="flex-1 min-w-[200px] h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            placeholder="¿Qué necesita reparación?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            required
          />
          <input
            type="date"
            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <button
            type="submit"
            className="h-10 px-4 bg-orange-600 text-white rounded-lg text-xs font-black uppercase"
          >
            Enviar Reporte
          </button>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {condoRepairs.map((r) => (
          <div
            key={r.id}
            className="p-4 bg-white border border-slate-100 rounded-lg shadow-sm group space-y-3"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-700">
                {r.description}
              </span>
              <div className="flex gap-1">
                {confirmingId === r.id ? (
                  <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                    <button
                      onClick={() => {
                        onDelete(r.id);
                        setConfirmingId(null);
                      }}
                      className="text-[9px] font-black text-rose-600 uppercase"
                    >
                      Eliminar
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="text-[9px] font-black text-slate-400 uppercase"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingId(r.id)}
                    className="p-1 text-rose-400 hover:text-rose-600 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 italic">
                Fecha: {new Date(r.date).toLocaleDateString()}
              </span>
              <select
                className={`text-[9px] font-black uppercase px-2 py-1 rounded border-none outline-none ${
                  r.status === "completada"
                    ? "bg-emerald-100 text-emerald-700"
                    : r.status === "en_proceso"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                }`}
                value={r.status || "pendiente"}
                onChange={(e) =>
                  onUpdate(r.id, { status: e.target.value as any })
                }
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En Proceso</option>
                <option value="completada">Completada</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Staff Manager
function StaffManager({
  condoId,
  staff,
  onAdd,
  onDelete,
}: {
  condoId: string;
  staff: Conserje[];
  onAdd: (s: any) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [shift, setShift] = useState("Día (7am - 7pm)");
  const [photo, setPhoto] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const condoStaff = staff.filter((s) => s.condominioId === condoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ condominioId: condoId, name, phone, shift, photo });
    setName("");
    setPhone("");
    setPhoto("");
    setIsAdding(false);
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-cyan-600" />
          <h4 className="text-sm font-black text-slate-700 uppercase italic">
            Personal de Conserjería
          </h4>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-[10px] font-black text-blue-600 uppercase tracking-widest"
        >
          {isAdding ? "Cerrar" : "+ Conserje"}
        </button>
      </div>
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              placeholder="Nombre completo..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              placeholder="Teléfono..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <input
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              placeholder="Turno (Ej. Día, Noche)"
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              required
            />
          </div>
          <ImageUpload
            label="Foto del Conserje"
            onImageSelected={setPhoto}
            currentImage={photo}
          />
          <button
            type="submit"
            className="w-full h-10 bg-cyan-700 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-cyan-800 transition-all mt-2"
          >
            Registrar Personal
          </button>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {condoStaff.map((s) => (
          <div
            key={s.id}
            className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3"
          >
            <div className="w-12 h-12 bg-slate-100 rounded-full overflow-hidden border border-slate-50 flex items-center justify-center text-slate-400">
              {s.photo ? (
                <img src={s.photo} className="w-full h-full object-cover" />
              ) : (
                <Users size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">
                {s.name}
              </h5>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {s.shift}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Phone size={10} className="text-emerald-500" />
                <span className="text-[9px] font-bold text-slate-600">
                  {s.phone}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {confirmingId === s.id ? (
                <div className="flex flex-col items-center gap-1 bg-rose-50 p-1 rounded border border-rose-100">
                  <button
                    onClick={() => {
                      onDelete(s.id);
                      setConfirmingId(null);
                    }}
                    className="text-[8px] font-black text-rose-600 uppercase"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="text-[8px] font-black text-slate-400 uppercase"
                  >
                    X
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingId(s.id)}
                  className="text-rose-400 hover:text-rose-600 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Suppliers Manager
function SuppliersManager({
  condoId,
  suppliers,
  onAdd,
  onDelete,
}: {
  condoId: string;
  suppliers: Proveedor[];
  onAdd: (s: any) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("");
  const [email, setEmail] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const condoSuppliers = suppliers.filter((s) => s.condominioId === condoId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ condominioId: condoId, name, phone, service, email });
    setName("");
    setPhone("");
    setService("");
    setEmail("");
    setIsAdding(false);
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-indigo-600" />
          <h4 className="text-sm font-black text-slate-700 uppercase italic">
            Proveedores y Servicios
          </h4>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-[10px] font-black text-blue-600 uppercase tracking-widest"
        >
          {isAdding ? "Cerrar" : "+ Proveedor"}
        </button>
      </div>
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              placeholder="Nombre de la empresa/persona..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              placeholder="Servicio (Ej. Plomería, Agua)..."
              value={service}
              onChange={(e) => setService(e.target.value)}
              required
            />
            <input
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              placeholder="Teléfono..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <input
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              placeholder="Email (Opcional)..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full h-10 bg-indigo-700 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-800 transition-all mt-2"
          >
            Registrar Proveedor
          </button>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {condoSuppliers.map((s) => (
          <div
            key={s.id}
            className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
              <Package size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">
                {s.name}
              </h5>
              <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">
                {s.service}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <Phone size={10} className="text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-600">
                    {s.phone}
                  </span>
                </div>
                {s.email && (
                  <div className="flex items-center gap-1">
                    <Mail size={10} className="text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-600 truncate max-w-[80px]">
                      {s.email}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              {confirmingId === s.id ? (
                <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                  <button
                    onClick={() => {
                      onDelete(s.id);
                      setConfirmingId(null);
                    }}
                    className="text-[9px] font-black text-rose-600 uppercase"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="text-[9px] font-black text-slate-400 uppercase"
                  >
                    X
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingId(s.id)}
                  className="p-1.5 text-rose-400 hover:text-rose-600 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Condo Management View
function CondoView({
  condos,
  units,
  tasks,
  maintenance,
  repairs,
  staff,
  onAdd,
  onUpdate,
  onDelete,
  onSelect,
  selectedId,
  onAddUnit,
  onUpdateUnit,
  onDeleteUnit,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onAddMaintenance,
  onUpdateMaintenance,
  onDeleteMaintenance,
  onAddRepair,
  onUpdateRepair,
  onDeleteRepair,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  suppliers,
  onAddSupplier,
  onDeleteSupplier,
}: {
  condos: Condominio[];
  units: Unidad[];
  tasks: Tarea[];
  maintenance: Mantenimiento[];
  repairs: Reparacion[];
  staff: Conserje[];
  suppliers: Proveedor[];
  onAdd: (n: string, a: string, p?: string, rsd?: number) => void;
  onUpdate: (
    id: string,
    n: string,
    a: string,
    p?: string,
    rsd?: number,
  ) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onAddUnit: (u: any) => void;
  onUpdateUnit: (id: string, u: any) => void;
  onDeleteUnit: (id: string) => void;
  onAddTask: (t: any) => void;
  onUpdateTask: (id: string, t: any) => void;
  onDeleteTask: (id: string) => void;
  onAddMaintenance: (m: any) => void;
  onUpdateMaintenance: (id: string, m: any) => void;
  onDeleteMaintenance: (id: string) => void;
  onAddRepair: (r: any) => void;
  onUpdateRepair: (id: string, r: any) => void;
  onDeleteRepair: (id: string) => void;
  onAddStaff: (s: any) => void;
  onUpdateStaff: (id: string, s: any) => void;
  onDeleteStaff: (id: string) => void;
  onAddSupplier: (s: any) => void;
  onDeleteSupplier: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [reminderStartDay, setReminderStartDay] = useState<string>("1");
  const [photo, setPhoto] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editReminderStartDay, setEditReminderStartDay] = useState<string>("1");
  const [editPhoto, setEditPhoto] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name, address, photo, parseInt(reminderStartDay) || 1);
    setName("");
    setAddress("");
    setReminderStartDay("1");
    setPhoto("");
    setIsAdding(false);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    onUpdate(
      editingId,
      editName,
      editAddress,
      editPhoto,
      parseInt(editReminderStartDay) || 1,
    );
    setEditingId(null);
  };

  const startEditing = (c: Condominio) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditAddress(c.address);
    setEditReminderStartDay(c.reminderStartDay?.toString() || "1");
    setEditPhoto(c.photo || "");
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-2 w-8 bg-blue-500 rounded"></div>
          <div>
            <h3 className="text-lg font-bold uppercase tracking-tight text-slate-800 italic">
              Juntas de Condominios
            </h3>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Multi-Propiedad Dominicana
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-slate-800 text-white px-6 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest shadow-md hover:bg-slate-700 transition-all active:scale-95"
        >
          {isAdding ? <X size={16} /> : <PlusCircle size={16} />}
          {isAdding ? "Cancelar" : "Añadir Condominio"}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form
              onSubmit={handleSubmit}
              className="bg-slate-50 p-8 rounded-xl border border-dashed border-slate-300 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Nombre del Residencial
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Ej. Residencial Las Palmeras"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 focus:ring-1 focus:ring-blue-500 transition-all outline-none font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Dirección Física
                  </label>
                  <input
                    type="text"
                    placeholder="Calle, Sector, Ciudad..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 focus:ring-1 focus:ring-blue-500 transition-all outline-none font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    Día de Inicio Recordatorios (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ej. 1"
                    value={reminderStartDay}
                    onChange={(e) => setReminderStartDay(e.target.value)}
                    className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 focus:ring-1 focus:ring-blue-500 transition-all outline-none font-bold text-sm"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <ImageUpload
                  label="Foto del Residencial (JPG)"
                  onImageSelected={setPhoto}
                  currentImage={photo}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-700 text-white py-3.5 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-blue-800 shadow-lg transition-all"
              >
                Registrar Localmente
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {condos.map((c) => (
          <div
            key={c.id}
            className={`p-6 bg-white rounded-xl border transition-all relative group shadow-sm ${
              selectedId === c.id
                ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/10"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            {editingId === c.id ? (
              <form onSubmit={handleUpdate} className="space-y-3">
                <input
                  autoFocus
                  className="w-full h-10 px-3 border border-blue-400 bg-white rounded-lg font-bold text-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <input
                  className="w-full h-10 px-3 border border-slate-200 bg-white rounded-lg text-xs"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Día Inicio Recordatorios
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="w-full h-10 px-3 border border-slate-200 bg-white rounded-lg text-xs"
                    value={editReminderStartDay}
                    onChange={(e) => setEditReminderStartDay(e.target.value)}
                  />
                </div>
                <ImageUpload
                  label="Actualizar Foto (JPG)"
                  onImageSelected={setEditPhoto}
                  currentImage={editPhoto}
                />
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-black text-[10px] uppercase"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 bg-slate-100 py-2 rounded-lg font-bold text-[10px] uppercase"
                  >
                    X
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Photo Header */}
                <div className="absolute top-0 left-0 w-full h-32 bg-slate-50 overflow-hidden border-b border-slate-100">
                  {c.photo ? (
                    <img
                      src={c.photo}
                      alt={c.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Building2
                      size={32}
                      className={`opacity-20 ${selectedId === c.id ? "text-blue-500" : "text-slate-400"}`}
                    />
                  )}
                </div>

                <div className="mt-28">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="text-lg font-bold text-slate-800 mb-1 truncate">
                        {c.name}
                      </h4>
                      <p className="text-xs text-slate-400 italic truncate">
                        {c.address || "Sin dirección"}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {confirmingId === c.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(c.id);
                              setConfirmingId(null);
                            }}
                            className="text-[9px] font-black text-rose-600 uppercase"
                          >
                            Si, Eliminar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingId(null);
                            }}
                            className="text-[9px] font-black text-slate-400 uppercase"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(c)}
                            className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmingId(c.id)}
                            className="p-2 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                          {selectedId !== c.id && (
                            <button
                              onClick={() => onSelect(c.id)}
                              className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            >
                              <Check size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                      ID: {c.id.slice(0, 8)}
                    </span>
                    {selectedId === c.id && (
                      <span className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />{" "}
                        Seleccionado
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {selectedId && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-10 border-t border-slate-200"
        >
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-2 w-8 bg-blue-600 rounded"></div>
              <h3 className="text-xl font-black text-slate-800 uppercase italic">
                Detalles de {condos.find((c) => c.id === selectedId)?.name}
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">
              Gestión Integral del Residencial
            </p>

            <div className="space-y-12">
              <UnitsManager
                condoId={selectedId}
                units={units}
                onAdd={onAddUnit}
                onUpdate={onUpdateUnit}
                onDelete={onDeleteUnit}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 border-t border-slate-100 pt-10">
                <TasksManager
                  condoId={selectedId}
                  tasks={tasks}
                  onAdd={onAddTask}
                  onUpdate={onUpdateTask}
                  onDelete={onDeleteTask}
                />
                <RepairsManager
                  condoId={selectedId}
                  repairs={repairs}
                  onAdd={onAddRepair}
                  onUpdate={onUpdateRepair}
                  onDelete={onDeleteRepair}
                />
              </div>

              <div className="border-t border-slate-100 pt-10">
                <MaintenanceManager
                  condoId={selectedId}
                  maintenance={maintenance}
                  onAdd={onAddMaintenance}
                  onDelete={onDeleteMaintenance}
                />
              </div>

              <div className="border-t border-slate-100 pt-10">
                <StaffManager
                  condoId={selectedId}
                  staff={staff}
                  onAdd={onAddStaff}
                  onDelete={onDeleteStaff}
                />
              </div>

              <div className="border-t border-slate-100 pt-10">
                <SuppliersManager
                  condoId={selectedId}
                  suppliers={suppliers}
                  onAdd={onAddSupplier}
                  onDelete={onDeleteSupplier}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Billing View Component
function BillingView({
  condo,
  units,
  transactions,
  onAddTransaction,
}: {
  condo: Condominio | null;
  units: Unidad[];
  transactions: Transaction[];
  onAddTransaction: (t: any) => void;
}) {
  const [filter, setFilter] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  ); // YYYY-MM
  const [remindingAll, setRemindingAll] = useState(false);

  const condoUnits = useMemo(
    () =>
      units.filter((u) =>
        u.numero.toLowerCase().includes(filter.toLowerCase()),
      ),
    [units, filter],
  );

  const unitPayments = useMemo(() => {
    const monthTransactions = transactions.filter((t) =>
      t.date.startsWith(selectedMonth),
    );

    return condoUnits.map((unit) => {
      const payment = monthTransactions.find(
        (t) =>
          t.type === TransactionType.INCOME &&
          t.concept === "Cuotas de Mantenimientos" &&
          t.description?.includes(`Unidad ${unit.numero}`),
      );
      return {
        unit,
        paid: !!payment,
        payment,
      };
    });
  }, [condoUnits, transactions, selectedMonth]);

  const stats = useMemo(() => {
    const total = unitPayments.length;
    const paidCount = unitPayments.filter((p) => p.paid).length;
    const pendingCount = total - paidCount;
    const pendingAmount = unitPayments
      .filter((p) => !p.paid)
      .reduce((sum, p) => sum + (p.unit.maintenanceFee || 0), 0);
    const paidAmount = unitPayments
      .filter((p) => p.paid)
      .reduce((sum, p) => sum + (p.payment?.amount || 0), 0);

    return { total, paidCount, pendingCount, pendingAmount, paidAmount };
  }, [unitPayments]);

  const handleBill = (unit: Unidad) => {
    const amount = unit.maintenanceFee || 0;
    if (amount <= 0) {
      alert("La unidad no tiene una cuota de mantenimiento asignada.");
      return;
    }

    onAddTransaction({
      condominioId: unit.condominioId,
      type: TransactionType.INCOME,
      category: "INGRESOS ORDINARIOS",
      concept: "Cuotas de Mantenimientos",
      amount: amount,
      date: new Date().toISOString().split("T")[0],
      description: `Pago mantenimiento Unidad ${unit.numero} - ${selectedMonth}`,
    });
  };

  const sendWhatsAppReminder = (unit: Unidad) => {
    const message = `Hola ${unit.ownerName}, le recordamos que la cuota de mantenimiento de su unidad ${unit.numero} correspondiente al mes de ${selectedMonth} por un monto de RD$ ${unit.maintenanceFee?.toLocaleString()} está pendiente. Favor realizar su pago a la brevedad. Gracias.`;
    const encoded = encodeURIComponent(message);
    window.open(
      `https://wa.me/${unit.whatsapp.replace(/[^0-9]/g, "")}?text=${encoded}`,
      "_blank",
    );
  };

  const sendEmailReminder = (unit: Unidad) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RECORDATORIO DE PAGO", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(condo?.name || "Condominio", pageWidth / 2, 30, {
      align: "center",
    });
    doc.text(condo?.address || "", pageWidth / 2, 35, { align: "center" });

    doc.line(20, 45, pageWidth - 20, 45);

    // Content
    doc.setFontSize(14);
    doc.text(`Estimado/a ${unit.ownerName},`, 20, 60);

    doc.setFontSize(11);
    const text = `Le saludamos cordialmente de la junta de condominios. Por este medio le recordamos que su unidad No. ${unit.numero} presenta un balance pendiente de pago por concepto de cuota de mantenimiento ordinaria del mes de ${selectedMonth}.`;
    const lines = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(lines, 20, 70);

    // Table-like area
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 90, pageWidth - 40, 30, "F");
    doc.setFont("helvetica", "bold");
    doc.text("DETALLE DEL PENDIENTE", 25, 100);
    doc.setFont("helvetica", "normal");
    doc.text(`Concepto: Mantenimiento Mensual (${selectedMonth})`, 25, 110);
    doc.setFontSize(16);
    doc.text(
      `TOTAL A PAGAR: RD$ ${unit.maintenanceFee?.toLocaleString()}`,
      pageWidth - 25,
      110,
      { align: "right" },
    );

    doc.setFontSize(10);
    doc.text(
      "Favor realizar el pago vía transferencia bancaria o en la oficina de administración.",
      20,
      130,
    );

    doc.text("Atentamente,", 20, 150);
    doc.text("La Administración del Condominio", 20, 155);

    doc.save(`Recordatorio_${unit.numero}_${selectedMonth}.pdf`);
  };

  const handleRemindAll = () => {
    const todayDay = new Date().getDate();
    if (condo?.reminderStartDay && todayDay < condo.reminderStartDay) {
      if (
        !confirm(
          `Hoy es día ${todayDay}. Los recordatorios están configurados para iniciar el día ${condo.reminderStartDay}. ¿Desea enviarlos de todas formas?`,
        )
      ) {
        return;
      }
    }

    setRemindingAll(true);
    // In a real app this might be a background process or server-side
    // Here we'll just alert that it started
    setTimeout(() => {
      alert(`Se han enviado ${stats.pendingCount} recordatorios masivos.`);
      setRemindingAll(false);
    }, 1500);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
              <ReceiptText size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase italic leading-none">
                Control de Facturación
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {condo?.name || "Selecciona un condominio"} • Mes de Gestión:{" "}
                {selectedMonth}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-black outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Filtro (ej: 101)..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-48"
            />
            <button
              onClick={handleRemindAll}
              disabled={remindingAll || stats.pendingCount === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 disabled:bg-slate-200 disabled:shadow-none"
            >
              {remindingAll ? (
                <Clock size={14} className="animate-spin" />
              ) : (
                <Mail size={14} />
              )}
              Remitir Recordatorios ({stats.pendingCount})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Unidad
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Condómino
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Mantenimiento
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Estado {selectedMonth}
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {unitPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-20 text-center text-slate-400 font-medium italic"
                  >
                    {condo
                      ? "No se encontraron unidades registradas."
                      : "Selecciona un condominio para ver las unidades."}
                  </td>
                </tr>
              ) : (
                unitPayments.map(({ unit, paid, payment }) => (
                  <tr
                    key={unit.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm border ${paid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"}`}
                        >
                          {unit.numero}
                        </div>
                        <span className="text-[10px] font-black text-slate-800 uppercase italic">
                          Activa
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                          {unit.ownerName}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                          {unit.whatsapp}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-slate-700 font-mono">
                        RD$ {unit.maintenanceFee?.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {paid ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
                          <Check size={10} strokeWidth={4} /> PAGADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest">
                          <AlertTriangle size={10} strokeWidth={4} /> PENDIENTE
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {!paid && (
                          <button
                            onClick={() => handleBill(unit)}
                            className="h-9 px-3 flex items-center gap-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm"
                            title="Registrar Pago"
                          >
                            <DollarSign size={14} /> Facturar
                          </button>
                        )}
                        {!paid && (
                          <>
                            <button
                              onClick={() => sendWhatsAppReminder(unit)}
                              className="h-9 w-9 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-emerald-500 hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm"
                              title="Recordatorio WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </button>
                            <button
                              onClick={() => sendEmailReminder(unit)}
                              className="h-9 w-9 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-blue-500 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm"
                              title="Recordatorio PDF"
                            >
                              <FileText size={16} />
                            </button>
                          </>
                        )}
                        {paid && (
                          <span className="text-[9px] font-bold text-slate-300 italic uppercase">
                            Procesado: {payment?.date}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all duration-700"></div>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">
            CUMPLIMIENTO MENSUAL
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-black font-mono">
                {stats.total > 0
                  ? Math.round((stats.paidCount / stats.total) * 100)
                  : 0}
                %
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                {stats.paidCount} de {stats.total} unidades
              </p>
            </div>
            <BarChart3 size={32} className="text-slate-700" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">
            RECAUDADO {selectedMonth}
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-black font-mono text-slate-800">
                RD$ {stats.paidAmount.toLocaleString()}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                Ingresos ordinarios liquidados
              </p>
            </div>
            <TrendingUp size={32} className="text-emerald-100" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm border-l-4 border-l-rose-500">
          <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4">
            CUENTAS POR COBRAR
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-black font-mono text-slate-800">
                RD$ {stats.pendingAmount.toLocaleString()}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                Balance pendiente de unidades
              </p>
            </div>
            <AlertTriangle size={32} className="text-rose-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

const generateInvoicePDF = (
  sale: Sale,
  settings: TicketSettings,
  format: "58mm" | "80mm" | "letter" = "80mm",
) => {
  const doc = new jsPDF({
    unit: "mm",
    format: format === "letter" ? "letter" : [format === "58mm" ? 58 : 80, 297],
  });

  const width = format === "letter" ? 215.9 : format === "58mm" ? 58 : 80;
  let y = 10;

  // Logo
  if (settings.showLogo && settings.logoUrl) {
    try {
      // Simple check if it's a data URL or a regular URL
      doc.addImage(settings.logoUrl, "JPEG", width / 2 - 10, y, 20, 20);
      y += 25;
    } catch (e) {
      console.error("Error adding logo to PDF", e);
    }
  }

  // Header
  const baseSize = settings.fontSize || 10;
  doc.setFontSize(format === "letter" ? baseSize + 6 : baseSize);
  doc.setFont("helvetica", "bold");
  doc.text(settings.businessName || "SISTEMA DE FACTURACIÓN", width / 2, y, {
    align: "center",
  });
  y += format === "letter" ? 10 : 5;

  if (settings.address) {
    doc.setFontSize(format === "letter" ? baseSize : baseSize * 0.7);
    doc.setFont("helvetica", "normal");
    doc.text(settings.address, width / 2, y, { align: "center" });
    y += format === "letter" ? 6 : 3;
  }

  if (settings.phone) {
    doc.text(`Tel: ${settings.phone}`, width / 2, y, { align: "center" });
    y += format === "letter" ? 6 : 3;
  }

  if (settings.rnc) {
    doc.text(`RNC: ${settings.rnc}`, width / 2, y, { align: "center" });
    y += format === "letter" ? 6 : 4;
  }

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(format === "letter" ? baseSize + 2 : baseSize * 0.8);
  doc.text(`Factura: ${sale.id.slice(0, 8)}`, width / 2, y, {
    align: "center",
  });
  y += format === "letter" ? 8 : 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(format === "letter" ? baseSize : baseSize * 0.7);
  doc.text(`Fecha: ${new Date(sale.date).toLocaleString()}`, width / 2, y, {
    align: "center",
  });
  y += format === "letter" ? 6 : 3;
  doc.text(
    `Cliente: ${sale.clientName || "Ventas de Mostrador"}`,
    width / 2,
    y,
    { align: "center" },
  );
  y += format === "letter" ? 10 : 5;

  // Items Table
  autoTable(doc, {
    head: [["Cant", "Desc", "Precio", "Total"]],
    body: sale.items.map((item) => [
      item.quantity.toString(),
      item.description,
      `$${item.price.toFixed(2)}`,
      `$${item.total.toFixed(2)}`,
    ]),
    startY: y,
    theme: "plain",
    styles: {
      fontSize: format === "letter" ? baseSize : baseSize * 0.7,
      cellPadding: format === "letter" ? 2 : 1,
      font: settings.isBold ? "helvetica" : "helvetica", // Simplified
    },
    headStyles: { fontStyle: "bold" },
    margin: { left: 5, right: 5 },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Totals
  doc.setFont("helvetica", "bold");
  doc.text(`SUBTOTAL: $${sale.subtotal.toFixed(2)}`, width - 10, y, {
    align: "right",
  });
  y += format === "letter" ? 6 : 3;
  doc.text(`ITBIS (18%): $${sale.itbis.toFixed(2)}`, width - 10, y, {
    align: "right",
  });
  y += format === "letter" ? 6 : 3;
  doc.text(`TOTAL: $${sale.total.toFixed(2)}`, width - 10, y, {
    align: "right",
  });

  if (sale.usdAmount) {
    y += format === "letter" ? 6 : 3;
    doc.text(`TOTAL USD: $${sale.usdAmount.toFixed(2)}`, width - 10, y, {
      align: "right",
    });
  }

  if (sale.notes) {
    y += format === "letter" ? 10 : 5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(format === "letter" ? baseSize - 1 : baseSize * 0.6);
    doc.text(`Notas: ${sale.notes}`, 5, y);
  }

  y += format === "letter" ? 15 : 8;
  doc.setFont("helvetica", "bold");
  doc.text(
    settings.farewellMessage || "¡GRACIAS POR SU COMPRA!",
    width / 2,
    y,
    { align: "center" },
  );

  doc.save(`Factura-${sale.id}.pdf`);
};

const generateReceiptPDF = (receipt: Recibo, settings?: TicketSettings) => {
  const doc = new jsPDF({
    unit: "mm",
    format: "letter",
  });

  const width = 215.9; // Letter width in mm
  let y = 15;

  const currentSettings = settings || storage.getTicketSettings();
  const bizName = currentSettings?.businessName || "SISTEMA DE GESTIÓN";
  const address = currentSettings?.address || "";
  const phone = currentSettings?.phone || "";
  const rnc = currentSettings?.rnc || "";

  // 1. Decorative Header Accent line
  doc.setFillColor(13, 148, 136); // Teal accent (#0d9488)
  doc.rect(0, 0, width, 5, "F");

  // Add Company Logo if configured
  if (currentSettings?.showLogo && currentSettings?.logoUrl) {
    try {
      doc.addImage(currentSettings.logoUrl, "JPEG", width / 2 - 12, y, 24, 24);
      y += 28;
    } catch (e) {
      console.error("Error adding logo to PDF", e);
    }
  }

  // Title Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(13, 148, 136);
  doc.text(bizName.toUpperCase(), width / 2, y, { align: "center" });
  y += 8;

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  if (address) {
    doc.text(address, width / 2, y, { align: "center" });
    y += 5;
  }
  if (phone || rnc) {
    let contactStr = "";
    if (phone) contactStr += `Tel: ${phone}  `;
    if (rnc) contactStr += `RNC: ${rnc}`;
    doc.text(contactStr, width / 2, y, { align: "center" });
    y += 8;
  }

  // Draw elegant double split
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, y, width - 15, y);
  y += 8;

  // Receipt Meta Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  const typeLabels: Record<string, string> = {
    ingreso: "COMPROBANTE DE INGRESO",
    egreso: "COMPROBANTE DE GASTO / EGRESO",
    nomina: "COMPROBANTE DE PAGO DE NÓMINA",
    venta: "COMPROBANTE DE VENTA (POS)",
    pago_mantenimiento: "COMPROBANTE DE PAGO MANTENIMIENTO",
  };
  doc.text(typeLabels[receipt.tipo] || "COMPROBANTE DE TRANSACCIÓN", 15, y);

  // Right: Sequence number and date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(13, 148, 136);
  doc.text(`Secuencia: ${receipt.sequence}`, width - 15, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Fecha de Emisión: ${receipt.fecha}`, width - 15, y, { align: "right" });
  y += 12;

  // Table header background box
  doc.setFillColor(248, 250, 252);
  doc.rect(15, y, width - 30, 10, "F");

  // Table headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("CONCEPTO / DETALLE DE OPERACIÓN", 18, y + 6.5);
  doc.text("IMPORTE TOTAL", width - 18, y + 6.5, { align: "right" });
  
  doc.setDrawColor(203, 213, 225);
  doc.line(15, y + 10, width - 15, y + 10);
  y += 10;

  // Table body content
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(receipt.concepto || "Operación General", 18, y);
  doc.setFont("helvetica", "bold");
  doc.text(`RD$ ${Number(receipt.monto).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, width - 18, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Beneficiario / Cliente: ${receipt.beneficiario}`, 18, y);
  y += 8;

  // Si tiene datos de gas m³, agregar tarjeta de desglose detallado y organizado
  if (receipt.m3 !== undefined) {
    try {
      const unitsList = storage.getUnits();
      const unit = receipt.unidadId ? unitsList.find(u => u.id === receipt.unidadId) : null;
      let unitText = "N/D";
      if (unit) {
        unitText = `UNIDAD ${unit.numero} - ${unit.ownerName.toUpperCase()}`;
      } else if (receipt.beneficiario) {
        // Fallback matching substring
        const cleanBeneficiary = receipt.beneficiario.replace(/^Gas:\s*/i, "").trim();
        unitText = cleanBeneficiary;
      }

      // Elegant card background & border
      doc.setFillColor(248, 250, 252); // slate-50 background
      doc.setDrawColor(226, 232, 240); // slate-200 border
      doc.setLineWidth(0.3);
      doc.roundedRect(18, y, width - 36, 40, 4, 4, "FD");

      // Card Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(13, 148, 136); // Teal primary color
      doc.text("MÉTRICAS Y DETALLES DE CONSUMO DE GAS GLP", 22, y + 6);

      // Thin separator line
      doc.setDrawColor(241, 245, 249);
      doc.line(22, y + 8, width - 22, y + 8);

      // Info Columns
      // 1. Unidad o Propietario a calcular
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("UNIDAD O PROPIETARIO A CALCULAR", 22, y + 13);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(unitText, 22, y + 17.5);

      // 2. Readings columns (Lectura Anterior vs Actual)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("LECTURA ANTERIOR (m³)", 22, y + 26);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      const prevReadingText = receipt.lecturaAnterior !== undefined ? `${receipt.lecturaAnterior.toFixed(2)} m³` : "N/D";
      doc.text(prevReadingText, 22, y + 31);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("LECTURA ACTUAL (m³)", 75, y + 26);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      const currReadingText = receipt.lecturaActual !== undefined ? `${receipt.lecturaActual.toFixed(2)} m³` : "N/D";
      doc.text(currReadingText, 75, y + 31);

      // Right Column: Formula & Result Highlights
      doc.setFillColor(238, 242, 255); // Indigo-50
      doc.setDrawColor(224, 231, 255); // Indigo-100
      doc.roundedRect(width - 80, y + 11.5, 58, 24, 3, 3, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text("CONSUMO CALCULADO RESULTANTE", width - 77, y + 16);

      // Big Badge for final m3
      doc.setFontSize(14);
      doc.text(`${receipt.m3.toFixed(2)} m³`, width - 77, y + 23);

      // Detailed Operation
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      let opText = `Operación directa: ${receipt.m3.toFixed(2)} m³`;
      if (receipt.lecturaActual !== undefined && receipt.lecturaAnterior !== undefined) {
        opText = `Operación: ${receipt.lecturaActual.toFixed(2)} m³ - ${receipt.lecturaAnterior.toFixed(2)} m³`;
      }
      doc.text(opText, width - 77, y + 28);
      
      y += 44;
    } catch (e) {
      console.error("Error drawing Gas receipt metadata:", e);
    }
  }

  // Extra Description/Notes
  if (receipt.descripcion) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    // Draw note box
    doc.setFillColor(254, 254, 254);
    doc.rect(18, y, width - 36, 12, "F");
    
    // Check line wrapping for note
    const lines = doc.splitTextToSize(`Nota / Detalle: ${receipt.descripcion}`, width - 40);
    doc.text(lines, 20, y + 5);
    y += 18;
  } else {
    y += 5;
  }

  // Draw bottom line
  doc.setDrawColor(226, 232, 240);
  doc.line(15, y, width - 15, y);
  y += 15;

  // Signature lines
  const sigY = y + 20;
  doc.setDrawColor(148, 163, 184);
  doc.line(25, sigY, 85, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma de Entrega / Despacho", 55, sigY + 4, { align: "center" });

  doc.line(width - 85, sigY, width - 25, sigY);
  doc.text("Firma Conforme Beneficiario / Cliente", width - 55, sigY + 4, { align: "center" });

  y = sigY + 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Este es un comprobante electrónico oficial de caja guardado en el sistema.", width / 2, y, { align: "center" });

  doc.save(`Recibo-${receipt.sequence}.pdf`);
};

// General Billing View Component
interface GeneralBillingViewProps {
  settings: TicketSettings;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  onAddReceipt?: (r: Recibo) => void;
}

function GeneralBillingView({
  settings,
  products,
  setProducts,
  sales,
  setSales,
  onAddReceipt,
}: GeneralBillingViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    | "ventas"
    | "cotizaciones"
    | "inventario"
    | "productos"
    | "clientes"
    | "ventas_dia"
  >("ventas");
  const [departments, setDepartments] = useState<string[]>(
    storage.getDepartments(),
  );

  // Shared state for the active sale/cart
  const [cart, setCart] = useState<(Product & { quantity: number })[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("default");

  const subTabs = [
    {
      id: "ventas" as const,
      label: "VENTAS",
      icon: <ShoppingCart size={18} />,
    },
    {
      id: "ventas_dia" as const,
      label: "VENTAS DÍA",
      icon: <BarChart3 size={18} />,
    },
    {
      id: "cotizaciones" as const,
      label: "COTIZACIONES",
      icon: <FileText size={18} />,
    },
    {
      id: "inventario" as const,
      label: "INVENTARIO",
      icon: <ClipboardList size={18} />,
    },
    { id: "productos" as const, label: "PRODUCTOS", icon: <Tag size={18} /> },
    { id: "clientes" as const, label: "CLIENTES", icon: <Users size={18} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-14">
      {/* Blue Sub-Navigation Bar */}
      <div className="bg-[#0f172a] p-4 rounded-xl shadow-lg flex flex-wrap items-center justify-center gap-2 md:gap-8 overflow-x-auto border-b-4 border-[#10b981]">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            id={`subtab-${tab.id}`}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all duration-300 ${
              activeSubTab === tab.id
                ? "bg-[#10b981] text-[#064e3b] shadow-inner font-black scale-105"
                : "text-white/80 hover:text-white font-bold"
            }`}
          >
            <span
              className={
                activeSubTab === tab.id ? "text-[#064e3b]" : "text-white/70"
              }
            >
              {tab.icon}
            </span>
            <span className="text-[11px] uppercase tracking-tighter">
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {activeSubTab === "productos" ? (
        <ProductsView
          products={products}
          setProducts={setProducts}
          departments={departments}
          setDepartments={setDepartments}
        />
      ) : activeSubTab === "ventas" ? (
        <SalesView
          products={products}
          setProducts={setProducts}
          sales={sales}
          setSales={setSales}
          cart={cart}
          setCart={setCart}
          selectedClientId={selectedClientId}
          setSelectedClientId={setSelectedClientId}
          settings={settings}
          onAddReceipt={onAddReceipt}
        />
      ) : activeSubTab === "ventas_dia" ? (
        <DailySalesView
          sales={sales}
          setSales={setSales}
          generateInvoicePDF={(sale, format) =>
            generateInvoicePDF(sale, settings, format)
          }
        />
      ) : activeSubTab === "cotizaciones" ? (
        <QuotesView
          products={products}
          setProducts={setProducts}
          setActiveSubTab={setActiveSubTab}
          setCart={setCart}
          setSelectedClientId={setSelectedClientId}
        />
      ) : activeSubTab === "inventario" ? (
        <InventoryView products={products} />
      ) : activeSubTab === "clientes" ? (
        <ClientsView />
      ) : (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            {subTabs.find((t) => t.id === activeSubTab)?.icon}
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase italic mb-2">
            Módulo de {activeSubTab}
          </h3>
          <p className="text-sm text-slate-400 font-medium max-w-md mx-auto">
            Este módulo de Facturación General está siendo configurado para
            gestionar {activeSubTab}. Pronto podrás realizar operaciones
            comerciales aquí.
          </p>
        </div>
      )}
    </div>
  );
}

function SalesView({
  products,
  setProducts,
  sales,
  setSales,
  cart,
  setCart,
  selectedClientId,
  setSelectedClientId,
  settings,
  onAddReceipt,
}: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  cart: (Product & { quantity: number })[];
  setCart: React.Dispatch<
    React.SetStateAction<(Product & { quantity: number })[]>
  >;
  selectedClientId: string;
  setSelectedClientId: React.Dispatch<React.SetStateAction<string>>;
  settings: TicketSettings;
  onAddReceipt?: (r: Recibo) => void;
}) {
  const [itbisEnabled, setItbisEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [clients] = useState<Client[]>(storage.getClients());

  const [showCommonModal, setShowCommonModal] = useState(false);
  const [commonName, setCommonName] = useState("");
  const [commonPrice, setCommonPrice] = useState("");

  const selectedClient = useMemo(() => {
    return (
      clients.find((c) => c.id === selectedClientId) || {
        id: "default",
        fullName: "Ventas de Mostrador",
      }
    );
  }, [clients, selectedClientId]);

  const filteredProducts = products.filter(
    (p) =>
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    );
  };

  const addCommonItem = () => {
    if (!commonName || !commonPrice) return;
    const price = parseFloat(commonPrice);
    if (isNaN(price)) return;

    const commonProduct: Product = {
      id: `common-${Date.now()}`,
      description: `[COMÚN] ${commonName.toUpperCase()}`,
      salePrice: price,
      costPrice: 0,
      barcode: "",
      department: "COMUN",
      image: "",
      currentStock: 0,
      minStock: 0,
      useInventory: false,
      sellType: "Unidad",
      wholesalePrice: price,
    };

    addToCart(commonProduct);
    setCommonName("");
    setCommonPrice("");
    setShowCommonModal(false);
  };
  const subtotal = cart.reduce(
    (acc, item) => acc + item.salePrice * item.quantity,
    0,
  );
  const itbis = itbisEnabled ? subtotal * 0.18 : 0;
  const total = subtotal + itbis;

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleProcessSale = (data: {
    method: string;
    printTicket: boolean;
    sendWhatsApp: boolean;
    notes?: string;
    bank?: string;
    reference?: string;
    exchangeRate?: number;
    usdAmount?: number;
  }) => {
    if (cart.length === 0) return;

    const subtotalVal = subtotal;
    const itbisVal = itbis;
    const totalVal = total;

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      date: new Date().toISOString(),
      items: cart.map((item) => ({
        productId: item.id,
        description: item.description,
        quantity: item.quantity,
        price: item.salePrice,
        total: item.salePrice * item.quantity,
      })),
      subtotal: subtotalVal,
      itbis: itbisVal,
      total: totalVal,
      paymentMethod: data.method,
      clientName: selectedClient.fullName,
      notes: data.notes,
      bank: data.bank,
      reference: data.reference,
      exchangeRate: data.exchangeRate,
      usdAmount: data.usdAmount,
    };

    setSales((prev) => [...prev, newSale]);

    if (onAddReceipt) {
      const loadedReceipts = storage.getReceipts();
      const nextNum = loadedReceipts.length + 1;
      const sequence = `REC-${String(nextNum).padStart(4, "0")}`;
      const newRec: Recibo = {
        id: crypto.randomUUID(),
        saleId: newSale.id,
        tipo: "venta",
        sequence,
        concepto: `Venta POS: ${cart.map(item => `${item.description} (x${item.quantity})`).join(", ")}`,
        monto: newSale.total,
        fecha: new Date(newSale.date).toISOString().split('T')[0],
        descripcion: newSale.notes,
        beneficiario: newSale.clientName || "Cliente General",
        createdAt: Date.now()
      };
      onAddReceipt(newRec);
    }

    // Update inventory
    const updatedProducts = products.map((p) => {
      const cartItem = cart.find((item) => item.id === p.id);
      if (cartItem && p.useInventory) {
        return {
          ...p,
          currentStock: Math.max(0, p.currentStock - cartItem.quantity),
        };
      }
      return p;
    });

    setProducts(updatedProducts);

    if (data.printTicket) {
      generateInvoicePDF(
        newSale,
        settings,
        (data as any).ticketFormat || "80mm",
      );
    }

    if (data.sendWhatsApp) {
      const message =
        `*Factura - ${settings.businessName}*\n\n` +
        `Cliente: ${selectedClient.fullName}\n` +
        `Fecha: ${new Date().toLocaleDateString()}\n\n` +
        `Items:\n` +
        cart
          .map(
            (item) =>
              `- ${item.description} x${item.quantity}: $${(item.salePrice * item.quantity).toFixed(2)}`,
          )
          .join("\n") +
        `\n\n*TOTAL: $${totalVal.toFixed(2)}*` +
        (data.notes ? `\n\nNotas: ${data.notes}` : "") +
        `\n\n${settings.farewellMessage}`;

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank");
    } else if (!data.printTicket) {
      alert(`Venta facturada por un total de $${totalVal.toFixed(2)}`);
    }

    setCart([]);
    setShowPaymentModal(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[700px]">
      {showCommonModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-emerald-500 p-4 flex items-center justify-between">
              <h3 className="text-white font-black italic uppercase text-sm">
                Venta Producto Común
              </h3>
              <button
                onClick={() => setShowCommonModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Descripción del Producto
                </label>
                <input
                  autoFocus
                  type="text"
                  value={commonName}
                  onChange={(e) => setCommonName(e.target.value)}
                  placeholder="Ej: Servicio de Copia"
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Precio de Venta (RD$)
                </label>
                <input
                  type="number"
                  value={commonPrice}
                  onChange={(e) => setCommonPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xl font-black text-emerald-600 font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={addCommonItem}
                className="w-full h-12 bg-emerald-500 text-white font-black italic uppercase tracking-tighter rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                <PlusSquare size={18} /> Agregar al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          total={total}
          clientName={selectedClient.fullName}
          itemCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
          onConfirm={handleProcessSale}
        />
      )}
      {/* Main Column: Search & Products */}
      <div className="lg:col-span-9 space-y-5">
        {/* Top Search Bar */}
        <div className="flex gap-2 relative">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center px-4 h-12 group focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
            <Search
              className="text-slate-400 group-focus-within:text-emerald-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Código, Nombre o Descripción..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(e.target.value.length > 0);
              }}
              onFocus={() => setShowSearchResults(searchQuery.length > 0)}
              className="flex-1 h-full bg-transparent border-none outline-none px-4 text-xs font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-medium"
            />
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest hidden md:block">
              |||| ESCÁNER ACTIVO
            </span>
          </div>

          <AnimatePresence>
            {showSearchResults && filteredProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 right-36 top-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[400px] overflow-y-auto"
              >
                <div className="p-2 space-y-1">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addToCart(p);
                        setSearchQuery("");
                        setShowSearchResults(false);
                      }}
                      className="w-full flex items-center gap-3 p-2 hover:bg-emerald-50 rounded-lg transition-all group border border-transparent hover:border-emerald-100"
                    >
                      {p.image && (
                        <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden shrink-0">
                          <img
                            src={p.image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-[10px] font-black text-slate-800 uppercase italic truncate">
                          {p.description}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 truncate">
                          {p.barcode || "Sin Código"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-emerald-600 font-mono">
                          ${p.salePrice.toFixed(2)}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400">
                          Stock: {p.currentStock}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-1 shrink-0">
            <ActionIconBtn
              onClick={() => setShowCommonModal(true)}
              icon={<PlusSquare size={16} />}
              label="COMÚN"
              active
            />
          </div>
        </div>

        {/* Categories / Filter Tabs */}
        <div className="flex gap-1.5">
          <button className="px-3 py-1 bg-rose-600 text-white rounded text-[9px] font-black uppercase tracking-widest">
            TODOS
          </button>
          <button className="px-3 py-1 bg-white border border-slate-200 text-slate-400 rounded text-[9px] font-black uppercase tracking-widest hover:border-slate-300 hover:text-slate-500 transition-colors">
            SIN DEPARTAMENTO
          </button>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 pb-8">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => addToCart(product)}
              className="cursor-pointer group"
            >
              <ProductSaleCard
                image={
                  product.image ||
                  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400"
                }
                name={product.description}
                price={product.salePrice}
              />
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              No hay productos para mostrar. Agregue productos en el módulo de
              PRODUCTOS.
            </div>
          )}
          <div className="aspect-[4/5] bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-center px-4">
              Más productos...
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Billing Sidebar */}
      <div className="lg:col-span-3 flex flex-col gap-3">
        <div className="bg-[#1e293b] rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 border-t-2 border-slate-800">
          {/* Header */}
          <div className="p-3.5 flex items-center gap-2 border-b border-white/5">
            <ShoppingBag
              className="text-emerald-400"
              size={20}
              strokeWidth={2.5}
            />
            <h3 className="text-base font-black text-white italic uppercase tracking-tighter">
              FACTURA
            </h3>
          </div>

          {/* Client Selector */}
          <div className="p-3.5 space-y-3.5 flex-1 flex flex-col">
            <div>
              <label className="flex items-center gap-1 text-[8px] font-black text-white/60 uppercase tracking-widest mb-1">
                <Users size={10} />
                CLIENTE
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-white font-bold text-[10px] outline-none focus:bg-white/20 transition-all cursor-pointer"
              >
                <option value="default" className="text-stone-800">
                  Ventas de Mostrador
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="text-stone-800">
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Display */}
            <div className="flex-1 flex flex-col overflow-y-auto max-h-[250px] scrollbar-hide space-y-1.5">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 p-1.5 bg-white/5 rounded-lg border border-white/5 group hover:bg-white/10 transition-all"
                  >
                    {item.image && (
                      <div className="w-6 h-6 rounded bg-slate-800 shrink-0 overflow-hidden">
                        <img
                          src={item.image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-black text-white truncate uppercase italic">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.id, -1);
                          }}
                          className="w-3.5 h-3.5 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-rose-500 transition-colors"
                        >
                          <Minus size={7} />
                        </button>
                        <span className="text-[8px] font-black text-emerald-400">
                          {item.quantity}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.id, 1);
                          }}
                          className="w-3.5 h-3.5 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-emerald-500 transition-colors"
                        >
                          <Plus size={7} />
                        </button>
                        <span className="text-[7px] font-bold text-white/40 ml-0.5">
                          x ${item.salePrice}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromCart(item.id);
                      }}
                      className="text-white/20 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white/20 mb-2 border border-white/5 shadow-inner">
                    <ShoppingBag size={24} strokeWidth={1.5} />
                  </div>
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest italic">
                    Vacío
                  </p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[6px] font-black text-white uppercase tracking-widest">
                  ITBIS (18%)
                </span>
                <button
                  onClick={() => setItbisEnabled(!itbisEnabled)}
                  className={`w-7 h-3.5 rounded-full transition-all relative ${itbisEnabled ? "bg-emerald-400" : "bg-slate-700"}`}
                >
                  <div
                    className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${itbisEnabled ? "left-4" : "left-0.5"}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[6px] font-black text-white uppercase tracking-widest">
                  PROPINA
                </span>
                <div className="w-12 h-6 bg-white/10 border border-white/20 rounded flex items-center overflow-hidden">
                  <input
                    type="text"
                    defaultValue="0"
                    className="w-full h-full bg-transparent text-center text-white font-black text-[9px] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-0.5 pt-1.5">
              <div className="flex justify-between text-[7px] font-black text-white/50 uppercase">
                <span>Subt:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {itbisEnabled && (
                <div className="flex justify-between text-[7px] font-black text-white/50 uppercase">
                  <span>ITBIS (18%):</span>
                  <span>${itbis.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[7px] font-black text-white/50 uppercase">
                <span>Total Artículos:</span>
                <span>
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[12px] font-black text-white italic tracking-tighter uppercase">
                  TOTAL:
                </span>
                <span className="text-lg font-black text-emerald-400">
                  ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Action Buttons Row 1 */}
            <div className="grid grid-cols-2 gap-1 pt-2">
              <SideActionBtn icon={<Clock size={10} />} label="ESPERA" />
              <SideActionBtn
                icon={<X size={10} />}
                label="CANCELAR"
                onClick={() => {
                  if (confirm("¿Desea cancelar y vaciar la venta actual?")) {
                    setCart([]);
                  }
                }}
              />
            </div>

            {/* Big Action Buttons */}
            <div className="space-y-1 pt-1">
              <button
                onClick={() => {
                  if (cart.length > 0) setShowPaymentModal(true);
                }}
                disabled={cart.length === 0}
                className={`w-full py-2 bg-emerald-400 text-emerald-950 rounded-lg flex items-center justify-center gap-2 shadow-md shadow-emerald-950/20 transition-all group border-b-2 border-emerald-600 ${cart.length === 0 ? "opacity-50 grayscale cursor-not-allowed" : "hover:bg-emerald-300 hover:scale-[1.02] active:scale-[0.98]"}`}
              >
                <DollarSign
                  size={14}
                  className="group-hover:rotate-12 transition-transform"
                />
                <span className="text-xs font-black italic uppercase tracking-tighter">
                  COBRAR
                </span>
              </button>

              <button
                onClick={() => {
                  if (cart.length === 0) return;

                  const newQuote: Quote = {
                    id: `quote-${Date.now()}`,
                    date: new Date().toISOString(),
                    clientId: selectedClientId,
                    clientName: selectedClient.fullName,
                    items: cart.map((item) => ({
                      productId: item.id,
                      description: item.description,
                      quantity: item.quantity,
                      price: item.salePrice,
                      total: item.salePrice * item.quantity,
                    })),
                    subtotal: subtotal,
                    itbis: itbis,
                    total: total,
                    status: "Pendiente",
                  };

                  const quotes = storage.getQuotes();
                  storage.saveQuotes([newQuote, ...quotes]);

                  alert(`Cotización generada para ${selectedClient.fullName}`);
                  setCart([]);
                }}
                disabled={cart.length === 0}
                className={`w-full py-2.5 bg-blue-500 text-white rounded-lg flex items-center justify-center gap-3 shadow-md transition-all group border-b-2 border-blue-700 ${cart.length === 0 ? "opacity-50 grayscale cursor-not-allowed" : "hover:bg-blue-400 hover:scale-[1.02] active:scale-[0.98]"}`}
              >
                <FilePlus size={16} />
                <span className="text-sm font-black italic uppercase tracking-tighter">
                  COTIZAR
                </span>
              </button>
            </div>
          </div>

          {/* Footer Blue Bar */}
          <button className="w-full h-10 bg-white flex items-center justify-center gap-2 group transition-colors hover:bg-emerald-50">
            <ArrowLeftRight
              size={12}
              className="text-emerald-600"
              strokeWidth={3}
            />
            <span className="text-[9px] font-black text-emerald-600 uppercase italic tracking-tighter">
              VENTAS DEL DÍA
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionIconBtn({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-12 px-5 rounded-xl flex items-center gap-2.5 transition-all shadow-sm ${
        active
          ? "bg-emerald-500 text-white font-black shadow-lg shadow-emerald-200"
          : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {icon}
      <span className="text-[10px] uppercase font-black tracking-tight">
        {label}
      </span>
    </button>
  );
}

function ProductSaleCard({
  image,
  name,
  price,
}: {
  image: string;
  name: string;
  price: number;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col group cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all h-full">
      <div className="aspect-square p-1.5 flex items-center justify-center bg-slate-50/50">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="p-2 bg-white border-t border-slate-100 flex flex-col flex-1">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight italic line-clamp-2 min-h-[20px] mb-1">
          {name}
        </p>
        <p className="text-[13px] font-black text-emerald-600 leading-none mt-auto">
          ${price.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

function SideActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-10 bg-black/20 text-white/70 rounded-xl flex items-center justify-center gap-2 border border-white/5 hover:bg-black/30 hover:text-white transition-all"
    >
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">
        {label}
      </span>
    </button>
  );
}

function PaymentModal({
  isOpen,
  onClose,
  total,
  clientName,
  itemCount,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  clientName: string;
  itemCount: number;
  onConfirm: (data: {
    method: string;
    printTicket: boolean;
    sendWhatsApp: boolean;
    notes?: string;
    bank?: string;
    reference?: string;
    exchangeRate?: number;
    usdAmount?: number;
  }) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [paidWith, setPaidWith] = useState(total.toString());
  const [notes, setNotes] = useState("");
  const [showNotesInput, setShowNotesInput] = useState(false);

  // Transfer details
  const [selectedBank, setSelectedBank] = useState("Banco Popular");
  const banks = [
    "Banco Popular",
    "Banreservas",
    "BHD León",
    "Scotiabank",
    "Asociación Popular",
    "Otros",
  ];

  // Dollar details
  const [exchangeRate, setExchangeRate] = useState(58.5);
  const usdAmount = total / exchangeRate;

  // Card details
  const [cardReference, setCardReference] = useState("");

  const change = Math.max(0, parseFloat(paidWith || "0") - total);

  const [ticketFormat, setTicketFormat] = useState<"58mm" | "80mm" | "letter">(
    "80mm",
  );

  const handleConfirm = (printTicket: boolean, sendWhatsApp: boolean) => {
    onConfirm({
      method: paymentMethod,
      printTicket,
      sendWhatsApp,
      notes,
      bank: paymentMethod === "Transferencia" ? selectedBank : undefined,
      reference: paymentMethod === "Tarjeta" ? cardReference : undefined,
      exchangeRate: paymentMethod === "Dólares" ? exchangeRate : undefined,
      usdAmount: paymentMethod === "Dólares" ? usdAmount : undefined,
      ticketFormat: printTicket ? ticketFormat : undefined,
    } as any);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "F1":
          e.preventDefault();
          handleConfirm(true, false);
          break;
        case "F2":
          e.preventDefault();
          handleConfirm(false, false);
          break;
        case "F3":
          e.preventDefault();
          handleConfirm(false, true);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "F4":
          e.preventDefault();
          setShowNotesInput(true);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, paymentMethod, onConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-3xl h-[580px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#2563eb] px-5 py-3 flex items-center justify-between">
          <h2 className="text-white font-black text-lg italic uppercase tracking-tighter">
            COBRAR
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 p-6 flex flex-col items-center bg-[#f8fafc] overflow-y-auto">
            <p className="text-slate-400 font-black uppercase tracking-widest text-[9px] mb-1 font-sans">
              Total a Cobrar
            </p>
            <h1 className="text-5xl font-black text-[#2563eb] italic mb-8 tracking-tighter">
              ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </h1>

            {/* Payment Methods */}
            <div className="flex justify-center gap-3 mb-8 w-full">
              <PaymentMethodBtn
                active={paymentMethod === "Efectivo"}
                onClick={() => setPaymentMethod("Efectivo")}
                icon={<CreditCard size={20} />}
                label="EFECTIVO"
                color="bg-[#3b82f6]"
              />
              <PaymentMethodBtn
                active={paymentMethod === "Transferencia"}
                onClick={() => setPaymentMethod("Transferencia")}
                icon={<ArrowRightLeft size={20} />}
                label="TRANSFERENCIA"
                color="bg-[#a855f7]"
              />
              <PaymentMethodBtn
                active={paymentMethod === "Dólares"}
                onClick={() => setPaymentMethod("Dólares")}
                icon={<DollarSign size={20} />}
                label="DÓLARES"
                color="bg-[#22c55e]"
              />
              <PaymentMethodBtn
                active={paymentMethod === "Tarjeta"}
                onClick={() => setPaymentMethod("Tarjeta")}
                icon={<CreditCard size={20} />}
                label="TARJETA"
                color="bg-[#06b6d4]"
              />
            </div>

            {/* Dynamic Details based on Payment Method */}
            <div className="w-full max-w-md mb-8 animate-in fade-in slide-in-from-top-2">
              {paymentMethod === "Transferencia" && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest mb-2">
                    Seleccionar Banco:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {banks.map((bank) => (
                      <button
                        key={bank}
                        onClick={() => setSelectedBank(bank)}
                        className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase transition-all ${selectedBank === bank ? "bg-purple-600 text-white shadow-md" : "bg-white text-purple-600 border border-purple-100 hover:bg-purple-100"}`}
                      >
                        {bank}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {paymentMethod === "Dólares" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                      Tasa del Día:
                    </p>
                    <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-1">
                      <span className="text-xs font-black text-emerald-600">
                        RD$
                      </span>
                      <input
                        type="number"
                        value={exchangeRate || 0}
                        onChange={(e) =>
                          setExchangeRate(parseFloat(e.target.value) || 0)
                        }
                        className="w-16 bg-transparent border-none outline-none text-sm font-black text-slate-800 font-mono"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                      Total en Dólares:
                    </p>
                    <h3 className="text-2xl font-black text-emerald-600 italic font-mono">
                      US${" "}
                      {usdAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </h3>
                  </div>
                </div>
              )}

              {paymentMethod === "Tarjeta" && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                  <p className="text-[10px] font-black text-cyan-700 uppercase tracking-widest mb-2">
                    Número de Referencia:
                  </p>
                  <input
                    type="text"
                    value={cardReference}
                    onChange={(e) => setCardReference(e.target.value)}
                    placeholder="Ej: 123456789"
                    className="w-full bg-white border border-cyan-200 rounded-lg px-4 py-3 text-lg font-black text-slate-800 italic tracking-tighter outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              )}
            </div>

            {/* Client Info */}
            <div className="w-full max-w-md bg-white rounded-xl border border-blue-100 p-4 flex items-center justify-between shadow-sm mb-8">
              <div>
                <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-0.5">
                  NOMBRE FACTURADO A:
                </p>
                <h3 className="text-xl font-black text-slate-800 italic uppercase tracking-tighter">
                  {clientName}
                </h3>
              </div>
              <button className="text-[10px] font-black text-blue-500 hover:underline">
                Cambiar
              </button>
            </div>

            {/* Cash Input */}
            <div
              className={`w-full max-w-md space-y-6 ${paymentMethod === "Dólares" ? "opacity-50 pointer-events-none" : ""}`}
            >
              <div className="flex items-center gap-5">
                <span className="text-xl font-black text-slate-800 italic uppercase tracking-tighter w-36 shrink-0">
                  Pagó Con:
                </span>
                <div className="flex-1 bg-white border border-emerald-500 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <span className="text-2xl font-black text-emerald-600 italic tracking-tighter">
                    $
                  </span>
                  <input
                    type="number"
                    value={paidWith}
                    onChange={(e) => setPaidWith(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-3xl font-black text-slate-800 italic tracking-tighter font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-5">
                <span className="text-xl font-black text-slate-800 italic uppercase tracking-tighter w-36 shrink-0">
                  Su Cambio:
                </span>
                <span className="text-3xl font-black text-emerald-500 italic tracking-tighter font-mono">
                  ${" "}
                  {change.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Notes Input Section */}
            {showNotesInput && (
              <div className="w-full max-w-md mt-6 animate-in slide-in-from-bottom-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Notas de la Factura:
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Escriba alguna observación aquí..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 min-h-[60px] outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-72 bg-[#f1f5f9] border-l border-slate-200 p-4 flex flex-col gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3 mb-1">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Formato de Ticket:
              </p>
              <div className="flex gap-1">
                {(["58mm", "80mm", "letter"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTicketFormat(f)}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all ${ticketFormat === f ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <CheckoutSideBtn
              icon={<Printer size={18} />}
              label="Cobrar e Imprimir Ticket"
              shortcut="F1"
              onClick={() => handleConfirm(true, false)}
            />
            <CheckoutSideBtn
              icon={<MessageCircle size={18} />}
              label="Cobrar y Enviar WhatsApp"
              shortcut="F3"
              onClick={() => handleConfirm(false, true)}
            />
            <CheckoutSideBtn
              icon={<Save size={18} />}
              label="Cobrar solo registrando la venta"
              shortcut="F2"
              onClick={() => handleConfirm(false, false)}
            />
            <CheckoutSideBtn
              icon={<X size={18} />}
              label="Cancelar"
              shortcut="ESC"
              onClick={onClose}
              danger
            />

            <div className="mt-auto pt-4 border-t border-slate-300">
              <CheckoutSideBtn
                icon={<FileText size={18} />}
                label={showNotesInput ? "Cerrar notas" : "Ingresar notas"}
                shortcut="F4"
                onClick={() => setShowNotesInput(!showNotesInput)}
              />

              <div className="mt-6 text-center bg-white/50 py-4 rounded-xl border border-slate-200 shadow-inner">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                  TOTAL DE ARTÍCULOS:
                </p>
                <h2 className="text-5xl font-black text-[#2563eb] italic tracking-tighter">
                  {itemCount}
                </h2>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodBtn({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        className={`w-20 h-16 rounded-xl flex items-center justify-center transition-all ${color} ${active ? "scale-105 shadow-xl ring-2 ring-blue-500/30" : "opacity-60 grayscale-[50%] hover:opacity-80"}`}
      >
        <div className="text-white scale-110">{icon}</div>
      </button>
      <span
        className={`text-[8px] font-black tracking-widest ${active ? "text-blue-600" : "text-slate-400"}`}
      >
        {label}
      </span>
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-blue-600"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckoutSideBtn({
  icon,
  label,
  shortcut,
  onClick,
  danger,
}: {
  icon: any;
  label: string;
  shortcut: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 text-left shadow-sm hover:translate-x-1 hover:shadow-md transition-all group ${danger ? "hover:border-rose-300" : "hover:border-blue-300"}`}
    >
      <div
        className={`p-2 rounded-lg ${danger ? "bg-rose-50 text-rose-500 group-hover:bg-rose-500 group-hover:text-white" : "bg-slate-50 text-slate-500 group-hover:bg-[#2563eb] group-hover:text-white"} transition-all`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0">
          {shortcut}
        </p>
        <p
          className={`text-[10px] font-black leading-tight uppercase italic tracking-tight ${danger ? "text-rose-600" : "text-slate-800"}`}
        >
          {label}
        </p>
      </div>
    </button>
  );
}

function InventoryView({ products }: { products: Product[] }) {
  const exportToExcel = () => {
    if (products.length === 0) return;
    const data = products.map((p) => ({
      Código: p.barcode,
      Descripción: p.description,
      Departamento: p.department,
      Costo: p.costPrice,
      Venta: p.salePrice,
      Mayoreo: p.wholesalePrice,
      "Stock Actual": p.currentStock,
      "Stock Mínimo": p.minStock,
      "Valor Inventario": p.currentStock * p.salePrice,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(
      wb,
      `Reporte_Inventario_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
            <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">
              Reporte de Inventario Completo
            </h3>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportToExcel}
              className="h-11 px-6 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
            >
              <Download size={16} /> Excel
            </button>
            <button
              onClick={handlePrint}
              className="h-11 px-6 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
            >
              <Printer size={16} /> Imprimir
            </button>
          </div>
        </div>

        <div className="bg-slate-50/30 rounded-2xl border border-slate-100 overflow-hidden print:border-none print:bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200">
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Código
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Descripción
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Costo
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Venta
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Stock
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-white transition-colors group"
                  >
                    <td className="p-5">
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">
                        {p.barcode || "N/A"}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="text-sm font-bold text-slate-700">
                        {p.description}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                        {p.department}
                      </div>
                    </td>
                    <td className="p-5 text-right text-sm font-bold text-slate-600">
                      ${p.costPrice.toFixed(2)}
                    </td>
                    <td className="p-5 text-right text-sm font-bold text-emerald-600">
                      ${p.salePrice.toFixed(2)}
                    </td>
                    <td className="p-5 text-right">
                      <span
                        className={`text-sm font-black ${p.currentStock <= p.minStock ? "text-rose-500 animate-pulse" : "text-slate-700"}`}
                      >
                        {p.currentStock}
                      </span>
                      <span className="text-[9px] text-slate-400 ml-1 font-bold">
                        / min: {p.minStock}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <span className="text-sm font-black text-slate-800">
                        ${(p.currentStock * p.salePrice).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-20 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200 border border-slate-100">
                        <Package size={32} />
                      </div>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                        No hay productos registrados
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-800 text-white border-t-4 border-emerald-500">
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-right text-[11px] font-black uppercase tracking-widest italic opacity-60"
                  >
                    Valor Total del Inventario:
                  </td>
                  <td className="p-6 text-right">
                    <div className="text-2xl font-black text-emerald-400 tracking-tighter">
                      $
                      {products
                        .reduce(
                          (acc, p) => acc + p.currentStock * p.salePrice,
                          0,
                        )
                        .toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuotesView({
  products,
  setProducts,
  setActiveSubTab,
  setCart,
  setSelectedClientId,
}: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setActiveSubTab: React.Dispatch<
    React.SetStateAction<
      "ventas" | "cotizaciones" | "inventario" | "productos" | "clientes"
    >
  >;
  setCart: React.Dispatch<
    React.SetStateAction<(Product & { quantity: number })[]>
  >;
  setSelectedClientId: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [quotes, setQuotes] = useState<Quote[]>(storage.getQuotes());
  const [clients] = useState<Client[]>(storage.getClients());
  const [searchQuery, setSearchQuery] = useState("");

  const filteredQuotes = quotes.filter(
    (q) =>
      q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleInvoice = (quote: Quote) => {
    if (quote.status === "Facturado") {
      alert("Esta cotización ya ha sido facturada.");
      return;
    }

    if (
      !window.confirm(
        `¿Desea cargar la cotización ${quote.id} al carrito de ventas para cobrarla?`,
      )
    ) {
      return;
    }

    // 1. Map quote items to Product & { quantity: number }
    const cartItems: (Product & { quantity: number })[] = [];
    let missingProducts = false;

    quote.items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        cartItems.push({ ...product, quantity: item.quantity });
      } else {
        missingProducts = true;
      }
    });

    if (missingProducts) {
      alert(
        "Algunos productos de la cotización ya no existen en el sistema. Se cargarán solo los productos disponibles.",
      );
    }

    // 2. Load into shared cart
    setCart(cartItems);
    setSelectedClientId(quote.clientId);

    // 3. Mark quote as "Facturado" (or maybe we keep it as is until the sale is confirmed?
    // The user said "valla al la casilla de ventas para poder cobrarla", usually implying the intent to finish the process).
    // Let's mark it as Facturado to avoid duplicates if that's the common flow.
    const updatedQuotes = quotes.map((q) =>
      q.id === quote.id ? { ...q, status: "Facturado" as const } : q,
    );
    storage.saveQuotes(updatedQuotes);
    setQuotes(updatedQuotes);

    // 4. Switch to Sales Tab
    setActiveSubTab("ventas");
  };

  const generatePDF = (quote: Quote) => {
    const doc = new jsPDF();
    const client = clients.find((c) => c.id === quote.clientId);

    // Header
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("COTIZACIÓN COMERCIAL", 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Referencia: ${quote.id}`, 20, 35);
    doc.text(`Fecha: ${new Date(quote.date).toLocaleDateString()}`, 20, 40);

    // Client Info
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("CLIENTE:", 20, 55);
    doc.setFontSize(10);
    doc.text(`${quote.clientName}`, 20, 60);
    if (client) {
      doc.text(`WhatsApp: ${client.whatsapp}`, 20, 65);
      doc.text(`RNC: ${client.rnc}`, 20, 70);
      doc.text(`Email: ${client.email}`, 20, 75);
    }

    // Table
    const tableData = quote.items.map((item) => [
      item.description,
      item.quantity.toString(),
      `$${item.price.toFixed(2)}`,
      `$${item.total.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 85,
      head: [["Descripción", "Cant.", "Precio Unit.", "Total"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.text(`Subtotal: $${quote.subtotal.toFixed(2)}`, 140, finalY);
    doc.text(`ITBIS: $${quote.itbis.toFixed(2)}`, 140, finalY + 5);
    doc.setFontSize(12);
    doc.text(`TOTAL: $${quote.total.toFixed(2)}`, 140, finalY + 12);

    return doc;
  };

  const handlePrint = (quote: Quote) => {
    const doc = generatePDF(quote);
    window.open(doc.output("bloburl"), "_blank");
  };

  const handleWhatsApp = (quote: Quote) => {
    const client = clients.find((c) => c.id === quote.clientId);
    const phone = client?.whatsapp.replace(/\D/g, "") || "";

    let message = `*COTIZACIÓN COMERCIAL*\n\n`;
    message += `Hola ${quote.clientName},\n`;
    message += `Aquí tienes la cotización solicitada:\n\n`;
    quote.items.forEach((item) => {
      message += `- ${item.description} (x${item.quantity}): $${item.total.toFixed(2)}\n`;
    });
    message += `\n*TOTAL: $${quote.total.toFixed(2)}*\n\n`;
    message += `¡Gracias por preferirnos!`;

    const url = `https://wa.me/${phone ? "1" + phone : ""}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");

    // Also download PDF
    const doc = generatePDF(quote);
    doc.save(`Cotizacion_${quote.id}.pdf`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("¿Eliminar esta cotización?")) {
      const updated = quotes.filter((q) => q.id !== id);
      setQuotes(updated);
      storage.saveQuotes(updated);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
            <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">
              Historial de Cotizaciones
            </h3>
          </div>
          <div className="relative w-full max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por cliente o referencia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuotes.map((quote) => (
            <div
              key={quote.id}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3">
                <span
                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                    quote.status === "Pendiente"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {quote.status}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Cliente
                </p>
                <h4 className="text-sm font-black text-slate-800 uppercase italic truncate">
                  {quote.clientName}
                </h4>
                <p className="text-[10px] font-medium text-slate-400 mt-1">
                  {new Date(quote.date).toLocaleString()}
                </p>
              </div>

              <div className="space-y-2 mb-6">
                {quote.items.slice(0, 2).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-[10px] font-bold text-slate-500"
                  >
                    <span>
                      {item.description} (x{item.quantity})
                    </span>
                    <span>${item.total.toFixed(2)}</span>
                  </div>
                ))}
                {quote.items.length > 2 && (
                  <p className="text-[9px] font-black text-slate-400 italic">
                    +{quote.items.length - 2} productos más...
                  </p>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Total Cotizado
                  </p>
                  <p className="text-lg font-black text-blue-600 tracking-tighter">
                    ${quote.total.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {quote.status === "Pendiente" && (
                    <button
                      onClick={() => handleInvoice(quote)}
                      className="p-2.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-all shadow-md group/facturar"
                      title="Facturar Cotización"
                    >
                      <DollarSign
                        size={18}
                        className="group-hover/facturar:rotate-12 transition-transform"
                      />
                    </button>
                  )}
                  <button
                    onClick={() => handlePrint(quote)}
                    className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-800 hover:border-slate-800 rounded-xl transition-all shadow-sm"
                    title="Imprimir / Ver PDF"
                  >
                    <Printer size={18} />
                  </button>
                  <button
                    onClick={() => handleWhatsApp(quote)}
                    className="p-2.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-all shadow-md"
                    title="Enviar por WhatsApp"
                  >
                    <MessageCircle size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(quote.id)}
                    className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredQuotes.length === 0 && (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200 border border-slate-100">
              <FilePlus size={32} />
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
              No hay cotizaciones registradas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientsView() {
  const [clients, setClients] = useState<Client[]>(storage.getClients());
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [rnc, setRnc] = useState("");
  const [email, setEmail] = useState("");

  const filteredClients = clients.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.rnc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.whatsapp.includes(searchQuery),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) return;

    const newClient: Client = {
      id: crypto.randomUUID(),
      fullName,
      whatsapp,
      address,
      rnc,
      email,
      createdAt: new Date().toISOString(),
    };

    const updated = [newClient, ...clients];
    setClients(updated);
    storage.saveClients(updated);
    resetForm();
    setIsAdding(false);
    alert("Cliente registrado exitosamente");
  };

  const resetForm = () => {
    setFullName("");
    setWhatsapp("");
    setAddress("");
    setRnc("");
    setEmail("");
  };

  const handleDelete = (id: string) => {
    if (window.confirm("¿Eliminar este cliente?")) {
      const updated = clients.filter((c) => c.id !== id);
      setClients(updated);
      storage.saveClients(updated);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
          <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">
            Directorio de Clientes
          </h3>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="h-11 px-6 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
        >
          {isAdding ? <X size={16} /> : <Plus size={16} />}
          {isAdding ? "CANCELAR" : "NUEVO CLIENTE"}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
          >
            <div className="p-8 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <PlusCircle size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800 uppercase italic">
                    Formulario de Registro
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Ingresa los datos fiscales y de contacto
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Nombre Completo / Razón Social
                    </label>
                    <input
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Juan Pérez o Empresa S.R.L."
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Número de WhatsApp
                    </label>
                    <div className="relative">
                      <Phone
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                      />
                      <input
                        type="text"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="809-XXX-XXXX"
                        className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="cliente@ejemplo.com"
                        className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      RNC / Cédula
                    </label>
                    <input
                      type="text"
                      value={rnc}
                      onChange={(e) => setRnc(e.target.value)}
                      placeholder="1-01-XXXXX-X"
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Dirección de Entrega / Fiscal
                    </label>
                    <textarea
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Calle, Proximidad, Sector, Ciudad..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full h-12 bg-blue-600 text-white rounded-xl font-black text-[12px] uppercase tracking-widest hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg"
                  >
                    FINALIZAR REGISTRO
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por nombre, RNC o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="bg-slate-50/30 rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200">
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Cliente
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Identificación
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Contacto
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Dirección
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-white transition-colors group"
                  >
                    <td className="p-5">
                      <div className="text-sm font-black text-slate-800 uppercase italic tracking-tight">
                        {client.fullName}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold mt-0.5">
                        Registrado el{" "}
                        {new Date(client.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded">
                        {client.rnc || "CONSUMIDOR FINAL"}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                          <Phone size={12} /> {client.whatsapp || "N/A"}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                          <Mail size={12} /> {client.email || "N/A"}
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="text-[10px] font-bold text-slate-500 line-clamp-2 max-w-[200px]">
                        {client.address || "Sin dirección registrada"}
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200 border border-slate-100">
                        <Users size={32} />
                      </div>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                        No se encontraron clientes
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesReportView() {
  const [sales] = useState<Sale[]>(storage.getSales());
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const filteredSales = useMemo(() => {
    return sales
      .filter((sale) => {
        const saleDate = sale.date.split("T")[0];
        return saleDate >= startDate && saleDate <= endDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, startDate, endDate]);

  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);

  const exportToExcel = () => {
    if (filteredSales.length === 0) return;
    const data = filteredSales.map((s) => ({
      ID: s.id,
      Fecha: new Date(s.date).toLocaleString(),
      Subtotal: s.subtotal,
      ITBIS: s.itbis,
      Total: s.total,
      Metodo: s.paymentMethod,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, `Reporte_Ventas_${startDate}_${endDate}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
            <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">
              Ventas por Periodo
            </h3>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Fecha Inicial
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Fecha Final
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="h-11 px-6 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
              >
                <Download size={16} /> Excel
              </button>
              <button
                onClick={handlePrint}
                className="h-11 px-6 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-900 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
              >
                <Printer size={16} /> Imprimir
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-50/30 rounded-2xl border border-slate-100 overflow-hidden print:border-none print:bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200">
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Fecha y Hora
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Ref. Operación
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Subtotal
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    ITBIS
                  </th>
                  <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Total Neto
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-white transition-colors group"
                  >
                    <td className="p-5">
                      <div className="text-sm font-bold text-slate-700">
                        {new Date(sale.date).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400">
                        {new Date(sale.date).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">
                        {sale.id.replace("sale-", "")}
                      </span>
                    </td>
                    <td className="p-5 text-right text-sm font-bold text-slate-600">
                      ${sale.subtotal.toFixed(2)}
                    </td>
                    <td className="p-5 text-right text-sm font-bold text-slate-400">
                      ${sale.itbis.toFixed(2)}
                    </td>
                    <td className="p-5 text-right">
                      <span className="text-sm font-black text-emerald-600">
                        ${sale.total.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200 border border-slate-100">
                        <BarChart3 size={32} />
                      </div>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                        No hay registros para este periodo
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-800 text-white border-t-4 border-emerald-500">
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-right text-[11px] font-black uppercase tracking-widest italic opacity-60"
                  >
                    Consolidado Total del Periodo:
                  </td>
                  <td className="p-6 text-right">
                    <div className="text-2xl font-black text-emerald-400 tracking-tighter">
                      $
                      {totalRevenue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center px-2 print:hidden">
          <p className="text-[10px] font-bold text-slate-400 italic">
            Reporte generado el {new Date().toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Base de datos sincronizada
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductsView({
  products,
  setProducts,
  departments,
  setDepartments,
}: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  departments: string[];
  setDepartments: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [viewMode, setViewMode] = useState<
    "nuevo" | "modificar" | "eliminar" | "departamentos" | "ventas_periodo"
  >("nuevo");
  const [searchQuery, setSearchQuery] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sellType, setSellType] = useState("unidad");
  const [useInventory, setUseInventory] = useState(true);
  const [productImage, setProductImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inventoryValue = products.reduce(
    (acc, p) => acc + p.salePrice * (p.useInventory ? p.currentStock : 0),
    0,
  );
  const lowStockCount = products.filter(
    (p) => p.useInventory && p.currentStock <= p.minStock,
  ).length;

  const filteredProducts = products.filter(
    (p) =>
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  useEffect(() => {
    if (editingProduct) {
      if (barcodeRef.current) barcodeRef.current.value = editingProduct.barcode;
      if (descriptionRef.current)
        descriptionRef.current.value = editingProduct.description;
      if (costPriceRef.current)
        costPriceRef.current.value = editingProduct.costPrice.toString();
      if (salePriceRef.current)
        salePriceRef.current.value = editingProduct.salePrice.toString();
      if (wholesalePriceRef.current)
        wholesalePriceRef.current.value =
          editingProduct.wholesalePrice.toString();
      if (currentStockRef.current)
        currentStockRef.current.value = editingProduct.currentStock.toString();
      if (minStockRef.current)
        minStockRef.current.value = editingProduct.minStock.toString();
      if (departmentRef.current)
        departmentRef.current.value = editingProduct.department;
      setSellType(editingProduct.sellType);
      setUseInventory(editingProduct.useInventory);
      setProductImage(editingProduct.image || null);
    } else {
      resetForm();
    }
  }, [editingProduct]);

  const resetForm = () => {
    if (barcodeRef.current) barcodeRef.current.value = "";
    if (descriptionRef.current) descriptionRef.current.value = "";
    if (costPriceRef.current) costPriceRef.current.value = "0";
    if (salePriceRef.current) salePriceRef.current.value = "0";
    if (wholesalePriceRef.current) wholesalePriceRef.current.value = "0";
    if (currentStockRef.current) currentStockRef.current.value = "0";
    if (minStockRef.current) minStockRef.current.value = "0";
    setProductImage(null);
    setSellType("unidad");
    setUseInventory(true);
    setEditingProduct(null);
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setProductImage(null);
  };

  // Form refs
  const barcodeRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const costPriceRef = useRef<HTMLInputElement>(null);
  const salePriceRef = useRef<HTMLInputElement>(null);
  const wholesalePriceRef = useRef<HTMLInputElement>(null);
  const departmentRef = useRef<HTMLSelectElement>(null);
  const currentStockRef = useRef<HTMLInputElement>(null);
  const minStockRef = useRef<HTMLInputElement>(null);

  const handleSaveProduct = () => {
    const description = descriptionRef.current?.value || "";
    if (!description.trim()) {
      alert("La descripción es obligatoria");
      return;
    }

    const productData: Product = {
      id: editingProduct ? editingProduct.id : crypto.randomUUID(),
      barcode: barcodeRef.current?.value || "",
      description: description,
      sellType: sellType,
      costPrice: parseFloat(costPriceRef.current?.value || "0"),
      salePrice: parseFloat(salePriceRef.current?.value || "0"),
      wholesalePrice: parseFloat(wholesalePriceRef.current?.value || "0"),
      department: departmentRef.current?.value || "Sin Departamento",
      useInventory: useInventory,
      currentStock: parseFloat(currentStockRef.current?.value || "0"),
      minStock: parseFloat(minStockRef.current?.value || "0"),
      image: productImage || undefined,
    };

    let updatedProducts;
    if (editingProduct) {
      updatedProducts = products.map((p) =>
        p.id === editingProduct.id ? productData : p,
      );
    } else {
      updatedProducts = [...products, productData];
    }

    setProducts(updatedProducts);
    storage.saveProducts(updatedProducts);

    resetForm();
    if (editingProduct) setViewMode("nuevo");

    alert(
      editingProduct
        ? "Producto actualizado correctamente"
        : "Producto guardado correctamente",
    );
  };

  const selectProductToEdit = (p: Product) => {
    setEditingProduct(p);
  };

  const handleDeleteProduct = (id: string) => {
    if (window.confirm("¿Está seguro de eliminar este producto?")) {
      const updatedProducts = products.filter((p) => p.id !== id);
      setProducts(updatedProducts);
      storage.saveProducts(updatedProducts);
      alert("Producto eliminado");
    }
  };

  const handleAddDepartment = () => {
    if (!newDeptName.trim()) return;
    if (departments.includes(newDeptName.trim())) {
      alert("Este departamento ya existe");
      return;
    }
    const updated = [...departments, newDeptName.trim()];
    setDepartments(updated);
    storage.saveDepartments(updated);
    setNewDeptName("");
  };

  const handleDeleteDepartment = (dept: string) => {
    if (dept === "Sin Departamento") {
      alert("No se puede eliminar el departamento por defecto");
      return;
    }

    if (
      window.confirm(
        `¿Está seguro de eliminar el departamento "${dept}"?\n\nLos productos se moverán a "Sin Departamento".`,
      )
    ) {
      // Use functional updates to avoid stale state issues
      setDepartments((prev) => {
        const updated = prev.filter((d) => d !== dept);
        storage.saveDepartments(updated);
        return updated;
      });

      setProducts((prev) => {
        const updated = prev.map((p) =>
          p.department === dept ? { ...p, department: "Sin Departamento" } : p,
        );
        storage.saveProducts(updated);
        return updated;
      });

      alert(`Departamento "${dept}" eliminado correctamente.`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      {/* Product Toolbar */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
        <ToolbarButton
          icon={<Plus size={16} />}
          label="Nuevo"
          active={viewMode === "nuevo"}
          onClick={() => {
            setViewMode("nuevo");
            setEditingProduct(null);
          }}
        />
        <ToolbarButton
          icon={<Edit2 size={16} />}
          label="Modificar"
          active={viewMode === "modificar"}
          onClick={() => setViewMode("modificar")}
        />
        <ToolbarButton
          icon={<Trash2 size={16} />}
          label="Eliminar"
          active={viewMode === "eliminar"}
          onClick={() => setViewMode("eliminar")}
        />
        <div className="w-px h-6 bg-slate-300 self-center mx-1"></div>
        <ToolbarButton
          icon={<Layers size={16} />}
          label="Departamentos"
          active={viewMode === "departamentos"}
          onClick={() => setViewMode("departamentos")}
        />
        <ToolbarButton
          icon={<BarChart3 size={16} />}
          label="Ventas por Periodo"
          active={viewMode === "ventas_periodo"}
          onClick={() => setViewMode("ventas_periodo")}
        />
      </div>

      {viewMode === "ventas_periodo" && <SalesReportView />}

      {viewMode === "departamentos" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
            <h3 className="text-xl font-black text-indigo-600 uppercase italic tracking-tight">
              Gestionar Departamentos
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Nuevo Departamento
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="Nombre del departamento..."
                  className="flex-1 h-12 bg-indigo-50/30 border border-indigo-100 rounded-xl px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  onClick={handleAddDepartment}
                  className="h-12 px-6 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all"
                >
                  Agregar
                </button>
              </div>
              <p className="text-[9px] text-slate-400 font-medium italic">
                Crea categorías para organizar tus productos (ej: Farmacia,
                Ferretería, Electrónica).
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Departamentos Existentes
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-1 scrollbar-hide">
                {departments.map((dept) => (
                  <div
                    key={dept}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                  >
                    <span className="text-xs font-bold text-slate-700">
                      {dept}
                    </span>
                    {dept !== "Sin Departamento" && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDepartment(dept)}
                        className="w-10 h-10 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-xl transition-all cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode !== "nuevo" &&
        viewMode !== "departamentos" &&
        viewMode !== "ventas_periodo" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-1 scrollbar-hide">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (viewMode === "modificar") {
                      selectProductToEdit(p);
                      setViewMode("nuevo");
                    } else if (viewMode === "eliminar") {
                      handleDeleteProduct(p.id);
                    }
                  }}
                  className={`flex gap-3 p-3 bg-white border rounded-xl hover:border-emerald-300 transition-all cursor-pointer group ${editingProduct?.id === p.id ? "border-emerald-500 bg-emerald-50/10" : "border-slate-100"}`}
                >
                  <div className="w-12 h-12 bg-slate-50 rounded-lg overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center">
                    <img
                      src={
                        p.image ||
                        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=100"
                      }
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-800 truncate uppercase">
                      {p.description}
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase truncate mt-0.5">
                      {p.barcode || "SIN CÓDIGO"}
                    </p>
                    <p className="text-xs font-black text-emerald-600 mt-1">
                      ${p.salePrice.toFixed(2)}
                    </p>
                  </div>
                  {viewMode === "eliminar" && (
                    <div className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                      <Trash2 size={16} />
                    </div>
                  )}
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  No se encontraron productos.
                </div>
              )}
            </div>
          </div>
        )}

      {/* Main Product Card */}
      {viewMode !== "departamentos" && viewMode !== "ventas_periodo" && (
        <div
          className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${viewMode !== "nuevo" && !editingProduct ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div
                className={`w-2 h-6 rounded-full ${editingProduct ? "bg-amber-400" : "bg-[#10b981]"}`}
              ></div>
              <h3
                className={`text-xl font-black uppercase italic tracking-tight ${editingProduct ? "text-amber-500" : "text-[#10b981]"}`}
              >
                {editingProduct ? "Modificar Producto" : "Nuevo Producto"}
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Left: Project Image */}
              <div className="lg:col-span-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  Foto del Producto
                </p>
                <div
                  onClick={handleImageClick}
                  className="aspect-square border-2 border-dashed border-emerald-100 bg-emerald-50/30 rounded-2xl flex flex-col items-center justify-center group cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 transition-all overflow-hidden relative"
                >
                  {productImage ? (
                    <div className="w-full h-full relative group">
                      <img
                        src={productImage}
                        alt="Producto"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[2px] gap-2">
                        <div className="bg-white/90 p-2 rounded-lg text-emerald-600 font-black text-[9px] uppercase tracking-widest shadow-lg flex items-center gap-1.5">
                          <ImageIcon size={12} />
                          Cambiar Foto
                        </div>
                        <button
                          onClick={handleDeleteImage}
                          className="bg-rose-500/90 p-2 rounded-lg text-white font-black text-[9px] uppercase tracking-widest shadow-lg flex items-center gap-1.5 hover:bg-rose-600 transition-colors"
                        >
                          <Trash2 size={12} />
                          Eliminar Foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-emerald-500 mb-3 group-hover:scale-110 transition-transform">
                        <ImageIcon size={32} />
                      </div>
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        Subir Imagen
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 font-bold mt-4 text-center italic">
                  Formatos: JPG, PNG. Máx 2MB
                </p>
              </div>

              {/* Right: Form fields */}
              <div className="lg:col-span-9 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Código de Barras
                    </label>
                    <input
                      type="text"
                      ref={barcodeRef}
                      placeholder="Escanee o escriba el código..."
                      className="w-full h-12 bg-emerald-50/30 border border-emerald-100 rounded-xl px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-[#10b981] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Descripción
                    </label>
                    <input
                      type="text"
                      ref={descriptionRef}
                      placeholder="Nombre del producto..."
                      className="w-full h-12 bg-emerald-50/30 border border-emerald-100 rounded-xl px-4 text-sm font-bold outline-none focus:ring-1 focus:ring-[#10b981] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                    Se Vende
                  </label>
                  <div className="flex flex-wrap gap-6">
                    <FormRadio
                      label="Por Unidad/Pza"
                      active={sellType === "unidad"}
                      onClick={() => setSellType("unidad")}
                    />
                    <FormRadio
                      label="A Granel (Usa Decimales)"
                      active={sellType === "granel"}
                      onClick={() => setSellType("granel")}
                    />
                    <FormRadio
                      label="Como paquete (kit)"
                      active={sellType === "paquete"}
                      onClick={() => setSellType("paquete")}
                    />
                    <FormRadio
                      label="Venta por Peso (Báscula)"
                      active={sellType === "peso"}
                      onClick={() => setSellType("peso")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Precio Costo
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-sm">
                        $
                      </span>
                      <input
                        type="text"
                        ref={costPriceRef}
                        defaultValue="0"
                        className="w-full h-12 bg-emerald-50/30 border border-emerald-100 rounded-xl pl-8 pr-4 text-sm font-black text-slate-700 outline-none focus:ring-1 focus:ring-[#10b981] transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Precio Venta
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-sm">
                        $
                      </span>
                      <input
                        type="text"
                        ref={salePriceRef}
                        defaultValue="0"
                        className="w-full h-12 bg-emerald-50/30 border border-emerald-100 rounded-xl pl-8 pr-4 text-sm font-black text-slate-700 outline-none focus:ring-1 focus:ring-[#10b981] transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Precio Mayoreo
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-sm">
                        $
                      </span>
                      <input
                        type="text"
                        ref={wholesalePriceRef}
                        defaultValue="0"
                        className="w-full h-12 bg-emerald-50/30 border border-emerald-100 rounded-xl pl-8 pr-4 text-sm font-black text-slate-700 outline-none focus:ring-1 focus:ring-[#10b981] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Departamento
                  </label>
                  <select
                    ref={departmentRef}
                    className="w-full h-12 bg-emerald-50/30 border border-emerald-100 rounded-xl px-4 text-sm font-bold text-slate-600 outline-none focus:ring-1 focus:ring-[#10b981] appearance-none cursor-pointer"
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Section */}
          <div className="p-8 bg-slate-50/50 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <h4 className="text-xs font-black text-slate-700 uppercase italic tracking-widest">
                Inventario
              </h4>
            </div>

            <div className="space-y-6">
              <button
                onClick={() => setUseInventory(!useInventory)}
                className="flex items-center gap-3 group"
              >
                <div
                  className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${useInventory ? "bg-[#10b981] border-[#10b981]" : "bg-white border-slate-300"}`}
                >
                  {useInventory && (
                    <Check size={14} className="text-white" strokeWidth={4} />
                  )}
                </div>
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">
                  Este producto SI utiliza inventario.
                </span>
              </button>

              {useInventory && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Cantidad Actual
                    </label>
                    <input
                      type="text"
                      ref={currentStockRef}
                      defaultValue="0"
                      className="w-full h-12 bg-emerald-50/30 border border-emerald-100 rounded-xl px-4 text-sm font-black text-slate-700 outline-none focus:ring-1 focus:ring-[#10b981] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Mínimo
                    </label>
                    <input
                      type="text"
                      ref={minStockRef}
                      defaultValue="0"
                      className="w-full h-12 bg-emerald-50/30 border border-emerald-100 rounded-xl px-4 text-sm font-black text-slate-700 outline-none focus:ring-1 focus:ring-[#10b981] transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="p-8 border-t border-slate-100 flex justify-center pb-12 gap-4">
            {editingProduct && (
              <button
                onClick={resetForm}
                className="h-14 px-8 border-2 border-slate-200 text-slate-500 rounded-2xl flex items-center gap-3 hover:bg-slate-50 transition-all font-black text-sm uppercase tracking-widest italic"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSaveProduct}
              className={`h-14 px-12 text-white rounded-2xl flex items-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all ${editingProduct ? "bg-amber-400 shadow-amber-200" : "bg-[#10b981] shadow-emerald-200"}`}
            >
              <Check size={20} strokeWidth={3} />
              <span className="text-sm font-black uppercase tracking-widest italic">
                {editingProduct ? "Actualizar Producto" : "Guardar Producto"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Summary Cards */}
      {viewMode !== "departamentos" && viewMode !== "ventas_periodo" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
              <Box size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Total Productos
              </p>
              <p className="text-2xl font-black text-slate-800">
                {products.length}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Stock Bajo
              </p>
              <p className="text-2xl font-black text-slate-800">
                {lowStockCount}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Valor Inventario
              </p>
              <p className="text-2xl font-black text-slate-800 font-mono">
                $
                {inventoryValue.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-11 px-4 rounded-lg flex items-center gap-2.5 transition-all ${
        active
          ? "bg-white text-[#10b981] shadow-sm font-black"
          : "text-slate-500 hover:text-slate-700 font-bold hover:bg-slate-200/50"
      }`}
    >
      {icon}
      <span className="text-[10px] uppercase tracking-tight">{label}</span>
    </button>
  );
}

function FormRadio({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 group">
      <div
        className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${active ? "border-[#10b981]" : "border-slate-300 group-hover:border-emerald-300"}`}
      >
        {active && <div className="w-2 h-2 bg-[#10b981] rounded-full" />}
      </div>
      <span
        className={`text-[10px] font-bold uppercase tracking-tight transition-colors ${active ? "text-slate-800" : "text-slate-400 group-hover:text-slate-500"}`}
      >
        {label}
      </span>
    </button>
  );
}

// Settings / Customization View
function SettingsView({
  categories,
  setCategories,
  concepts,
  setConcepts,
  ticketSettings,
  setTicketSettings,
  autoSaveSettings,
  setAutoSaveSettings,
  appNameText,
  setAppNameText,
  developerName,
  setDeveloperName,
  hideDeveloperName,
  setHideDeveloperName,
  onSyncComplete,
  initialTab = "ticket",
  onTabChange,
}: {
  categories: Category[];
  setCategories: any;
  concepts: Concept[];
  setConcepts: any;
  ticketSettings: TicketSettings;
  setTicketSettings: any;
  autoSaveSettings: AutoSaveSettings;
  setAutoSaveSettings: any;
  appNameText: string;
  setAppNameText: (name: string) => void;
  developerName: string;
  setDeveloperName: (name: string) => void;
  hideDeveloperName: boolean;
  setHideDeveloperName: (hide: boolean) => void;
  onSyncComplete?: () => void;
  initialTab?: "ticket" | "income" | "expense" | "security" | "brand";
  onTabChange?: (tab: "ticket" | "income" | "expense" | "security" | "brand") => void;
}) {
  const [activeTab, setActiveTabInternal] = useState<
    "ticket" | "income" | "expense" | "security" | "brand"
  >(initialTab);

  const setActiveTab = (tab: "ticket" | "income" | "expense" | "security" | "brand") => {
    setActiveTabInternal(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTabInternal(initialTab);
    }
  }, [initialTab]);
  const [newCatName, setNewCatName] = useState("");
  const [newConceptName, setNewConceptName] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("");

  // Local state for auto-save to avoid too many re-renders in parent
  const [localAutoSave, setLocalAutoSave] = useState(autoSaveSettings);

  const handleAutoSaveToggle = (enabled: boolean) => {
    const newSettings = { ...localAutoSave, enabled };
    setLocalAutoSave(newSettings);
    setAutoSaveSettings(newSettings);
  };

  const handleAutoSaveInterval = (interval: number) => {
    const newSettings = { ...localAutoSave, interval };
    setLocalAutoSave(newSettings);
    setAutoSaveSettings(newSettings);
  };

  const exportData = () => {
    const data = storage.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `respaldo_completo_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (
          window.confirm(
            "¿Está seguro de que desea importar estos datos? Esto sobrescribirá la información actual.",
          )
        ) {
          storage.importAllData(data);
          window.location.reload(); // Recargar para aplicar cambios de localStorage a todo el App
        }
      } catch (err) {
        alert(
          "Error al importar el archivo. Asegúrese de que sea un JSON válido.",
        );
      }
    };
    reader.readAsText(file);
  };

  const activeType =
    activeTab === "income" ? TransactionType.INCOME : TransactionType.EXPENSE;
  const filteredCats = categories.filter((c) => c.type === activeType);

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: crypto.randomUUID(),
      name: newCatName,
      type: activeType,
      isSystem: false,
    };
    setCategories((prev: Category[]) => [...prev, newCat]);
    setNewCatName("");
  };

  const addConcept = () => {
    if (!newConceptName.trim() || !selectedCatId) return;
    const newCon: Concept = {
      id: crypto.randomUUID(),
      categoryId: selectedCatId,
      name: newConceptName,
      isSystem: false,
    };
    setConcepts((prev: Concept[]) => [...prev, newCon]);
    setNewConceptName("");
  };

  const deleteCategory = (id: string) => {
    if (
      window.confirm(
        "¿Eliminar esta categoría? Se borrarán sus conceptos asociados.",
      )
    ) {
      setCategories((prev: Category[]) => prev.filter((c) => c.id !== id));
      setConcepts((prev: Concept[]) => prev.filter((c) => c.categoryId !== id));
    }
  };

  const deleteConcept = (id: string) => {
    setConcepts((prev: Concept[]) => prev.filter((c) => c.id !== id));
  };

  const updateSetting = (key: keyof TicketSettings, value: any) => {
    setTicketSettings({ ...ticketSettings, [key]: value });
  };

  const typographyOptions = [
    { id: "STANDARD", name: "STANDARD" },
    { id: "MODERN", name: "MODERN" },
    { id: "CLASSIC", name: "CLASSIC" },
    { id: "TECHNICAL", name: "TECHNICAL" },
    { id: "ELEGANT", name: "ELEGANT" },
    { id: "IMPACT", name: "IMPACT" },
    { id: "HANDWRITTEN", name: "HANDWRIT..." },
  ];

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab("ticket")}
            className={`flex-1 py-5 font-black text-[10px] uppercase tracking-widest transition-all gap-2 flex items-center justify-center ${
              activeTab === "ticket"
                ? "text-blue-600 bg-blue-50/20 border-b-2 border-blue-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Printer size={14} />
            Configuración Ticket
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex-1 py-5 font-black text-[10px] uppercase tracking-widest transition-all gap-2 flex items-center justify-center ${
              activeTab === "security"
                ? "text-purple-600 bg-purple-50/20 border-b-2 border-purple-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Shield size={14} />
            Seguridad y Datos
          </button>
          <button
            onClick={() => setActiveTab("brand")}
            className={`flex-1 py-5 font-black text-[10px] uppercase tracking-widest transition-all gap-2 flex items-center justify-center ${
              activeTab === "brand"
                ? "text-rose-600 bg-rose-50/20 border-b-2 border-rose-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Sparkles size={14} className="text-rose-550 animate-pulse" />
            Personalizar Marca (Libre)
          </button>
        </div>

        <div className="p-8">
          {activeTab === "ticket" ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Printer size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-800 uppercase italic">
                  Configuración de Ticket
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Business Name */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Nombre del Negocio
                  </label>
                  <input
                    type="text"
                    value={ticketSettings.businessName || ""}
                    onChange={(e) =>
                      updateSetting("businessName", e.target.value)
                    }
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Address and Phone */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={ticketSettings.address || ""}
                    onChange={(e) => updateSetting("address", e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={ticketSettings.phone || ""}
                    onChange={(e) => updateSetting("phone", e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* RNC and Logo upload icon UI */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    RNC (Opcional)
                  </label>
                  <input
                    type="text"
                    value={ticketSettings.rnc || ""}
                    onChange={(e) => updateSetting("rnc", e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Cargar Logo (JPG/PNG)
                  </label>
                  <div className="h-16 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center group hover:border-blue-300 transition-all cursor-pointer overflow-hidden relative">
                    {ticketSettings.logoUrl ? (
                      <img
                        src={ticketSettings.logoUrl}
                        alt="Logo"
                        className="h-full w-full object-cover opacity-50"
                      />
                    ) : (
                      <div className="p-2 bg-slate-100 rounded text-slate-400">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () =>
                            updateSetting("logoUrl", reader.result);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Logo URL */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Logo URL (Alternativo)
                  </label>
                  <input
                    type="text"
                    value={ticketSettings.logoUrl || ""}
                    onChange={(e) => updateSetting("logoUrl", e.target.value)}
                    placeholder="https://..."
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Farewell and Print Size */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Mensaje de Despedida
                  </label>
                  <input
                    type="text"
                    value={ticketSettings.farewellMessage || ""}
                    onChange={(e) =>
                      updateSetting("farewellMessage", e.target.value)
                    }
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Tamaño de Impresión
                  </label>
                  <select
                    value={ticketSettings.printSize || "POS 80mm (Estándar)"}
                    onChange={(e) => updateSetting("printSize", e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option>POS 80mm (Estándar)</option>
                    <option>POS 58mm (Pequeño)</option>
                    <option>Carta (PDF)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Tamaño de Letra ({ticketSettings.fontSize}px)
                  </label>
                  <input
                    type="range"
                    min="6"
                    max="20"
                    step="1"
                    value={ticketSettings.fontSize || 10}
                    onChange={(e) =>
                      updateSetting("fontSize", parseInt(e.target.value))
                    }
                    className="w-full h-12 accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Typography Section */}
              <div className="space-y-4 pt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Tipografía del Ticket
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {typographyOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => updateSetting("typography", opt.id)}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        ticketSettings.typography === opt.id
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-slate-100 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg mb-2 ${ticketSettings.typography === opt.id ? "bg-blue-100" : "bg-slate-200"}`}
                      >
                        <Type size={16} />
                      </div>
                      <span className="text-[8px] font-black tracking-tight uppercase truncate w-full text-center">
                        {opt.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkboxes */}
              <div className="pt-6 space-y-4 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={ticketSettings.isBold}
                    onChange={(e) => updateSetting("isBold", e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-500 uppercase tracking-tight text-xs">
                      B
                    </span>
                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                      Texto en negritas
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={ticketSettings.showLogo}
                    onChange={(e) =>
                      updateSetting("showLogo", e.target.checked)
                    }
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                    Mostrar logo en ticket
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={ticketSettings.openDrawer}
                    onChange={(e) =>
                      updateSetting("openDrawer", e.target.checked)
                    }
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                    Abrir gaveta al imprimir ticket
                  </span>
                </label>

                <p className="text-[9px] text-slate-400 italic">
                  * Nota: Asegúrese de configurar su impresora térmica en
                  Windows/Mac para que "abra el cajón después de imprimir".
                </p>
              </div>
            </div>
          ) : activeTab === "brand" ? (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-2xl mx-auto py-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm">
                  <Sparkles size={20} className="text-amber-500 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase italic">
                    Personalización de Marca y Desarrollador
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">
                    Haga el sistema verdaderamente libre y bajo su propia marca
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* 1. App Title customizer */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">
                    Nombre de su Aplicación / Marca
                  </label>
                  <p className="text-[9px] text-slate-400 font-semibold px-1 mb-2">
                    Cambie "CONDOBill" por el nombre de su negocio o marca de software preferida.
                  </p>
                  <input
                    type="text"
                    value={appNameText}
                    onChange={(e) => {
                      const val = e.target.value || "CONDOBill";
                      setAppNameText(val);
                      localStorage.setItem('condobill_custom_app_name', val);
                    }}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500 transition-all font-mono"
                  />
                </div>

                {/* 2. Developer customizer */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">
                    Nombre del Desarrollador / Agencia
                  </label>
                  <p className="text-[9px] text-slate-400 font-semibold px-1 mb-2">
                    Cambie "Izar Salas" por su propio nombre o el nombre de su agencia de desarrollo.
                  </p>
                  <input
                    type="text"
                    value={developerName}
                    onChange={(e) => {
                      const val = e.target.value || "Izar Salas";
                      setDeveloperName(val);
                      localStorage.setItem('condobill_custom_dev_name', val);
                    }}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500 transition-all font-mono"
                  />
                </div>

                {/* 3. Hide Credits checkbox */}
                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hideDeveloperName}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setHideDeveloperName(val);
                        localStorage.setItem('condobill_custom_hide_dev', val ? 'true' : 'false');
                      }}
                      className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                      Esconder créditos del programador en la barra lateral
                    </span>
                  </label>
                </div>

                {/* Info notice about Freedom Mode */}
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 text-xs leading-relaxed space-y-2">
                  <p className="font-extrabold uppercase italic tracking-tighter text-slate-700 flex items-center gap-2">
                    <span>🛡️ MODO LIBRE Y DE CÓDIGO ABIERTO ACTIVO</span>
                  </p>
                  <p>
                    Usted tiene la libertad absoluta de distribuir este software, renombrarlo (“White labeling”), usarlo comercialmente para sus propios clientes de condominio, y realizar las modificaciones que considere oportunas en el diseño de su interfaz de usuario.
                  </p>
                  <p className="font-bold text-slate-600">
                    La base de datos sigue operando en modo local seguro de máxima privacidad comercial (LocalStorage) en su dispositivo.
                  </p>
                </div>
              </div>
            </div>
          ) : activeTab === "security" ? (
            <div className="space-y-12 animate-in fade-in duration-500 max-w-2xl mx-auto py-4">
              
              {/* Sincronización en la Nube con Firebase */}
              <FirebaseSyncPanel onSyncComplete={onSyncComplete || (() => {})} />

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-sm">
                    <Database size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 italic uppercase">
                    Seguridad y Datos Locales
                  </h3>
                </div>
                <p className="text-xs font-medium text-slate-400 italic">
                  Proteja su información exportando una copia o restaure
                  información previa.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Export Button Card */}
                <button
                  onClick={exportData}
                  className="group relative flex flex-col items-center justify-center gap-4 p-8 rounded-[2rem] bg-purple-50/30 border-2 border-purple-100 hover:border-purple-400 hover:bg-purple-50 transition-all duration-300 shadow-sm overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-200/20 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-150 transition-transform duration-500" />
                  <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-purple-600 shadow-md group-hover:scale-110 transition-transform">
                    <Download size={32} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-purple-700">
                    Exportar Datos
                  </span>
                </button>

                {/* Import Button Card */}
                <label className="group relative flex flex-col items-center justify-center gap-4 p-8 rounded-[2rem] bg-cyan-50/30 border-2 border-cyan-100 hover:border-cyan-400 hover:bg-cyan-50 cursor-pointer transition-all duration-300 shadow-sm overflow-hidden text-center">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-200/20 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-150 transition-transform duration-500" />
                  <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-cyan-600 shadow-md group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">
                    Importar Datos
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={importData}
                  />
                </label>
              </div>

              <div className="pt-8 border-t border-slate-100 space-y-8">
                <div
                  className="flex items-center gap-4 group cursor-pointer"
                  onClick={() => handleAutoSaveToggle(!localAutoSave.enabled)}
                >
                  <div
                    className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${localAutoSave.enabled ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-200" : "bg-white border-slate-200"}`}
                  >
                    {localAutoSave.enabled && (
                      <Check size={14} className="text-white" strokeWidth={4} />
                    )}
                  </div>
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                    Habilitar Guardado Automático
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                      Intervalo (Minutos)
                    </label>
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter px-1">
                      Se generará un archivo de respaldo cada periodo.
                    </p>
                  </div>
                  <select
                    value={localAutoSave.interval}
                    onChange={(e) =>
                      handleAutoSaveInterval(parseInt(e.target.value))
                    }
                    className="h-12 px-6 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm min-w-[160px] outline-none"
                  >
                    <option value={1}>1 Minuto (Prueba)</option>
                    <option value={5}>5 Minutos</option>
                    <option value={15}>15 Minutos</option>
                    <option value={30}>30 Minutos</option>
                    <option value={60}>1 Hora</option>
                    <option value={1440}>A Diario (24h)</option>
                  </select>
                </div>
              </div>

              {/* Guía Móvil y Sincronización Local / Nube */}
              <div className="pt-8 border-t border-slate-100 space-y-6">
                <div className="flex items-center gap-2">
                  <Laptop size={16} className="text-blue-500 animate-pulse" />
                  <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-widest leading-none">
                    Guía Móvil y Sincronización Local / Nube
                  </h4>
                </div>
                
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Este sistema está diseñado para utilizarse tanto <strong>en la nube</strong> como de forma <strong>local offline sin internet</strong> en cualquier dispositivo (celular Android, iPhone, tablet o laptop), asegurando privacidad, resiliencia y rapidez.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Android & PC Installs */}
                  <div className="p-5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 space-y-3 transition-colors text-left">
                    <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-wider">
                      Instalación Rápida
                    </span>
                    <h5 className="text-[11px] font-black text-slate-700 uppercase">Android & Computadoras (Chrome / Edge)</h5>
                    <ul className="text-[10px] text-slate-500 space-y-1.5 font-medium list-disc pl-4 leading-normal">
                      <li>En <strong>Android</strong>: Pulse el botón de menú de 3 puntos en Chrome y pulse <strong>"Instalar Aplicación"</strong> o <strong>"Agregar a Pantalla Principal"</strong>.</li>
                      <li>En <strong>Computadoras</strong>: Haga clic en la pantalla con flecha a la derecha en la barra de direcciones superior de Chrome o Edge para crear una App de escritorio nativa e instantánea.</li>
                    </ul>
                  </div>

                  {/* iOS Installs */}
                  <div className="p-5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 space-y-3 transition-colors text-left">
                    <span className="inline-block px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-[9px] font-black uppercase tracking-wider">
                      Instalación iOS
                    </span>
                    <h5 className="text-[11px] font-black text-slate-700 uppercase">iPhone & iPad (Safari)</h5>
                    <ul className="text-[10px] text-slate-500 space-y-1.5 font-medium list-disc pl-4 leading-normal">
                      <li>Abra la aplicación en <strong>Safari</strong> desanimada de marcos.</li>
                      <li>Toque el botón de <strong>Compartir</strong> (un cuadrado con una flecha hacia arriba).</li>
                      <li>Desplácese y elija <strong>"Agregar a Inicio"</strong> para fijarla para siempre en la parrilla táctil de su celular.</li>
                    </ul>
                  </div>
                </div>

                {/* Sincronización Steps */}
                <div className="p-5 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-100 rounded-2xl space-y-3 text-left">
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <ArrowLeftRight size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sincronización Fácil Nube-Local</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Para mover su información o continuar trabajando en su condominio entre su celular y computadora portátil de manera segura:
                  </p>
                  <ol className="text-[10px] text-slate-500 space-y-1 font-medium list-decimal pl-4 leading-relaxed">
                    <li>Haga clic en <strong className="text-indigo-700">Exportar Datos</strong> arriba en su computadora para descargar el archivo <span className="font-mono text-[9px] text-slate-600 bg-white border px-1.5 py-0.5 rounded">.json</span>.</li>
                    <li>Envíese ese archivo por email o mensajería a su otro dispositivo (teléfono o tablet).</li>
                    <li>Abra la aplicación en el dispositivo secundario, diríjase a este mismo menú "Seguridad y Datos" y presione <strong className="text-cyan-700">Importar Datos</strong> seleccionando el archivo. Sus condominios, lecturas cargadas y registros quedarán sincronizados al instante.</li>
                  </ol>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in duration-300">
              {/* Categories Manager */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-8 bg-blue-500 rounded"></div>
                  <h4 className="font-bold text-slate-800 uppercase italic">
                    Categorías
                  </h4>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nueva categoría..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 h-10 bg-slate-50 border border-slate-200 rounded-lg px-4 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={addCategory}
                    className="bg-slate-800 text-white px-4 rounded-lg hover:bg-slate-700 transition-all shadow-md"
                  >
                    <PlusCircle size={14} />
                  </button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {filteredCats.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group"
                    >
                      <span
                        className={`font-black uppercase tracking-tighter text-[10px] ${cat.isSystem ? "text-blue-600" : "text-slate-600"}`}
                      >
                        {cat.name} {cat.isSystem && "(Fijo)"}
                      </span>
                      {!cat.isSystem && (
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Concepts Manager */}
              <div className="space-y-6 lg:border-l lg:border-slate-100 lg:pl-10">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-8 bg-slate-400 rounded"></div>
                  <h4 className="font-bold text-slate-800 uppercase italic">
                    Conceptos Relacionados
                  </h4>
                </div>

                <div className="space-y-2">
                  <select
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[11px] font-bold text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Selecciona categoría raíz...</option>
                    {filteredCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nuevo concepto..."
                      value={newConceptName}
                      onChange={(e) => setNewConceptName(e.target.value)}
                      className="flex-1 h-10 bg-slate-50 border border-slate-200 rounded-lg px-4 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <button
                      onClick={addConcept}
                      className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 transition-all shadow-md"
                    >
                      <PlusCircle size={14} />
                    </button>
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1 font-mono">
                  {concepts
                    .filter(
                      (con) =>
                        categories.find((cat) => cat.id === con.categoryId)
                          ?.type === activeType,
                    )
                    .map((con) => (
                      <div
                        key={con.id}
                        className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg group shadow-sm hover:border-slate-200 transition-all"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-[11px]">
                            {con.name}
                          </span>
                          <span className="text-[9px] text-blue-500 font-black uppercase tracking-tighter">
                            Raíz:{" "}
                            {
                              categories.find((c) => c.id === con.categoryId)
                                ?.name
                            }
                          </span>
                        </div>
                        {!con.isSystem && (
                          <button
                            onClick={() => deleteConcept(con.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
