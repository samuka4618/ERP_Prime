# Configuração Nginx - ERP PRIME

Este diretório contém o arquivo de configuração do Nginx para usar o ERP PRIME atrás de um proxy reverso.

## Uso rápido

- **Linux (Debian/Ubuntu):** copie para `/etc/nginx/sites-available/` e ative (veja README principal).
- **Windows:** use `nginx -c "C:\caminho\do\projeto\nginx\nginx-standalone.conf"` ou, com HTTPS, o script `npm start` escolhe automaticamente o config com HTTPS se o certificado existir.

O aplicativo Node deve estar rodando na **porta 3000** (ou na porta definida em `PORT` no `.env`). Se usar outra porta, edite `proxy_pass` neste arquivo.

## HTTPS (https://erp.empresa.local)

1. Gere o certificado autoassinado e o arquivo `ssl-cert.conf`:
   ```bash
   npm run generate:ssl-cert
   ```
2. **Windows:** ao dar `npm start`, o Nginx usará `nginx-standalone-https.conf` automaticamente (porta 80 + 443).
3. **Linux:** copie `nginx/ssl-cert.conf` para `/etc/nginx/` e `nginx/erp-prime-https.conf` para `/etc/nginx/sites-available/`, ative o site e recarregue o Nginx.
4. Em cada PC, adicione no arquivo **hosts**: `<IP_DO_SERVIDOR>    erp.empresa.local`
5. Acesse **https://erp.empresa.local** e aceite o aviso do navegador uma vez.
