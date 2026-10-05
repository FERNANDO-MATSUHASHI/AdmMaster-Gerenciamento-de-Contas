import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building, Save, Plus, Edit, Trash2, Search, Power, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ, isValidCNPJ } from "@/lib/cnpjFormatter";
import { useViaCEP } from "@/hooks/useViaCEP";
import { useCompanyOperations, Company, getLocalCompanies } from "@/hooks/useCompanyOperations";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CompanyForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createCompany, updateCompany, deleteCompany, toggleCompanyStatus, isLoading } = useCompanyOperations();
  const { fetchAddress, formatCEP, isLoading: isFetchingCEP } = useViaCEP();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<Company | null>(null);
  const [cannotDeleteDialog, setCannotDeleteDialog] = useState<Company | null>(null);

  const [formData, setFormData] = useState({
    cnpj: "",
    razao_social: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    status: "active"
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      let remote: Company[] = [];
      let supabaseAvailable = false;
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          remote = data;
          supabaseAvailable = true;
        }
      } catch (e) {
        console.warn('Remote companies fetch fallback to local storage', e);
      }

      const locals = getLocalCompanies();

      // Auto sync local items to Supabase cloud if available and user authenticated
      if (supabaseAvailable && locals.length > 0) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const remoteCnpjs = new Set(remote.map(c => (c.cnpj || '').replace(/\D/g, '')));
            const toUpload = locals.filter(l => l.cnpj && !remoteCnpjs.has(l.cnpj.replace(/\D/g, '')));

            for (const item of toUpload) {
              const { data: inserted, error: insErr } = await supabase.from('companies').insert({
                user_id: user.id,
                cnpj: item.cnpj,
                razao_social: item.razao_social,
                cep: item.cep || null,
                logradouro: item.logradouro || null,
                numero: item.numero || null,
                complemento: item.complemento || null,
                bairro: item.bairro || null,
                cidade: item.cidade || null,
                estado: item.estado || null,
                status: item.status || 'active'
              }).select().single();

              if (!insErr && inserted) {
                remote.unshift(inserted);
              }
            }
          }
        } catch (syncErr) {
          console.warn('Auto-sync local companies failed:', syncErr);
        }
      }

      const existingRemoteIds = new Set(remote.map(c => c.id));
      const combined = [...remote, ...locals.filter(c => !existingRemoteIds.has(c.id))];

      setCompanies(combined);
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
      setCompanies(getLocalCompanies());
    }
  };

  const handleCEPChange = async (cepValue: string) => {
    const formatted = formatCEP(cepValue);
    setFormData(prev => ({ ...prev, cep: formatted }));
    
    if (formatted.length === 9) {
      const address = await fetchAddress(formatted);
      if (address) {
        setFormData(prev => ({
          ...prev,
          logradouro: address.logradouro || prev.logradouro,
          bairro: address.bairro || prev.bairro,
          cidade: address.localidade || prev.cidade,
          estado: address.uf || prev.estado
        }));
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === "cnpj") {
      setFormData(prev => ({ ...prev, cnpj: formatCNPJ(value) }));
    } else if (field === "cep") {
      handleCEPChange(value);
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cnpj || !formData.razao_social) {
      toast({
        title: "Campos obrigatórios",
        description: "CNPJ e Razão Social são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    if (!isValidCNPJ(formData.cnpj)) {
      toast({
        title: "CNPJ inválido",
        description: "Verifique os 14 dígitos do CNPJ digitado.",
        variant: "destructive"
      });
      return;
    }

    let result;
    if (editingCompany) {
      result = await updateCompany(editingCompany.id, formData);
    } else {
      result = await createCompany(formData);
    }

    if (result) {
      resetForm();
      fetchCompanies();
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      cnpj: company.cnpj || "",
      razao_social: company.razao_social || "",
      cep: company.cep || "",
      logradouro: company.logradouro || "",
      numero: company.numero || "",
      complemento: company.complemento || "",
      bairro: company.bairro || "",
      cidade: company.cidade || "",
      estado: company.estado || "",
      status: company.status || "active"
    });
    setShowForm(true);
  };

  const handleDeleteRequest = async (company: Company) => {
    const result = await deleteCompany(company);
    if (result.hasEntries) {
      setCannotDeleteDialog(company);
    } else if (result.success) {
      fetchCompanies();
    }
  };

  const handleInactivateCompany = async (company: Company) => {
    await toggleCompanyStatus(company, 'inactive');
    setCannotDeleteDialog(null);
    fetchCompanies();
  };

  const resetForm = () => {
    setFormData({
      cnpj: "",
      razao_social: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      status: "active"
    });
    setShowForm(false);
    setEditingCompany(null);
  };

  const filteredCompanies = companies.filter(company => 
    company.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Empresas para Entradas</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Cadastre as empresas e clientes responsáveis pelas entradas financeiras (caixa)
              </p>
            </div>
          </div>
          {!showForm && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Empresa
            </Button>
          )}
        </div>

        {/* Form Card */}
        {showForm && (
          <Card className="border shadow-lg bg-card/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5 text-primary" />
                {editingCompany ? "Editar Empresa" : "Cadastrar Nova Empresa"}
              </CardTitle>
              <CardDescription>
                Preencha os dados da empresa. O CEP realiza a busca automática de endereço.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CNPJ */}
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input
                      id="cnpj"
                      placeholder="00.000.000/0000-00"
                      value={formData.cnpj}
                      onChange={(e) => handleInputChange("cnpj", e.target.value)}
                      maxLength={18}
                      required
                    />
                  </div>

                  {/* Razão Social */}
                  <div className="space-y-2">
                    <Label htmlFor="razao_social">Razão Social *</Label>
                    <Input
                      id="razao_social"
                      placeholder="Razão Social da empresa"
                      value={formData.razao_social}
                      onChange={(e) => handleInputChange("razao_social", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Endereço - CEP com busca automática */}
                <div className="pt-2">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" /> Endereço da Empresa
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        placeholder="00000-000"
                        value={formData.cep}
                        onChange={(e) => handleInputChange("cep", e.target.value)}
                        maxLength={9}
                      />
                      {isFetchingCEP && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="logradouro">Logradouro</Label>
                      <Input
                        id="logradouro"
                        placeholder="Rua, Avenida, Alameda..."
                        value={formData.logradouro}
                        onChange={(e) => handleInputChange("logradouro", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                    <div className="space-y-2">
                      <Label htmlFor="numero">Número</Label>
                      <Input
                        id="numero"
                        placeholder="123"
                        value={formData.numero}
                        onChange={(e) => handleInputChange("numero", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="complemento">Complemento</Label>
                      <Input
                        id="complemento"
                        placeholder="Sala 101, Bloco A"
                        value={formData.complemento}
                        onChange={(e) => handleInputChange("complemento", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                    <div className="space-y-2">
                      <Label htmlFor="bairro">Bairro</Label>
                      <Input
                        id="bairro"
                        placeholder="Bairro"
                        value={formData.bairro}
                        onChange={(e) => handleInputChange("bairro", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        placeholder="Cidade"
                        value={formData.cidade}
                        onChange={(e) => handleInputChange("cidade", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estado">Estado (UF)</Label>
                      <Input
                        id="estado"
                        placeholder="SP"
                        value={formData.estado}
                        onChange={(e) => handleInputChange("estado", e.target.value)}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2 pt-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) => handleInputChange("status", val)}
                  >
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="inactive">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading} className="gap-2">
                    <Save className="h-4 w-4" />
                    {isLoading ? "Salvando..." : editingCompany ? "Atualizar Empresa" : "Cadastrar Empresa"}
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
                <CardTitle className="text-lg">Empresas Cadastradas ({filteredCompanies.length})</CardTitle>
                <CardDescription>Consulte ou gerencie as empresas de onde provêm suas entradas.</CardDescription>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por CNPJ ou Razão Social..."
                  className="pl-9 text-xs sm:text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredCompanies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Nenhuma empresa encontrada para a pesquisa." : "Nenhuma empresa cadastrada ainda."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="p-4 rounded-lg border bg-card/50 space-y-3 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-base flex items-center gap-2">
                          <Building className="h-4 w-4 text-primary shrink-0" />
                          {company.razao_social}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">CNPJ: {company.cnpj}</p>
                      </div>
                      <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                        {company.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>

                    {(company.logradouro || company.cidade) && (
                      <p className="text-xs text-muted-foreground">
                        📍 {[
                          company.logradouro && `${company.logradouro}${company.numero ? `, ${company.numero}` : ''}`,
                          company.bairro,
                          company.cidade && company.estado && `${company.cidade} - ${company.estado}`,
                          company.cep && `CEP: ${company.cep}`
                        ].filter(Boolean).join(" | ")}
                      </p>
                    )}

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleCompanyStatus(company, company.status === 'active' ? 'inactive' : 'active')}
                        title={company.status === 'active' ? 'Inativar empresa' : 'Ativar empresa'}
                      >
                        <Power className={`h-4 w-4 ${company.status === 'active' ? 'text-amber-500' : 'text-emerald-500'}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(company)}
                      >
                        <Edit className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteCandidate(company)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para confirmar exclusão simples */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa <strong>{deleteCandidate?.razao_social}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteCandidate) handleDeleteRequest(deleteCandidate);
                setDeleteCandidate(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog quando não pode excluir por ter movimentações vinculadas */}
      <AlertDialog open={!!cannotDeleteDialog} onOpenChange={() => setCannotDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível excluir a empresa</AlertDialogTitle>
            <AlertDialogDescription>
              A empresa <strong>{cannotDeleteDialog?.razao_social}</strong> possui entradas ou movimentações vinculadas e não pode ser excluída para preservar o histórico financeiro.
              <br /><br />
              Deseja alterar o status da empresa para <strong>Inativa</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cannotDeleteDialog) handleInactivateCompany(cannotDeleteDialog);
              }}
            >
              Inativar Empresa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyForm;
