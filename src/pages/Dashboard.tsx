import { useState, useEffect, useCallback, useRef } from "react";
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
  Landmark,
  Eye,
  FileText,
  Image as ImageIcon,
  Users,
  BarChart3,
  Wallet,
  Building,
  ArrowDownLeft,
  Receipt,
  Tag
} from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn, capitalizeFirst, safeParseDate, safeFormatDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getExpenseUsers } from "@/lib/expenseUsers";
import { useExpenseUsers } from "@/hooks/useExpenseUsers";
import { toast } from "@/hooks/use-toast";
import { UserReportModal } from "@/components/UserReportModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Extend the Window interface to include inactivityTimer
declare global {
  interface Window {
    inactivityTimer: NodeJS.Timeout;
  }
}

const Dashboard = () => {
  const { getUserBadgeStyle } = useExpenseUsers();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const currentRefDate = selectedDate || new Date();
  const selectedMonth = currentRefDate.getMonth();
  const selectedYear = currentRefDate.getFullYear();
  const [allBills, setAllBills] = useState<any[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    pendingBills: 0,
    overdueBills: 0,
    totalAmount: 0,
    paidBills: 0,
    paidBillsTotal: 0
  });
  const [userBreakdown, setUserBreakdown] = useState<Array<{ name: string; total: number; count: number; color?: string }>>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // User Report Modal State
  const [selectedUserForReport, setSelectedUserForReport] = useState<string | null>(null);
  const [selectedUserColor, setSelectedUserColor] = useState<string>("#3b82f6");
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);

  const handleOpenUserReport = (userName: string, color?: string) => {
    setSelectedUserForReport(userName);
    setSelectedUserColor(color || "#3b82f6");
    setIsUserModalOpen(true);
  };
  const [paymentProofConfirmDialog, setPaymentProofConfirmDialog] = useState(false);
  const [selectedPaymentProof, setSelectedPaymentProof] = useState<{file: File, billId: string} | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const navigate = useNavigate();

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-logout após 10 minutos de inatividade
  const resetTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, 10 * 60 * 1000); // 10 minutos
  }, []);

  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      await signOut();
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
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetTimer]);

  useEffect(() => {
    fetchBills();
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchStats(selectedDate);
    }
  }, [selectedDate]);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  const fetchBills = async () => {
    try {
      // Buscar todas as contas
      const { data: allBillsData, error: allBillsError } = await supabase
        .from('bills')
        .select(`
          *,
          suppliers (name),
          banks (name)
        `)
        .order('due_date', { ascending: true });

      if (allBillsError) throw allBillsError;

      const formattedAllBills = allBillsData?.map((bill) => ({
        id: bill.id,
        description: bill.description,
        dueDate: safeParseDate(bill.due_date),
        amount: bill.amount,
        supplier: bill.suppliers?.name || "Sem fornecedor",
        status: bill.status,
        attachmentUrl: bill.attachment_url,
        paymentProofUrl: bill.payment_proof_url,
        paymentType: bill.payment_type,
        checkNumber: bill.check_number,
        bankName: bill.banks?.name,
        accountHolder: bill.account_holder,
        billType: ((bill as any).bill_type === 'despesa' || bill.payment_type === 'despesa') ? 'despesa' : 'conta',
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

  const fetchStats = async (referenceDate: Date = new Date()) => {
    try {
      const { data: bills } = await supabase
        .from('bills')
        .select('amount, status, due_date, account_holder');

      if (bills) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const selectedMonth = referenceDate.getMonth();
        const selectedYear = referenceDate.getFullYear();
        
        const billsWithUpdatedStatus = bills.map(bill => {
          const billDate = safeParseDate(bill.due_date);
          billDate.setHours(0, 0, 0, 0);
          
          if (bill.status === 'pending' && billDate < today) {
            return { ...bill, status: 'overdue', dueDate: billDate };
          }
          return { ...bill, dueDate: billDate };
        });

        // Contas a Vencer: contas pendentes do mês selecionado com vencimento >= hoje
        const pendingBills = billsWithUpdatedStatus.filter(bill => {
          const billMonth = bill.dueDate.getMonth();
          const billYear = bill.dueDate.getFullYear();
          return bill.status === 'pending' && 
                 bill.dueDate >= today &&
                 billMonth === selectedMonth &&
                 billYear === selectedYear;
        }).length;
        
        // Contas Vencidas: contas com status overdue do mês selecionado
        const overdueBills = billsWithUpdatedStatus.filter(bill => {
          const billMonth = bill.dueDate.getMonth();
          const billYear = bill.dueDate.getFullYear();
          return bill.status === 'overdue' &&
                 billMonth === selectedMonth &&
                 billYear === selectedYear;
        }).length;
        
        // Total do Mês: soma das contas pendentes e vencidas do mês selecionado
        const totalAmount = billsWithUpdatedStatus
          .filter(bill => {
            const billMonth = bill.dueDate.getMonth();
            const billYear = bill.dueDate.getFullYear();
            return billMonth === selectedMonth && 
                   billYear === selectedYear && 
                   (bill.status === 'pending' || bill.status === 'overdue');
          })
          .reduce((sum, bill) => sum + Number(bill.amount), 0);
        
        // Contas Pagas: contas pagas do mês selecionado
        const paidBills = billsWithUpdatedStatus.filter(bill => {
          const billMonth = bill.dueDate.getMonth();
          const billYear = bill.dueDate.getFullYear();
          return bill.status === 'paid' &&
                 billMonth === selectedMonth &&
                 billYear === selectedYear;
        }).length;
        
        // Total das Contas Pagas: soma dos valores das contas pagas do mês selecionado
        const paidBillsTotal = billsWithUpdatedStatus
          .filter(bill => {
            const billMonth = bill.dueDate.getMonth();
            const billYear = bill.dueDate.getFullYear();
            return bill.status === 'paid' &&
                   billMonth === selectedMonth &&
                   billYear === selectedYear;
          })
          .reduce((sum, bill) => sum + Number(bill.amount), 0);
        
        setStats({
          pendingBills,
          overdueBills,
          totalAmount,
          paidBills,
          paidBillsTotal
        });

        // Compute expenses per user for the selected month (all bills in month)
        const expenseUsers = await getExpenseUsers();
        const userMap: Record<string, { total: number; count: number; color?: string }> = {};

        expenseUsers.forEach(u => {
          userMap[u.name] = { total: 0, count: 0, color: u.color };
        });

        billsWithUpdatedStatus.forEach(bill => {
          const billMonth = bill.dueDate.getMonth();
          const billYear = bill.dueDate.getFullYear();
          if (billMonth === selectedMonth && billYear === selectedYear) {
            const name = bill.account_holder?.trim() || "Sem Usuário";
            if (!userMap[name]) {
              userMap[name] = { total: 0, count: 0, color: "#64748b" };
            }
            userMap[name].total += Number(bill.amount);
            userMap[name].count += 1;
          }
        });

        const breakdown = Object.entries(userMap)
          .map(([name, data]) => ({ name, ...data }))
          .filter(item => item.count > 0 || expenseUsers.some(u => u.name === item.name))
          .sort((a, b) => b.total - a.total);

        setUserBreakdown(breakdown);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  // Função para visualizar anexo
  const handleViewAttachment = async (attachmentUrl: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Use fetch directly to get proper response with headers
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

      // Get the blob with correct content type from response
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up URL after a delay
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

  // Funções para ações nas contas
  const handleEditBill = (billId: string) => {
    navigate(`/contas/editar/${billId}`);
  };

  const handleDeleteBill = async (billId: string) => {
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
      fetchStats(selectedDate || new Date());
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir conta",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsPaid = async (billId: string) => {
    try {
      const { error } = await supabase
        .from('bills')
        .update({ status: 'paid' })
        .eq('id', billId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Conta marcada como paga!",
      });

      fetchBills();
      fetchStats(selectedDate || new Date());
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da conta",
        variant: "destructive",
      });
    }
  };

  const handleUploadPaymentProof = async (billId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Show confirmation dialog with file preview
        setSelectedPaymentProof({ file, billId });
        setPaymentProofConfirmDialog(true);
      }
    };
    input.click();
  };

  const handleConfirmPaymentProof = async () => {
    if (!selectedPaymentProof) return;

    setUploadingProof(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileExt = selectedPaymentProof.file.name.split('.').pop();
      const fileName = `payment_proof_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('bill-attachments')
        .upload(filePath, selectedPaymentProof.file);

      if (uploadError) throw uploadError;

      // Update bill with payment proof and mark as paid
      const { error: updateError } = await supabase
        .from('bills')
        .update({ 
          payment_proof_url: filePath,
          status: 'paid'
        })
        .eq('id', selectedPaymentProof.billId);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: "Comprovante anexado e conta marcada como paga!",
      });

      fetchBills();
      fetchStats(selectedDate || new Date());
      setPaymentProofConfirmDialog(false);
      setSelectedPaymentProof(null);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao anexar comprovante",
        variant: "destructive",
      });
    } finally {
      setUploadingProof(false);
    }
  };

  const handleChooseAnotherFile = () => {
    setPaymentProofConfirmDialog(false);
    setSelectedPaymentProof(null);
    // Trigger file selection again
    if (selectedPaymentProof?.billId) {
      setTimeout(() => handleUploadPaymentProof(selectedPaymentProof.billId), 100);
    }
  };

  const statsCards = [
    {
      title: "Contas a Vencer",
      value: stats.pendingBills.toString(),
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10",
      statusFilter: "pending"
    },
    {
      title: "Contas Vencidas",
      value: stats.overdueBills.toString(),
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      statusFilter: "overdue"
    },
    {
      title: "Total do Mês",
      value: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(stats.totalAmount),
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
      statusFilter: "all"
    },
    {
      title: "Pagas",
      value: `${stats.paidBills} (${new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(stats.paidBillsTotal)})`,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
      statusFilter: "paid"
    }
  ];

  const MobileMenu = () => (
    <div className="space-y-4 p-4">
      <Button 
        variant="outline" 
        className="w-full justify-start text-primary font-medium" 
        onClick={() => {
          navigate("/caixa");
          setMobileMenuOpen(false);
        }}
      >
        <Wallet className="w-4 h-4 mr-2" />
        Caixa e Extrato
      </Button>
      <Button 
        variant="outline" 
        className="w-full justify-start" 
        onClick={() => {
          navigate("/entradas");
          setMobileMenuOpen(false);
        }}
      >
        <ArrowDownLeft className="w-4 h-4 mr-2 text-emerald-600" />
        Entradas (Receitas)
      </Button>
      <Button 
        variant="outline" 
        className="w-full justify-start" 
        onClick={() => {
          navigate("/empresas");
          setMobileMenuOpen(false);
        }}
      >
        <Building className="w-4 h-4 mr-2" />
        Empresas / Clientes
      </Button>
      <Button 
        variant="outline" 
        className="w-full justify-start" 
        onClick={() => {
          navigate("/pagamentos");
          setMobileMenuOpen(false);
        }}
      >
        <Receipt className="w-4 h-4 mr-2" />
        Pagamentos de Contas
      </Button>
      <Button 
        variant="outline" 
        className="w-full justify-start" 
        onClick={() => {
          navigate("/relatorios");
          setMobileMenuOpen(false);
        }}
      >
        <BarChart3 className="w-4 h-4 mr-2" />
        Relatórios
      </Button>
      <Button 
        variant="outline" 
        className="w-full justify-start" 
        onClick={() => {
          navigate("/usuarios-despesas");
          setMobileMenuOpen(false);
        }}
      >
        <Users className="w-4 h-4 mr-2" />
        Usuários
      </Button>
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
      <Button 
        className="w-full justify-start bg-orange-500 hover:bg-orange-600 text-white" 
        onClick={() => {
          navigate("/despesas/nova");
          setMobileMenuOpen(false);
        }}
      >
        <Plus className="w-4 h-4 mr-2" />
        Nova Despesa
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
      <header className="border-b bg-card/90 backdrop-blur-md sticky top-0 z-40 shadow-sm border-border/60">
        <div className="container mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            
            {/* Left Brand & Context */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => navigate("/perfil")}
                  className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center hover:scale-105 hover:shadow-md transition-all cursor-pointer text-primary-foreground shadow-sm shrink-0"
                  title="Ver Perfil da Empresa"
                >
                  <Building2 className="w-5 h-5 text-primary-foreground" />
                </button>
                <div>
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                    Gerenciador de Contas
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground font-medium">
                    <span>{capitalizeFirst(format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }))}</span>
                    {userProfile && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="text-foreground font-semibold">
                          Olá, {userProfile.first_name} {userProfile.last_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Mobile Menu Trigger */}
              <div className="lg:hidden">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 px-2.5">
                      <Menu className="w-4 h-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <div className="mt-6">
                      <h2 className="text-lg font-semibold mb-4">Menu Principal</h2>
                      <MobileMenu />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            
            {/* Desktop Navigation & Actions */}
            <div className="hidden lg:flex items-center justify-end gap-2.5 flex-wrap">
              
              {/* Navigation Segmented Group */}
              <nav className="flex items-center gap-0.5 bg-muted/60 p-1 rounded-xl border border-border/50 shadow-xs">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2.5 text-xs font-semibold text-foreground hover:bg-emerald-600 hover:text-white hover:[&_svg]:text-white transition-all gap-1.5 [&_svg]:transition-colors"
                  onClick={() => navigate("/caixa")}
                >
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Caixa</span>
                </Button>

                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2.5 text-xs font-semibold text-foreground hover:bg-emerald-600 hover:text-white hover:[&_svg]:text-white transition-all gap-1.5 [&_svg]:transition-colors"
                  onClick={() => navigate("/entradas")}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Entradas</span>
                </Button>

                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2.5 text-xs font-semibold text-foreground hover:bg-emerald-600 hover:text-white hover:[&_svg]:text-white transition-all gap-1.5 [&_svg]:transition-colors"
                  onClick={() => navigate("/empresas")}
                >
                  <Building className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Empresas</span>
                </Button>

                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2.5 text-xs font-semibold text-foreground hover:bg-emerald-600 hover:text-white hover:[&_svg]:text-white transition-all gap-1.5 [&_svg]:transition-colors"
                  onClick={() => navigate("/pagamentos")}
                >
                  <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Pagamentos</span>
                </Button>

                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2.5 text-xs font-semibold text-foreground hover:bg-emerald-600 hover:text-white hover:[&_svg]:text-white transition-all gap-1.5 [&_svg]:transition-colors"
                  onClick={() => navigate("/relatorios")}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Relatórios</span>
                </Button>

                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2.5 text-xs font-semibold text-foreground hover:bg-emerald-600 hover:text-white hover:[&_svg]:text-white transition-all gap-1.5 [&_svg]:transition-colors"
                  onClick={() => navigate("/tipos-fornecedor")}
                >
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>+ Tipos</span>
                </Button>

                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2.5 text-xs font-semibold text-foreground hover:bg-emerald-600 hover:text-white hover:[&_svg]:text-white transition-all gap-1.5 [&_svg]:transition-colors"
                  onClick={() => navigate("/fornecedores/novo")}
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>+ Fornecedores</span>
                </Button>
              </nav>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  className="h-8 px-3 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 rounded-lg"
                  onClick={() => navigate("/contas/nova")}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Conta</span>
                </Button>

                <Button 
                  size="sm" 
                  className="h-8 px-3 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-xs gap-1.5 rounded-lg"
                  onClick={() => navigate("/despesas/nova")}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Despesa</span>
                </Button>
              </div>

              {/* Separator & Logout */}
              <div className="h-5 w-px bg-border/80 mx-0.5" />

              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors gap-1.5 rounded-lg"
                onClick={handleLogout}
                title="Sair da Conta"
              >
                <LogOut className="w-3.5 h-3.5 text-destructive" />
                <span>Sair</span>
              </Button>

            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {statsCards.map((stat, index) => (
            <Card 
              key={index} 
              onClick={() => {
                if (stat.statusFilter) {
                  navigate(`/contas?status=${stat.statusFilter}&month=${selectedMonth}&year=${selectedYear}`);
                }
              }}
              className="border-0 shadow-sm bg-card/60 backdrop-blur-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all group"
              title={`Clique para ver ${stat.title.toLowerCase()} de ${MONTH_NAMES[selectedMonth]} / ${selectedYear}`}
            >
              <CardContent className="p-2 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                  <div className="w-full sm:w-auto">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{stat.title}</p>
                    <p className="text-lg sm:text-2xl font-bold truncate">{stat.value}</p>
                  </div>
                  <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor} self-end sm:self-auto group-hover:scale-110 transition-transform`}>
                    <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Despesas por Usuário no Mês */}
        {userBreakdown.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Despesas Por Usuário no Mês
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/relatorios")}
                className="text-xs flex items-center gap-1.5 hover:bg-emerald-600 hover:text-white hover:[&_svg]:text-white transition-all"
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                Relatórios
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
              {userBreakdown.map((ub, idx) => {
                const isSelected = selectedUserFilter === ub.name;
                return (
                  <Card 
                    key={idx} 
                    onClick={() => setSelectedUserFilter(prev => prev === ub.name ? null : ub.name)}
                    className={cn(
                      "border-0 shadow-sm bg-card/60 backdrop-blur-sm hover:bg-card/90 transition-all cursor-pointer relative overflow-hidden group",
                      isSelected && "ring-2 ring-primary bg-primary/10 shadow-md"
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between space-x-1 mb-1">
                        <div className="flex items-center space-x-2 truncate">
                          <div 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: ub.color || "#3b82f6" }} 
                          />
                          <span className="font-semibold text-xs sm:text-sm truncate">{ub.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-primary shrink-0"
                          title="Ver Relatório Individual"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenUserReport(ub.name, ub.color);
                          }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-primary truncate">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ub.total)}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                        <span>{ub.count} {ub.count === 1 ? 'conta' : 'contas'}</span>
                        <span 
                          className="text-primary group-hover:underline font-semibold cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenUserReport(ub.name, ub.color);
                          }}
                        >
                          Relatório &rarr;
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

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
              onEditBill={handleEditBill}
              onDeleteBill={handleDeleteBill}
              onMarkAsPaid={handleMarkAsPaid}
              onViewAttachment={handleViewAttachment}
              onUploadPaymentProof={handleUploadPaymentProof}
              onMonthChange={setSelectedDate}
              selectedUser={selectedUserFilter}
              onSelectUser={setSelectedUserFilter}
            />
            </CardContent>
          </Card>

          {/* Right Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Overdue Bills */}
            {(() => {
              const monthOverdue = allBills.filter(bill => {
                const bMonth = bill.dueDate.getMonth();
                const bYear = bill.dueDate.getFullYear();
                return bill.status === 'overdue' && bMonth === selectedMonth && bYear === selectedYear;
              });

              const hasOverdueInMonth = monthOverdue.length > 0;
              const displayOverdue = hasOverdueInMonth 
                ? monthOverdue 
                : allBills.filter(bill => bill.status === 'overdue');

              if (displayOverdue.length === 0) return null;

              return (
                <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center justify-between text-sm sm:text-base">
                      <span className="flex items-center">
                        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-destructive" />
                        Contas Vencidas
                      </span>
                      <Badge variant={hasOverdueInMonth ? "destructive" : "outline"} className="text-[10px]">
                        {hasOverdueInMonth ? MONTH_NAMES[selectedMonth] : 'Todas'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {hasOverdueInMonth 
                        ? `Contas vencidas em ${MONTH_NAMES[selectedMonth]} de ${selectedYear}`
                        : `Contas que já passaram do vencimento`
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                    {displayOverdue.slice(0, 5).map((bill) => (
                      <div key={bill.id} className="p-2 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <div className="flex items-start justify-between mb-1 sm:mb-2">
                          <h4 className="font-medium text-xs sm:text-sm truncate pr-2">{bill.description}</h4>
                          <Badge variant="destructive" className="text-xs shrink-0">
                            {safeFormatDate(bill.dueDate, "dd/MM")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1 truncate">{bill.supplier}</p>
                        {bill.paymentType === 'cheque' && (
                          <div className="text-xs text-muted-foreground space-y-0.5 mb-1">
                            {bill.checkNumber && <p>Nº Cheque: {bill.checkNumber}</p>}
                            {bill.bankName && <p>Banco: {bill.bankName}</p>}
                            {bill.accountHolder && (
                               <div className="flex items-center gap-1 pt-0.5">
                                 <span>Titular:</span>
                                 <Badge 
                                   variant="outline" 
                                   className="text-[10px] py-0 px-1 font-semibold"
                                   style={getUserBadgeStyle(bill.accountHolder)}
                                 >
                                   {bill.accountHolder}
                                 </Badge>
                               </div>
                             )}
                          </div>
                        )}
                        <p className="font-semibold text-destructive text-xs sm:text-sm">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(bill.amount)}
                        </p>
                      </div>
                    ))}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full" 
                      onClick={() => navigate(`/contas?status=overdue&month=${selectedMonth}&year=${selectedYear}`)}
                    >
                      Ver contas vencidas do mês ({stats.overdueBills})
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}

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
                         {safeFormatDate(bill.dueDate, "dd/MM")}
                       </Badge>
                     </div>
                     <p className="text-xs text-muted-foreground mb-1 truncate">{bill.supplier}</p>
                     {bill.paymentType === 'cheque' && (
                       <div className="text-xs text-muted-foreground space-y-0.5 mb-1">
                         {bill.checkNumber && <p>Nº Cheque: {bill.checkNumber}</p>}
                         {bill.bankName && <p>Banco: {bill.bankName}</p>}
                         {bill.accountHolder && (
                            <div className="flex items-center gap-1 pt-0.5">
                              <span>Titular:</span>
                              <Badge 
                                variant="outline" 
                                className="text-[10px] py-0 px-1 font-semibold"
                                style={getUserBadgeStyle(bill.accountHolder)}
                              >
                                {bill.accountHolder}
                              </Badge>
                            </div>
                          )}
                       </div>
                     )}
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

      {/* Payment Proof Confirmation Dialog */}
      <Dialog open={paymentProofConfirmDialog} onOpenChange={setPaymentProofConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Comprovante de Pagamento</DialogTitle>
            <DialogDescription>
              Revise o arquivo selecionado antes de continuar
            </DialogDescription>
          </DialogHeader>
          
          {selectedPaymentProof && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  {selectedPaymentProof.file.type.includes('pdf') ? (
                    <FileText className="w-8 h-8 text-primary" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-primary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedPaymentProof.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedPaymentProof.file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Confirma que deseja anexar este arquivo como comprovante de pagamento?
              </p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleChooseAnotherFile}
              disabled={uploadingProof}
            >
              Escolher Outro Arquivo
            </Button>
            <Button
              onClick={handleConfirmPaymentProof}
              disabled={uploadingProof}
            >
              {uploadingProof ? "Enviando..." : "Confirmar e Anexar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Individual Report Modal */}
      <UserReportModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        userName={selectedUserForReport}
        userColor={selectedUserColor}
      />
    </div>
  );
};

export default Dashboard;