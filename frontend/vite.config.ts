import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

// Função para obter o IP local da rede
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  const priorityInterfaces = ['Ethernet', 'Wi-Fi', 'eth0', 'wlan0', 'en0'];
  
  for (const ifaceName of priorityInterfaces) {
    const iface = interfaces[ifaceName];
    if (iface) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
  }
  
  for (const ifaceName in interfaces) {
    const iface = interfaces[ifaceName];
    if (iface) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
  }
  
  return 'localhost';
}

const backendHost = process.env.BACKEND_HOST || getLocalIP();
const backendPort = process.env.BACKEND_PORT || '3004'; // Porta padrão do servidor

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Permitir acesso de outros computadores na rede
    port: 3001,
    https: false,
    proxy: {
      '/api': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/imgCadastros': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true,
        secure: false,
      },
      '/storage': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
