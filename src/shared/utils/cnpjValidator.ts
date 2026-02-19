/**
 * Validador de CNPJ com dígitos verificadores
 * Suporta formatos: 12345678000190 ou 12.345.678/0001-90
 */

export function validateCNPJ(cnpj: string): boolean {
  // Remover caracteres não numéricos
  const cleaned = cnpj.replace(/[^\d]/g, '');
  
  // Verificar se tem 14 dígitos
  if (cleaned.length !== 14) {
    return false;
  }
  
  // Verificar se todos os dígitos são iguais (CNPJ inválido)
  if (/^(\d)\1{13}$/.test(cleaned)) {
    return false;
  }
  
  // Calcular primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  const firstDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  
  if (parseInt(cleaned[12]) !== firstDigit) {
    return false;
  }
  
  // Calcular segundo dígito verificador
  sum = 0;
  weight = 6;
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  const secondDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  
  if (parseInt(cleaned[13]) !== secondDigit) {
    return false;
  }
  
  return true;
}

export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/[^\d]/g, '');
  
  if (cleaned.length !== 14) {
    throw new Error('CNPJ deve ter 14 dígitos');
  }
  
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

export function isValidCNPJFormat(cnpj: string): boolean {
  // Verificar se está no formato correto (14 dígitos ou formato XX.XXX.XXX/XXXX-XX)
  const digitOnlyPattern = /^\d{14}$/;
  const formattedPattern = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
  
  return digitOnlyPattern.test(cnpj) || formattedPattern.test(cnpj);
}

export function normalizeCNPJ(cnpj: string): string {
  // Se já está limpo (apenas dígitos), retornar como está
  if (/^\d{14}$/.test(cnpj)) {
    return cnpj;
  }
  
  // Se está formatado, limpar e retornar
  if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(cnpj)) {
    return cleanCNPJ(cnpj);
  }
  
  // Se não está em formato válido, tentar limpar e verificar
  const cleaned = cleanCNPJ(cnpj);
  if (cleaned.length === 14) {
    return cleaned;
  }
  
  throw new Error('Formato de CNPJ inválido');
}

export function validateAndFormatCNPJ(cnpj: string): { isValid: boolean; formatted: string; cleaned: string } {
  try {
    const cleaned = normalizeCNPJ(cnpj);
    const isValid = validateCNPJ(cleaned);
    const formatted = isValid ? formatCNPJ(cleaned) : '';
    
    return {
      isValid,
      formatted,
      cleaned
    };
  } catch (error) {
    return {
      isValid: false,
      formatted: '',
      cleaned: ''
    };
  }
}

export function generateCNPJ(): string {
  // Gerar 12 primeiros dígitos aleatórios
  let cnpj = '';
  for (let i = 0; i < 12; i++) {
    cnpj += Math.floor(Math.random() * 10).toString();
  }
  
  // Calcular primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  const firstDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  cnpj += firstDigit.toString();
  
  // Calcular segundo dígito verificador
  sum = 0;
  weight = 6;
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  const secondDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  cnpj += secondDigit.toString();
  
  return cnpj;
}

export function maskCNPJ(value: string): string {
  // Remover caracteres não numéricos
  const cleaned = value.replace(/[^\d]/g, '');
  
  // Aplicar máscara conforme o usuário digita
  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 5) {
    return cleaned.replace(/^(\d{2})(\d+)/, '$1.$2');
  } else if (cleaned.length <= 8) {
    return cleaned.replace(/^(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  } else if (cleaned.length <= 12) {
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
  } else {
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
  }
}

export function unmaskCNPJ(value: string): string {
  return value.replace(/[^\d]/g, '');
}

// Exemplos de uso:
// validateCNPJ('12345678000190') // true
// validateCNPJ('12.345.678/0001-90') // true
// formatCNPJ('12345678000190') // '12.345.678/0001-90'
// cleanCNPJ('12.345.678/0001-90') // '12345678000190'
