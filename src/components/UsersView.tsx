import React, { useState } from "react";
import { 
  User, 
  UserCheck, 
  UserX, 
  Trash2, 
  Edit3, 
  PlusCircle, 
  ShieldAlert, 
  Check, 
  Lock, 
  Briefcase, 
  Calendar,
  XCircle,
  Save,
  Shield,
  RefreshCw
} from "lucide-react";
import { AppUser } from "../types";

interface UsersViewProps {
  users: AppUser[];
  currentUser: AppUser;
  onAddUser: (user: Omit<AppUser, "createdAt">) => void;
  onUpdateUser: (user: AppUser) => void;
  onDeleteUser: (id: string) => void;
}

const MODULES_MAP = [
  { id: "dashboard", label: "Panel de Control", desc: "Gráficos de flujo de caja, balance absoluto e indicadores", color: "from-blue-500 to-indigo-500" },
  { id: "income", label: "Módulo de Ingresos", desc: "Registro de ingresos directos, mora y pagos", color: "from-emerald-500 to-teal-500" },
  { id: "expense", label: "Módulo de Egresos", desc: "Registro de facturas de compras, gastos y nómina", color: "from-rose-500 to-red-500" },
  { id: "billing", label: "Facturador de Condominio", desc: "Recordatorios masivos y emisión de facturas de cuotas", color: "from-sky-500 to-blue-500" },
  { id: "generalBilling", label: "Facturación General POS", desc: "Punto de ventas, almacén de productos e inventario", color: "from-amber-500 to-orange-500" },
  { id: "personal", label: "Personal de Trabajo", desc: "Registro de empleados, datos de contacto, rol y gestión de áreas", color: "from-teal-600 to-emerald-600" },
  { id: "reporte_diario", label: "Reporte Diario (Caja y Recibos)", desc: "Impresión, búsqueda, visualización y re-impresión de recibos emitidos", color: "from-cyan-600 to-blue-600" },
  { id: "calculator", label: "Calculadora de Gas", desc: "Mediciones volumétricas y asignaciones de gas", color: "from-orange-500 to-amber-500" },
  { id: "cashClose", label: "Corte de Caja", desc: "Cierre financiero diario y generación física de reportes", color: "from-purple-500 to-indigo-500" },
  { id: "condos", label: "Gestión de Condominios", desc: "Configuración de unidades, propietarios y conserjes", color: "from-slate-700 to-slate-800" },
  { id: "settings", label: "Personalización / Configuración", desc: "RNC, ticket térmico, categorías e importación general", color: "from-slate-600 to-slate-700" },
  { id: "users", label: "Administración de Usuarios", desc: "Creación de operadores de cobro y asignación de permisos", color: "from-blue-600 to-indigo-600" }
];

