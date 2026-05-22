import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { 
  Building2, 
  User, 
  MapPin, 
  Mail, 
  Phone, 
  Camera, 
  CheckCircle2, 
  Loader2, 
  Building, 
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Condominio {
  id: string;
  name: string;
  address: string;
  photo?: string;
}

export function PublicOwnerRegistration() {
  const [adminId, setAdminId] = useState<string | null>(null);
  const [condos, setCondos] = useState<Condominio[]>([]);
  const [loadingCondos, setLoadingCondos] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Form fields
  const [condominioId, setCondominioId] = useState("");
  const [numero, setNumero] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [address, setAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
    const id = params.get("adminId");
    if (id) {
      setAdminId(id);
      fetchCondos(id);
    } else {
      setLoadingCondos(false);
      setErrorMsg("El enlace de registro no es válido. Falta el identificador del administrador.");
    }
  }, []);

  const fetchCondos = async (uid: string) => {
    try {
      const colRef = collection(db, "users", uid, "condos");
      const snapshot = await getDocs(colRef);
      const list: Condominio[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || "",
          address: data.address || "",
          photo: data.photo || ""
        });
      });
      setCondos(list);
      if (list.length > 0) {
        setCondominioId(list[0].id);
      }
    } catch (err: any) {
      console.error("Error fetching condos:", err);
      setErrorMsg("No se pudieron cargar los residenciales. Verifique su conexión de red.");
    } finally {
      setLoadingCondos(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (limit to 1MB for base64 storage efficiency)
    if (file.size > 1.2 * 1024 * 1024) {
      alert("La imagen seleccionada supera el límite recomendado de 1MB. Por favor, recorte o baje la calidad.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !condominioId || !numero || !ownerName || !whatsapp) {
      alert("Por favor complete todos los campos obligatorios (*).");
      return;
    }

    setSubmitting(true);
    try {
      const selectedCondo = condos.find(c => c.id === condominioId);
      const condominioName = selectedCondo ? selectedCondo.name : "Condominio Desconocido";
      const regId = "reg_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();

      // Write direct self-registration document
      await setDoc(doc(db, "users", adminId, "owner_registrations", regId), {
        id: regId,
        condominioId,
        condominioName,
        numero,
        ownerName,
        address,
        whatsapp,
        email,
        photo,
        createdAt: Date.now(),
        status: "pending"
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting owner info:", err);
      alert("Hubo un error al enviar sus datos. Por favor, reintente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 font-sans selection:bg-teal-500 selection:text-slate-900 relative overflow-hidden">
      
      {/* Background blobs for premium aesthetic */}
      <div className="absolute top-0 -left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="w-full max-w-xl bg-slate-800/80 border border-slate-700/50 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col relative z-10 transition-all">
        
        {/* Header Logo & Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-12 w-12 bg-gradient-to-tr from-teal-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20 mb-3">
            <Building2 className="w-6 h-6 text-slate-900" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Registro de Apartamento
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wider">
            Sistema de Colecta CONDOBill
          </p>
        </div>

        <AnimatePresence mode="wait">
          {errorMsg ? (
            <motion.div 
              key="error"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-rose-500/10 border border-rose-500/30 p-5 rounded-xl flex flex-col items-center text-center gap-3 my-4"
            >
              <AlertTriangle className="w-8 h-8 text-rose-400" />
              <p className="text-sm font-bold text-rose-300 leading-relaxed">{errorMsg}</p>
              <p className="text-[10px] text-slate-500 max-w-xs uppercase font-extrabold tracking-widest mt-2">
                Consulte al administrador de su propiedad
              </p>
            </motion.div>
          ) : loadingCondos ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-3"
            >
              <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
              <p className="text-xs text-slate-400 tracking-widest uppercase font-bold">Cargando Residenciales...</p>
            </motion.div>
          ) : submitted ? (
            <motion.div 
              key="success"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center flex flex-col items-center py-8"
            >
              <div className="h-20 w-20 bg-teal-500/20 rounded-full flex items-center justify-center border border-teal-500/30 mb-6 relative">
                <div className="absolute inset-0 bg-teal-500/5 rounded-full animate-ping scale-110"></div>
                <CheckCircle2 className="w-10 h-10 text-teal-400" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2">¡Información Recibida!</h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Muchas gracias por registrar sus datos. Su información ha sido sincronizada de forma segura en la base de datos de administración del condominio.
              </p>
              <div className="mt-8 pt-6 border-t border-slate-700/50 w-full text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-400" /> Conexión protegida de extremo a extremo
              </div>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Select Residencial */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Elegir Residencial / Condominio *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Building className="w-4 h-4" />
                  </span>
                  <select
                    required
                    value={condominioId}
                    onChange={(e) => setCondominioId(e.target.value)}
                    className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold text-slate-100 transition-all appearance-none cursor-pointer"
                  >
                    {condos.length === 0 ? (
                      <option value="">No hay residenciales creados</option>
                    ) : (
                      condos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Grid 2-cols: Unit and Owner Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    N° Unidad / Apto *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Ej. 101, A-2"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg px-4 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold text-slate-100 placeholder-slate-500 transition-all"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Nombre Completo *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      required
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold text-slate-100 placeholder-slate-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Address Field */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Dirección de la Propiedad
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Calle, torre, piso..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold text-slate-100 placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              {/* Grid 2-cols: WhatsApp and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Número de WhatsApp *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      required
                      type="tel"
                      placeholder="Ej. +1 (809) 555-0199"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold text-slate-100 placeholder-slate-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      placeholder="Ej. dueño@correo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-bold text-slate-100 placeholder-slate-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Photo Input (Optional) */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Foto de la Propiedad o Propietario (Opcional)
                </label>
                <div className="flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-lg p-5 bg-slate-900 transition-all hover:border-slate-500 relative group overflow-hidden">
                  {photo ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden flex items-center justify-center bg-black/40">
                      <img src={photo} alt="Preview" className="max-h-36 object-contain" />
                      <button 
                        type="button" 
                        onClick={() => setPhoto("")}
                        className="absolute top-2 right-2 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-[9px] font-extrabold uppercase tracking-widest rounded-md text-white transition-all shadow-md"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer w-full flex flex-col items-center py-4">
                      <Camera className="w-8 h-8 text-slate-500 group-hover:text-teal-400 transition-colors mb-2" />
                      <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 group-hover:text-slate-200 transition-colors">
                        Seleccionar o Tomar Foto
                      </span>
                      <span className="text-[9px] text-slate-600 font-medium mt-1">Soporta JPG, PNG (Max 1.2MB)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handlePhotoChange} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 mt-4 bg-gradient-to-r from-teal-500 to-blue-600 text-slate-900 font-extrabold text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-900" /> Sincronizando...
                  </>
                ) : (
                  <>
                    Enviar mi Registro <ArrowRight className="w-4 h-4 text-slate-900" />
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Humble Footer */}
      <div className="mt-8 text-[11px] font-bold text-slate-500 tracking-wider flex items-center gap-1.5 uppercase opacity-60">
        CONDOBill © 2026. Todos los derechos reservados.
      </div>
    </div>
  );
}
