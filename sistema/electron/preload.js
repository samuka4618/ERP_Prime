const { contextBridge, ipcRenderer } = require('electron');

// Expor APIs seguras para o processo de renderização
contextBridge.exposeInMainWorld('electronAPI', {
  // Obter URL do backend
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  
  // Atualizar URL do backend
  updateBackendUrl: (url) => ipcRenderer.invoke('update-backend-url', url),
  
  // Obter configuração
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  // Resetar configuração
  resetConfig: () => ipcRenderer.invoke('reset-config'),
  
  // Forçar reconfiguração
  forceReconfigure: () => ipcRenderer.invoke('force-reconfigure'),
  
  // Obter versão do app
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Mostrar caixa de diálogo
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // Informações da plataforma
  platform: process.platform,
  
  // Versões
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
});

// Log para debug
console.log('Preload script carregado');

