import React, { useState, useEffect } from 'react';
import { logger, LogLevel, LogEntry } from '../utils/logger';
import { X, Download, Trash2, Filter, Eye, EyeOff } from 'lucide-react';

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLogs(logger.getLogs());
    }
  }, [isOpen]);

  useEffect(() => {
    let filtered = logs;

    // Filtrar por nível
    if (selectedLevel !== 'ALL') {
      filtered = filtered.filter(log => log.level === selectedLevel);
    }

    // Filtrar por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.context?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.data).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [logs, selectedLevel, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setLogs(logger.getLogs());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const getLevelColor = (level: LogLevel): string => {
    const colors = {
      [LogLevel.DEBUG]: 'text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/40',
      [LogLevel.INFO]: 'text-cyan-600 bg-cyan-100 dark:text-cyan-300 dark:bg-cyan-900/40',
      [LogLevel.WARN]: 'text-yellow-600 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/40',
      [LogLevel.ERROR]: 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/40'
    };
    return colors[level] || 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-700';
  };

  const getLevelName = (level: LogLevel): string => {
    return LogLevel[level];
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleDownload = () => {
    logger.downloadLogs();
  };

  const handleClear = () => {
    logger.clearLogs();
    setLogs([]);
    setFilteredLogs([]);
  };

  const scrollToBottom = () => {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  };

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [filteredLogs, autoScroll]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 dark:bg-opacity-60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Log Viewer
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-2 rounded-md ${
                autoScroll 
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
              title={autoScroll ? 'Auto-scroll ativado' : 'Auto-scroll desativado'}
            >
              {autoScroll ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800/50"
              title="Download dos logs"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              className="p-2 bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50"
              title="Limpar logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as LogLevel | 'ALL')}
                className="input px-3 py-1 text-sm"
              >
                <option value="ALL">Todos os níveis</option>
                <option value={LogLevel.DEBUG}>Debug</option>
                <option value={LogLevel.INFO}>Info</option>
                <option value={LogLevel.WARN}>Warn</option>
                <option value={LogLevel.ERROR}>Error</option>
              </select>
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar nos logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full text-sm"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {filteredLogs.length} de {logs.length} logs
            </div>
          </div>
        </div>

        {/* Logs */}
        <div
          id="log-container"
          className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-white dark:bg-gray-800"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              Nenhum log encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-md p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(log.level)}`}
                      >
                        {getLevelName(log.level)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatTimestamp(log.timestamp)}</span>
                        <span>•</span>
                        <span>{log.context}</span>
                        {log.userId && (
                          <>
                            <span>•</span>
                            <span>User: {log.userId}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1 text-gray-900 dark:text-white">
                        {log.message}
                      </div>
                      {log.data && (
                        <div className="mt-2">
                          <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.stack && (
                        <div className="mt-2">
                          <pre className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-x-auto">
                            {log.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
