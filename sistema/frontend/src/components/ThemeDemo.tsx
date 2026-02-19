import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

const ThemeDemo: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: SunIcon },
    { value: 'dark', label: 'Escuro', icon: MoonIcon },
  ];

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Configurações de Tema
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Escolha o tema:
          </label>
          <div className="flex space-x-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value as 'light' | 'dark')}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200
                    ${theme === option.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>Tema atual: <span className="font-medium">{theme === 'light' ? 'Claro' : 'Escuro'}</span></p>
          <p className="mt-1">O tema é salvo automaticamente e será aplicado em todas as páginas.</p>
        </div>
      </div>
    </div>
  );
};

export default ThemeDemo;
