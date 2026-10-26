#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then echo "Necesitas instalar Node.js desde https://nodejs.org"; read -p "Enter para cerrar"; exit 1; fi
node server.js
