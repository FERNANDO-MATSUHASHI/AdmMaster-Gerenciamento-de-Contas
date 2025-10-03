import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Receipt, Save, Calendar as CalendarIcon, Edit2, Plus, X, Camera, Paperclip, Eye } from "lucide-react";
import { format, addMonths } from "date-fns";
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
    nomeConta: "",
    // Campos do boleto/cheque parcelado
    quantidadeParcelas: "1",
    parcelasDatas: [new Date()],
    parcelasValores: [0],
    parcelasNumerosCheque: [""],
    // Campo do arquivo anexado
    attachmentUrl: ""
  });

  const [selectedFiles, setSelectedFiles] = useState<(File | null)[]>([null]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState({
    entrada: false,
    vencimento: false,
    parcelas: {} as Record<number, boolean>
  });

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Função para upload de arquivo
  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('bill-attachments')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      return fileName;
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload do arquivo",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Função para capturar foto
  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSelectedFile(file);
        setShowAttachmentOptions(false);
      }
    };
    input.click();
  };

  // Função para selecionar arquivo para uma parcela específica
  const handleFileSelectForParcela = (parcelaIndex: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const novosArquivos = [...selectedFiles];
        novosArquivos[parcelaIndex] = file;
        setSelectedFiles(novosArquivos);
      }
    };
    input.click();
  };

  // Função para capturar foto para uma parcela específica
  const handleCameraCaptureForParcela = (parcelaIndex: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const novosArquivos = [...selectedFiles];
        novosArquivos[parcelaIndex] = file;
        setSelectedFiles(novosArquivos);
      }
    };
    input.click();
  };

  // Função para remover arquivo de uma parcela específica
  const handleRemoveFileFromParcela = (parcelaIndex: number) => {
    const novosArquivos = [...selectedFiles];
    novosArquivos[parcelaIndex] = null;
    setSelectedFiles(novosArquivos);
  };
  // Função para selecionar arquivo
  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSelectedFile(file);
        setShowAttachmentOptions(false);
      }
    };
    input.click();
  };

  // Função para remover arquivo
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFormData(prev => ({ ...prev, attachmentUrl: "" }));
  };

  // Função para visualizar arquivo anexado - usando edge function segura
  const handleViewAttachment = async (attachmentUrl: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const { data, error } = await supabase.functions.invoke('download-attachment', {
        body: { path: attachmentUrl },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Create blob URL and open in new tab
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Erro ao visualizar anexo:', error);
      toast({
        title: "Erro",
        description: "Erro ao visualizar anexo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

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

  // Função para calcular o valor da parcela
  const calcularValorParcela = () => {
    const valor = parseFloat(formData.valor) || 0;
    const parcelas = parseInt(formData.quantidadeParcelas) || 1;
    return (valor / parcelas).toFixed(2);
  };

  // Função para atualizar a quantidade de parcelas e suas datas
  const handleQuantidadeParcelasChange = (quantidade: string) => {
    const num = parseInt(quantidade) || 1;
    const novasParcelas: Date[] = [];
    const novosValores: number[] = [];
    const novosNumerosCheque: string[] = [];
    const valor = parseFloat(formData.valor) || 0;
    const valorParcela = valor / num; // Calcular com a nova quantidade
    
    for (let i = 0; i < num; i++) {
      novasParcelas.push(addMonths(formData.dataVencimento, i));
      novosValores.push(valorParcela);
      novosNumerosCheque.push("");
    }
    
    // Ajustar array de arquivos anexados para cada parcela
    const novosArquivos: (File | null)[] = Array(num).fill(null);
    
    setFormData(prev => ({
      ...prev,
      quantidadeParcelas: quantidade,
      parcelasDatas: novasParcelas,
      parcelasValores: novosValores,
      parcelasNumerosCheque: novosNumerosCheque
    }));
    
    setSelectedFiles(novosArquivos);
  };

  // Função para atualizar o valor total e recalcular as parcelas
  const handleValorTotalChange = (valor: string) => {
    const novoValor = parseFloat(valor) || 0;
    const parcelas = parseInt(formData.quantidadeParcelas) || 1;
    const valorParcela = (novoValor / parcelas);
    
    // Criar array com o número correto de parcelas, todas com o valor calculado
    const novosValores = Array(parcelas).fill(valorParcela);
    
    setFormData(prev => ({
      ...prev,
      valor: valor,
      parcelasValores: novosValores
    }));
  };

  // Função para sincronizar valores quando mudar para tipo boleto ou cheque
  const handlePaymentTypeChange = (tipo: string) => {
    if (tipo === "boleto" || tipo === "cheque") {
      const valor = parseFloat(formData.valor) || 0;
      const parcelas = parseInt(formData.quantidadeParcelas) || 1;
      const valorParcela = valor / parcelas;
      
      // Inicializar valores das parcelas se necessário
      if (formData.parcelasValores.length === 0 || formData.parcelasValores.every(v => v === 0)) {
        const novosValores = Array(parcelas).fill(valorParcela);
        setFormData(prev => ({
          ...prev,
          paymentType: tipo,
          parcelasValores: novosValores
        }));
      } else {
        handleInputChange("paymentType", tipo);
      }
    } else {
      handleInputChange("paymentType", tipo);
    }
  };

  // Função para atualizar data específica de uma parcela
  const handleParcelaDataChange = (index: number, date: Date) => {
    const novasDatas = [...formData.parcelasDatas];
    novasDatas[index] = date;
    setFormData(prev => ({
      ...prev,
      parcelasDatas: novasDatas
    }));
  };

  // Função para atualizar valor específico de uma parcela
  const handleParcelaValorChange = (index: number, valor: string) => {
    const novosValores = [...formData.parcelasValores];
    novosValores[index] = parseFloat(valor) || 0;
    setFormData(prev => ({
      ...prev,
      parcelasValores: novosValores
    }));
  };

  // Função para atualizar número do cheque específico de uma parcela
  const handleParcelaNumeroChequeChange = (index: number, numero: string) => {
    const novosNumeros = [...formData.parcelasNumerosCheque];
    novosNumeros[index] = numero;
    setFormData(prev => ({
      ...prev,
      parcelasNumerosCheque: novosNumeros
    }));
  };

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

      // Upload do arquivo se houver um selecionado
      let attachmentUrl = formData.attachmentUrl;
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (uploadedUrl) {
          attachmentUrl = uploadedUrl;
        }
      }

      // Se for boleto ou cheque com parcelas, criar múltiplas contas (uma para cada parcela)
      if ((formData.paymentType === 'boleto' || formData.paymentType === 'cheque') && parseInt(formData.quantidadeParcelas) >= 2) {
        // Fazer upload dos arquivos de cada parcela se houver
        const uploadPromises = selectedFiles.map(async (file, index) => {
          if (file) {
            return await uploadFile(file);
          }
          return null;
        });

        const uploadedUrls = await Promise.all(uploadPromises);

        const contasParaInserir = formData.parcelasDatas.map((data, index) => ({
          user_id: user.id,
          description: `${formData.descricao} (${index + 1}/${formData.quantidadeParcelas})`,
          amount: formData.parcelasValores[index] || parseFloat(calcularValorParcela()),
          supplier_id: formData.fornecedor || null,
          due_date: format(data, 'yyyy-MM-dd'),
          entry_date: format(formData.dataEntrada, 'yyyy-MM-dd'),
          payment_type: formData.paymentType,
          check_number: formData.paymentType === 'cheque' ? (formData.parcelasNumerosCheque[index] || null) : null,
          bank_id: formData.paymentType === 'cheque' ? formData.banco || null : null,
          account_holder: formData.paymentType === 'cheque' ? formData.titularConta || null : null,
          account_number: formData.numeroConta || null,
          account_name: formData.nomeConta || null,
          status: 'pending',
          attachment_url: uploadedUrls[index] || null
        }));

        const { data, error } = await supabase
          .from('bills')
          .insert(contasParaInserir)
          .select();

        if (error) {
          throw error;
        }

        // Salvar anexos individuais na tabela bill_installment_attachments
        const installmentAttachments = [];
        for (let i = 0; i < data.length; i++) {
          if (uploadedUrls[i]) {
            installmentAttachments.push({
              bill_id: data[i].id,
              installment_number: i + 1,
              attachment_url: uploadedUrls[i],
              file_name: selectedFiles[i]?.name || '',
              file_type: selectedFiles[i]?.type || '',
              user_id: user.id
            });
          }
        }

        if (installmentAttachments.length > 0) {
          const { error: attachmentError } = await supabase
            .from('bill_installment_attachments')
            .insert(installmentAttachments);
          
          if (attachmentError) {
            console.error('Error saving installment attachments:', attachmentError);
          }
        }

        const tipoTexto = formData.paymentType === 'boleto' ? 'Boleto' : 'Cheque';
        toast({
          title: `${tipoTexto} parcelado salvo com sucesso!`,
          description: `${formData.quantidadeParcelas} parcelas foram registradas no sistema`,
        });
      } else {
        // Save single bill to database
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
            status: 'pending',
            attachment_url: attachmentUrl
          })
          .select();

        if (error) {
          throw error;
        }

        toast({
          title: "Conta salva com sucesso!",
          description: "A conta foi registrada no sistema",
        });
      }
      
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
                        placeholder="0.00"
                        value={formData.valor}
                        onChange={(e) => {
                          if (formData.paymentType === "boleto" || formData.paymentType === "cheque") {
                            handleValorTotalChange(e.target.value);
                          } else {
                            handleInputChange("valor", e.target.value);
                          }
                        }}
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
                      <Select value={formData.paymentType} onValueChange={handlePaymentTypeChange}>
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
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {!(formData.paymentType === "boleto" || (formData.paymentType === "cheque" && parseInt(formData.quantidadeParcelas) > 1)) && (
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
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dados do Cheque (aparecem quando tipo = cheque e não é parcelado) */}
                {formData.paymentType === "cheque" && parseInt(formData.quantidadeParcelas) === 1 && (
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
                          required={formData.paymentType === "cheque" && parseInt(formData.quantidadeParcelas) === 1}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="banco">Banco *</Label>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate("/bancos/novo")}
                            className="h-auto p-1"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
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

                {/* Banco e Titular para cheques parcelados (aparecem quando tipo = cheque e é parcelado) */}
                {formData.paymentType === "cheque" && parseInt(formData.quantidadeParcelas) >= 2 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Dados do Cheque</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="banco">Banco *</Label>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate("/bancos/novo")}
                            className="h-auto p-1"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
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

                {/* Dados de Parcelamento (aparecem quando tipo = boleto ou cheque) */}
                {(formData.paymentType === "boleto" || formData.paymentType === "cheque") && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      {formData.paymentType === "boleto" ? "Dados do Boleto" : "Dados do Cheque"}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="quantidadeParcelas">Quantidade de Parcelas *</Label>
                        <Input
                          id="quantidadeParcelas"
                          type="number"
                          min="1"
                          placeholder="1"
                          value={formData.quantidadeParcelas}
                          onChange={(e) => handleQuantidadeParcelasChange(e.target.value)}
                          required={formData.paymentType === "boleto" || formData.paymentType === "cheque"}
                        />
                      </div>

                      <div>
                        <Label htmlFor="valorParcela">Valor da Parcela</Label>
                        <Input
                          id="valorParcela"
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={calcularValorParcela()}
                          onChange={(e) => {
                            const novoValorParcela = parseFloat(e.target.value) || 0;
                            const parcelas = parseInt(formData.quantidadeParcelas) || 1;
                            const valorTotal = (novoValorParcela * parcelas).toFixed(2);
                            
                            // Atualizar o valor total
                            handleInputChange("valor", valorTotal);
                            
                            // Atualizar todos os valores das parcelas
                            const novosValores = formData.parcelasValores.map(() => novoValorParcela);
                            setFormData(prev => ({
                              ...prev,
                              parcelasValores: novosValores
                            }));
                          }}
                        />
                      </div>
                    </div>

                     {/* Datas de Vencimento das Parcelas */}
                     <div className="space-y-3">
                       <Label>Datas de Vencimento das Parcelas</Label>
                       <div className="grid grid-cols-1 gap-3">
                         {formData.parcelasDatas.map((data, index) => (
                           <div key={index} className="space-y-2">
                             <Label className="text-sm text-muted-foreground">
                               Parcela {index + 1}
                             </Label>
                             
                             {/* Número do Cheque individual para cheques parcelados */}
                             {formData.paymentType === "cheque" && parseInt(formData.quantidadeParcelas) >= 2 && (
                               <div>
                                 <Label className="text-xs text-muted-foreground">Número do Cheque *</Label>
                                 <Input
                                   placeholder="000001"
                                   value={formData.parcelasNumerosCheque[index] || ""}
                                   onChange={(e) => handleParcelaNumeroChequeChange(index, e.target.value)}
                                   required
                                 />
                               </div>
                             )}
                             
                             <div className="flex gap-2">
                               <div className="flex-1">
                                 <Popover 
                                   open={isDatePickerOpen.parcelas[index] || false} 
                                   onOpenChange={(open) => setIsDatePickerOpen(prev => ({ 
                                     ...prev, 
                                     parcelas: { ...prev.parcelas, [index]: open } 
                                   }))}
                                 >
                                   <PopoverTrigger asChild>
                                     <Button
                                       variant="outline"
                                       className="w-full justify-start text-left font-normal"
                                     >
                                       <CalendarIcon className="mr-2 h-4 w-4" />
                                       {format(data, "dd/MM/yyyy", { locale: ptBR })}
                                     </Button>
                                   </PopoverTrigger>
                                   <PopoverContent className="w-auto p-0" align="start">
                                     <Calendar
                                       mode="single"
                                       selected={data}
                                       onSelect={(date) => {
                                         if (date) handleParcelaDataChange(index, date);
                                         setIsDatePickerOpen(prev => ({ 
                                           ...prev, 
                                           parcelas: { ...prev.parcelas, [index]: false } 
                                         }));
                                       }}
                                       initialFocus
                                       className="p-3 pointer-events-auto"
                                     />
                                   </PopoverContent>
                                 </Popover>
                               </div>
                               <div className="w-32">
                                 <Input
                                   type="number"
                                   step="0.01"
                                   placeholder="Valor"
                                   value={formData.parcelasValores[index] !== undefined && formData.parcelasValores[index] > 0 ? formData.parcelasValores[index].toFixed(2) : calcularValorParcela()}
                                   onChange={(e) => handleParcelaValorChange(index, e.target.value)}
                                 />
                               </div>
                             </div>
                             
                              {/* Anexo para cada parcela quando há 2 ou mais parcelas */}
                              {parseInt(formData.quantidadeParcelas) >= 2 && (
                               <div className="mt-2">
                                 <Label className="text-xs text-muted-foreground">
                                   Anexo da Parcela {index + 1}
                                 </Label>
                                 
                                 {!selectedFiles[index] && (
                                   <div className="flex gap-1 mt-1">
                                     <Button
                                       type="button"
                                       variant="outline"
                                       size="sm"
                                       onClick={() => handleFileSelectForParcela(index)}
                                       className="text-xs"
                                     >
                                       <Paperclip className="w-3 h-3 mr-1" />
                                       Anexar
                                     </Button>
                                     {isMobile && (
                                       <Button
                                         type="button"
                                         variant="outline"
                                         size="sm"
                                         onClick={() => handleCameraCaptureForParcela(index)}
                                         className="text-xs"
                                       >
                                         <Camera className="w-3 h-3 mr-1" />
                                         Foto
                                       </Button>
                                     )}
                                   </div>
                                 )}
                                 
                                 {selectedFiles[index] && (
                                   <div className="flex items-center justify-between p-2 bg-muted rounded-md mt-1">
                                     <span className="text-xs truncate">{selectedFiles[index]?.name}</span>
                                     <Button
                                       type="button"
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => handleRemoveFileFromParcela(index)}
                                     >
                                       <X className="w-3 h-3" />
                                     </Button>
                                   </div>
                                 )}
                               </div>
                             )}
                           </div>
                         ))}
                       </div>
                     </div>
                  </div>
                )}

                {/* Seção de Anexo (disponível para todos os tipos de pagamento, exceto boleto/cheque parcelado) */}
                {!((formData.paymentType === "boleto" || formData.paymentType === "cheque") && parseInt(formData.quantidadeParcelas) >= 2) && (
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Anexar Arquivo</Label>
                
                {!selectedFile && !formData.attachmentUrl && (
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAttachmentOptions(!showAttachmentOptions)}
                      className="w-full"
                    >
                      <Paperclip className="w-4 h-4 mr-2" />
                      Anexar Arquivo
                    </Button>
                    
                    {showAttachmentOptions && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-md shadow-lg">
                        {isMobile ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={handleFileSelect}
                              className="w-full justify-start rounded-none"
                            >
                              <Paperclip className="w-4 h-4 mr-2" />
                              Anexar arquivo existente
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={handleCameraCapture}
                              className="w-full justify-start rounded-none"
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Abrir câmera
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={handleFileSelect}
                            className="w-full justify-start rounded-none"
                          >
                            <Paperclip className="w-4 h-4 mr-2" />
                            Selecionar arquivo
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {selectedFile && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <span className="text-sm truncate">{selectedFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                {formData.attachmentUrl && !selectedFile && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <span className="text-sm">Arquivo anexado</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAttachment(formData.attachmentUrl)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveFile}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
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