export default function UsersView({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser
}: UsersViewProps) {
  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cargo, setCargo] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "dashboard",
    "income",
    "expense"
  ]);

  const [formError, setFormError] = useState("");

  const handleEditClick = (user: AppUser) => {
    setEditingId(user.id);
    setName(user.name);
    setUsername(user.username);
    setPassword(user.passwordHash);
    setCargo(user.cargo);
    setSelectedPermissions(user.permissions || []);
    setFormError("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setUsername("");
    setPassword("");
    setCargo("");
    setSelectedPermissions(["dashboard", "income", "expense"]);
    setFormError("");
  };

  const handleTogglePermission = (modId: string) => {
    // If it is the Admin user we are editing (from user list or settings), we don't allow modifying some critical permissions to prevent admin locked out, but they can set whatever for others.
    if (editingId === "user-admin" && (modId === "settings" || modId === "users")) {
      // Must keep settings and users to preserve user management
      return;
    }
    
    if (selectedPermissions.includes(modId)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== modId));
    } else {
      setSelectedPermissions([...selectedPermissions, modId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim() || !username.trim() || !password.trim() || !cargo.trim()) {
      setFormError("Por favor completa todos los campos requeridos.");
      return;
    }

    if (selectedPermissions.length === 0) {
      setFormError("El usuario debe tener al menos una casilla de acceso autorizada.");
      return;
    }

    // Check username duplicates (case-insensitive), excluding current edited user
    const checkUsername = username.trim().toLowerCase();
    const isDuplicate = users.some(
      (u) => u.id !== editingId && u.username.toLowerCase() === checkUsername
    );

    if (isDuplicate) {
      setFormError("El nombre de usuario ya está registrado por otro operador.");
      return;
    }

    if (editingId) {
      // Edit mode
      const updatedUser: AppUser = {
        id: editingId,
        name: name.trim(),
        username: username.trim(),
        passwordHash: password,
        cargo: cargo.trim(),
        permissions: selectedPermissions,
        createdAt: users.find((u) => u.id === editingId)?.createdAt || new Date().toISOString()
      };
      onUpdateUser(updatedUser);
      alert("Usuario actualizado con éxito.");
      handleCancelEdit();
    } else {
      // Create mode
      onAddUser({
        id: "user-" + crypto.randomUUID(),
        name: name.trim(),
        username: username.trim(),
        passwordHash: password,
        cargo: cargo.trim(),
        permissions: selectedPermissions
      });
      alert(`Usuario "${username}" creado y registrado exitosamente.`);
      handleCancelEdit();
    }
  };

  const handleDeleteClick = (id: string, uname: string) => {
    if (id === "user-admin") {
      alert("No se puede eliminar la cuenta maestra 'Admin'.");
      return;
    }

    if (id === currentUser.id) {
      alert("No puedes eliminar la cuenta del usuario actualmente conectado.");
      return;
    }

    if (window.confirm(`¿Está completamente seguro de que desea eliminar al usuario "${uname}"?\nEsta acción revocará inmediatamente sus credenciales de acceso.`)) {
      onDeleteUser(id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 select-none animate-in fade-in duration-300">
      {/* Banner Header */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <Shield size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">CONTROL DE USUARIOS Y PERMISOS</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Crea operadores virtuales de cobro con limitación por su cargo</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Create / Edit Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl shadow-lg p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${editingId ? 'bg-amber-500 animate-pulse' : 'bg-blue-600'}`}></span>
              {editingId ? "Editar Credencial" : "Nuevo Operador"}
            </h3>
            {editingId && (
              <button 
                onClick={handleCancelEdit}
                className="text-[10px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg transition-all"
              >
                <XCircle size={12} /> Cancelar
              </button>
            )}
          </div>

          {formError && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 flex items-center gap-2 text-xs font-bold">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Nombre Completo *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all placeholder-slate-400"
                />
              </div>
            </div>

            {/* Cargo / Role */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Cargo / Responsabilidad *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Briefcase size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Ej: Cajero, Contador, Supervisor"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all placeholder-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Usuario Acceso *
                </label>
                <input
                  type="text"
                  placeholder="Ej: JuanP"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={editingId === "user-admin"}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all placeholder-slate-400 disabled:bg-slate-100 disabled:text-slate-400 cursor-not-allowed"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Contraseña *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock size={14} />
                  </div>
                  <input
                    type="text"
                    placeholder="Ej: 123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all placeholder-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Permissions Check */}
            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 border-b border-slate-100 pb-1.5">
                Asignación de Casillas / Módulos ({selectedPermissions.length})
              </label>
              
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {MODULES_MAP.map((mod) => {
                  const isChecked = selectedPermissions.includes(mod.id);
                  const isCriticalAdminTab = editingId === "user-admin" && (mod.id === "settings" || mod.id === "users");
                  
                  return (
                    <div 
                      key={mod.id}
                      onClick={() => !isCriticalAdminTab && handleTogglePermission(mod.id)}
                      className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isChecked 
                          ? "border-blue-200 bg-blue-50/20" 
                          : "border-slate-100 bg-slate-50/30 hover:border-slate-200"
                      } ${isCriticalAdminTab ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border text-white transition-all shrink-0 mt-0.5 ${
                        isChecked 
                          ? "bg-blue-600 border-blue-600" 
                          : "bg-white border-slate-200"
                      }`}>
                        {isChecked && <Check size={12} strokeWidth={4} />}
                      </div>
                      <div className="text-left leading-tight">
                        <span className="text-[11px] font-bold text-slate-800 block">{mod.label}</span>
                        <span className="text-[8.5px] text-slate-400 mt-0.5 block font-medium">{mod.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 mt-4"
            >
              <Save size={14} /> {editingId ? "Actualizar Permisos" : "Registrar Operador"}
            </button>
          </form>
        </div>

        {/* Right Side: Active Users List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Lista de Usuarios de Negocio ({users.length})
            </h2>
            <p className="text-[10px] bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-black uppercase tracking-wide">
              Sesión Activa: {currentUser.name}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((user) => {
              const isAdmin = user.id === "user-admin";
              return (
                <div 
                  key={user.id}
                  className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Header Card */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0 shadow-md ${
                          isAdmin 
                            ? "bg-gradient-to-tr from-blue-600 to-indigo-600" 
                            : "bg-gradient-to-tr from-slate-700 to-slate-800"
                        }`}>
                          {user.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-left leading-none">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide truncate max-w-[150px]">{user.name}</h4>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">@{user.username}</span>
                        </div>
                      </div>

                      {isAdmin && (
                        <span className="text-[7.5px] bg-blue-100 text-blue-800 font-extrabold tracking-widest uppercase px-2 py-0.5 rounded">
                          Maestro
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl text-left font-mono text-[9px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Briefcase size={10} className="text-slate-400" />
                        <span>Cargo: <strong className="text-slate-700 uppercase font-bold">{user.cargo}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={10} className="text-slate-400" />
                        <span>Registrado: <strong className="text-slate-700">{new Date(user.createdAt).toLocaleDateString()}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Lock size={10} className="text-slate-400" />
                        <span>Contraseña: <strong className="text-slate-700 font-black">{user.passwordHash}</strong></span>
                      </div>
                    </div>

                    {/* Permission Badges Container */}
                    <div className="space-y-1.5 text-left">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Casillas Autorizadas ({user.permissions?.length || 0}):</span>
                      <div className="flex flex-wrap gap-1 max-h-[64px] overflow-y-auto pr-1">
                        {user.permissions?.map((pId) => {
                          const lbl = MODULES_MAP.find((m) => m.id === pId)?.label || pId;
                          return (
                            <span 
                              key={pId}
                              className="text-[8px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase tracking-tighter"
                            >
                              {lbl}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3 mt-4">
                    <button
                      onClick={() => handleEditClick(user)}
                      className="flex-1 h-8 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                    >
                      <Edit3 size={10} /> Editar
                    </button>
                    {!isAdmin && user.id !== currentUser.id && (
                      <button
                        onClick={() => handleDeleteClick(user.id, user.username)}
                        className="h-8 w-8 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 text-rose-500 rounded-lg flex items-center justify-center transition-all shrink-0"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
