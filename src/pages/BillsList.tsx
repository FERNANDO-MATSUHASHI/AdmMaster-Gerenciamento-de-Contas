import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Building2, 
  Search,
  Calendar,
  DollarSign,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Check,
  Receipt
} from "lucide-react";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBillStatusUpdate } from "@/hooks/useBillStatusUpdate";
import { translateErrorMessage } from "@/lib/errorMessages";
import { type BillStatus } from "@/lib/billStatusValidation";

const BillsList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updateBillStatus, isUpdating } = useBillStatusUpdate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [bills, setBills] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchBills();
    // Set initial filter based on URL params
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [searchParams]);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          id,
          description,
          due_date,
          amount,
          status,
          payment_type,
          suppliers (name)
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      // Parse Supabase date as local date to avoid timezone shift
      const parseLocalDate = (dateStr: string) => {
        const [year, month, day] = (dateStr || "").split("-").map(Number);
        return new Date(year, (month || 1) - 1, day || 1);
      };

      const formattedBills = data?.map(bill => ({
        id: bill.id,
        description: bill.description,
        dueDate: parseLocalDate(bill.due_date),
        amount: bill.amount,
        supplier: bill.suppliers?.name || 'Sem fornecedor',
        status: bill.status,
        paymentType: bill.payment_type
      })) || [];
      
      // Update status for overdue bills
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const billsWithUpdatedStatus = formattedBills.map(bill => {
        const billDate = new Date(bill.dueDate);
        billDate.setHours(0, 0, 0, 0);
        
        if (bill.status === 'pending' && billDate < today) {
          return { ...bill, status: 'overdue' };
        }
        return bill;
      });
      
      setBills(billsWithUpdatedStatus);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
    }
  };

  // Remove old updateBillStatus function - now using the secure hook

  const deleteBill = async (billId: string) => {
    try {
      const { error } = await supabase
        .from('bills')
        .delete()
        .eq('id', billId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Conta excluída com sucesso!",
      });

      fetchBills();
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir conta",
        variant: "destructive",
      });
    }
  };

  const filteredBills = bills
    .filter(bill => {
      const matchesSearch = bill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filterStatus === "all") return matchesSearch;
      return matchesSearch && bill.status === filterStatus;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'pending':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'paid':
        return 'bg-success/10 text-success border-success/20';
      default:
        return 'bg-secondary/10 text-secondary border-secondary/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'Vencida';
      case 'pending':
        return 'Pendente';
      case 'paid':
        return 'Paga';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-2 sm:px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Voltar</span>
              </Button>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
               <div className="min-w-0">
                 <h1 className="text-lg sm:text-xl font-semibold truncate">
                   {filterStatus === 'overdue' ? 'Contas Vencidas' : 
                    filterStatus === 'pending' ? 'Contas à Vencer' : 
                    'Todas as Contas'}
                 </h1>
                 <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                   {filterStatus === 'overdue' ? 'Contas que já passaram do vencimento' : 
                    filterStatus === 'pending' ? 'Contas que vencem nos próximos dias' : 
                    'Gerencie todas as suas contas a pagar'}
                 </p>
               </div>
            </div>
            
            <Button size="sm" onClick={() => navigate("/contas/nova")} className="flex-shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Nova Conta</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-2 sm:px-4 py-6">
        {/* Search and Filter */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={filterStatus === "all" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              Todas
            </Button>
            <Button 
              variant={filterStatus === "pending" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterStatus("pending")}
            >
              Pendentes
            </Button>
            <Button 
              variant={filterStatus === "overdue" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterStatus("overdue")}
            >
              Vencidas
            </Button>
            <Button 
              variant={filterStatus === "paid" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterStatus("paid")}
            >
              Pagas
            </Button>
          </div>
        </div>

        {/* Bills List */}
        <div className="grid gap-4">
          {filteredBills.map((bill) => (
            <Card key={bill.id} className="border-0 shadow-sm bg-card/60 backdrop-blur-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className="font-semibold text-lg">{bill.description}</h3>
                    <Badge className={`${getStatusColor(bill.status)} w-fit`}>
                      {getStatusText(bill.status)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">Fornecedor:</span>
                      <span className="text-sm font-medium truncate">{bill.supplier}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">Vencimento:</span>
                      <span className="text-sm font-medium">
                        {format(bill.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">Valor:</span>
                      <span className="text-sm font-semibold text-primary">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(bill.amount)}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Receipt className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">Tipo:</span>
                      <span className="text-sm font-medium">
                        {bill.paymentType === 'cheque' ? 'Cheque' : 'Conta'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {bill.status !== 'paid' && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/contas/editar/${bill.id}`)}
                          className="flex-1 sm:flex-none"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
                              <Trash2 className="w-4 h-4 mr-1" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a conta "{bill.description}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteBill(bill.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    
                    {bill.status !== 'paid' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="w-full sm:w-auto"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Marcar como Paga
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja marcar esta conta como paga? 
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => updateBillStatus(bill, 'paid' as BillStatus, fetchBills)}
                              className="bg-green-500 hover:bg-green-600"
                              disabled={isUpdating}
                            >
                              {isUpdating ? "Processando..." : "Confirmar Pagamento"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredBills.length === 0 && (
          <Card className="border-0 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma conta encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "Tente ajustar os termos de busca ou cadastre uma nova conta."
                  : "Você ainda não tem contas cadastradas. Que tal cadastrar a primeira?"}
              </p>
              <Button onClick={() => navigate("/contas/nova")}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Nova Conta
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BillsList;