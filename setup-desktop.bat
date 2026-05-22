@echo off
title Instalador Local de CONDOBill
color 0B
echo ====================================================================
echo             BIENVENIDO AL INSTALADOR LOCAL DE CONDOBill
echo ====================================================================
echo.
echo Este asistente preparara su entorno local, descargara los modulos
echo necesarios y compilara la aplicacion en un archivo ejecutable (.exe)
echo instalable para cualquier computadora Windows.
echo.
echo PASO CLAVE REQUERIDO ANTES DE CONTINUAR:
echo - Asegurese de descargar e instalar Node.js desde: https://nodejs.org
echo   (Seleccione la version "LTS" recomendada para la mayoria)
echo.
set /p prereq="^> ya ha instalado Node.js en esta computadora? (S/N): "
if /i "%prereq%" neq "S" (
    echo.
    echo Por favor, instale Node.js primero y luego vuelva a ejecutar este archivo.
    echo Abriendo pagina de descargas de Node.js...
    start https://nodejs.org
    pause
    exit
)

echo.
echo ====================================================================
echo   PASO 1: INSTALANDO PAQUETES Y DEPENDENCIAS NECESARIAS
echo ====================================================================
echo Esto puede tardar de 1 a 2 minutos dependiendo de su velocidad de internet.
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema instalando las dependencias.
    echo Asegurese de estar conectado a internet e intente de nuevo.
    pause
    exit
)

echo.
echo ====================================================================
echo   PASO 2: COMPILANDO FACTURACION Y CALCULADORA (PRODUCCION)
echo ====================================================================
echo Generando los archivos HTML, JS y CSS optimizados...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema compilando el codigo principal.
    pause
    exit
)

echo.
echo ====================================================================
echo   PASO 3: EMPAQUETANDO LA APLICACION DE ESCRITORIO (.EXE)
echo ====================================================================
echo Compilando un ejecutable offline robusto y autonomo...
echo Esto puede tomar unos minutos...
echo.
call npm run electron:dist
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudo empaquetar en formato .exe.
    echo Verifique que no tenga programas antivirus bloqueando el proceso.
    pause
    exit
)

echo.
echo ====================================================================
echo             INSTALACION Y COMPILACION COMPLETADA CON EXITO
echo ====================================================================
echo.
echo Se ha creado un archivo ejecutable instalable listo para usar.
echo.
echo RUTA DEL ARCHIVO GENERADO:
echo ^> Carpeta: %~dp0dist-desktop
echo.
echo INSTRUCCIONES:
echo 1. Ingrese a la carpeta "dist-desktop/" que se acaba de abrir/crear.
echo 2. Busque el archivo instalador (ejemplo: "CONDOBill Setup 1.0.0.exe").
echo 3. Hagale doble clic para instalar la aplicacion en su equipo.
echo 4. ¡Listo! Se creara un acceso directo en su escritorio. Unicamente
echo    necesitara abrirlo para empezar a facturar de forma 100%% offline.
echo.
explorer "%~dp0dist-desktop"
pause
