import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Landmark, Plus, Search, Trash2, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBankOperations } from "@/hooks/useBankOperations";
import { translateErrorMessage } from "@/lib/errorMessages";
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

interface Bank {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const BanksList = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { deleteBank: deleteBankWithAudit } = useBankOperations();

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) {
        throw error;
      }

      setBanks(data || []);
    } catch (error: any) {
      console.error('Error fetching banks:', error);
      toast({
        title: "Erro ao carregar bancos",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteBank = async (bankToDelete: Bank) => {
    const success = await deleteBankWithAudit(bankToDelete);
    
    if (success) {
      setBanks(banks.filter(bank => bank.id !== bankToDelete.id));
    }
  };

  const filteredBanks = banks.filter(bank =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <Landmark className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Bancos</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie os bancos cadastrados
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/bancos/novo")} className="flex-shrink-0">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo Banco</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar bancos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Banks List */}
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Carregando bancos...</p>
          </div>
        ) : filteredBanks.length === 0 ? (
          <div className="text-center py-8">
            <Landmark className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">
              {searchTerm ? "Nenhum banco encontrado" : "Nenhum banco cadastrado"}
            </p>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Tente buscar com outros termos" 
                : "Comece cadastrando seu primeiro banco"
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => navigate("/bancos/novo")}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Primeiro Banco
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBanks.map((bank) => (
              <Card key={bank.id} className="border-0 shadow-sm bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Landmark className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{bank.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Cadastrado em {new Date(bank.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/bancos/editar/${bank.id}`)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir banco</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o banco "{bank.name}"? 
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteBank(bank)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BanksList;