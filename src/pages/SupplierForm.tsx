import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Save, Plus, Edit, Trash2, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSupplierOperations } from "@/hooks/useSupplierOperations";
import { formatPhoneNumber } from "@/lib/phoneFormatter";
import { formatCNPJ } from "@/lib/cnpjFormatter";
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

const SupplierForm = () => {
  const navigate = useNavigate();
  const { createSupplier, updateSupplier, deleteSupplier, isLoading } = useSupplierOperations();
  const [supplierTypes, setSupplierTypes] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    cnpj: "",
    type_id: ""
  });

  useEffect(() => {
    fetchSupplierTypes();
    fetchSuppliers();
  }, []);

  const fetchSupplierTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setSupplierTypes(data || []);
    } catch (error) {
      console.error('Erro ao buscar tipos de fornecedor:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select(`
          *,
          supplier_types (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Store CNPJ and address separately in the address field with a delimiter
    const addressParts = [];
    if (formData.address) addressParts.push(formData.address);
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
      // Reset form and fetch suppliers
      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
        cnpj: "",
        type_id: ""
      });
      setShowForm(false);
      setEditingSupplier(null);
      fetchSuppliers();
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === "phone") {
      setFormData(prev => ({ ...prev, [field]: formatPhoneNumber(value) }));
    } else if (field === "cnpj") {
      setFormData(prev => ({ ...prev, [field]: formatCNPJ(value) }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    
    // Parse address and CNPJ from stored address field
    let address = "";
    let cnpj = "";
    
    if (supplier.address) {
      const parts = supplier.address.split(" | ");
      address = parts[0] || "";
      
      // Look for CNPJ in the parts
      const cnpjPart = parts.find((part: string) => part.startsWith("CNPJ: "));
      if (cnpjPart) {
        cnpj = cnpjPart.replace("CNPJ: ", "");
      }
    }
    
    setFormData({
      name: supplier.name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: address,
      cnpj: cnpj,
      type_id: supplier.type_id || ""
    });
    setShowForm(true);
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
      address: "",
      cnpj: "",
      type_id: ""
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
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Lista de Fornecedores</h2>
              <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Novo Fornecedor
              </Button>
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
                suppliers.map((supplier) => (
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
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        placeholder="00.000.000/0000-00"
                        value={formData.cnpj}
                        onChange={(e) => handleInputChange("cnpj", e.target.value)}
                        maxLength={18}
                      />
                    </div>

                    <div>
                      <Label htmlFor="type_id">Tipo de Fornecedor</Label>
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
                    
                    <div>
                      <Label htmlFor="address">Endereço Completo</Label>
                      <Input
                        id="address"
                        placeholder="Rua, número, bairro, cidade - UF, CEP"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-4 pt-6">
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      <Save className="w-4 h-4 mr-2" />
                      {isLoading ? "Salvando..." : (editingSupplier ? "Atualizar" : "Salvar Fornecedor")}
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