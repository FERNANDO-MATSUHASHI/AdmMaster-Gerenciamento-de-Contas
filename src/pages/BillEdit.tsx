import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Save, Calendar as CalendarIcon, Paperclip, Camera, X, Eye } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { translateErrorMessage } from "@/lib/errorMessages";

const BillEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<(File | null)[]>([null]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<string>("");
  
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    due_date: "",
    entry_date: "",
    supplier_id: "",
    check_number: "",
    account_number: "",
    account_name: "",
    account_holder: "",
    bank_id: "",
    payment_type: "conta",
    status: "pending",
    quantidadeParcelas: "1",
    parcelasDatas: [new Date()],
    parcelasValores: [0]
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState({
    entrada: false,
    vencimento: false,
    parcelas: {} as Record<number, boolean>
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchSuppliers();
    fetchBanks();
    if (id) {
      fetchBill();
    }
  }, [id]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
    }
  };

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error('Erro ao buscar bancos:', error);
    }
  };

  const fetchBill = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Função para converter string de data "YYYY-MM-DD" para Date local sem problemas de timezone
      const parseLocalDate = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
      };
      
      setFormData({
        description: data.description || "",
        amount: data.amount?.toString() || "",
        due_date: data.due_date || "",
        entry_date: data.entry_date || "",
        supplier_id: data.supplier_id || "",
        check_number: data.check_number || "",
        account_number: data.account_number || "",
        account_name: data.account_name || "",
        account_holder: data.account_holder || "",
        bank_id: data.bank_id || "",
        payment_type: data.payment_type || "conta",
        status: data.status || "pending",
        quantidadeParcelas: "1",
        parcelasDatas: [data.due_date ? parseLocalDate(data.due_date) : new Date()],
        parcelasValores: [parseFloat(data.amount?.toString() || "0")]
      });
      
      // Salvar URL do anexo existente
      if (data.attachment_url) {
        setExistingAttachment(data.attachment_url);
      }
    } catch (error) {
      console.error('Erro ao buscar conta:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const calcularValorParcela = () => {
    const valor = parseFloat(formData.amount) || 0;
    const parcelas = parseInt(formData.quantidadeParcelas) || 1;
    return (valor / parcelas).toFixed(2);
  };

  const handleQuantidadeParcelasChange = (quantidade: string) => {
    const num = parseInt(quantidade) || 1;
    const novasParcelas: Date[] = [];
    const novosValores: number[] = [];
    const valor = parseFloat(formData.amount) || 0;
    const valorParcela = valor / num;
    
    for (let i = 0; i < num; i++) {
      novasParcelas.push(addMonths(new Date(formData.due_date), i));
      novosValores.push(valorParcela);
    }
    
    const novosArquivos: (File | null)[] = Array(num).fill(null);
    
    setFormData(prev => ({
      ...prev,
      quantidadeParcelas: quantidade,
      parcelasDatas: novasParcelas,
      parcelasValores: novosValores
    }));
    
    setSelectedFiles(novosArquivos);
  };

  const handleParcelaDataChange = (index: number, date: Date) => {
    const novasDatas = [...formData.parcelasDatas];
    novasDatas[index] = date;
    setFormData(prev => ({
      ...prev,
      parcelasDatas: novasDatas
    }));
  };

  const handleParcelaValorChange = (index: number, valor: string) => {
    const novosValores = [...formData.parcelasValores];
    novosValores[index] = parseFloat(valor) || 0;
    setFormData(prev => ({
      ...prev,
      parcelasValores: novosValores
    }));
  };

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

  const handleRemoveFileFromParcela = (parcelaIndex: number) => {
    const novosArquivos = [...selectedFiles];
    novosArquivos[parcelaIndex] = null;
    setSelectedFiles(novosArquivos);
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSelectedFile(file);
      }
    };
    input.click();
  };

  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSelectedFile(file);
      }
    };
    input.click();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setExistingAttachment("");
  };

  const handleViewAttachment = async (attachmentUrl: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(
        `https://nbetcemynduklddhqgyu.supabase.co/functions/v1/download-attachment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path: attachmentUrl }),
        }
      );

      if (!response.ok) throw new Error('Failed to download file');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
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

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Upload do arquivo se houver um selecionado
      let attachmentUrl = existingAttachment;
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (uploadedUrl) {
          attachmentUrl = uploadedUrl;
        }
      }

      // Para boleto, usar a data da parcela ao invés de due_date
      const dueDateToSave = formData.payment_type === 'boleto' && formData.parcelasDatas[0]
        ? format(formData.parcelasDatas[0], 'yyyy-MM-dd')
        : formData.due_date;

      const { error } = await supabase
        .from('bills')
        .update({
          description: formData.description,
          amount: parseFloat(formData.amount),
          due_date: dueDateToSave,
          entry_date: formData.entry_date,
          supplier_id: formData.supplier_id || null,
          check_number: formData.payment_type === 'cheque' ? formData.check_number || null : null,
          account_number: formData.account_number || null,
          account_name: formData.account_name || null,
          account_holder: formData.payment_type === 'cheque' ? formData.account_holder || null : null,
          bank_id: formData.payment_type === 'cheque' ? formData.bank_id || null : null,
          payment_type: formData.payment_type,
          status: formData.status,
          attachment_url: attachmentUrl || null
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Conta atualizada com sucesso!",
      });

      navigate("/contas");
    } catch (error) {
      console.error('Erro ao atualizar conta:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/contas")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-xl font-semibold">Editar Conta</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Editar Conta a Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="amount">Valor *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                {formData.payment_type !== "boleto" && formData.payment_type !== "cheque" && (
                  <div>
                    <Label>Data de Vencimento *</Label>
                    <Popover open={isDatePickerOpen.vencimento} onOpenChange={(open) => setIsDatePickerOpen(prev => ({ ...prev, vencimento: open }))}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.due_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.due_date ? (() => {
                            const [year, month, day] = formData.due_date.split('-').map(Number);
                            return format(new Date(year, month - 1, day), "dd/MM/yyyy", { locale: ptBR });
                          })() : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.due_date ? (() => {
                            const [year, month, day] = formData.due_date.split('-').map(Number);
                            return new Date(year, month - 1, day);
                          })() : undefined}
                          onSelect={(date) => {
                            if (date) setFormData({ ...formData, due_date: format(date, 'yyyy-MM-dd') });
                            setIsDatePickerOpen(prev => ({ ...prev, vencimento: false }));
                          }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div>
                  <Label>Data de Lançamento *</Label>
                  <Popover open={isDatePickerOpen.entrada} onOpenChange={(open) => setIsDatePickerOpen(prev => ({ ...prev, entrada: open }))}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.entry_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.entry_date ? (() => {
                          const [year, month, day] = formData.entry_date.split('-').map(Number);
                          return format(new Date(year, month - 1, day), "dd/MM/yyyy", { locale: ptBR });
                        })() : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.entry_date ? (() => {
                          const [year, month, day] = formData.entry_date.split('-').map(Number);
                          return new Date(year, month - 1, day);
                        })() : undefined}
                        onSelect={(date) => {
                          if (date) setFormData({ ...formData, entry_date: format(date, 'yyyy-MM-dd') });
                          setIsDatePickerOpen(prev => ({ ...prev, entrada: false }));
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="supplier_id">Fornecedor</Label>
                  <Select value={formData.supplier_id} onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um fornecedor" />
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
                  <Label htmlFor="payment_type">Tipo de Pagamento</Label>
                  <Select value={formData.payment_type} onValueChange={(value) => setFormData({ ...formData, payment_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conta">Conta</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Paga</SelectItem>
                      <SelectItem value="overdue">Vencida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Anexo (disponível para todos os tipos) */}
              <div className="space-y-2">
                <Label>Anexo</Label>
                
                {!selectedFile && !existingAttachment && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFileSelect}
                    >
                      <Paperclip className="w-4 h-4 mr-2" />
                      Anexar Arquivo
                    </Button>
                    {isMobile && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCameraCapture}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Tirar Foto
                      </Button>
                    )}
                  </div>
                )}
                
                {(selectedFile || existingAttachment) && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      <span className="text-sm truncate">
                        {selectedFile ? selectedFile.name : "Arquivo anexado"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {existingAttachment && !selectedFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewAttachment(existingAttachment)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleFileSelect}
                      >
                        Editar
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

              {/* Dados do Cheque (aparecem quando tipo = cheque) */}
              {formData.payment_type === "cheque" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Dados do Cheque</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="check_number">Número do Cheque *</Label>
                      <Input
                        id="check_number"
                        value={formData.check_number}
                        onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                        required={formData.payment_type === "cheque"}
                      />
                    </div>

                    <div>
                      <Label htmlFor="bank_id">Banco *</Label>
                      <Select value={formData.bank_id} onValueChange={(value) => setFormData({ ...formData, bank_id: value })}>
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
                      <Label htmlFor="account_holder">Titular da Conta *</Label>
                      <Input
                        id="account_holder"
                        value={formData.account_holder}
                        onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                        required={formData.payment_type === "cheque"}
                      />
                    </div>

                    <div>
                      <Label htmlFor="account_number">Número da Conta</Label>
                      <Input
                        id="account_number"
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="account_name">Nome da Conta</Label>
                      <Input
                        id="account_name"
                        value={formData.account_name}
                        onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dados do Boleto (aparecem quando tipo = boleto) */}
              {formData.payment_type === "boleto" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Dados do Boleto</h3>
                  
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
                        required={formData.payment_type === "boleto"}
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
                        readOnly
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
                                value={formData.parcelasValores[index]?.toFixed(2) || calcularValorParcela()}
                                onChange={(e) => handleParcelaValorChange(index, e.target.value)}
                              />
                            </div>
                          </div>
                          
                          {/* Anexo para cada parcela */}
                          {formData.payment_type === "boleto" && (
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

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => navigate("/contas")}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BillEdit;