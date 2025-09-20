import { useState, useEffect, useCallback } from "react";
import { CalendarWithBills } from "@/components/CalendarWithBills";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Building2, 
  Plus, 
  Calendar as CalendarIcon, 
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Menu,
  LogOut,
  Landmark
} from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Extend the Window interface to include inactivityTimer
declare global {
  interface Window {
    inactivityTimer: NodeJS.Timeout;
  }
}

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [allBills, setAllBills] = useState<any[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pendingBills: 0,
    overdueBills: 0,
    totalAmount: 0,
    paidBills: 0
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Auto-logout após 10 minutos de inatividade
  const resetTimer = useCallback(() => {
    clearTimeout(window.inactivityTimer);
    window.inactivityTimer = setTimeout(() => {
      handleLogout();
    }, 10 * 60 * 1000); // 10 minutos
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Sessão encerrada com sucesso.",
      });
      navigate("/");
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer logout.",
        variant: "destructive",
      });
    }
  };

  // Detectar atividade do usuário
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const resetTimerHandler = () => resetTimer();
    
    events.forEach(event => {
      document.addEventListener(event, resetTimerHandler, true);
    });

    // Iniciar timer
    resetTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimerHandler, true);
      });
      clearTimeout(window.inactivityTimer);
    };
  }, [resetTimer]);

  useEffect(() => {
    fetchBills();
    fetchStats();
  }, []);

  const fetchBills = async () => {
    try {
      // Buscar todas as contas
      const { data: allBillsData, error: allBillsError } = await supabase
        .from('bills')
        .select(`
          id,
          description,
          due_date,
          amount,
          status,
          suppliers (name)
        `)
        .order('due_date', { ascending: true });

      if (allBillsError) throw allBillsError;

      // Parse Supabase date (YYYY-MM-DD) as local date to avoid timezone shift
      const parseLocalDate = (dateStr: string) => {
        const [year, month, day] = (dateStr || "").split("-").map(Number);
        return new Date(year, (month || 1) - 1, day || 1);
      };

      const formattedAllBills = allBillsData?.map((bill) => ({
        id: bill.id,
        description: bill.description,
        dueDate:
          typeof bill.due_date === "string"
            ? parseLocalDate(bill.due_date)
            : new Date(bill.due_date),
        amount: bill.amount,
        supplier: bill.suppliers?.name || "Sem fornecedor",
        status: bill.status,
      })) || [];
      
      // Atualizar status das contas baseado na data atual ANTES de salvar
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const billsWithUpdatedStatus = formattedAllBills.map(bill => {
        const billDate = new Date(bill.dueDate);
        billDate.setHours(0, 0, 0, 0);
        
        if (bill.status === 'pending' && billDate < today) {
          return { ...bill, status: 'overdue' };
        }
        return bill;
      });

      setAllBills(billsWithUpdatedStatus);

      // Filtrar próximas contas (próximos 10 dias, excluindo pagas e vencidas)
      const next10Days = new Date();
      next10Days.setDate(today.getDate() + 10);
      
      const upcoming = billsWithUpdatedStatus.filter(bill => 
        bill.status === 'pending' &&
        bill.dueDate >= today && 
        bill.dueDate <= next10Days
      ).slice(0, 10);
      
      setUpcomingBills(upcoming);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: bills } = await supabase
        .from('bills')
        .select('amount, status, due_date');

      if (bills) {
        // Parse dates and update status for overdue bills
        const parseLocalDate = (dateStr: string) => {
          const [year, month, day] = (dateStr || "").split("-").map(Number);
          return new Date(year, (month || 1) - 1, day || 1);
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const billsWithUpdatedStatus = bills.map(bill => {
          const billDate = parseLocalDate(bill.due_date);
          billDate.setHours(0, 0, 0, 0);
          
          if (bill.status === 'pending' && billDate < today) {
            return { ...bill, status: 'overdue' };
          }
          return bill;
        });

        const totalAmount = billsWithUpdatedStatus.reduce((sum, bill) => sum + Number(bill.amount), 0);
        const paidBills = billsWithUpdatedStatus.filter(bill => bill.status === 'paid').length;
        const pendingBills = billsWithUpdatedStatus.filter(bill => bill.status === 'pending').length;
        const overdueBills = billsWithUpdatedStatus.filter(bill => bill.status === 'overdue').length;
        
        setStats({
          pendingBills,
          overdueBills,
          totalAmount,
          paidBills
        });
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const statsCards = [
    {
      title: "Contas a Vencer",
      value: stats.pendingBills.toString(),
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      title: "Contas Vencidas",
      value: stats.overdueBills.toString(),
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10"
    },
    {
      title: "Total do Mês",
      value: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(stats.totalAmount),
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Pagas",
      value: stats.paidBills.toString(),
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10"
    }
  ];

  const MobileMenu = () => (
    <div className="space-y-4 p-4">
      <Button 
        variant="outline" 
        className="w-full justify-start" 
        onClick={() => {
          navigate("/tipos-fornecedor");
          setMobileMenuOpen(false);
        }}
      >
        <Plus className="w-4 h-4 mr-2" />
        Tipos de Fornecedor
      </Button>
      <Button 
        variant="outline" 
        className="w-full justify-start" 
        onClick={() => {
          navigate("/fornecedores/novo");
          setMobileMenuOpen(false);
        }}
      >
        <Plus className="w-4 h-4 mr-2" />
        Novo Fornecedor
      </Button>
      <Button 
        variant="outline" 
        className="w-full justify-start" 
        onClick={() => {
          navigate("/bancos");
          setMobileMenuOpen(false);
        }}
      >
        <Landmark className="w-4 h-4 mr-2" />
        Bancos
      </Button>
      <Button 
        className="w-full justify-start" 
        onClick={() => {
          navigate("/contas/nova");
          setMobileMenuOpen(false);
        }}
      >
        <Plus className="w-4 h-4 mr-2" />
        Nova Conta
      </Button>
      <hr className="border-border" />
      <Button 
        variant="destructive" 
        className="w-full justify-start" 
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold">Gerenciador de Contas</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center space-x-2">
              <Button size="sm" variant="outline" onClick={() => navigate("/tipos-fornecedor")}>
                <Plus className="w-4 h-4 mr-2" />
                Tipos de Fornecedor
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/fornecedores/novo")}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Fornecedor
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/bancos")}>
                <Landmark className="w-4 h-4 mr-2" />
                Bancos
              </Button>
              <Button size="sm" onClick={() => navigate("/contas/nova")}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta
              </Button>
              <Button size="sm" variant="destructive" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>

            {/* Mobile Menu */}
            <div className="lg:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <div className="mt-6">
                    <h2 className="text-lg font-semibold mb-4">Menu</h2>
                    <MobileMenu />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {statsCards.map((stat, index) => (
            <Card key={index} className="border-0 shadow-sm bg-card/60 backdrop-blur-sm">
              <CardContent className="p-2 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                  <div className="w-full sm:w-auto">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-lg sm:text-2xl font-bold truncate">{stat.value}</p>
                  </div>
                  <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor} self-end sm:self-auto`}>
                    <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-3 border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center text-base sm:text-lg">
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Calendário de Vencimentos
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Visualize suas contas organizadas por data de vencimento
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              <CalendarWithBills 
                bills={allBills}
                onDateSelect={setSelectedDate}
              />
            </CardContent>
          </Card>

          {/* Right Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Overdue Bills */}
            {allBills.filter(bill => bill.status === 'overdue').length > 0 && (
              <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center text-sm sm:text-base">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-destructive" />
                    Contas Vencidas
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Contas que já passaram do vencimento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  {allBills
                    .filter(bill => bill.status === 'overdue')
                    .slice(0, 5)
                    .map((bill) => (
                    <div key={bill.id} className="p-2 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="flex items-start justify-between mb-1 sm:mb-2">
                        <h4 className="font-medium text-xs sm:text-sm truncate pr-2">{bill.description}</h4>
                        <Badge variant="destructive" className="text-xs shrink-0">
                          {format(bill.dueDate, "dd/MM")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1 truncate">{bill.supplier}</p>
                      <p className="font-semibold text-destructive text-xs sm:text-sm">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(bill.amount)}
                      </p>
                    </div>
                  ))}
                  
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/contas?status=overdue")}>
                    Ver todas as contas vencidas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Bills */}
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center text-sm sm:text-base">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-warning" />
                  Próximos Vencimentos
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Contas que vencem nos próximos dias
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                {upcomingBills.map((bill) => (
                  <div key={bill.id} className="p-2 sm:p-3 rounded-lg bg-secondary/50 border">
                    <div className="flex items-start justify-between mb-1 sm:mb-2">
                      <h4 className="font-medium text-xs sm:text-sm truncate pr-2">{bill.description}</h4>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {format(bill.dueDate, "dd/MM")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1 truncate">{bill.supplier}</p>
                    <p className="font-semibold text-primary text-xs sm:text-sm">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(bill.amount)}
                    </p>
                  </div>
                ))}
                
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm" onClick={() => navigate("/contas?status=pending")}>
                    Ver contas à vencer
                  </Button>
                  <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm" onClick={() => navigate("/contas")}>
                    Ver todas as contas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;