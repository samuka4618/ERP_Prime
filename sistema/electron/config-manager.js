const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

class ConfigManager {
  constructor() {
    // Caminho do arquivo de configuração
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.config = null;
  }

  // Carregar configuração do arquivo
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(data);
        return this.config;
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
    return null;
  }

  // Salvar configuração no arquivo
  saveConfig(config) {
    try {
      // Garantir que o diretório existe
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      this.config = config;
      return true;
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      return false;
    }
  }

  // Verificar se é a primeira execução
  isFirstRun() {
    const config = this.loadConfig();
    return !config || !config.backendUrl || !config.firstRunCompleted;
  }

  // Obter URL do backend
  getBackendUrl() {
    const config = this.loadConfig();
    return config ? config.backendUrl : null;
  }

  // Solicitar URL do backend ao usuário
  async promptBackendUrl(ipcMain) {
    return new Promise((resolve) => {
      // Criar uma janela temporária para o diálogo
      const { BrowserWindow } = require('electron');
      const isDev = process.argv && process.argv.includes('--dev');
      const promptWindow = new BrowserWindow({
        width: 500,
        height: 320,
        show: false,
        modal: true,
        resizable: false,
        frame: true,
        alwaysOnTop: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      // HTML do diálogo
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Configuração Inicial</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              padding: 30px;
              background: #f5f5f5;
              margin: 0;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              margin: 0 0 20px 0;
              color: #333;
              font-size: 24px;
            }
            p {
              color: #666;
              margin: 0 0 20px 0;
              line-height: 1.5;
            }
            label {
              display: block;
              margin-bottom: 8px;
              color: #333;
              font-weight: 500;
            }
            input {
              width: 100%;
              padding: 10px;
              border: 2px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
              box-sizing: border-box;
              margin-bottom: 20px;
            }
            input:focus {
              outline: none;
              border-color: #4CAF50;
            }
            .button-container {
              display: flex;
              gap: 10px;
              justify-content: flex-end;
            }
            button {
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              font-size: 14px;
              cursor: pointer;
              font-weight: 500;
            }
            .btn-primary {
              background: #4CAF50;
              color: white;
            }
            .btn-primary:hover {
              background: #45a049;
            }
            .btn-secondary {
              background: #e0e0e0;
              color: #333;
            }
            .btn-secondary:hover {
              background: #d0d0d0;
            }
            .error {
              color: #f44336;
              font-size: 12px;
              margin-top: -15px;
              margin-bottom: 15px;
              display: none;
            }
            .error.show {
              display: block;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔧 Configuração Inicial</h1>
            <p>Bem-vindo ao Sistema de Chamados!<br>Por favor, informe a URL base do servidor backend.</p>
            <label for="backendUrl">URL do Backend (sem /api):</label>
            <input 
              type="text" 
              id="backendUrl" 
              placeholder="http://192.168.14.143:3000"
              value="http://192.168.14.143:3000"
            />
            <div style="font-size: 11px; color: #888; margin-top: -15px; margin-bottom: 15px;">
              ⓘ Informe apenas a URL base do backend (ex: http://192.168.14.143:3000 ou http://localhost:3000)<br>
              O sistema adicionará /api automaticamente.
            </div>
            <div class="error" id="error">Por favor, informe uma URL válida (ex: http://192.168.14.143:3000)</div>
            <div class="button-container">
              <button class="btn-secondary" onclick="cancel()">Cancelar</button>
              <button class="btn-primary" onclick="save()">Salvar</button>
            </div>
          </div>
          <script>
            var ipcRenderer = null;
            try {
              var electron = require('electron');
              ipcRenderer = electron.ipcRenderer;
            } catch (e) {
              console.error('Erro ao carregar electron:', e);
            }
            
            function validateUrl(url) {
              try {
                var urlObj = new URL(url);
                var protocol = urlObj.protocol;
                var pathname = urlObj.pathname;
                
                if (protocol !== 'http:' && protocol !== 'https:') {
                  return false;
                }
                
                if (pathname === '/api' || pathname.indexOf('/api/') === 0) {
                  return false;
                }
                
                return true;
              } catch (e) {
                return false;
              }
            }
            
            function save() {
              try {
                console.log('Função save chamada');
                var input = document.getElementById('backendUrl');
                if (!input) {
                  console.error('Input não encontrado');
                  alert('Erro: Campo de URL não encontrado.');
                  return;
                }
                
                var url = input.value.trim();
                var error = document.getElementById('error');
                
                console.log('URL digitada:', url);
                
                url = url.replace(/\/api\/?$/, '');
                
                if (!url || !validateUrl(url)) {
                  console.log('URL inválida');
                  if (error) {
                    error.textContent = 'Por favor, informe uma URL válida sem /api (ex: http://192.168.14.143:3000)';
                    error.classList.add('show');
                  }
                  return;
                }
                
                console.log('URL válida, enviando:', url);
                
                if (error) {
                  error.classList.remove('show');
                }
                
                if (!ipcRenderer || typeof ipcRenderer.send !== 'function') {
                  console.error('ipcRenderer.send não disponível');
                  alert('Erro: Não foi possível comunicar com o processo principal. Por favor, reinicie o aplicativo.');
                  return;
                }
                
                try {
                  ipcRenderer.send('backend-url-saved', url);
                  console.log('Mensagem IPC enviada com sucesso');
                } catch (e) {
                  console.error('Erro ao enviar mensagem IPC:', e);
                  alert('Erro ao salvar configuração: ' + e.message);
                }
              } catch (e) {
                console.error('Erro na função save:', e);
                alert('Erro ao salvar: ' + e.message);
              }
            }
            
            function cancel() {
              try {
                console.log('Função cancel chamada');
                if (!ipcRenderer || typeof ipcRenderer.send !== 'function') {
                  console.error('ipcRenderer.send não disponível');
                  alert('Erro: Não foi possível comunicar com o processo principal.');
                  return;
                }
                ipcRenderer.send('backend-url-cancelled');
                console.log('Mensagem IPC cancel enviada');
              } catch (e) {
                console.error('Erro na função cancel:', e);
                alert('Erro ao cancelar: ' + e.message);
              }
            }
            
            window.save = save;
            window.cancel = cancel;
            
            document.addEventListener('DOMContentLoaded', function() {
              var input = document.getElementById('backendUrl');
              
              if (input) {
                input.addEventListener('keypress', function(e) {
                  if (e.key === 'Enter') {
                    save();
                  }
                });
                
                setTimeout(function() {
                  input.focus();
                  input.select();
                }, 100);
              } else {
                console.error('Input não encontrado na inicialização');
              }
            });
            
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                var input = document.getElementById('backendUrl');
                if (input) {
                  setTimeout(function() {
                    input.focus();
                    input.select();
                  }, 100);
                }
              });
            } else {
              var input = document.getElementById('backendUrl');
              if (input) {
                setTimeout(function() {
                  input.focus();
                  input.select();
                }, 100);
              }
            }
          </script>
        </body>
        </html>
      `;

      // Definir handlers ANTES de criar/carregar a janela
      const saveHandler = (event, url) => {
        console.log('saveHandler recebido com URL:', url);
        ipcMain.removeListener('backend-url-saved', saveHandler);
        ipcMain.removeListener('backend-url-cancelled', cancelHandler);
        if (!promptWindow.isDestroyed()) {
          promptWindow.close();
        }
        resolve(url);
      };

      const cancelHandler = () => {
        console.log('cancelHandler recebido');
        ipcMain.removeListener('backend-url-saved', saveHandler);
        ipcMain.removeListener('backend-url-cancelled', cancelHandler);
        if (!promptWindow.isDestroyed()) {
          promptWindow.close();
        }
        resolve(null);
      };

      // Registrar handlers IPC ANTES de carregar a página
      console.log('Registrando handlers IPC para configuração');
      ipcMain.once('backend-url-saved', saveHandler);
      ipcMain.once('backend-url-cancelled', cancelHandler);
      console.log('Handlers IPC registrados com sucesso');

      promptWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      
      // Abrir DevTools em desenvolvimento para debug
      if (isDev) {
        promptWindow.webContents.openDevTools();
      }
      
      promptWindow.show();
      promptWindow.focus();
      
      // Log quando a página carregar
      promptWindow.webContents.on('did-finish-load', () => {
        console.log('Janela de configuração carregada');
      });
      
      // Log de erros
      promptWindow.webContents.on('console-message', (event, level, message) => {
        console.log(`[Config Window ${level}]:`, message);
      });
      
      // Log de erros JavaScript
      promptWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Erro ao carregar janela de configuração:', errorCode, errorDescription);
      });

      // Fechar a janela quando fechada pelo usuário
      promptWindow.on('closed', () => {
        ipcMain.removeListener('backend-url-saved', saveHandler);
        ipcMain.removeListener('backend-url-cancelled', cancelHandler);
        resolve(null);
      });
    });
  }

  // Inicializar configuração (FIXO - sem perguntar)
  async initialize(ipcMain) {
    // FIXO: Usar sempre o endereço fixo sem perguntar
    const fixedBackendUrl = 'http://192.168.14.143:3000';
    console.log('Usando backend fixo (sem perguntar):', fixedBackendUrl);
    
    // Salvar configuração automaticamente
    const config = {
      backendUrl: fixedBackendUrl,
      firstRunCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.saveConfig(config);
    return fixedBackendUrl;
  }

  // Atualizar URL do backend
  updateBackendUrl(url) {
    const config = this.loadConfig() || {};
    config.backendUrl = url;
    config.updatedAt = new Date().toISOString();
    return this.saveConfig(config);
  }

  // Resetar configuração (deletar arquivo)
  resetConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
        this.config = null;
        return true;
      }
      return true; // Já não existe, considerado sucesso
    } catch (error) {
      console.error('Erro ao resetar configuração:', error);
      return false;
    }
  }

  // Forçar reconfiguração (marcar como não completada)
  forceReconfigure() {
    try {
      const config = this.loadConfig() || {};
      config.firstRunCompleted = false;
      return this.saveConfig(config);
    } catch (error) {
      console.error('Erro ao forçar reconfiguração:', error);
      return false;
    }
  }
}

module.exports = ConfigManager;

