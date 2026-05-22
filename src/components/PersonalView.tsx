import React, { useState, useRef } from "react";
import {
  Users,
  Plus,
  Trash2,
  Edit,
  Search,
  Phone,
  MapPin,
  Briefcase,
  Camera,
  FolderPlus,
  X,
  FileDown,
  ChevronDown,
  Filter,
  Check,
  Building
} from "lucide-react";
import { Empleado, AreaTrabajo } from "../types";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface PersonalViewProps {
  employees: Empleado[];
  areas: AreaTrabajo[];
  onAddEmployee: (e: Empleado) => void;
  onUpdateEmployee: (e: Empleado) => void;
  onDeleteEmployee: (id: string) => void;
  onAddArea: (a: AreaTrabajo) => void;
  onDeleteArea: (id: string) => void;
  onUpdateArea: (a: AreaTrabajo) => void;
}

export function PersonalView({
  employees,
  areas,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onAddArea,
  onDeleteArea,
  onUpdateArea
}: PersonalViewProps) {
  // Navigation tabs inside the personal view
  const [activeSubTab, setActiveSubTab] = useState<"list" | "areas">("list");

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>("all");

  // Employee Form State
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Empleado | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formAreaId, setFormAreaId] = useState("");
  const [formPhoto, setFormPhoto] = useState<string>("");
  const [formError, setFormError] = useState("");

  // Area Form State
  const [newAreaName, setNewAreaName] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingAreaName, setEditingAreaName] = useState("");
  const [areaError, setAreaError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Upload base64 convert
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      setFormError("La foto supera el límite de 1.5MB. Intente con una imagen más pequeña.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormPhoto(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddEmployee = () => {
    setEditingEmployee(null);
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setFormRole("");
    setFormAreaId(areas[0]?.id || "");
    setFormPhoto("");
    setFormError("");
    setIsEmployeeFormOpen(true);
  };

  const handleOpenEditEmployee = (emp: Empleado) => {
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormPhone(emp.phone);
    setFormAddress(emp.address);
    setFormRole(emp.role);
    setFormAreaId(emp.areaId);
    setFormPhoto(emp.photo || "");
    setFormError("");
    setIsEmployeeFormOpen(true);
  };

  const handleEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("El nombre es requerido");
      return;
    }
    if (!formRole.trim()) {
      setFormError("El cargo es requerido");
      return;
    }
    if (!formAreaId) {
      setFormError("Se debe asignar un área de trabajo");
      return;
    }

    if (editingEmployee) {
      onUpdateEmployee({
        ...editingEmployee,
        name: formName,
        phone: formPhone,
        address: formAddress,
        role: formRole,
        areaId: formAreaId,
        photo: formPhoto || undefined
      });
    } else {
      onAddEmployee({
        id: `emp-${Date.now()}`,
        name: formName,
        phone: formPhone,
        address: formAddress,
        role: formRole,
        areaId: formAreaId,
        photo: formPhoto || undefined,
        createdAt: Date.now()
      });
    }

    setIsEmployeeFormOpen(false);
  };

  // Area Manage handlers
  const handleAddAreaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAreaError("");

    if (!newAreaName.trim()) {
      setAreaError("El nombre del área es requerido");
      return;
    }

    // Check duplicate
    if (areas.some((a) => a.name.toLowerCase() === newAreaName.trim().toLowerCase())) {
      setAreaError("Ya existe un área con este nombre");
      return;
    }

    onAddArea({
      id: `area-${Date.now()}`,
      name: newAreaName.trim(),
      createdAt: Date.now()
    });

    setNewAreaName("");
  };

  const handleStartEditArea = (area: AreaTrabajo) => {
    setEditingAreaId(area.id);
    setEditingAreaName(area.name);
  };

  const handleSaveEditArea = (id: string) => {
    if (!editingAreaName.trim()) return;

    if (
      areas.some(
        (a) => a.id !== id && a.name.toLowerCase() === editingAreaName.trim().toLowerCase()
      )
    ) {
      alert("Ya existe otra área con ese nombre.");
      return;
    }

    onUpdateArea({
      id,
      name: editingAreaName.trim(),
      createdAt: Date.now()
    });
    setEditingAreaId(null);
  };

  const handleDeleteAreaClick = (area: AreaTrabajo) => {
    const isUsed = employees.some((emp) => emp.areaId === area.id);
    if (isUsed) {
      alert(
        `No se puede eliminar la área "${area.name}" porque tiene personal asignado. Primero mueva al personal a otra área.`
      );
      return;
    }

    if (confirm(`¿Está seguro de que desea eliminar el área "${area.name}"?`)) {
      onDeleteArea(area.id);
    }
  };

  const handleDeleteEmployeeClick = (id: string, name: string) => {
    if (confirm(`¿Está seguro de que desea retirar y eliminar a "${name}" de los registros?`)) {
      onDeleteEmployee(id);
    }
  };

  // Filtered employees listing
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.phone.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = selectedAreaFilter === "all" || emp.areaId === selectedAreaFilter;
    return matchesSearch && matchesArea;
  });

  // Export reports
  const exportToExcel = () => {
    const dataToExport = filteredEmployees.map((emp) => {
      const area = areas.find((a) => a.id === emp.areaId);
      return {
        ID: emp.id,
        Nombre: emp.name,
        Teléfono: emp.phone || "No especificado",
        Dirección: emp.address || "No especificado",
        Cargo: emp.role,
        "Área de Trabajo": area ? area.name : "Sin Área",
        "Fecha de Registro": new Date(emp.createdAt).toLocaleDateString("es-DO")
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Personal de Trabajo");
    XLSX.writeFile(workbook, `Personal_de_Trabajo_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("CONDOBill - Personal de Trabajo", 14, 15);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-DO")} | Total de empleados: ${filteredEmployees.length}`, 14, 22);

    const tableData = filteredEmployees.map((emp, index) => {
      const area = areas.find((a) => a.id === emp.areaId);
      return [
        index + 1,
        emp.name,
        emp.phone || "N/D",
        emp.role,
        area ? area.name : "Sin Área",
        emp.address || "N/D"
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [["#", "Nombre", "Teléfono", "Cargo / Rol", "Área", "Dirección"]],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 8, font: "helvetica" },
      headStyles: { fillColor: [13, 148, 136] } // Teal color
    });

    doc.save(`Personal_de_Trabajo_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden" id="personal-view-main">
      {/* Header and inner tab selector */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-teal-600" size={24} />
            Personal de Trabajo
          </h2>
          <p className="text-xs text-slate-500">
            Registro, control y organización de su equipo de colaboradores por áreas de la empresa
          </p>
        </div>

        {/* Outer Tabs selector */}
        <div className="flex bg-slate-100 p-1 rounded-lg self-start">
          <button
            onClick={() => setActiveSubTab("list")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
              activeSubTab === "list" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Lista de Personal
          </button>
          <button
            onClick={() => setActiveSubTab("areas")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
              activeSubTab === "areas" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Gestión de Áreas
          </button>
        </div>
      </div>

      {activeSubTab === "list" ? (
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
          {/* Subheader: search, filtering options and button */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shrink-0">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
              {/* Search text box */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, cargo, teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
                />
              </div>

              {/* Area select dropdown */}
              <div className="relative">
                <Filter className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <select
                  value={selectedAreaFilter}
                  onChange={(e) => setSelectedAreaFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700 appearance-none min-w-[160px]"
                >
                  <option value="all">Todas las Áreas</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14} />
              </div>
            </div>

            {/* Actions: Add personnel & export */}
            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                disabled={filteredEmployees.length === 0}
                className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-all flex items-center justify-center gap-1 text-xs font-bold disabled:opacity-40"
                title="Exportar a Excel"
              >
                <FileDown size={16} />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button
                onClick={exportToPDF}
                disabled={filteredEmployees.length === 0}
                className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-all flex items-center justify-center gap-1 text-xs font-bold disabled:opacity-40"
                title="Exportar a PDF"
              >
                <FileDown size={16} />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button
                onClick={handleOpenAddEmployee}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
              >
                <Plus size={18} />
                <span>Registrar Personal</span>
              </button>
            </div>
          </div>

          {/* List display */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {filteredEmployees.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto mt-8">
                <Users className="mx-auto text-slate-300 mb-4" size={48} />
                <h3 className="font-bold text-slate-800 text-lg">No hay personal registrado</h3>
                <p className="text-slate-500 text-xs mt-1">
                  {searchTerm || selectedAreaFilter !== "all"
                    ? "Ningún colaborador coincide con los criterios de búsqueda o filtros actuales."
                    : "Comience registrando los datos de sus empleados y colaboradores con sus respectivas áreas."}
                </p>
                {(searchTerm || selectedAreaFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedAreaFilter("all");
                    }}
                    className="mt-4 text-xs font-black uppercase text-teal-600 hover:text-teal-700 cursor-pointer"
                  >
                    Restablecer Filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees.map((emp) => {
                  const area = areas.find((a) => a.id === emp.areaId);
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={emp.id}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="p-4 flex gap-4">
                        {/* Profile Photo */}
                        <div className="w-16 h-16 rounded-xl bg-teal-50 border border-teal-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {emp.photo ? (
                            <img
                              src={emp.photo}
                              alt={emp.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Users className="text-teal-500" size={28} />
                          )}
                        </div>

                        {/* Name and details */}
                        <div className="flex-1 min-w-0">
                          <span className="inline-block px-2 py-0.5 rounded bg-teal-50 text-[10px] font-black text-teal-700 uppercase tracking-widest mb-1">
                            {area ? area.name : "Sin Área asignada"}
                          </span>
                          <h4 className="font-bold text-slate-800 truncate" title={emp.name}>
                            {emp.name}
                          </h4>
                          <span className="text-slate-600 font-medium text-xs flex items-center gap-1 mt-0.5">
                            <Briefcase size={12} className="text-slate-400" />
                            {emp.role}
                          </span>
                        </div>
                      </div>

                      {/* Contact & Address Fields */}
                      <div className="px-4 pb-4 border-t border-slate-100 pt-3 bg-slate-50/50 flex flex-col gap-1.5 text-xs text-slate-500">
                        {emp.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone size={13} className="text-slate-400" />
                            <a href={`tel:${emp.phone}`} className="hover:text-teal-600 hover:underline">
                              {emp.phone}
                            </a>
                          </div>
                        )}
                        {emp.address && (
                          <div className="flex items-start gap-1.5">
                            <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                            <span className="line-clamp-2 leading-tight">{emp.address}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">
                          Registrado el: {new Date(emp.createdAt).toLocaleDateString("es-DO")}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-end gap-2 bg-white">
                        <button
                          onClick={() => handleOpenEditEmployee(emp)}
                          className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-teal-600 hover:bg-teal-50 hover:border-teal-200 transition-all text-xs font-bold flex items-center gap-1"
                          title="Editar información"
                        >
                          <Edit size={12} />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteEmployeeClick(emp.id, emp.name)}
                          className="p-1 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all text-xs font-bold flex items-center gap-1"
                          title="Retirar empleado"
                        >
                          <Trash2 size={12} />
                          <span>Retirar</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          {/* Areas configuration: left side list, right side add form */}
          <div className="w-full lg:w-1/3 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col shrink-0 gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <FolderPlus size={18} className="text-teal-500" />
                Registrar Nueva Área
              </h3>
              <p className="text-xs text-slate-500">Defina subdivisiones para organizar su personal de trabajo</p>
            </div>

            <form onSubmit={handleAddAreaSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Nombre del Área *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Seguridad, Jardinería, Ventas..."
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
                />
              </div>

              {areaError && <p className="text-rose-500 text-xs font-bold">{areaError}</p>}

              <button
                type="submit"
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Agregar Área</span>
              </button>
            </form>
          </div>

          {/* Right side list of areas */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col overflow-hidden gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Áreas Registradas ({areas.length})
              </h3>
              <p className="text-xs text-slate-500">
                A continuación se listan las áreas actuales de su organización.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest w-16">#</th>
                    <th className="py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre de Área</th>
                    <th className="py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Colaboradores</th>
                    <th className="py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {areas.map((area, index) => {
                    const count = employees.filter((e) => e.areaId === area.id).length;
                    const isEditing = editingAreaId === area.id;

                    return (
                      <tr key={area.id} className="hover:bg-slate-55/40">
                        <td className="py-3 text-xs font-mono text-slate-400">{index + 1}</td>
                        <td className="py-3 text-sm text-slate-700 font-bold">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingAreaName}
                                onChange={(e) => setEditingAreaName(e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveEditArea(area.id)}
                                className="p-1 rounded bg-teal-50 text-teal-600 hover:bg-teal-100"
                                title="Guardar cambios"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingAreaId(null)}
                                className="p-1 rounded bg-slate-50 text-slate-500"
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span>{area.name}</span>
                          )}
                        </td>
                        <td className="py-3 text-sm text-slate-500 text-center font-bold">
                          <span className={`px-2 py-0.5 text-xs font-mono rounded ${count > 0 ? "bg-teal-50 text-teal-700 font-bold" : "bg-slate-100 text-slate-400"}`}>
                            {count} {count === 1 ? "empleado" : "empleados"}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {!isEditing && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleStartEditArea(area)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-teal-600 transition-all"
                                title="Editar nombre"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteAreaClick(area)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600 transition-all"
                                title="Eliminar área"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {areas.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs text-medium">
                  No hay áreas creadas todavía. Utilice el formulario de la izquierda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide dialogue Modal for Registering/Editing Employees */}
      <AnimatePresence>
        {isEmployeeFormOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal header */}
              <div className="bg-teal-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Users size={20} />
                  {editingEmployee ? "Editar Datos del Colaborador" : "Registrar Nuevo Personal"}
                </h3>
                <button
                  onClick={() => setIsEmployeeFormOpen(false)}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal form */}
              <form onSubmit={handleEmployeeSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Photo picker on left-top, name on right */}
                  <div className="col-span-2 flex items-center gap-4 bg-slate-55 p-3 rounded-xl border border-slate-100">
                    <div className="relative w-16 h-16 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center overflow-hidden shrink-0">
                      {formPhoto ? (
                        <img
                          src={formPhoto}
                          alt="Previsualización"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Users className="text-teal-400" size={24} />
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-all cursor-pointer"
                        title="Subir foto"
                      >
                        <Camera size={16} />
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 text-xs">Fotografía del Personal</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Formatos soportados PNG/JPG. Máximo 1.5MB de tamaño.
                      </p>
                      {formPhoto && (
                        <button
                          type="button"
                          onClick={() => setFormPhoto("")}
                          className="text-[10px] font-bold text-rose-500 hover:underline mt-1 cursor-pointer block"
                        >
                          Remover foto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Name field */}
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      placeholder="Ingrese los nombres y apellidos"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700 font-semibold"
                    />
                  </div>

                  {/* Role / Cargo */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                      Cargo que Ocupa *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Conserje, Plomero, Auditor, etc."
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700 font-semibold"
                    />
                  </div>

                  {/* Area / Area */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                      Área de Trabajo *
                    </label>
                    {areas.length > 0 ? (
                      <select
                        value={formAreaId}
                        onChange={(e) => setFormAreaId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
                      >
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-rose-500 text-xs font-bold py-2">
                        Debe crear al menos un área antes de registrar personal.
                      </div>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 809-555-0123"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
                    />
                  </div>

                  {/* Address */}
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                      Dirección de Residencia
                    </label>
                    <textarea
                      placeholder="Calle, sector, municipio o provincia de residencia..."
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700 resize-none"
                    />
                  </div>
                </div>

                {formError && <p className="text-rose-500 text-xs font-bold mt-2">{formError}</p>}

                {/* Submit / Cancel Buttons */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-4 bg-white">
                  <button
                    type="button"
                    onClick={() => setIsEmployeeFormOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                  >
                    <span>{editingEmployee ? "Guardar Cambios" : "Registrar Personal"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
