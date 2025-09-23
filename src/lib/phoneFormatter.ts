// Função para formatar telefone brasileiro
export const formatPhoneNumber = (value: string): string => {
  // Remove todos os caracteres que não são números
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 11 dígitos (DDD + 9 dígitos)
  const truncated = numbers.substring(0, 11);
  
  // Aplica a formatação
  if (truncated.length === 0) return '';
  if (truncated.length <= 2) return `(${truncated}`;
  if (truncated.length <= 7) return `(${truncated.substring(0, 2)})${truncated.substring(2)}`;
  return `(${truncated.substring(0, 2)})${truncated.substring(2, 7)}-${truncated.substring(7)}`;
};

// Função para remover formatação e retornar apenas números
export const unformatPhoneNumber = (value: string): string => {
  return value.replace(/\D/g, '');
};

// Função para validar se o telefone está completo
export const isValidPhoneNumber = (value: string): boolean => {
  const numbers = unformatPhoneNumber(value);
  return numbers.length === 10 || numbers.length === 11;
};