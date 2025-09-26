// Função para formatar CNPJ brasileiro
export const formatCNPJ = (value: string): string => {
  // Remove todos os caracteres que não são números
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 14 dígitos
  const truncated = numbers.substring(0, 14);
  
  // Aplica a formatação
  if (truncated.length === 0) return '';
  if (truncated.length <= 2) return truncated;
  if (truncated.length <= 5) return `${truncated.substring(0, 2)}.${truncated.substring(2)}`;
  if (truncated.length <= 8) return `${truncated.substring(0, 2)}.${truncated.substring(2, 5)}.${truncated.substring(5)}`;
  if (truncated.length <= 12) return `${truncated.substring(0, 2)}.${truncated.substring(2, 5)}.${truncated.substring(5, 8)}/${truncated.substring(8)}`;
  return `${truncated.substring(0, 2)}.${truncated.substring(2, 5)}.${truncated.substring(5, 8)}/${truncated.substring(8, 12)}-${truncated.substring(12)}`;
};

// Função para remover formatação e retornar apenas números
export const unformatCNPJ = (value: string): string => {
  return value.replace(/\D/g, '');
};

// Função para validar se o CNPJ está completo
export const isValidCNPJ = (value: string): boolean => {
  const numbers = unformatCNPJ(value);
  return numbers.length === 14;
};