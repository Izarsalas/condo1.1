import React, { useState, useEffect } from "react";
import { 
  Cloud, 
  CloudUpload, 
  CloudDownload, 
  LogOut, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  User,
  Chrome,
  Share2,
  Copy,
  Mail,
  Lock,
  UserPlus,
  LogIn,
  Settings
} from "lucide-react";
import { auth, googleProvider } from "../lib/firebase";
import { 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { uploadToCloud, downloadFromCloud, getLocalStats, SyncStats } from "../lib/firebaseSync";

interface FirebaseSyncPanelProps {
  onSyncComplete: () => void;
}

export default function FirebaseSyncPanel({ onSyncComplete }: FirebaseSyncPanelProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  const [localStats, setLocalStats] = useState<SyncStats | null>(null);
  const [autoCloudSync, setAutoCloudSync] = useState(() => {
    const rawVal = localStorage.getItem("condobill_auto_cloud_sync");
    return rawVal === null ? true : rawVal === "true";
  });

  // Custom Firebase configuration status check
  const [customConfig, setCustomConfig] = useState<any>(() => {
    const stored = localStorage.getItem("custom_firebase_config");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Custom Form fields with fallback from stored customConfig
  const [customApiKey, setCustomApiKey] = useState(customConfig?.apiKey || "");
  const [customAuthDomain, setCustomAuthDomain] = useState(customConfig?.authDomain || "");
  const [customProjectId, setCustomProjectId] = useState(customConfig?.projectId || "");
  const [customStorageBucket, setCustomStorageBucket] = useState(customConfig?.storageBucket || "");
  const [customMessagingSenderId, setCustomMessagingSenderId] = useState(customConfig?.messagingSenderId || "");
  const [customAppId, setCustomAppId] = useState(customConfig?.appId || "");
  const [customDatabaseURL, setCustomDatabaseURL] = useState(customConfig?.databaseURL || "");

  // Email and password form state
  const [loginMethod, setLoginMethod] = useState<'google' | 'email' | 'custom'>('email'); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const toggleAutoCloudSync = (enabled: boolean) => {
    localStorage.setItem("condobill_auto_cloud_sync", String(enabled));
    setAutoCloudSync(enabled);
  };

  const handleSaveCustomConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customApiKey || !customProjectId) {
      alert("Por favor ingresa al menos la API Key y el Project ID.");
      return;
    }

    const configToSave = {
      apiKey: customApiKey.trim(),
      authDomain: customAuthDomain.trim() || `${customProjectId.trim()}.firebaseapp.com`,
      projectId: customProjectId.trim(),
      storageBucket: customStorageBucket.trim() || `${customProjectId.trim()}.firebasestorage.app`,
      messagingSenderId: customMessagingSenderId.trim(),
      appId: customAppId.trim(),
      databaseURL: customDatabaseURL.trim() || `https://${customProjectId.trim()}-default-rtdb.firebaseio.com`
    };

    localStorage.setItem("custom_firebase_config", JSON.stringify(configToSave));
    alert("¡Configuración de Firebase guardada con éxito! La página se recargará para conectar usando tus credenciales...");
    window.location.reload();
  };

  const handleClearCustomConfig = () => {
    if (window.confirm("¿Estás seguro de que deseas eliminar tu configuración personalizada y regresar al entorno por defecto de la plataforma?")) {
      localStorage.removeItem("custom_firebase_config");
      alert("Se restableció la configuración. La página se recargará...");
      window.location.reload();
    }
  };

  // Load and subscribe to Firebase Auth states
  useEffect(() => {
    setLocalStats(getLocalStats());
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshStats = () => {
    setLocalStats(getLocalStats());
  };

  const handleSignIn = async () => {
    setErrorMsg("");
    setSyncStatus('idle');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("[Firebase Signin Error]", err);
      const isDomainError = 
        err.code === "auth/unauthorized-domain" || 
        (err.message && err.message.includes("unauthorized-domain")) ||
        (err.message && err.message.includes("unauthorized"));

      if (isDomainError) {
        const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
        setErrorMsg(`⚠️ DOMINIO NO AUTORIZADO: Tu aplicación Firebase aún no sabe que este entorno de vista previa es seguro.
👉 SOLUCIÓN FÁCIL: Usa la pestaña "Correo y Contraseña" al lado para conectarte de inmediato SIN configurar nada en Firebase Console.

O si prefieres Google Auth, autorízalo así:
1. Ve a tu Firebase Console.
2. Entra a 'Authentication' > pestaña 'Settings' > sección 'Authorized domains' (Dominios autorizados).
3. Haz clic en 'Add domain' e ingresa: ${currentHost}
4. Guarda los cambios y vuelve a intentar.`);
      } else {
        setErrorMsg("No se pudo iniciar sesión con Google: " + (err.message || err.code || "Error desconocido"));
      }
      setSyncStatus('error');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Completa todos los campos para continuar.");
      setSyncStatus('error');
      return;
    }
    
    setErrorMsg("");
    setSyncStatus('idle');
    setAuthLoading(true);

    try {
      if (isRegistering) {
        try {
          await createUserWithEmailAndPassword(auth, email.trim(), password);
        } catch (regErr: any) {
          if (regErr.code === "auth/email-already-in-use") {
            console.log("[Firebase Auto-Fallback] El correo ya está registrado. Iniciando sesión...");
            await signInWithEmailAndPassword(auth, email.trim(), password);
          } else {
            throw regErr;
          }
        }
      } else {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (signInErr: any) {
          if (
            signInErr.code === "auth/user-not-found" || 
            signInErr.code === "auth/invalid-credential" || 
            signInErr.code === "auth/invalid-login-credentials" ||
            signInErr.message?.includes("invalid-credential") ||
            signInErr.message?.includes("user-not-found")
          ) {
            console.log("[Firebase Auto-Fallback] Usuario no encontrado. Creando nueva cuenta...");
            try {
              await createUserWithEmailAndPassword(auth, email.trim(), password);
            } catch (regErr: any) {
              if (regErr.code === "auth/email-already-in-use") {
                throw new Error("Credenciales inválidas. Verifica tu correo y contraseña.");
              }
              throw regErr;
            }
          } else {
            throw signInErr;
          }
        }
      }
    } catch (err: any) {
      console.error("[Firebase Email Auth Error]", err);
      let errorResponse = err.message || err.code || "Error desconocido";
      
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-login-credentials") {
        errorResponse = "Credenciales incorrectas. Verifica tu correo y contraseña o intenta con otra clave.";
      } else if (err.code === "auth/email-already-in-use") {
        errorResponse = "El correo ya está registrado. Introduce la contraseña correcta para iniciar sesión.";
      } else if (err.code === "auth/weak-password") {
        errorResponse = "La contraseña debe tener al menos 6 caracteres.";
      } else if (err.code === "auth/invalid-email") {
        errorResponse = "Por favor ingresa un correo electrónico válido.";
      } else if (err.code === "auth/operation-not-allowed") {
        const projectId = auth.app?.options?.projectId || "phrasal-portfolio-pszp9";
        errorResponse = `⚠️ MÉTODO NO ACTIVADO: El registro de Correo/Contraseña aún está desactivado en tu proyecto de Firebase.
Para activarlo de inmediato, sigue estos sencillos pasos:

1. Haz clic aquí para ir al panel de autenticación:
   https://console.firebase.google.com/project/${projectId}/authentication/providers
2. Haz clic en el botón "Comenzar" (si es la primera vez que entras) o "Agregar nuevo proveedor".
3. Selecciona "Correo electrónico y contraseña" (Email/Password).
4. Activa la primera casilla (Habilitar) y haz clic en "Guardar".
5. Regresa aquí y vuelve a intentar. ¡Listo!`;
      }
      
      setErrorMsg(errorResponse);
      setSyncStatus('error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMsg("");
    setSyncStatus('idle');
    try {
      await fbSignOut(auth);
    } catch (err: any) {
      setErrorMsg("Ocurrió un error al cerrar sesión.");
      setSyncStatus('error');
    }
  };

  const handleUpload = async () => {
    if (!firebaseUser) return;
    setSyncing(true);
    setSyncStatus('idle');
    setErrorMsg("");
    try {
      await uploadToCloud(firebaseUser.uid);
      setSyncStatus('success');
      refreshStats();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error al respaldar datos en la nube. Verifica tu conexión.");
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDownload = async () => {
    if (!firebaseUser) return;
    
    const confirmRestore = window.confirm(
      "¿ESTÁS SEGURO? Descargar los datos de la nube REEMPLAZARÁ completamente los condominios, lecturas, ventas y productos de este dispositivo con los que tienes respaldados en la nube."
    );
    if (!confirmRestore) return;

    setSyncing(true);
    setSyncStatus('idle');
    setErrorMsg("");
    try {
      const stats = await downloadFromCloud(firebaseUser.uid);
      setSyncStatus('success');
      refreshStats();
      onSyncComplete(); // Trigger state refresh in App.tsx
      alert(`¡Restauración exitosa! Se cargaron ${stats.condos} condominios y ${stats.transactions} transacciones desde la nube.`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error al descargar e importar los respaldos desde la nube.");
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="p-8 bg-slate-50 border border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-[10px] font-black uppercase tracking-widest">Iniciando Servicios de Nube...</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-6 sm:p-8 space-y-6 text-left relative overflow-hidden transition-all shadow-sm">
      {/* Visual background gradient accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-6 -mt-6 blur-xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
            <Cloud size={20} className={syncing ? "animate-bounce" : ""} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider leading-none">
              Sincronización en la Nube
            </h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
              Firebase Cloud Database Sync
            </p>
          </div>
        </div>
        
        {firebaseUser ? (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Conectado
          </span>
        ) : (
          <span className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-wider">
            Solo Local
          </span>
        )}
      </div>

      {/* Connection Logic & Login Form */}
      {!firebaseUser ? (
        <div className="space-y-5">
          {/* Custom Tabs Selector */}
          <div className="flex bg-slate-200/60 p-1 rounded-2xl flex-wrap gap-1 md:flex-nowrap">
            <button
              type="button"
              onClick={() => {
                setLoginMethod('email');
                setErrorMsg("");
                setSyncStatus('idle');
              }}
              className={`flex-1 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer rounded-xl ${
                loginMethod === 'email'
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Mail size={12} />
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('custom');
                setErrorMsg("");
                setSyncStatus('idle');
              }}
              className={`flex-1 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer rounded-xl ${
                loginMethod === 'custom'
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Settings size={12} />
              Mi Propio Firebase
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('google');
                setErrorMsg("");
                setSyncStatus('idle');
              }}
              className={`flex-1 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer rounded-xl ${
                loginMethod === 'google'
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Chrome size={12} />
              Google Sign-In
            </button>
          </div>

          {loginMethod === 'email' ? (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                <strong className="text-blue-600 font-extrabold uppercase text-[9px] tracking-wider block mb-0.5">Súper fácil - Sin autorizar dominios:</strong>
                Ingresa tus credenciales a continuación. Si aún no tienes un usuario creado, marca la casilla de <strong>Registrar nueva cuenta</strong> y la crearemos al instante usando tu correo.
              </p>

              <div className="space-y-2.5">
                {/* Email input */}
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5 align-left">
                    Correo Electrónico
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={14} className="absolute left-4 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@correo.com"
                      className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs text-slate-700 placeholder-slate-400 font-medium focus:outline-none focus:border-blue-500 shadow-sm"
                    />
                  </div>
                </div>

                {/* Password input */}
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5 align-left">
                    Contraseña de la Cloud (Mínimo 6 caracteres)
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={14} className="absolute left-4 text-slate-400 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={password}
                      minLength={6}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingrese una contraseña"
                      className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs text-slate-700 placeholder-slate-400 font-medium focus:outline-none focus:border-blue-500 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Mode Toggle Checkbox */}
              <label className="flex items-center gap-2.5 p-3.5 bg-white/70 border border-slate-200/50 rounded-2xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRegistering}
                  onChange={(e) => setIsRegistering(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <div className="text-left">
                  <span className="block text-[10px] font-black uppercase text-slate-700 leading-none">Registrar nueva cuenta</span>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                    Actívalo para crear un nuevo usuario con este correo
                  </span>
                </div>
              </label>

              {/* Action Buttons */}
              <button
                type="submit"
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01] cursor-pointer shadow-md active:scale-95"
              >
                {isRegistering ? <UserPlus size={15} /> : <LogIn size={15} />}
                {isRegistering ? "Registrar usuario en la Nube" : "Iniciar Sesión en la Nube"}
              </button>
            </form>
          ) : loginMethod === 'custom' ? (
            <form onSubmit={handleSaveCustomConfig} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-4 text-[11px] text-amber-800 font-medium leading-relaxed">
                <strong className="text-amber-900 font-extrabold block mb-1">CONECTA YA TU PROPIO PROYECTO DE FIREBASE:</strong>
                Ingresa aquí las credenciales para conectar tu sistema directamente a tu proyecto (como <strong>condo1-ca3b0</strong>). Así podrás iniciar sesión con el correo y contraseña que registraste allí.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">ID de Proyecto (Project ID) *</label>
                  <input
                    type="text"
                    required
                    value={customProjectId}
                    onChange={(e) => setCustomProjectId(e.target.value)}
                    placeholder="ej. condo1-ca3b0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">API Key *</label>
                  <input
                    type="text"
                    required
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Ingrese su API API Key de Firebase"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">App ID</label>
                  <input
                    type="text"
                    value={customAppId}
                    onChange={(e) => setCustomAppId(e.target.value)}
                    placeholder="ej. 1:12345:web:abcdef"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">Auth Domain (Dominio Auth)</label>
                  <input
                    type="text"
                    value={customAuthDomain}
                    onChange={(e) => setCustomAuthDomain(e.target.value)}
                    placeholder="ej. condo1-ca3b0.firebaseapp.com"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">Storage Bucket</label>
                  <input
                    type="text"
                    value={customStorageBucket}
                    onChange={(e) => setCustomStorageBucket(e.target.value)}
                    placeholder="ej. condo1-ca3b0.firebasestorage.app"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">Database URL (Opcional)</label>
                  <input
                    type="text"
                    value={customDatabaseURL}
                    onChange={(e) => setCustomDatabaseURL(e.target.value)}
                    placeholder="ej. rtdb url"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md cursor-pointer text-center"
                >
                  Conectar Con Mi Firebase
                </button>
                {customConfig && (
                  <button
                    type="button"
                    onClick={handleClearCustomConfig}
                    className="py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Quitar Mi Configuración
                  </button>
                )}
              </div>
              
              <p className="text-[9px] text-slate-400 font-bold uppercase leading-snug">
                * Asegúrate de habilitar Cloud Firestore y el proveedor de Correo/Contraseña en Authentication en tu consola de Firebase.
              </p>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Si ya configuraste y agregaste el dominio de tu sistema condominial en Firebase Console, puedes usar un clic con tu cuenta de Google.
              </p>

              <button
                type="button"
                onClick={handleSignIn}
                className="w-full py-4 px-6 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:scale-[1.01] cursor-pointer shadow-lg active:scale-95"
              >
                <Chrome className="w-5 h-5 text-blue-400 shrink-0" />
                Vincular cuenta con Google Sign-In
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Linked User Meta Detail */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {firebaseUser.photoURL ? (
                <img 
                  src={firebaseUser.photoURL} 
                  referrerPolicy="no-referrer"
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center border border-slate-100">
                  <User size={18} />
                </div>
              )}
              <div className="text-left">
                <p className="text-xs font-black text-slate-800">{firebaseUser.displayName}</p>
                <p className="text-[10px] text-slate-400 font-bold tracking-tight">{firebaseUser.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Cerrar sesión de Nube"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Sync Stats Breakdown */}
          {localStats && (
            <div className="p-4 bg-slate-100/50 rounded-2xl space-y-3">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Database size={12} />
                <span className="text-[9px] font-black uppercase tracking-wider">Base de Datos de este Dispositivo</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/65">
                  <span className="block text-sm font-black text-slate-800 leading-none">{localStats.condos}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-1 block">Condos</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/65">
                  <span className="block text-sm font-black text-slate-800 leading-none">{localStats.units}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-1 block">Unidades</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/65">
                  <span className="block text-sm font-black text-slate-800 leading-none">{localStats.transactions}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-1 block">Cobros/Gastos</span>
                </div>
              </div>
            </div>
          )}

          {/* Background Auto Cloud Sync Toggle Setting */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex-1 text-left">
              <span className="block text-xs font-black text-slate-800 uppercase tracking-tight">Sincronización en Tiempo Real</span>
              <span className="block text-[10px] text-slate-400 font-bold leading-normal mt-0.5">
                Al activar, todos tus cambios locales se guardan al instante y de forma continua en tu base de datos Firebase sin necesidad de guardados manuales.
              </span>
            </div>
            <button
              type="button"
              onClick={() => toggleAutoCloudSync(!autoCloudSync)}
              className={`w-12 h-6 rounded-full p-0.5 transition-all outline-none shrink-0 ${
                autoCloudSync ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-300'
              } flex items-center relative cursor-pointer`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-250 ${
                  autoCloudSync ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Enlace de Registro Único para Propietarios */}
          <div className="p-5 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/60 rounded-3xl space-y-3 shadow-inner text-left">
            <div className="flex items-center gap-2 text-blue-700">
              <Share2 size={16} className="text-blue-600 shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider">Tu Enlace de Registro Único</span>
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">
              Envía este enlace a tus propietarios para que registren sus datos de forma remota. Recibirás sus datos en tiempo real de manera sincronizada:
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/?register-owner=true&adminId=${firebaseUser.uid}`}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[10px] font-mono text-slate-700 select-all focus:outline-none shadow-sm focus:border-blue-300"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?register-owner=true&adminId=${firebaseUser.uid}`);
                  alert("¡Enlace copiado al portapapeles con éxito!");
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shrink-0 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Copy size={12} />
                Copiar
              </button>
            </div>
            <div className="pt-2.5 border-t border-slate-200/60 flex flex-wrap gap-2">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Estimado propietario, por favor registre o actualice sus datos en nuestro sistema de administración de condominios ingresando en el siguiente enlace único:\n\n${window.location.origin}/?register-owner=true&adminId=${firebaseUser.uid}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="text-[9px] font-black uppercase tracking-wider text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 hover:scale-[1.01] px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all outline-none border border-emerald-200/50"
              >
                <span>Compartir por WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Upload to Cloud */}
            <button
              type="button"
              disabled={syncing}
              onClick={handleUpload}
              className="py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <CloudUpload size={16} className={syncing ? "animate-spin" : ""} />
              Respaldar en la Nube
            </button>

            {/* Download from Cloud */}
            <button
              type="button"
              disabled={syncing}
              onClick={handleDownload}
              className="py-4 px-6 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <CloudDownload size={16} />
              Restaurar de la Nube
            </button>
          </div>
        </div>
      )}

      {/* Sync State Status Message Feedbacks */}
      {syncStatus === 'success' && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">¡Éxito en la Sincronización!</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">Los datos locales se han acoplado y asegurado con la base de datos central en la nube correctamente.</p>
          </div>
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="text-left w-full">
            <p className="text-[10px] font-black text-rose-800 uppercase tracking-wider">Error de Transferencia</p>
            <p className="text-[10px] text-slate-600 font-medium mt-1 leading-relaxed whitespace-pre-line select-all">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
