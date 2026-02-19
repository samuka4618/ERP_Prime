// Script de teste para verificar se o backend está acessível
const http = require('http');
const https = require('https');

const BACKEND_URL = 'http://192.168.14.143:3000';
const API_URL = `${BACKEND_URL}/api`;

console.log('========================================');
console.log('Teste de Conexão com Backend');
console.log('========================================');
console.log('');
console.log('URL do Backend:', BACKEND_URL);
console.log('URL da API:', API_URL);
console.log('');

// Função para testar uma URL
function testUrl(url, description) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    console.log(`Testando: ${description}`);
    console.log(`URL: ${url}`);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Electron-Backend-Test/1.0'
      }
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✓ Status: ${res.statusCode} ${res.statusMessage}`);
        console.log(`✓ Headers:`, res.headers);
        if (data) {
          console.log(`✓ Resposta (primeiros 200 caracteres):`, data.substring(0, 200));
        }
        console.log('');
        resolve({ success: true, statusCode: res.statusCode, data });
      });
    });
    
    req.on('error', (error) => {
      console.log(`✗ Erro: ${error.message}`);
      console.log(`✗ Código: ${error.code}`);
      console.log('');
      resolve({ success: false, error: error.message, code: error.code });
    });
    
    req.on('timeout', () => {
      console.log(`✗ Timeout: A requisição demorou mais de 5 segundos`);
      console.log('');
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    
    req.end();
  });
}

// Função para testar conectividade básica
async function testConnectivity() {
  console.log('1. Testando conectividade básica do servidor...');
  const result1 = await testUrl(BACKEND_URL, 'Backend Base');
  
  console.log('2. Testando endpoint da API...');
  const result2 = await testUrl(API_URL, 'API Base');
  
  console.log('3. Testando endpoint de health check (se existir)...');
  const result3 = await testUrl(`${API_URL}/health`, 'Health Check');
  
  console.log('4. Testando endpoint de autenticação (se existir)...');
  const result4 = await testUrl(`${API_URL}/auth/login`, 'Auth Login (GET)');
  
  console.log('========================================');
  console.log('Resumo dos Testes');
  console.log('========================================');
  console.log('');
  console.log(`Backend Base (${BACKEND_URL}):`, result1.success ? '✓ OK' : '✗ FALHOU');
  if (!result1.success) {
    console.log(`  Erro: ${result1.error || result1.code}`);
  }
  
  console.log(`API Base (${API_URL}):`, result2.success ? '✓ OK' : '✗ FALHOU');
  if (!result2.success) {
    console.log(`  Erro: ${result2.error || result2.code}`);
  }
  
  console.log(`Health Check:`, result3.success ? '✓ OK' : '✗ Não disponível (normal)');
  console.log(`Auth Login:`, result4.success ? '✓ OK' : '✗ Não disponível (normal)');
  console.log('');
  
  if (result1.success || result2.success) {
    console.log('✓ Backend está acessível!');
    console.log('');
    console.log('Próximos passos:');
    console.log('1. Verifique se o backend está rodando na porta 3000');
    console.log('2. Verifique se o firewall permite conexões na porta 3000');
    console.log('3. Verifique se o IP 192.168.14.143 está correto');
  } else {
    console.log('✗ Backend NÃO está acessível!');
    console.log('');
    console.log('Possíveis causas:');
    console.log('1. Backend não está rodando');
    console.log('2. Backend está rodando em outra porta');
    console.log('3. Firewall bloqueando conexões');
    console.log('4. IP incorreto');
    console.log('5. Problemas de rede');
  }
  
  console.log('');
  console.log('========================================');
}

// Executar testes
testConnectivity().catch((error) => {
  console.error('Erro ao executar testes:', error);
  process.exit(1);
});

