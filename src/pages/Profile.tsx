import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, User, Edit, Key, Lock, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { translateErrorMessage } from "@/lib/errorMessages";
import { formatPhoneNumber, unformatPhoneNumber } from "@/lib/phoneFormatter";
import { useViaCEP } from "@/hooks/useViaCEP";

const Profile = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: ""
  });
  const [addressData, setAddressData] = useState({
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: ""
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fetchAddress, formatCEP, isLoading: isCEPLoading } = useViaCEP();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/");
        return;
      }

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      setProfile({
        first_name: profileData?.first_name || "",
        last_name: profileData?.last_name || "",
        phone: profileData?.phone ? formatPhoneNumber(profileData.phone) : "",
        email: user.email || ""
      });

      // Parse address from profileData if exists
      if (profileData?.address) {
        // Format: "Rua Atílio Fanchelli, 58 | Jardim Ohara | Marília - SP | CEP: 17506-430"
        const addressParts = profileData.address.split(' | ');
        const parsedAddress: any = {
          cep: "",
          logradouro: "",
          numero: "",
          bairro: "",
          cidade: "",
          estado: ""
        };

        if (addressParts.length >= 4) {
          // Parse street and number (first part)
          const streetAndNumber = addressParts[0].split(', ');
          parsedAddress.logradouro = streetAndNumber[0] || "";
          parsedAddress.numero = streetAndNumber[1] || "";
          
          // Parse neighborhood (second part)
          parsedAddress.bairro = addressParts[1] || "";
          
          // Parse city and state (third part)
          const cityState = addressParts[2].split(' - ');
          parsedAddress.cidade = cityState[0] || "";
          parsedAddress.estado = cityState[1] || "";
          
          // Parse CEP (fourth part)
          parsedAddress.cep = addressParts[3]?.replace('CEP: ', '') || "";
        }

        setAddressData(parsedAddress);
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Build address string in the format: "Rua, Número | Bairro | Cidade - Estado | CEP: XXXXX-XXX"
      const streetPart = addressData.logradouro && addressData.numero 
        ? `${addressData.logradouro}, ${addressData.numero}` 
        : addressData.logradouro || "";
      const cityStatePart = addressData.cidade && addressData.estado
        ? `${addressData.cidade} - ${addressData.estado}`
        : addressData.cidade || addressData.estado || "";
      const cepPart = addressData.cep ? `CEP: ${addressData.cep}` : "";
      
      const addressParts = [streetPart, addressData.bairro, cityStatePart, cepPart].filter(part => part);
      const fullAddress = addressParts.join(' | ');

      // Atualizar o perfil com endereço
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: unformatPhoneNumber(profile.phone),
          address: fullAddress
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!",
      });
      
      setIsEditing(false);
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Verificar se as novas senhas coincidem
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error('As novas senhas não coincidem');
      }

      // Verificar se a nova senha tem pelo menos 6 caracteres
      if (passwordData.newPassword.length < 6) {
        throw new Error('A nova senha deve ter pelo menos 6 caracteres');
      }

      // Atualizar a senha
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso!",
      });
      
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'phone') {
      // Aplica formatação de telefone
      const formatted = formatPhoneNumber(value);
      setProfile(prev => ({ ...prev, [field]: formatted }));
    } else {
      setProfile(prev => ({ ...prev, [field]: value }));
    }
  };

  const handlePasswordInputChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value);
    setAddressData(prev => ({ ...prev, cep: formatted }));

    if (formatted.replace(/\D/g, '').length === 8) {
      const address = await fetchAddress(formatted);
      if (address) {
        setAddressData(prev => ({
          ...prev,
          logradouro: address.logradouro,
          bairro: address.bairro,
          cidade: address.localidade,
          estado: address.uf
        }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Voltar</span>
              </Button>
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Perfil do Usuário</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie suas informações pessoais
                </p>
              </div>
            </div>
            
            {!isEditing && !isChangingPassword && (
              <div className="flex space-x-2">
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar Perfil
                </Button>
                <Button variant="outline" onClick={() => setIsChangingPassword(true)}>
                  <Key className="w-4 h-4 mr-2" />
                  Alterar Senha
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Informações Pessoais */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>
                {isEditing 
                  ? "Edite suas informações pessoais abaixo" 
                  : "Visualize suas informações pessoais"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">Nome</Label>
                    <Input
                      id="first_name"
                      value={profile.first_name}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                      disabled={!isEditing}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="last_name">Sobrenome</Label>
                    <Input
                      id="last_name"
                      value={profile.last_name}
                      onChange={(e) => handleInputChange("last_name", e.target.value)}
                      disabled={!isEditing}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    O e-mail não pode ser alterado
                  </p>
                </div>

                <div>
                  <Label htmlFor="phone">Celular</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={profile.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>

                {/* Address Section */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-medium">Endereço</h3>
                  
                  <div>
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      placeholder="00000-000"
                      value={addressData.cep}
                      onChange={(e) => handleCEPChange(e.target.value)}
                      disabled={!isEditing || isCEPLoading}
                      maxLength={9}
                    />
                  </div>

                  <div>
                    <Label htmlFor="logradouro">Rua</Label>
                    <Input
                      id="logradouro"
                      value={addressData.logradouro}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div>
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      placeholder="123"
                      value={addressData.numero}
                      onChange={(e) => setAddressData(prev => ({ ...prev, numero: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>

                  <div>
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={addressData.bairro}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={addressData.cidade}
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    <div>
                      <Label htmlFor="estado">Estado</Label>
                      <Input
                        id="estado"
                        value={addressData.estado}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex justify-end space-x-4 pt-6">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsEditing(false);
                        fetchProfile(); // Reset form
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      <Save className="w-4 h-4 mr-2" />
                      {isLoading ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Alterar Senha */}
          {isChangingPassword && (
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Digite sua nova senha abaixo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-6">
                  <div>
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Digite a nova senha (mín. 6 caracteres)"
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordInputChange("newPassword", e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Digite a nova senha novamente"
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordInputChange("confirmPassword", e.target.value)}
                      required
                    />
                    {passwordData.newPassword && passwordData.confirmPassword && 
                     passwordData.newPassword !== passwordData.confirmPassword && (
                      <p className="text-sm text-destructive mt-1">As senhas não coincidem</p>
                    )}
                  </div>

                  <div className="flex justify-end space-x-4 pt-6">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: ""
                        });
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isLoading || passwordData.newPassword !== passwordData.confirmPassword}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      {isLoading ? "Alterando..." : "Alterar Senha"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;