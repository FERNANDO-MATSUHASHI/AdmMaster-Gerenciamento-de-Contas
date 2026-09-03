import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, ShoppingCart, Calendar as CalendarIcon, Paperclip, Eye, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { translateErrorMessage } from "@/lib/errorMessages";
import { getExpenseUsers, ExpenseUser } from "@/lib/expenseUsers";

const ExpenseForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Array<{id: string, name: string}>>([]);
  const [expenseUsersList, setExpenseUsersList] = useState<ExpenseUser[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    descricao: "",
    valor: "",
    fornecedor: "",
    titularConta: "",
    dataEntrada: new Date(),
    attachmentUrl: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Upload de arquivo
  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("bill-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      return fileName;
    } catch (error) {
      console.error("Erro no upload:", error);
      toast({ title: "Erro", description: "Não foi possível fazer upload do arquivo", variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf,.pdf,.jpg,.jpeg,.png";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) setSelectedFile(file);
    };
    input.click();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFormData(prev => ({ ...prev, attachmentUrl: "" }));
  };

  const handleViewAttachment = async (attachmentUrl: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await fetch(
        `https://nbetcemynduklddhqgyu.supabase.co/functions/v1/download-attachment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: attachmentUrl }),
        }
      );

      if (!response.ok) throw new Error("Failed to download file");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao visualizar anexo. Tente novamente.", variant: "destructive" });
    }
  };

  // Carrega fornecedores e usuários
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: suppliersData } = await supabase
          .from("suppliers")
          .select("id, name")
          .order("name");
        setSuppliers(suppliersData || []);

        const users = await getExpenseUsers();
        setExpenseUsersList(users);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro de autenticação", description: "Você precisa estar logado para salvar uma despesa", variant: "destructive" });
        navigate("/login");
        return;
      }

      // Upload do arquivo se houver
      let attachmentUrl = formData.attachmentUrl;
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (uploadedUrl) attachmentUrl = uploadedUrl;
      }

      // Formatar data sem conversão de timezone
      const entryDate = new Date(formData.dataEntrada);
      const entryDateFormatted = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}-${String(entryDate.getDate()).padStart(2, "0")}`;

      // Despesa não tem vencimento: due_date = entry_date
      const parsedAmount = parseFloat(formData.valor.replace(",", "."));
      const insertData: any = {
        user_id: user.id,
        description: formData.descricao,
        amount: isNaN(parsedAmount) ? 0 : parsedAmount,
        supplier_id: formData.fornecedor || null,
        due_date: entryDateFormatted,
        entry_date: entryDateFormatted,
        payment_type: "despesa",
        account_holder: formData.titularConta || null,
        status: "paid",
        attachment_url: attachmentUrl || null,
        bill_type: "despesa",
      };

      let { error } = await supabase.from("bills").insert(insertData);

      // Se a coluna bill_type ainda não existe no banco, tenta sem ela
      if (error && (error.message?.includes("bill_type") || error.code === "PGRST204" || error.code === "42703")) {
        console.warn("Coluna bill_type não existe ainda. Salvando sem ela. Aplique a migration SQL no Supabase.");
        const { bill_type, ...insertDataSemTipo } = insertData;
        const result = await supabase.from("bills").insert(insertDataSemTipo);
        error = result.error;
      }

      if (error) throw error;

      toast({ title: "Despesa salva com sucesso!", description: "A despesa foi registrada no sistema" });
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error saving expense:", error);
      const desc = error?.message || error?.details || "Ocorreu um erro inesperado. Tente novamente.";
      toast({ title: "Erro ao salvar despesa", description: desc, variant: "destructive" });
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
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Cadastro de Despesa</h1>
              <p className="text-sm text-muted-foreground">Registre uma nova despesa no sistema</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Informações da Despesa</CardTitle>
              <CardDescription>Preencha os dados da despesa a ser registrada no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados Básicos */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="descricao">Descrição *</Label>
                    <Textarea
                      id="descricao"
                      placeholder="Descreva o motivo/natureza da despesa"
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
                        <SelectContent position="popper" side="bottom" align="start" className="max-h-[300px]">
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="titularConta">Pessoa / Usuário</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate("/usuarios-despesas")}
                          className="h-auto p-0 text-xs text-primary hover:underline"
                        >
                          + Gerenciar
                        </Button>
                      </div>
                      <Select
                        value={formData.titularConta}
                        onValueChange={(value) => handleInputChange("titularConta", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ex: Fernando, Luciane..." />
                        </SelectTrigger>
                        <SelectContent position="popper" side="bottom" align="start" className="max-h-[300px]">
                          {expenseUsersList.map((user) => (
                            <SelectItem key={user.id} value={user.name}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Data */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Data</h3>
                  <div>
                    <Label>Data de Entrada *</Label>
                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.dataEntrada && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.dataEntrada
                            ? format(formData.dataEntrada, "dd/MM/yyyy", { locale: ptBR })
                            : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.dataEntrada}
                          onSelect={(date) => {
                            if (date) handleInputChange("dataEntrada", date);
                            setIsDatePickerOpen(false);
                          }}
                          defaultMonth={formData.dataEntrada}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground mt-1">
                      Despesas não possuem data de vencimento — a data de entrada é usada para o calendário.
                    </p>
                  </div>
                </div>

                {/* Anexar Arquivo */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Anexar Arquivo</h3>
                  {!selectedFile && !formData.attachmentUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleFileSelect}
                    >
                      <Paperclip className="w-4 h-4 mr-2" />
                      Anexar Arquivo
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                      <Paperclip className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm flex-1 truncate">
                        {selectedFile ? selectedFile.name : "Arquivo anexado"}
                      </span>
                      {formData.attachmentUrl && !selectedFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewAttachment(formData.attachmentUrl)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveFile}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading || isUploading}>
                    {isLoading || isUploading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        {isUploading ? "Enviando arquivo..." : "Salvando..."}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Salvar Despesa
                      </span>
                    )}
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

export default ExpenseForm;
