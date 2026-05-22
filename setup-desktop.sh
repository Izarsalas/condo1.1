#!/bin/bash
# Script de Automatización de Compilación para macOS / Linux

# Colores estéticos
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}             BIENVENIDO AL INSTALADOR LOCAL DE CONDOBill            ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo ""
echo "Este asistente preparará su entorno local, descargará los módulos"
echo "necesarios y compilará la aplicación en un paquete instalable"
echo "(formato .dmg para Mac o .AppImage para Linux)."
echo ""
echo -e "${YELLOW}REQUISITO GENERAL PREVIO:${NC}"
echo "- Debe tener Node.js instalado en el sistema."
echo "  Si no lo tiene, descárguelo gratis en: https://nodejs.org"
echo ""

read -p "¿Ya tiene Node.js instalado en esta computadora? (s/n): " prereq
if [[ "$prereq" != "s" && "$prereq" != "S" ]]; then
    echo ""
    echo -e "${RED}[AVISO] Por favor, instale Node.js primero y vuelva a ejecutar este archivo.${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "https://nodejs.org"
    fi
    exit 1
fi

echo ""
echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}   PASO 1: INSTALANDO PAQUETES Y DEPENDENCIAS NECESARIAS             ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo "Descargando módulos necesarios..."
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Ocurrió un error al descargar e instalar las dependencias.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}   PASO 2: COMPILANDO FACTURACIÓN Y CALCULADORA (PRODUCCIÓN)        ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo "Generando código de distribución limpio..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Falló la compilación del código principal de la aplicación.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}   PASO 3: EMPAQUETANDO LA APLICACIÓN DE ESCRITORIO                 ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo "Compilando un empaquetador nativo offline..."
npm run electron:dist

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] No se pudo empaquetar en formato instalable nativo.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}             INSTALACIÓN Y COMPILACIÓN COMPLETADA CON ÉXITO         ${NC}"
echo -e "${GREEN}====================================================================${NC}"
echo ""
echo "Su archivo instalador de escritorio se encuentra listo en la carpeta:"
echo -e "${CYAN}-> Carpeta: $(pwd)/dist-desktop/${NC}"
echo ""
echo "INSTRUCCIONES:"
echo "1. Abra su explorador de archivos en la carpeta 'dist-desktop/'."
echo "2. En macOS, instale el archivo '.dmg' arrastrando a Aplicaciones."
echo "3. En Linux, dele permisos de ejecución al archivo '.AppImage' y ejecútelo."
echo "4. ¡Listo! Ya tiene la aplicación instalada de forma local de por vida."
echo ""
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "dist-desktop/"
fi
