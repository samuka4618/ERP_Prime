const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.argv.includes('--dev');
const ConfigManager = require('./config-manager');

// Gerenciador de configuração
const configManager = new ConfigManager();

// URL do backend (será definida após inicialização)
let BACKEND_URL = process.env.BACKEND_URL || 'http://192.168.14.143:3000';
const FRONTEND_URL = isDev 
  ? 'http://localhost:3001' 
  : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;

let mainWindow;

function createWindow() {
  // Criar a janela do navegador
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Desabilitar para permitir carregar assets locais
      allowRunningInsecureContent: true // Permitir conteúdo local
    },
    icon: path.join(__dirname, 'build/icon.png'),
    show: false, // Não mostrar até estar pronto
    titleBarStyle: 'default',
    backgroundColor: '#ffffff'
  });

  // Injetar script de adaptação da API antes de carregar a página
  mainWindow.webContents.on('did-finish-load', () => {
    // Injetar o adaptador de API
    mainWindow.webContents.executeJavaScript(`
      (function() {
        if (window.electronAPI) {
          window.electronAPI.getBackendUrl().then(url => {
            window.__ELECTRON_BACKEND_URL__ = url;
            console.log('Backend URL configurada:', url);
          });
        }
      })();
    `).catch(err => console.error('Erro ao injetar adaptador:', err));
  });

  // Carregar a aplicação
  if (isDev) {
    // Em desenvolvimento, carregar do servidor Vite
    mainWindow.loadURL(FRONTEND_URL);
    // Abrir DevTools em desenvolvimento
    mainWindow.webContents.openDevTools();
  } else {
    // Em produção, carregar do build estático
    const frontendPath = path.join(__dirname, '../frontend/dist/index.html');
    console.log('Tentando carregar frontend de:', frontendPath);
    console.log('__dirname:', __dirname);
    console.log('Arquivo existe?', fs.existsSync(frontendPath));
    
    // Tentar carregar o arquivo
    if (fs.existsSync(frontendPath)) {
      mainWindow.loadFile(frontendPath);
    } else {
      // Fallback: tentar caminho alternativo (quando empacotado)
      const altPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'app.asar', '../frontend/dist/index.html')
        : path.join(__dirname, '../../frontend/dist/index.html');
      
      console.log('Tentando caminho alternativo:', altPath);
      console.log('app.isPackaged:', app.isPackaged);
      console.log('process.resourcesPath:', process.resourcesPath);
      
      if (fs.existsSync(altPath)) {
        mainWindow.loadFile(altPath);
      } else {
        // Último recurso: mostrar erro
        dialog.showErrorBox('Erro', `Não foi possível encontrar o arquivo do frontend.\n\nTentado:\n${frontendPath}\n${altPath}\n\n__dirname: ${__dirname}\napp.isPackaged: ${app.isPackaged}`);
      }
    }
  }

  // Mostrar janela quando estiver pronta
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Abrir DevTools para debug (mesmo em produção temporariamente)
    if (!isDev) {
      mainWindow.webContents.openDevTools();
    }
    
    // Focar na janela
    if (isDev) {
      mainWindow.focus();
    }
  });
  
  // Log de erros de console
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Console ${level}]:`, message);
  });
  
  // Log de erros de renderização
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
  });
  
  mainWindow.webContents.on('unresponsive', () => {
    console.error('Window unresponsive');
  });
  
  mainWindow.webContents.on('responsive', () => {
    console.log('Window responsive again');
  });

  // Manipular fechamento da janela
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Manipular erros de carregamento
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Erro ao carregar:', errorCode, errorDescription);
    
    if (!isDev) {
      dialog.showErrorBox(
        'Erro ao Carregar',
        `Não foi possível carregar a aplicação.\n\n${errorDescription}\n\nVerifique se o backend está rodando em ${BACKEND_URL}`
      );
    }
  });

  // Log de navegação (útil para debug)
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('Navegou para:', url);
  });
}

// Este método será chamado quando o Electron terminar de inicializar
app.whenReady().then(async () => {
  // FIXO: Usar sempre o endereço fixo sem perguntar
  BACKEND_URL = 'http://192.168.14.143:3000';
  console.log('Backend URL fixa configurada:', BACKEND_URL);
  
  // Salvar configuração automaticamente
  configManager.updateBackendUrl(BACKEND_URL);
  
  createWindow();

  app.on('activate', () => {
    // No macOS, é comum recriar uma janela quando o ícone do dock é clicado
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Sair quando todas as janelas estiverem fechadas, exceto no macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Manipuladores IPC para comunicação com o processo de renderização
ipcMain.handle('get-backend-url', () => {
  return BACKEND_URL;
});

// Handlers para configuração inicial (usados pelo config-manager)
ipcMain.on('backend-url-saved', (event, url) => {
  console.log('Handler backend-url-saved recebido:', url);
  // Este handler será removido e substituído pelo config-manager quando necessário
});

ipcMain.on('backend-url-cancelled', () => {
  console.log('Handler backend-url-cancelled recebido');
  // Este handler será removido e substituído pelo config-manager quando necessário
});

// Handler para atualizar URL do backend
ipcMain.handle('update-backend-url', async (event, url) => {
  if (configManager.updateBackendUrl(url)) {
    BACKEND_URL = url;
    return { success: true, url: BACKEND_URL };
  }
  return { success: false };
});

// Handler para obter configuração
ipcMain.handle('get-config', () => {
  return configManager.loadConfig();
});

// Handler para resetar configuração
ipcMain.handle('reset-config', () => {
  const result = configManager.resetConfig();
  return { success: result };
});

// Handler para forçar reconfiguração
ipcMain.handle('force-reconfigure', async () => {
  configManager.forceReconfigure();
  BACKEND_URL = await configManager.initialize(ipcMain);
  if (!BACKEND_URL) {
    BACKEND_URL = 'http://192.168.14.143:3000';
  }
  return { success: true, backendUrl: BACKEND_URL };
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('Erro não capturado:', error);
  dialog.showErrorBox('Erro', error.message);
});

// Log de informações úteis
console.log('=== Sistema de Chamados - Electron ===');
console.log('Modo:', isDev ? 'Desenvolvimento' : 'Produção');
console.log('Backend URL:', BACKEND_URL);
console.log('Frontend URL:', FRONTEND_URL);
console.log('Plataforma:', process.platform);
console.log('Versão Node:', process.versions.node);
console.log('Versão Electron:', process.versions.electron);

