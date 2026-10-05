import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Save, Plus, Edit, Trash2, Calendar, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSupplierOperations } from "@/hooks/useSupplierOperations";
import { formatPhoneNumber } from "@/lib/phoneFormatter";
import { formatCNPJ } from "@/lib/cnpjFormatter";
import { useViaCEP } from "@/hooks/useViaCEP";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { getLocalSupplierTypes } from "./SupplierTypes";

const SupplierForm = () => {
  const navigate = useNavigate();
  const { createSupplier, updateSupplier, deleteSupplier, isLoading } = useSupplierOperations();
  const [supplierTypes, setSupplierTypes] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const { fetchAddress, formatCEP, isLoading: isFetchingCEP } = useViaCEP();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cnpj: "",
    type_id: "",
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: ""
  });

  useEffect(() => {
    fetchSupplierTypes();
    fetchSuppliers();
  }, []);

  const fetchSupplierTypes = async () => {
    try {
      let remote: any[] = [];
      try {
        const { data, error } = await supabase
          .from('supplier_types')
          .select('*')
          .order('name');

        if (!error && data) remote = data;
      } catch (e) {
        console.warn('Remote supplier types fetch failed:', e);
      }

      const locals = getLocalSupplierTypes();
      const existingIds = new Set(remote.map(t => t.id));
      const combined = [...remote, ...locals.filter(t => !existingIds.has(t.id))];

      setSupplierTypes(combined);
    } catch (error) {
      console.error('Erro ao buscar tipos de fornecedor:', error);
      setSupplierTypes(getLocalSupplierTypes());
    }
  };

  const fetchSuppliers = async () => {
    try {
      let data: any[] = [];
      try {
        const { data: remoteData, error } = await supabase
          .from('suppliers')
          .select(`
            *,
            supplier_types (
              name
            )
          `)
          .order('created_at', { ascending: false });

        if (!error && remoteData) {
          data = remoteData;
        } else {
          // Retry simple query if relation fails
          const { data: simpleData } = await supabase
            .from('suppliers')
            .select('*')
            .order('created_at', { ascending: false });
          if (simpleData) data = simpleData;
        }
      } catch (e) {
        console.warn('Remote suppliers fetch failed:', e);
      }

      // Map local supplier_types if relation missing
      const localTypes = getLocalSupplierTypes();
      const typeMap = new Map(localTypes.map(t => [t.id, t.name]));

      const enriched = data.map(s => {
        if (!s.supplier_types && s.type_id && typeMap.has(s.type_id)) {
          return {
            ...s,
            supplier_types: { name: typeMap.get(s.type_id) }
          };
        }
        return s;
      });

      setSuppliers(enriched);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build full address from parts
    const addressParts = [];
    if (formData.logradouro) {
      let streetAddress = formData.logradouro;
      if (formData.numero) streetAddress += `, ${formData.numero}`;
      addressParts.push(streetAddress);
    }
    if (formData.bairro) addressParts.push(formData.bairro);
    if (formData.cidade && formData.estado) addressParts.push(`${formData.cidade} - ${formData.estado}`);
    if (formData.cep) addressParts.push(`CEP: ${formData.cep}`);
    if (formData.cnpj) addressParts.push(`CNPJ: ${formData.cnpj}`);
    
    const fullAddress = addressParts.join(" | ");

    const supplierFormData = {
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: fullAddress || undefined,
      type_id: formData.type_id || undefined
    };

    let result;
    if (editingSupplier) {
      result = await updateSupplier(editingSupplier, supplierFormData);
    } else {
      result = await createSupplier(supplierFormData);
    }

    if (result) {
      navigate("/dashboard");
    }
  };

  const handleCEPChange = async (cep: string) => {
    const formatted = formatCEP(cep);
    setFormData(prev => ({ ...prev, cep: formatted }));
    
    // Only fetch if CEP is complete
    if (formatted.length === 9) {
      const address = await fetchAddress(formatted);
      if (address) {
        setFormData(prev => ({
          ...prev,
          logradouro: address.logradouro,
          bairro: address.bairro,
          cidade: address.localidade,
          estado: address.uf
        }));
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === "phone") {
      setFormData(prev => ({ ...prev, [field]: formatPhoneNumber(value) }));
    } else if (field === "cnpj") {
      setFormData(prev => ({ ...prev, [field]: formatCNPJ(value) }));
    } else if (field === "cep") {
      handleCEPChange(value);
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    
    // Parse address parts from stored address field
    let cep = "";
    let logradouro = "";
    let numero = "";
    let bairro = "";
    let cidade = "";
    let estado = "";
    let cnpj = "";
    
    if (supplier.address) {
      const parts = supplier.address.split(" | ");
      
      // Extract CEP
      const cepPart = parts.find((part: string) => part.startsWith("CEP: "));
      if (cepPart) {
        cep = cepPart.replace("CEP: ", "");
      }
      
      // Extract CNPJ
      const cnpjPart = parts.find((part: string) => part.startsWith("CNPJ: "));
      if (cnpjPart) {
        cnpj = cnpjPart.replace("CNPJ: ", "");
      }
      
      // Extract street address (first part, may contain number)
      if (parts[0] && !parts[0].startsWith("CEP:") && !parts[0].startsWith("CNPJ:")) {
        const streetParts = parts[0].split(", ");
        logradouro = streetParts[0] || "";
        numero = streetParts[1] || "";
      }
      
      // Extract neighborhood
      if (parts[1] && !parts[1].startsWith("CEP:") && !parts[1].startsWith("CNPJ:")) {
        bairro = parts[1];
      }
      
      // Extract city and state
      const cityStatePart = parts.find((part: string) => part.includes(" - ") && !part.startsWith("CEP:") && !part.startsWith("CNPJ:"));
      if (cityStatePart) {
        const [c, s] = cityStatePart.split(" - ");
        cidade = c || "";
        estado = s || "";
      }
    }
    
    setFormData({
      name: supplier.name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      cnpj: cnpj,
      type_id: supplier.type_id || "",
      cep: cep,
      logradouro: logradouro,
      numero: numero,
      bairro: bairro,
      cidade: cidade,
      estado: estado
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (supplier: any) => {
    const success = await deleteSupplier(supplier);
    
    if (success) {
      fetchSuppliers();
    }
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      cnpj: "",
      type_id: "",
      cep: "",
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: ""
    });
    setShowForm(false);
    setEditingSupplier(null);
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
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                {showForm ? (editingSupplier ? "Editar Fornecedor" : "Cadastro de Fornecedor") : "Fornecedores"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {showForm ? "Preencha os dados do fornecedor" : "Gerencie seus fornecedores cadastrados"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {!showForm ? (
          // Suppliers List View
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <h2 className="text-2xl font-bold">Lista de Fornecedores</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial sm:min-w-[300px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar fornecedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button onClick={() => setShowForm(true)} className="flex items-center gap-2 whitespace-nowrap">
                  <Plus className="w-4 h-4" />
                  Novo Fornecedor
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {suppliers.length === 0 ? (
                <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhum fornecedor cadastrado</h3>
                      <p className="text-muted-foreground mb-4">
                        Comece adicionando seu primeiro fornecedor
                      </p>
                      <Button onClick={() => setShowForm(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Fornecedor
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                suppliers
                  .filter((supplier) => {
                    if (!searchTerm) return true;
                    const search = searchTerm.toLowerCase();
                    return (
                      supplier.name?.toLowerCase().includes(search) ||
                      supplier.email?.toLowerCase().includes(search) ||
                      supplier.phone?.toLowerCase().includes(search) ||
                      supplier.address?.toLowerCase().includes(search) ||
                      supplier.supplier_types?.name?.toLowerCase().includes(search)
                    );
                  })
                  .map((supplier) => (
                  <Card key={supplier.id} className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{supplier.name}</h3>
                            {supplier.supplier_types && (
                              <Badge variant="secondary">
                                {supplier.supplier_types.name}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {supplier.email && (
                              <p>📧 {supplier.email}</p>
                            )}
                            {supplier.phone && (
                              <p>📞 {supplier.phone}</p>
                            )}
                            {supplier.address && (() => {
                              const parts = supplier.address.split(" | ");
                              const address = parts[0];
                              const cnpjPart = parts.find((part: string) => part.startsWith("CNPJ: "));
                              
                              return (
                                <>
                                  {address && <p>📍 {address}</p>}
                                  {cnpjPart && <p>🏢 {cnpjPart}</p>}
                                </>
                              );
                            })()}
                            <div className="flex items-center gap-1 mt-2">
                              <Calendar className="w-3 h-3" />
                              <span>Criado em {format(new Date(supplier.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(supplier)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o fornecedor "{supplier.name}"? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDelete(supplier)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : (
          // Form View
          <div className="max-w-2xl mx-auto">
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>
                  {editingSupplier ? "Editar Fornecedor" : "Informações do Fornecedor"}
                </CardTitle>
                <CardDescription>
                  Preencha todos os campos obrigatórios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Dados Básicos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="name">Nome da Empresa *</Label>
                      <Input
                        id="name"
                        placeholder="Nome completo da empresa"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="contato@empresa.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        placeholder="(11) 99999-9999"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between h-5 mb-1.5">
                        <Label htmlFor="cnpj">CNPJ</Label>
                      </div>
                      <Input
                        id="cnpj"
                        placeholder="00.000.000/0000-00"
                        value={formData.cnpj}
                        onChange={(e) => handleInputChange("cnpj", e.target.value)}
                        maxLength={18}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between h-5 mb-1.5">
                        <Label htmlFor="type_id">Tipo de Fornecedor</Label>
                        <Button 
                          type="button" 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0 text-xs text-primary font-medium"
                          onClick={() => navigate("/tipos-fornecedor")}
                        >
                          + Gerenciar Tipos
                        </Button>
                      </div>
                      <Select value={formData.type_id} onValueChange={(value) => handleInputChange("type_id", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplierTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Endereço</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1">
                        <Label htmlFor="cep">CEP</Label>
                        <Input
                          id="cep"
                          placeholder="00000-000"
                          value={formData.cep}
                          onChange={(e) => handleInputChange("cep", e.target.value)}
                          maxLength={9}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-3">
                        <Label htmlFor="logradouro">Rua</Label>
                        <Input
                          id="logradouro"
                          placeholder="Nome da rua"
                          value={formData.logradouro}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      
                      <div className="md:col-span-1">
                        <Label htmlFor="numero">Número</Label>
                        <Input
                          id="numero"
                          placeholder="Nº"
                          value={formData.numero}
                          onChange={(e) => handleInputChange("numero", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="bairro">Bairro</Label>
                        <Input
                          id="bairro"
                          placeholder="Bairro"
                          value={formData.bairro}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="cidade">Cidade</Label>
                        <Input
                          id="cidade"
                          placeholder="Cidade"
                          value={formData.cidade}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="estado">Estado</Label>
                        <Input
                          id="estado"
                          placeholder="UF"
                          value={formData.estado}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-4 pt-6">
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading || isFetchingCEP}>
                      <Save className="w-4 h-4 mr-2" />
                      {isLoading || isFetchingCEP ? "Salvando..." : (editingSupplier ? "Atualizar" : "Salvar Fornecedor")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierForm;