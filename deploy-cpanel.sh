#!/bin/bash
# =============================================================
# SocialConnect — Deploy para cPanel
# Gera um ficheiro ZIP pronto para fazer upload
# =============================================================

set -e

echo "🔨 A fazer build do frontend..."
cd frontend && npm run build && cd ..

echo "🔨 A fazer build do backend..."
cd backend && npm run build && cd ..

echo "📦 A criar pacote para upload..."

# Nome do ficheiro final
ZIP_FILE="socialconnect-deploy.zip"

# Apagar zip anterior se existir
rm -f "$ZIP_FILE"

# Criar zip com apenas o necessário
zip -r "$ZIP_FILE" \
  app.js \
  backend/dist/ \
  backend/package.json \
  backend/package-lock.json \
  frontend/dist/ \
  -x "*.DS_Store" "*.log"

echo ""
echo "✅ Pronto! Ficheiro criado: $ZIP_FILE"
echo ""
echo "📋 PRÓXIMOS PASSOS NO CPANEL:"
echo "   1. File Manager → faz upload de '$ZIP_FILE' para a pasta da app"
echo "   2. Extrai o ZIP na pasta raiz da app"
echo "   3. Setup Node.js App:"
echo "      - Node.js version: 18 ou superior"
echo "      - Application root: /home/UTILIZADOR/PASTA_APP"
echo "      - Application startup file: app.js"
echo "   4. Environment Variables (adicionar no cPanel):"
echo "      NODE_ENV=production"
echo "      ANTHROPIC_API_KEY=<a tua key>"
echo "      PORT=(deixa vazio — cPanel define automaticamente)"
echo "   5. Clica em 'Run NPM Install' no painel Node.js"
echo "   6. Start Application"
echo ""
