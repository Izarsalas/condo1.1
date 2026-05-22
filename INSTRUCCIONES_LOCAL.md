# Manual de Instalación Local - CONDOBill 🖥️⛽

¡Felicidades! La aplicación **CONDOBill** está totalmente optimizada para ejecutarse de forma **local y 100% offline** en cualquier computadora (Windows, macOS o Linux) sin depender de conexión a Internet. 

Hemos configurado **Electron** y preparado scripts automáticos para que puedas generar el instalador (.exe o .dmg) de forma directa y sencilla.

Sigue las siguientes instrucciones detalladas paso a paso para prepararlo todo.

---

## 📋 Requisitos Previos

Solo necesitas tener un programa instalado en tu computadora para poder construir y empaquetar el ejecutable:

1. **Descargar e Instalar Node.js:**
   - Ve a la página oficial: [https://nodejs.org](https://nodejs.org)
   - Descarga la versión marcada como **LTS** (Recomendada para la mayoría).
   - Instálala haciendo doble clic y presionando "Siguiente" en todas las ventanas. Esto preparará tu computadora para ejecutar comandos de JavaScript de forma nativa.

---

## ⚡ Instalación Automatizada (Recomendado)

Hemos creado scripts de un solo clic que hacen todo el trabajo de forma automatizada. Solo debes seguir estos pasos según tu sistema operativo:

### 🪟 En Computadoras con Windows
1. Descarga el código de la aplicación (el archivo ZIP exportado desde AI Studio o clona el repositorio).
2. Extrae el ZIP en tu carpeta preferida (por ejemplo, en el Escritorio o Documentos).
3. Entra a la carpeta de la aplicación y busca el archivo llamado **`setup-desktop.bat`**.
4. Hazle **doble clic** para ejecutarlo.
5. El instalador abrirá una pantalla negra e iniciará la preparación:
   - Evaluará que tengas Node.js instalado.
   - Instalará todas las dependencias del sistema de manera interna.
   - Compilará todo el código para que sea rápido y liviano.
   - Generará el archivo ejecutable autoinstalable.
6. Al finalizar, se abrirá automáticamente la carpeta **`dist-desktop`**.
7. ¡Listo! Solo haz doble clic sobre el archivo de instalación creados (ej. `CONDOBill Setup 1.0.0.exe`) para instalarlo localmente en tu computadora. Se creará un acceso directo en tu escritorio.

### 🍎 En Computadoras con macOS o Linux
1. Descarga y extrae el archivo ZIP de la aplicación en tu Mac o equipo Linux.
2. Abre la aplicación **Terminal** e ingresa a la carpeta del proyecto (escribiendo `cd ` y arrastrando la carpeta de la app a la terminal).
3. Concede permisos al script de instalación escribiendo el siguiente comando en la terminal:
   ```bash
   chmod +x setup-desktop.sh
   ```
4. Ejecuta el script escribiendo:
   ```bash
   ./setup-desktop.sh
   ```
5. El script se encargará de configurar e instalar todo automáticamente. Al finalizar, abrirá la carpeta **`dist-desktop`** donde tendrás el archivo **`.dmg`** de instalación para Mac. Arrástralo a tu carpeta de Aplicaciones y listo.

---

## 🛠️ Método Manual (Paso a Paso por Consola)

Si prefieres realizar el proceso de instalación manualmente paso a paso mediante tu terminal, sigue este procedimiento:

1. **Instalar los componentes internos:**
   Abre una terminal o consola de comandos en la carpeta de tu aplicación y escribe el siguiente comando para descargar los módulos:
   ```bash
   npm install
   ```

2. **Compilar el código del programa:**
   Genera la versión optimizada de la calculadora de gas y facturación corriendo:
   ```bash
   npm run build
   ```

3. **Probar la Aplicación en Modo Desarrollador (Opcional):**
   Si quieres probar el programa embebido en una ventana de escritorio antes de generar el instalador portátil final, ejecuta:
   ```bash
   npm run electron:start
   ```

4. **Crear el Instalador Definitivo para toda la vida:**
   Empaqueta la aplicación de forma encriptada y optimizada en un instalador portable:
   ```bash
   npm run electron:dist
   ```
   **Resultado:** Revisa la nueva carpeta llamada `dist-desktop/` donde se guardará tu instalador `.exe` (para Windows) o `.dmg` (para Mac).

---

## 💾 Notas de Almacenamiento y Seguridad (Sincronización Offline)
- **Base de Datos Local:** El programa utiliza el almacenamiento persistente seguro `localStorage` del dispositivo. Esto significa que todas tus facturas, cotizaciones, registros de mantenimiento y cierres de caja se guardan de forma interna de por vida sin necesidad de contratar servidores extras.
- **Respaldos de Datos:** Para evitar perder información si formateas tu computadora, puedes ir al menú **"Seguridad y Datos"** de la aplicación, dar clic en **Exportar Base de Datos** para guardar tu copia en un archivo, e importarla cuando desees en cualquier otra computadora.

¡Ya está todo listo para que uses **CONDOBill** en tus equipos locales de manera ilimitada y sin depender de Internet! 🚀 Gas, Caja, Reportes y Facturación al instante.
