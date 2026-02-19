// Adaptador de API para Electron
// Este arquivo será injetado no contexto do renderer para configurar a API

(function() {
  'use strict';
  
  // Verificar se estamos no Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  
  if (!isElectron) {
    console.log('API Adapter: Não está rodando no Electron');
    return;
  }
  
  console.log('API Adapter: Configurando para Electron');
  
  // Obter URL do backend do Electron
  window.electronAPI.getBackendUrl().then(backendUrl => {
    // Configurar variável global com a URL do backend
    window.__ELECTRON_BACKEND_URL__ = backendUrl;
    console.log('API Adapter: Backend URL configurada:', backendUrl);
    
    // Disparar evento customizado para notificar que a URL está pronta
    window.dispatchEvent(new CustomEvent('electron-backend-ready', { 
      detail: { backendUrl } 
    }));
  }).catch(error => {
    console.error('API Adapter: Erro ao obter URL do backend:', error);
    // Fallback para o IP padrão
    window.__ELECTRON_BACKEND_URL__ = 'http://192.168.14.143:3000';
  });
})();

