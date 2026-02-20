#!/bin/bash
# Instala o Nginx (Linux). Execute com: bash scripts/install-nginx.sh
# Pode precisar de sudo para apt/yum/dnf.

set -e

if command -v nginx &> /dev/null; then
  echo "✅ Nginx já está instalado: $(nginx -v 2>&1)"
  exit 0
fi

if [ -f /etc/debian_version ]; then
  sudo apt-get update
  sudo apt-get install -y nginx
  echo "✅ Nginx instalado (Debian/Ubuntu). Para usar o ERP PRIME:"
  echo "   sudo cp nginx/erp-prime.conf /etc/nginx/sites-available/erp-prime"
  echo "   sudo ln -sf /etc/nginx/sites-available/erp-prime /etc/nginx/sites-enabled/"
  echo "   sudo nginx -t && sudo systemctl reload nginx"
elif [ -f /etc/redhat-release ] || [ -f /etc/fedora-release ]; then
  sudo dnf install -y nginx 2>/dev/null || sudo yum install -y nginx
  echo "✅ Nginx instalado (RHEL/Fedora). Configure manualmente o proxy para a porta 3000."
else
  echo "Sistema não reconhecido. Instale o Nginx manualmente e use nginx/erp-prime.conf como referência."
  exit 1
fi
