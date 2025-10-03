import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Building2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { translateErrorMessage } from "@/lib/errorMessages";
import { formatPhoneNumber, unformatPhoneNumber } from "@/lib/phoneFormatter";
import { useViaCEP } from "@/hooks/useViaCEP";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fetchAddress, formatCEP, isLoading: isFetchingCEP } = useViaCEP();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Redirecionando para o dashboard...",
        });
      } else if (mode === 'register') {
        // Verificar se as senhas coincidem
        if (password !== confirmPassword) {
          throw new Error('As senhas não coincidem');
        }
        
        // Verificar se a senha tem pelo menos 6 caracteres
        if (password.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres');
        }
        
        // Build full address
        const addressParts = [];
        if (logradouro) {
          let streetAddress = logradouro;
          if (numero) streetAddress += `, ${numero}`;
          addressParts.push(streetAddress);
        }
        if (bairro) addressParts.push(bairro);
        if (cidade && estado) addressParts.push(`${cidade} - ${estado}`);
        if (cep) addressParts.push(`CEP: ${cep}`);
        
        const fullAddress = addressParts.join(" | ");
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              first_name: firstName,
              last_name: lastName,
              phone: unformatPhoneNumber(phone),
              address: fullAddress
            }
          }
        });
        
        if (error) throw error;
        
        toast({
          title: "Conta criada com sucesso!",
          description: "Verifique seu e-mail para confirmar a conta.",
        });
        setMode('login');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/dashboard`
        });
        
        if (error) throw error;
        
        toast({
          title: "E-mail enviado!",
          description: "Verifique sua caixa de entrada para redefinir a senha.",
        });
        setMode('login');
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value);
    setCep(formatted);
    
    // Only fetch if CEP is complete
    if (formatted.length === 9) {
      const address = await fetchAddress(formatted);
      if (address) {
        setLogradouro(address.logradouro);
        setBairro(address.bairro);
        setCidade(address.localidade);
        setEstado(address.uf);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciador de Contas</h1>
          <p className="text-muted-foreground mt-2">Acesse sua conta para continuar</p>
        </div>

        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-semibold">
              {mode === 'login' && 'Entrar'}
              {mode === 'register' && 'Criar Conta'}
              {mode === 'forgot' && 'Recuperar Senha'}
            </CardTitle>
            <CardDescription>
              {mode === 'login' && 'Digite seu e-mail e senha para acessar o sistema'}
              {mode === 'register' && 'Preencha os dados para criar sua conta'}
              {mode === 'forgot' && 'Digite seu e-mail para recuperar a senha'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nome</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Seu nome"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Sobrenome</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Seu sobrenome"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Celular</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                    />
                  </div>

                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Endereço</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        placeholder="00000-000"
                        value={cep}
                        onChange={(e) => handleCEPChange(e.target.value)}
                        maxLength={9}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="logradouro">Rua</Label>
                        <Input
                          id="logradouro"
                          placeholder="Nome da rua"
                          value={logradouro}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="numero">Número</Label>
                        <Input
                          id="numero"
                          placeholder="Nº"
                          value={numero}
                          onChange={(e) => setNumero(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bairro">Bairro</Label>
                      <Input
                        id="bairro"
                        placeholder="Bairro"
                        value={bairro}
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="cidade">Cidade</Label>
                        <Input
                          id="cidade"
                          placeholder="Cidade"
                          value={cidade}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="estado">Estado</Label>
                        <Input
                          id="estado"
                          placeholder="UF"
                          value={estado}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              {mode !== 'forgot' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={mode === 'register' ? "Crie uma senha (mín. 6 caracteres)" : "Digite sua senha"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        minLength={mode === 'register' ? 6 : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {mode === 'register' && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Digite a senha novamente"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {password && confirmPassword && password !== confirmPassword && (
                        <p className="text-sm text-destructive">As senhas não coincidem</p>
                      )}
                    </div>
                  )}
                </>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover"
                disabled={isLoading || isFetchingCEP}
              >
                {isLoading ? (
                  mode === 'login' ? "Entrando..." : 
                  mode === 'register' ? "Criando conta..." : "Enviando..."
                ) : (
                  mode === 'login' ? "Entrar" :
                  mode === 'register' ? "Criar Conta" : "Recuperar Senha"
                )}
              </Button>
            </form>

            {mode === 'login' && (
              <>
                <div className="text-center">
                  <button 
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <Separator className="my-4" />

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Não tem uma conta?
                  </p>
                  <Button 
                    type="button"
                    variant="outline" 
                    className="w-full"
                    onClick={() => setMode('register')}
                  >
                    Criar nova conta
                  </Button>
                </div>
              </>
            )}

            {(mode === 'register' || mode === 'forgot') && (
              <div className="text-center">
                <button 
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm text-primary hover:text-primary-hover transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-xs text-muted-foreground">
          Sistema seguro e confiável para gestão financeira
        </div>
      </div>
    </div>
  );
};

export default Login;