import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Edit, Trash2, CheckCircle2, XCircle, Search, Calendar, DollarSign, Building } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Company, getLocalCompanies } from "@/hooks/useCompanyOperations";
import { useFinancialEntriesOperations, FinancialEntry, getLocalFinancialEntries } from "@/hooks/useFinancialEntriesOperations";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PAYMENT_METHODS = [
  "Pix",
  "Transferência BANCÁRIA",
  "Boleto",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Dinheiro",
  "Cheque",
  "Outro"
];

const FinancialEntries = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createEntry, updateEntry, markAsReceived, cancelEntry, deleteEntry, isLoading } = useFinancialEntriesOperations();

  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  // Modal para confirmar recebimento
  const [confirmReceiveDialog, setConfirmReceiveDialog] = useState<FinancialEntry | null>(null);
  const [receivedDateInput, setReceivedDateInput] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [formData, setFormData] = useState({
    company_id: "",
    description: "",
    op_number: "",
    amount: "",
    expected_date: format(new Date(), 'yyyy-MM-dd'),
    received_date: "",
    payment_method: "Pix",
    status: "pending",
    observation: ""
  });

  useEffect(() => {
    fetchCompanies();
    fetchEntries();
  }, []);

  const fetchCompanies = async () => {
    try {
      let remote: Company[] = [];
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('razao_social');

        if (!error && data) {
          remote = data;
        }
      } catch (e) {
        console.warn('Remote companies fetch fallback to local', e);
      }

      const locals = getLocalCompanies();
      const existingRemoteIds = new Set(remote.map(c => c.id));
      const combined = [...remote, ...locals.filter(c => !existingRemoteIds.has(c.id))];

      setCompanies(combined);
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
      setCompanies(getLocalCompanies());
    }
  };

  const fetchEntries = async () => {
    try {
      let remote: FinancialEntry[] = [];
      let supabaseAvailable = false;
      try {
        const { data, error } = await supabase
          .from('financial_entries')
          .select(`
            *,
            companies (
              razao_social,
              cnpj
            )
          `)
          .order('expected_date', { ascending: false });

        if (!error && data) {
          remote = data;
          supabaseAvailable = true;
        }
      } catch (e) {
        console.warn('Remote entries fetch fallback to local', e);
      }

      const locals = getLocalFinancialEntries();
      const allCompanies = getLocalCompanies();

      // Auto sync local entries to Supabase cloud if available and user authenticated
      if (supabaseAvailable && locals.length > 0) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const remoteDescriptions = new Set(remote.map(r => `${r.description}_${r.amount}_${r.expected_date}`));
            const toUpload = locals.filter(l => !remoteDescriptions.has(`${l.description}_${l.amount}_${l.expected_date}`));

            for (const item of toUpload) {
              const { data: inserted, error: insErr } = await supabase.from('financial_entries').insert({
                user_id: user.id,
                company_id: item.company_id,
                description: item.description,
                op_number: item.op_number || null,
                amount: Number(item.amount),
                expected_date: item.expected_date,
                received_date: item.received_date || null,
                payment_method: item.payment_method,
                status: item.status || 'pending',
                observation: item.observation || null
              }).select(`*, companies(razao_social, cnpj)`).single();

              if (!insErr && inserted) {
                remote.unshift(inserted);
              }
            }
          }
        } catch (syncErr) {
          console.warn('Auto sync local financial entries failed:', syncErr);
        }
      }

      const enrichedLocals = locals.map(e => {
        if (!e.companies && e.company_id) {
          const matched = allCompanies.find(c => c.id === e.company_id);
          if (matched) {
            return {
              ...e,
              companies: { razao_social: matched.razao_social, cnpj: matched.cnpj }
            };
          }
        }
        return e;
      });

      const existingRemoteIds = new Set(remote.map(re => re.id));
      const combined = [...remote, ...enrichedLocals.filter(le => !existingRemoteIds.has(le.id))];

      setEntries(combined);
    } catch (error) {
      console.error('Erro ao buscar entradas:', error);
      setEntries(getLocalFinancialEntries());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_id || !formData.description || !formData.amount) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Empresa, Descrição e Valor são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    const numAmount = parseFloat(formData.amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor positivo válido.",
        variant: "destructive"
      });
      return;
    }

    const payload = {
      company_id: formData.company_id,
      description: formData.description,
      op_number: formData.op_number,
      amount: numAmount,
      expected_date: formData.expected_date,
      received_date: formData.status === 'received' ? (formData.received_date || formData.expected_date) : undefined,
      payment_method: formData.payment_method,
      status: formData.status,
      observation: formData.observation
    };

    let result;
    if (editingEntry) {
      result = await updateEntry(editingEntry.id, payload);
    } else {
      result = await createEntry(payload);
    }

    if (result) {
      resetForm();
      fetchEntries();
    }
  };

  const handleEdit = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setFormData({
      company_id: entry.company_id,
      description: entry.description,
      op_number: entry.op_number || "",
      amount: entry.amount.toString(),
      expected_date: entry.expected_date,
      received_date: entry.received_date || "",
      payment_method: entry.payment_method,
      status: entry.status,
      observation: entry.observation || ""
    });
    setShowForm(true);
  };

  const handleConfirmReceivedSubmit = async () => {
    if (!confirmReceiveDialog) return;
    const ok = await markAsReceived(confirmReceiveDialog.id, receivedDateInput);
    if (ok) {
      setConfirmReceiveDialog(null);
      fetchEntries();
    }
  };

  const handleCancelEntrySubmit = async (entryId: string) => {
    const ok = await cancelEntry(entryId);
    if (ok) {
      fetchEntries();
    }
  };

  const handleDeleteEntrySubmit = async (entryId: string) => {
    const ok = await deleteEntry(entryId);
    if (ok) {
      fetchEntries();
    }
  };

  const resetForm = () => {
    setFormData({
      company_id: "",
      description: "",
      op_number: "",
      amount: "",
      expected_date: format(new Date(), 'yyyy-MM-dd'),
      received_date: "",
      payment_method: "Pix",
      status: "pending",
      observation: ""
    });
    setShowForm(false);
    setEditingEntry(null);
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = 
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.op_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.companies?.razao_social || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.observation || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    const matchesCompany = companyFilter === "all" || entry.company_id === companyFilter;

    return matchesSearch && matchesStatus && matchesCompany;
  });

  const totalReceived = entries
    .filter(e => e.status === 'received')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPending = entries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-10 w-10 shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Entradas Financeiras (Caixa)</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Lance e acompanhe o recebimento de receitas das empresas/clientes
              </p>
            </div>
          </div>
          {!showForm && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Entrada
            </Button>
          )}
        </div>

        {/* Summary Mini Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Entradas Efetivamente Recebidas</p>
                <p className="text-xl font-bold text-emerald-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceived)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">*(Aumentam o saldo do caixa)</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Entradas Previstas (A Receber)</p>
                <p className="text-xl font-bold text-amber-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPending)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">*(Ainda não alteram o caixa)</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-full text-amber-600">
                <Calendar className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Card */}
        {showForm && (
          <Card className="border shadow-lg bg-card/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                {editingEntry ? "Editar Entrada Financeira" : "Lançar Nova Entrada"}
              </CardTitle>
              <CardDescription>
                Selecione a empresa/cliente e informe os dados do valor a receber.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Empresa / Cliente */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between h-5">
                      <Label htmlFor="company">Empresa / Cliente *</Label>
                      <button
                        type="button"
                        onClick={() => navigate('/empresas')}
                        className="text-xs text-primary hover:underline"
                      >
                        + Gerenciar empresas
                      </button>
                    </div>
                    <Select
                      value={formData.company_id}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, company_id: val }))}
                    >
                      <SelectTrigger id="company">
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.razao_social} {c.status === 'inactive' ? '(Inativa)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Descrição */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between h-5">
                      <Label htmlFor="description">Descrição da Entrada *</Label>
                    </div>
                    <Input
                      id="description"
                      placeholder="Ex: Pagamento de serviços, Venda de produtos..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Número da OP */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between h-5">
                      <Label htmlFor="op_number">Número da OP</Label>
                    </div>
                    <Input
                      id="op_number"
                      placeholder="Ex: OP-12345"
                      value={formData.op_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, op_number: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Valor em Reais */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between h-5">
                      <Label htmlFor="amount">Valor (R$) *</Label>
                    </div>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Data Prevista de Recebimento */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between h-5">
                      <Label htmlFor="expected_date">Data Prevista de Recebimento *</Label>
                    </div>
                    <Input
                      id="expected_date"
                      type="date"
                      value={formData.expected_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, expected_date: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Forma de Recebimento */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between h-5">
                      <Label htmlFor="payment_method">Forma de Recebimento *</Label>
                    </div>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, payment_method: val }))}
                    >
                      <SelectTrigger id="payment_method">
                        <SelectValue placeholder="Selecione a forma" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between h-5">
                      <Label htmlFor="status">Status</Label>
                    </div>
                    <Select
                      value={formData.status}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">A receber</SelectItem>
                        <SelectItem value="received">Recebido</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Data Efetiva (se recebido) */}
                  {formData.status === 'received' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between h-5">
                        <Label htmlFor="received_date">Data Efetiva de Recebimento</Label>
                      </div>
                      <Input
                        id="received_date"
                        type="date"
                        value={formData.received_date || formData.expected_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, received_date: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label htmlFor="observation">Observações</Label>
                  <Textarea
                    id="observation"
                    placeholder="Informações adicionais..."
                    value={formData.observation}
                    onChange={(e) => setFormData(prev => ({ ...prev, observation: e.target.value }))}
                    rows={2}
                  />
                </div>

                {/* Form Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading} className="gap-2">
                    {isLoading ? "Salvando..." : editingEntry ? "Atualizar Entrada" : "Cadastrar Entrada"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* List Section */}
        <Card className="border shadow-md bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Entradas Lançadas ({filteredEntries.length})</CardTitle>
                <CardDescription>Gerencie o status e confirmações de recebimento das entradas.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full md:w-56">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar..."
                    className="pl-9 text-xs sm:text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 text-xs sm:text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="pending">A receber</SelectItem>
                    <SelectItem value="received">Recebidos</SelectItem>
                    <SelectItem value="cancelled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>

                {/* Company Filter */}
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="w-44 text-xs sm:text-sm">
                    <SelectValue placeholder="Empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Empresas</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma entrada financeira encontrada com os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-lg border bg-card/50 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base truncate">{entry.description}</h3>
                        {entry.op_number && (
                          <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/5">
                            OP: {entry.op_number}
                          </Badge>
                        )}
                        <Badge
                          variant={
                            entry.status === 'received'
                              ? 'default'
                              : entry.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className={
                            entry.status === 'received' ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                          }
                        >
                          {entry.status === 'received' ? 'Recebido' : entry.status === 'pending' ? 'A receber' : 'Cancelado'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Building className="h-3.5 w-3.5 text-primary" />
                          {entry.companies?.razao_social || 'Sem empresa'}
                        </span>
                        {entry.op_number && (
                          <span className="font-medium text-foreground">
                            🔢 OP: {entry.op_number}
                          </span>
                        )}
                        <span>
                          📅 Previsto: {format(new Date(entry.expected_date + 'T00:00:00'), 'dd/MM/yyyy')}
                        </span>
                        {entry.received_date && (
                          <span className="text-emerald-600 font-medium">
                            ✅ Recebido em: {format(new Date(entry.received_date + 'T00:00:00'), 'dd/MM/yyyy')}
                          </span>
                        )}
                        <span>💳 Forma: {entry.payment_method}</span>
                      </div>

                      {entry.observation && (
                        <p className="text-xs text-muted-foreground italic">Obs: {entry.observation}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0">
                      <p className="text-lg font-bold text-primary">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.amount)}
                      </p>

                      <div className="flex items-center space-x-1">
                        {entry.status === 'pending' && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            onClick={() => {
                              setConfirmReceiveDialog(entry);
                              setReceivedDateInput(format(new Date(), 'yyyy-MM-dd'));
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Recebido
                          </Button>
                        )}

                        {entry.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Cancelar entrada"
                            onClick={() => handleCancelEntrySubmit(entry.id)}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        )}

                        <Button size="sm" variant="ghost" onClick={() => handleEdit(entry)}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteEntrySubmit(entry.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal para Confirmar Data Efetiva de Recebimento */}
      <Dialog open={!!confirmReceiveDialog} onOpenChange={() => setConfirmReceiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
            <DialogDescription>
              Confirme a data efetiva em que o valor de{" "}
              <strong>
                {confirmReceiveDialog &&
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(confirmReceiveDialog.amount)}
              </strong>{" "}
              foi recebido no caixa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="effective_date">Data Efetiva de Recebimento</Label>
            <Input
              id="effective_date"
              type="date"
              value={receivedDateInput}
              onChange={(e) => setReceivedDateInput(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReceiveDialog(null)}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmReceivedSubmit}>
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialEntries;
