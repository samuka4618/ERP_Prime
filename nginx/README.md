# Configuração Nginx - ERP PRIME

Este diretório contém o arquivo de configuração do Nginx para usar o ERP PRIME atrás de um proxy reverso.

## Uso rápido

- **Linux (Debian/Ubuntu):** copie para `/etc/nginx/sites-available/` e ative (veja README principal).
- **Windows:** use `nginx -c "C:\caminho\do\projeto\nginx\erp-prime-standalone.conf"` se tiver um config autocontido, ou instale e inclua este arquivo na configuração do Nginx.

O aplicativo Node deve estar rodando na **porta 3000** (ou na porta definida em `PORT` no `.env`). Se usar outra porta, edite `proxy_pass` neste arquivo.
