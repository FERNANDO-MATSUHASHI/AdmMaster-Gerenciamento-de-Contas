import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Receipt, Save, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { translateErrorMessage } from "@/lib/errorMessages";

const BillForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Array<{id: string, name: string}>>([]);
  const [banks, setBanks] = useState<Array<{id: string, name: string}>>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    descricao: "",
    valor: "",
    fornecedor: "",
    dataEntrada: new Date(),
    dataVencimento: new Date(),
    paymentType: "conta",
    numeroCheque: "",
    banco: "",
    titularConta: "",
    numeroConta: "",
    nomeConta: ""
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState({
    entrada: false,
    vencimento: false
  });

  // Load suppliers and banks from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load suppliers
        const { data: suppliersData, error: suppliersError } = await supabase
          .from('suppliers')
          .select('id, name')
          .order('name');
        
        if (suppliersError) {
          console.error('Error loading suppliers:', suppliersError);
        } else {
          setSuppliers(suppliersData || []);
        }

        // Load banks
        const { data: banksData, error: banksError } = await supabase
          .from('banks')
          .select('id, name')
          .order('name');
        
        if (banksError) {
          console.error('Error loading banks:', banksError);
        } else {
          setBanks(banksData || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para salvar uma conta",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      // Save bill to database
      const { data, error } = await supabase
        .from('bills')
        .insert({
          user_id: user.id,
          description: formData.descricao,
          amount: parseFloat(formData.valor),
          supplier_id: formData.fornecedor || null,
          due_date: format(formData.dataVencimento, 'yyyy-MM-dd'),
          entry_date: format(formData.dataEntrada, 'yyyy-MM-dd'),
          payment_type: formData.paymentType,
          check_number: formData.paymentType === 'cheque' ? formData.numeroCheque || null : null,
          bank_id: formData.paymentType === 'cheque' ? formData.banco || null : null,
          account_holder: formData.paymentType === 'cheque' ? formData.titularConta || null : null,
          account_number: formData.numeroConta || null,
          account_name: formData.nomeConta || null,
          status: 'pending'
        })
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Conta salva com sucesso!",
        description: "A conta foi registrada no sistema",
      });
      
      navigate("/contas");
    } catch (error: any) {
      console.error('Error saving bill:', error);
      toast({
        title: "Erro ao salvar conta",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | Date) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Voltar</span>
            </Button>
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Receipt className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Cadastro de Conta</h1>
              <p className="text-sm text-muted-foreground">
                Registre uma nova conta a pagar
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Informações da Conta</CardTitle>
              <CardDescription>
                Preencha os dados da conta a ser registrada no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados Básicos */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="descricao">Descrição *</Label>
                    <Textarea
                      id="descricao"
                      placeholder="Descreva o motivo/natureza da conta"
                      value={formData.descricao}
                      onChange={(e) => handleInputChange("descricao", e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="valor">Valor *</Label>
                      <Input
                        id="valor"
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={formData.valor}
                        onChange={(e) => handleInputChange("valor", e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="fornecedor">Fornecedor *</Label>
                      <Select value={formData.fornecedor} onValueChange={(value) => handleInputChange("fornecedor", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o fornecedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="paymentType">Tipo de Pagamento *</Label>
                      <Select value={formData.paymentType} onValueChange={(value) => handleInputChange("paymentType", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conta">Conta</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="boleto">Boleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Datas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Datas</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Data de Entrada *</Label>
                      <Popover open={isDatePickerOpen.entrada} onOpenChange={(open) => setIsDatePickerOpen(prev => ({ ...prev, entrada: open }))}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.dataEntrada && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.dataEntrada ? format(formData.dataEntrada, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.dataEntrada}
                            onSelect={(date) => {
                              if (date) handleInputChange("dataEntrada", date);
                              setIsDatePickerOpen(prev => ({ ...prev, entrada: false }));
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Data de Vencimento *</Label>
                      <Popover open={isDatePickerOpen.vencimento} onOpenChange={(open) => setIsDatePickerOpen(prev => ({ ...prev, vencimento: open }))}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.dataVencimento && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.dataVencimento ? format(formData.dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.dataVencimento}
                            onSelect={(date) => {
                              if (date) handleInputChange("dataVencimento", date);
                              setIsDatePickerOpen(prev => ({ ...prev, vencimento: false }));
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                {/* Dados do Cheque (aparecem quando tipo = cheque) */}
                {formData.paymentType === "cheque" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Dados do Cheque</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="numeroCheque">Número do Cheque *</Label>
                        <Input
                          id="numeroCheque"
                          placeholder="000001"
                          value={formData.numeroCheque}
                          onChange={(e) => handleInputChange("numeroCheque", e.target.value)}
                          required={formData.paymentType === "cheque"}
                        />
                      </div>

                      <div>
                        <Label htmlFor="banco">Banco *</Label>
                        <Select value={formData.banco} onValueChange={(value) => handleInputChange("banco", value)} required={formData.paymentType === "cheque"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o banco" />
                          </SelectTrigger>
                          <SelectContent>
                            {banks.map((bank) => (
                              <SelectItem key={bank.id} value={bank.id}>
                                {bank.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="titularConta">Titular da Conta *</Label>
                        <Input
                          id="titularConta"
                          placeholder="Nome do titular"
                          value={formData.titularConta}
                          onChange={(e) => handleInputChange("titularConta", e.target.value)}
                          required={formData.paymentType === "cheque"}
                        />
                      </div>
                    </div>
                  </div>
                )}


                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-6">
                  <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    <Save className="w-4 h-4 mr-2" />
                    {isLoading ? "Salvando..." : "Salvar Conta"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BillForm;