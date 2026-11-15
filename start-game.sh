#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Install Node.js from https://nodejs.org first."; exit 1; }
[ -d node_modules ] || npm install --legacy-peer-deps
npm run dev
