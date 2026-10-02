import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { translateErrorMessage } from "@/lib/errorMessages";
import { supabase } from "@/integrations/supabase/client";
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

const LOCAL_SUPPLIER_TYPES_KEY = 'adm_master_local_supplier_types';

const defaultUuidMap: Record<string, string> = {
  'default-1': 'a0000000-0000-4000-a000-000000000001',
  'default-2': 'a0000000-0000-4000-a000-000000000002',
  'default-3': 'a0000000-0000-4000-a000-000000000003',
  'default-4': 'a0000000-0000-4000-a000-000000000004',
  'default-5': 'a0000000-0000-4000-a000-000000000005',
  'default-6': 'a0000000-0000-4000-a000-000000000006',
  'default-7': 'a0000000-0000-4000-a000-000000000007',
  'default-8': 'a0000000-0000-4000-a000-000000000008',
};

export const getLocalSupplierTypes = (): any[] => {
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIER_TYPES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let migrated = false;
      const clean = parsed.map((item: any) => {
        if (item.id && defaultUuidMap[item.id]) {
          migrated = true;
          return { ...item, id: defaultUuidMap[item.id] };
        }
        if (item.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)) {
          migrated = true;
          return { ...item, id: crypto.randomUUID() };
        }
        return item;
      });
      if (migrated) {
        localStorage.setItem(LOCAL_SUPPLIER_TYPES_KEY, JSON.stringify(clean));
      }
      return clean;
    }
    const defaults = [
      { id: 'a0000000-0000-4000-a000-000000000001', name: 'Produtos' },
      { id: 'a0000000-0000-4000-a000-000000000002', name: 'Serviços' },
      { id: 'a0000000-0000-4000-a000-000000000003', name: 'Alimentação' },
      { id: 'a0000000-0000-4000-a000-000000000004', name: 'Combustível' },
      { id: 'a0000000-0000-4000-a000-000000000005', name: 'Manutenção' },
      { id: 'a0000000-0000-4000-a000-000000000006', name: 'Serviços Médicos / Saúde' },
      { id: 'a0000000-0000-4000-a000-000000000007', name: 'Transporte / Logística' },
      { id: 'a0000000-0000-4000-a000-000000000008', name: 'Outros' }
    ];
    localStorage.setItem(LOCAL_SUPPLIER_TYPES_KEY, JSON.stringify(defaults));
    return defaults;
  } catch {
    return [];
  }
};

export const saveLocalSupplierTypes = (types: any[]) => {
  try {
    localStorage.setItem(LOCAL_SUPPLIER_TYPES_KEY, JSON.stringify(types));
  } catch (e) {
    console.error('Error saving local supplier types:', e);
  }
};

const SupplierTypes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [types, setTypes] = useState<any[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [editingType, setEditingType] = useState<any>(null);

  useEffect(() => {
    fetchSupplierTypes();
  }, []);

  const fetchSupplierTypes = async () => {
    try {
      let remote: any[] = [];
      try {
        const { data, error } = await supabase
          .from('supplier_types')
          .select('*')
          .order('name');

        if (!error && data) {
          remote = data;
        }
      } catch (e) {
        console.warn('Remote supplier types fetch failed, using local fallback', e);
      }

      const locals = getLocalSupplierTypes();
      const existingIds = new Set(remote.map(t => t.id));
      const combined = [...remote, ...locals.filter(t => !existingIds.has(t.id))];

      setTypes(combined);
    } catch (error) {
      console.error('Erro ao buscar tipos de fornecedor:', error);
      setTypes(getLocalSupplierTypes());
    }
  };

  const handleAddType = async () => {
    if (!newTypeName.trim()) {
      toast({
        title: "Erro",
        description: "Nome do tipo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Try remote insert if authenticated
      if (user) {
        try {
          const { error } = await supabase
            .from('supplier_types')
            .insert({
              user_id: user.id,
              name: newTypeName.trim()
            });

          if (!error) {
            setNewTypeName("");
            fetchSupplierTypes();
            toast({
              title: "Sucesso",
              description: "Tipo de fornecedor criado com sucesso!",
            });
            return;
          }
        } catch (dbError) {
          console.warn('Supabase insert failed, using local storage fallback', dbError);
        }
      }

      // Local storage fallback
      const newTypeObj = {
        id: crypto.randomUUID(),
        name: newTypeName.trim(),
        user_id: user?.id || 'local-user',
        created_at: new Date().toISOString()
      };

      const locals = getLocalSupplierTypes();
      locals.unshift(newTypeObj);
      saveLocalSupplierTypes(locals);

      setNewTypeName("");
      fetchSupplierTypes();

      toast({
        title: "Sucesso",
        description: `Tipo "${newTypeObj.name}" cadastrado com sucesso!`,
      });
    } catch (error) {
      console.error('Erro ao criar tipo:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleEditType = (type: any) => {
    setEditingType({ ...type });
  };

  const handleUpdateType = async () => {
    if (!editingType?.name?.trim()) {
      toast({
        title: "Erro",
        description: "Nome do tipo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      let isRemoteSuccess = false;
      try {
        if (!editingType.id.startsWith('default-') && editingType.user_id !== 'local-user') {
          const { error } = await supabase
            .from('supplier_types')
            .update({ name: editingType.name.trim() })
            .eq('id', editingType.id);
          if (!error) isRemoteSuccess = true;
        }
      } catch (e) {
        console.warn('Remote update failed:', e);
      }

      if (!isRemoteSuccess) {
        const locals = getLocalSupplierTypes();
        const updated = locals.map(t => t.id === editingType.id ? { ...t, name: editingType.name.trim() } : t);
        saveLocalSupplierTypes(updated);
      }

      setEditingType(null);
      fetchSupplierTypes();

      toast({
        title: "Sucesso",
        description: "Tipo de fornecedor atualizado com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao atualizar tipo:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDeleteType = async (typeId: string) => {
    try {
      let isRemoteSuccess = false;
      try {
        if (!typeId.startsWith('default-')) {
          const { error } = await supabase
            .from('supplier_types')
            .delete()
            .eq('id', typeId);
          if (!error) isRemoteSuccess = true;
        }
      } catch (e) {
        console.warn('Remote delete failed:', e);
      }

      if (!isRemoteSuccess) {
        const locals = getLocalSupplierTypes();
        const filtered = locals.filter(t => t.id !== typeId);
        saveLocalSupplierTypes(filtered);
      }

      fetchSupplierTypes();

      toast({
        title: "Sucesso",
        description: "Tipo de fornecedor excluído com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao excluir tipo:', error);
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
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Voltar</span>
            </Button>
            <h1 className="text-xl font-semibold">Tipos de Fornecedores</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Add New Type */}
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Novo Tipo de Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="newType">Nome do Tipo</Label>
                <Input
                  id="newType"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Ex: Serviços, Produtos, Consultoria..."
                  onKeyPress={(e) => e.key === 'Enter' && handleAddType()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddType}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Types List */}
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Tipos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {types.map((type) => (
                <div key={type.id} className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                  {editingType?.id === type.id ? (
                    <div className="flex-1 flex items-center gap-4">
                      <Input
                        value={editingType.name}
                        onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateType()}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateType}>
                          Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingType(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{type.name}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {type.created_at ? `Criado em ${new Date(type.created_at).toLocaleDateString('pt-BR')}` : 'Tipo Padrão'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEditType(type)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o tipo "{type.name}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteType(type.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {types.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum tipo de fornecedor cadastrado ainda.</p>
                  <p>Adicione o primeiro tipo acima.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupplierTypes;