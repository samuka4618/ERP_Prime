// Teste de configuração SQL Server
const config = {
  server: 'PMCTWDS006',
  database: 'consultas_tess',
  user: 'suporte.ti',
  password: 'Prime@#2010',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  requestTimeout: 30000,
  connectionTimeout: 30000
};

console.log('Configuração SQL Server:');
console.log(JSON.stringify(config, null, 2));
