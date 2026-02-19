// Configuração do aplicativo Electron
module.exports = {
  // URL do backend (pode ser alterada via variável de ambiente)
  backendUrl: process.env.BACKEND_URL || 'http://192.168.14.143:3000',
  
  // Configurações da janela
  window: {
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700
  },
  
  // Configurações de desenvolvimento
  dev: {
    // Abrir DevTools automaticamente em desenvolvimento
    openDevTools: true,
    // URL do servidor de desenvolvimento do Vite
    viteUrl: 'http://localhost:3001'
  }
};

