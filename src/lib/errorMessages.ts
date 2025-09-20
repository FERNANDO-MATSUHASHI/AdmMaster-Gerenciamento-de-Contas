// Utility for translating error messages to Portuguese
export function translateErrorMessage(error: any): string {
  if (!error) return "Ocorreu um erro inesperado";
  
  const message = error.message || error.toString();
  
  // Common Supabase authentication errors
  if (message.includes("Invalid login credentials")) {
    return "Credenciais de login inválidas. Verifique seu e-mail e senha.";
  }
  
  if (message.includes("Email not confirmed")) {
    return "E-mail não confirmado. Verifique sua caixa de entrada.";
  }
  
  if (message.includes("User already registered")) {
    return "Usuário já cadastrado com este e-mail.";
  }
  
  if (message.includes("Password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  
  if (message.includes("Invalid email")) {
    return "E-mail inválido. Verifique o formato do e-mail.";
  }
  
  if (message.includes("Network request failed") || message.includes("fetch")) {
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  }
  
  if (message.includes("User not authenticated")) {
    return "Usuário não autenticado. Faça login novamente.";
  }
  
  // Database errors
  if (message.includes("duplicate key value")) {
    return "Este registro já existe.";
  }
  
  if (message.includes("foreign key constraint")) {
    return "Não é possível excluir este item pois está sendo usado.";
  }
  
  if (message.includes("permission denied") || message.includes("insufficient_privilege")) {
    return "Você não tem permissão para realizar esta ação.";
  }
  
  // Generic database error
  if (message.includes("null value in column")) {
    return "Todos os campos obrigatórios devem ser preenchidos.";
  }
  
  // Rate limiting errors
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  
  // Default fallback for unknown errors
  return "Ocorreu um erro inesperado. Tente novamente.";
}