import React from 'react';

export interface AccessibleCheckboxProps {
  /** Id do input (obrigatório para acessibilidade) */
  id: string;
  /** Texto ou conteúdo do label (associado ao input via htmlFor) */
  label: React.ReactNode;
  /** Estado marcado/desmarcado */
  checked: boolean;
  /** Callback ao alterar */
  onChange: (checked: boolean) => void;
  /** Desabilitado */
  disabled?: boolean;
  /** Classes adicionais no container (label) */
  className?: string;
  /** Classes no input */
  inputClassName?: string;
}

/**
 * Checkbox acessível: label associado ao input (htmlFor + id), área clicável no label.
 */
const AccessibleCheckbox: React.FC<AccessibleCheckboxProps> = ({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  className = '',
  inputClassName = ''
}) => (
  <label
    htmlFor={id}
    className={`flex items-center gap-3 cursor-pointer py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
  >
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className={`w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 flex-shrink-0 ${inputClassName}`}
    />
    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
  </label>
);

export default AccessibleCheckbox;
