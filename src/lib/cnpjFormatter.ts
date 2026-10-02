// Função para formatar CNPJ brasileiro
export const formatCNPJ = (value: string): string => {
  // Remove todos os caracteres que não são números
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 14 dígitos
  const truncated = numbers.substring(0, 14);
  
  // Aplica a formatação (XX.XXX.XXX/XXXX-XX)
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

// Função para validar se o CNPJ é completo e válido de acordo com o algoritmo dos dígitos verificadores
export const isValidCNPJ = (value: string): boolean => {
  const cnpj = unformatCNPJ(value);
  if (cnpj.length !== 14) return false;
  
  // Elimina CNPJs inválidos conhecidos (todos os dígitos iguais)
  if (/^(\d)\1+$/.test(cnpj)) return false;

  // Validação do 1º Dígito Verificador
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  // Validação do 2º Dígito Verificador
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1), 10)) return false;

  return true;
};