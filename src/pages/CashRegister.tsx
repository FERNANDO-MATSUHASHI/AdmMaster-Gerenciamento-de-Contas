import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ArrowLeft,
  Wallet,
  Calendar,
  Settings,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Search,
  DollarSign,
  Receipt,
  ShoppingCart,
  TrendingDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getLocalFinancialEntries } from "@/hooks/useFinancialEntriesOperations";
import { getLocalCompanies } from "@/hooks/useCompanyOperations";
import { getLocalBillPayments } from "@/hooks/useBillPaymentOperations";

interface CashMovement {
  id: string;
  date: string;
  description: string;
  entityName: string;
  type: 'initial' | 'inflow' | 'outflow';
  isExpense?: boolean;
  amount: number;
  runningBalance?: number;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Helper to normalize any ISO date or timestamp into YYYY-MM-DD format
export const normalizeDateStr = (rawDate: any): string => {
  if (!rawDate) return '';
  if (typeof rawDate === 'string') {
    const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {}
  return '';
};

// Helper to check if a movement is a Despesa vs a Conta Paga
const isExpenseMovement = (p: any): boolean => {
  if (p.payment_type === 'despesa' || p.bill_type === 'despesa') return true;
  if (p.bills) {
    if (p.bills.payment_type === 'despesa' || p.bills.bill_type === 'despesa') return true;
  }
  return false;
};

const CashRegister = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [referenceDate, setReferenceDate] = useState<string>(format(new Date(), 'yyyy-01-01'));
  const [entries, setEntries] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);

  // Period Filter State (Default: Mensal / Mês Atual)
  const today = new Date();
  const [periodType, setPeriodType] = useState<"diario" | "mensal" | "semestral" | "anual">("mensal");
  const [selectedDate, setSelectedDate] = useState<string>(format(today, "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedSemester, setSelectedSemester] = useState<number>(today.getMonth() < 6 ? 1 : 2);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Statement Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Settings Dialog
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [inputInitialBalance, setInputInitialBalance] = useState<string>('0.00');
  const [inputReferenceDate, setInputReferenceDate] = useState<string>(format(new Date(), 'yyyy-01-01'));

  useEffect(() => {
    loadAllCashData();
  }, []);

  const loadAllCashData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Fetch cash settings
      let refDate = format(new Date(), 'yyyy-01-01');
      let initBal = 0;

      if (user) {
        const { data: settings } = await supabase
          .from('cash_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settings) {
          initBal = Number(settings.initial_balance) || 0;
          refDate = settings.reference_date || refDate;
        }
      }

      setInitialBalance(initBal);
      setReferenceDate(refDate);
      setInputInitialBalance(initBal.toFixed(2));
      setInputReferenceDate(refDate);

      // 2. Fetch received entries (Supabase + LocalStorage fallback)
      let remoteEntries: any[] = [];
      try {
        const { data: entriesData, error: entriesError } = await supabase
          .from('financial_entries')
          .select(`*, companies(razao_social)`)
          .order('expected_date', { ascending: false });

        if (!entriesError && entriesData) {
          remoteEntries = entriesData;
        }
      } catch (err) {
        console.warn('Erro ao carregar entradas do Supabase:', err);
      }

      const localEntries = getLocalFinancialEntries();
      const localCompanies = getLocalCompanies();

      const enrichedLocals = localEntries.map(e => {
        if (!e.companies && e.company_id) {
          const matched = localCompanies.find(c => c.id === e.company_id);
          if (matched) {
            return {
              ...e,
              companies: { razao_social: matched.razao_social }
            };
          }
        }
        return e;
      });

      const existingRemoteIds = new Set(remoteEntries.map(re => re.id));
      const combinedEntries = [...remoteEntries, ...enrichedLocals.filter(le => !existingRemoteIds.has(le.id))];

      setEntries(combinedEntries);

      // 3. Fetch bill payments & paid bills (Supabase + LocalStorage fallback)
      let remotePayments: any[] = [];
      let remotePaidBills: any[] = [];
      const supplierMap: Record<string, string> = {};

      try {
        const { data: suppliersData } = await supabase.from('suppliers').select('id, name');
        if (suppliersData) {
          suppliersData.forEach((s: any) => {
            supplierMap[s.id] = s.name;
          });
        }
      } catch (e) {
        console.warn('Erro ao carregar mapa de fornecedores:', e);
      }

      try {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('bill_payments')
          .select(`*, bills(id, description, amount, payment_type, due_date, entry_date, supplier_id, suppliers(name))`)
          .order('payment_date', { ascending: true });

        if (!paymentsError && paymentsData) {
          remotePayments = paymentsData;
        } else if (paymentsError) {
          console.warn('Erro ao buscar bill_payments com relacionamentos, tentando fallback:', paymentsError);
          const { data: fallbackPayments } = await supabase
            .from('bill_payments')
            .select('*')
            .order('payment_date', { ascending: true });
          if (fallbackPayments) {
            remotePayments = fallbackPayments;
          }
        }

        const { data: paidBillsData } = await supabase
          .from('bills')
          .select(`id, user_id, description, amount, status, due_date, entry_date, updated_at, payment_type, supplier_id, suppliers(name)`);

        if (paidBillsData) {
          const paidStatuses = new Set(['paid', 'partially_paid', 'paga', 'pago', 'concluido', 'parcialmente_paga']);
          remotePaidBills = paidBillsData.filter((b: any) => paidStatuses.has((b.status || '').toLowerCase()));
        }
      } catch (err) {
        console.warn('Erro ao carregar pagamentos do Supabase:', err);
      }

      const localPayments = getLocalBillPayments();
      
      const trackedBillIds = new Set<string>();
      remotePayments.forEach(rp => {
        if (rp.bill_id) trackedBillIds.add(rp.bill_id);
      });
      localPayments.forEach(lp => {
        if (lp.bill_id) trackedBillIds.add(lp.bill_id);
      });

      const syntheticPayments: any[] = [];
      remotePaidBills.forEach(b => {
        if (!trackedBillIds.has(b.id)) {
          // IMPORTANT: Prioritize due_date or entry_date OVER updated_at!
          const effectiveDate = normalizeDateStr(b.payment_date || b.due_date || b.entry_date || b.updated_at);
          const supplierName = b.suppliers?.name || supplierMap[b.supplier_id] || 'Sem fornecedor';

          syntheticPayments.push({
            id: `paid_bill_${b.id}`,
            bill_id: b.id,
            user_id: b.user_id,
            amount_paid: Number(b.amount),
            payment_date: effectiveDate,
            payment_method: b.payment_type === 'despesa' ? 'Despesa' : (b.payment_type || 'Pix'),
            payment_type: b.payment_type,
            bills: {
              id: b.id,
              description: b.description,
              amount: Number(b.amount),
              payment_type: b.payment_type,
              due_date: b.due_date,
              entry_date: b.entry_date,
              supplier_id: b.supplier_id,
              suppliers: { name: supplierName }
            }
          });
        }
      });

      const existingRemotePaymentIds = new Set(remotePayments.map(rp => rp.id));
      const combinedPayments = [...remotePayments, ...localPayments.filter(lp => !existingRemotePaymentIds.has(lp.id)), ...syntheticPayments];

      // Normalize dates on all payment items and populate supplier names if missing
      combinedPayments.forEach(p => {
        p.normalized_date = normalizeDateStr(p.payment_date || p.bills?.due_date || p.bills?.entry_date || p.bills?.updated_at);
        if (p.bills && !p.bills.suppliers?.name && p.bills.supplier_id && supplierMap[p.bills.supplier_id]) {
          p.bills.suppliers = { name: supplierMap[p.bills.supplier_id] };
        }
      });

      setPayments(combinedPayments);

      // 4. Fetch all bills for "Total a pagar" calculation
      const { data: billsData } = await supabase
        .from('bills')
        .select(`id, amount, status, due_date`);

      setBills(billsData || []);

    } catch (err) {
      console.error('Erro ao carregar dados do caixa:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const parsedBal = parseFloat(inputInitialBalance.replace(',', '.')) || 0;

      const { data: existing } = await supabase
        .from('cash_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('cash_settings')
          .update({
            initial_balance: parsedBal,
            reference_date: inputReferenceDate,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('cash_settings')
          .insert({
            user_id: user.id,
            initial_balance: parsedBal,
            reference_date: inputReferenceDate
          });
      }

      setInitialBalance(parsedBal);
      setReferenceDate(inputReferenceDate);
      setSettingsDialogOpen(false);

      toast({
        title: "Saldo inicial atualizado",
        description: "As configurações do caixa foram salvas.",
      });

      loadAllCashData();
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Filter payments strictly matching selected period
  const periodFilteredPayments = useMemo(() => {
    return payments.filter(p => {
      const cleanDate = p.normalized_date || normalizeDateStr(p.payment_date);
      if (!cleanDate) return false;

      const dateParts = cleanDate.split('-').map(Number);
      if (dateParts.length < 3 || isNaN(dateParts[0]) || isNaN(dateParts[1])) return false;
      const [pYear, pMonth] = dateParts;

      if (periodType === "diario") {
        if (cleanDate !== selectedDate) return false;
      } else if (periodType === "mensal") {
        if (pYear !== selectedYear || (pMonth - 1) !== selectedMonth) return false;
      } else if (periodType === "semestral") {
        if (pYear !== selectedYear) return false;
        if (selectedSemester === 1 && (pMonth < 1 || pMonth > 6)) return false;
        if (selectedSemester === 2 && (pMonth < 7 || pMonth > 12)) return false;
      } else if (periodType === "anual") {
        if (pYear !== selectedYear) return false;
      }

      return true;
    });
  }, [payments, periodType, selectedDate, selectedMonth, selectedSemester, selectedYear]);

  // Separate Totals for Contas Pagas and Despesas in the period
  const { totalContasPagas, totalDespesas, totalGeralSaidas } = useMemo(() => {
    let contas = 0;
    let despesas = 0;

    periodFilteredPayments.forEach(p => {
      const val = Number(p.amount_paid) || 0;
      if (isExpenseMovement(p)) {
        despesas += val;
      } else {
        contas += val;
      }
    });

    return {
      totalContasPagas: contas,
      totalDespesas: despesas,
      totalGeralSaidas: contas + despesas
    };
  }, [periodFilteredPayments]);

  // Total de Entradas Recebidas no Período
  const totalReceivedInflows = useMemo(() => {
    return entries
      .filter(e => {
        if (e.status !== 'received') return false;
        const entryDate = normalizeDateStr(e.received_date || e.expected_date);
        if (!entryDate) return false;

        const dateParts = entryDate.split('-').map(Number);
        if (dateParts.length < 3 || isNaN(dateParts[0]) || isNaN(dateParts[1])) return false;
        const [eYear, eMonth] = dateParts;

        if (periodType === "diario") {
          if (entryDate !== selectedDate) return false;
        } else if (periodType === "mensal") {
          if (eYear !== selectedYear || (eMonth - 1) !== selectedMonth) return false;
        } else if (periodType === "semestral") {
          if (eYear !== selectedYear) return false;
          if (selectedSemester === 1 && (eMonth < 1 || eMonth > 6)) return false;
          if (selectedSemester === 2 && (eMonth < 7 || eMonth > 12)) return false;
        } else if (periodType === "anual") {
          if (eYear !== selectedYear) return false;
        }

        return true;
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [entries, periodType, selectedDate, selectedMonth, selectedSemester, selectedYear]);

  // Saldo Atual Disponível no Período
  const currentAvailableBalance = initialBalance + totalReceivedInflows - totalGeralSaidas;

  // Total a Receber (pending entries)
  const totalPendingInflows = useMemo(() => {
    return entries
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [entries]);

  // Total a Pagar (remaining balances of open / partially paid / overdue bills)
  const totalPendingOutflows = useMemo(() => {
    const paidPerBill: Record<string, number> = {};
    payments.forEach(p => {
      paidPerBill[p.bill_id] = (paidPerBill[p.bill_id] || 0) + Number(p.amount_paid);
    });

    return bills
      .filter(b => b.status !== 'paid')
      .reduce((sum, b) => {
        const paid = paidPerBill[b.id] || 0;
        const remaining = Number(b.amount) - paid;
        return sum + (remaining > 0 ? remaining : 0);
      }, 0);
  }, [bills, payments]);

  // --- Extrato / Statement Generation & Chronological Balance ---
  const allMovements = useMemo(() => {
    const list: CashMovement[] = [];

    // Initial Balance Movement
    if (referenceDate) {
      list.push({
        id: 'initial_balance_ref',
        date: referenceDate,
        description: 'Saldo Inicial do Caixa',
        entityName: 'Configuração do Caixa',
        type: 'initial',
        amount: initialBalance
      });
    }

    // Received Inflows
    entries.forEach(e => {
      if (e.status === 'received') {
        const entryDate = normalizeDateStr(e.received_date || e.expected_date);
        if (entryDate && entryDate >= referenceDate) {
          list.push({
            id: `entry_${e.id}`,
            date: entryDate,
            description: e.description,
            entityName: e.companies?.razao_social || 'Sem empresa',
            type: 'inflow',
            amount: Number(e.amount)
          });
        }
      }
    });

    // Payments (Outflows)
    payments.forEach(p => {
      const pDate = p.normalized_date || normalizeDateStr(p.payment_date);
      if (pDate && pDate >= referenceDate) {
        const isExp = isExpenseMovement(p);
        list.push({
          id: `payment_${p.id}`,
          date: pDate,
          description: p.bills?.description || (isExp ? 'Despesa' : 'Pagamento de Conta'),
          entityName: p.bills?.suppliers?.name || 'Sem fornecedor',
          type: 'outflow',
          isExpense: isExp,
          amount: -Number(p.amount_paid)
        });
      }
    });

    // Sort chronologically ascending
    list.sort((a, b) => {
      if (a.date === b.date) {
        if (a.type === 'initial') return -1;
        if (b.type === 'initial') return 1;
        return 0;
      }
      return a.date.localeCompare(b.date);
    });

    // Compute running balance for each movement
    let running = 0;
    const withRunningBalance = list.map(item => {
      running += item.amount;
      return {
        ...item,
        runningBalance: running
      };
    });

    return withRunningBalance;
  }, [entries, payments, initialBalance, referenceDate]);

  // Distinct entities for filter dropdown
  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    allMovements.forEach(m => {
      if (m.entityName && m.entityName !== 'Configuração do Caixa') {
        set.add(m.entityName);
      }
    });
    return Array.from(set).sort();
  }, [allMovements]);

  // Filtered movements for table display
  const filteredMovements = useMemo(() => {
    return allMovements.filter(m => {
      if (m.type !== 'initial') {
        const cleanDate = normalizeDateStr(m.date);
        const dateParts = cleanDate.split('-').map(Number);
        if (dateParts.length >= 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1])) {
          const [mYear, mMonth] = dateParts;

          if (periodType === "diario" && cleanDate !== selectedDate) return false;
          if (periodType === "mensal" && (mYear !== selectedYear || (mMonth - 1) !== selectedMonth)) return false;
          if (periodType === "semestral") {
            if (mYear !== selectedYear) return false;
            if (selectedSemester === 1 && (mMonth < 1 || mMonth > 6)) return false;
            if (selectedSemester === 2 && (mMonth < 7 || mMonth > 12)) return false;
          }
          if (periodType === "anual" && mYear !== selectedYear) return false;
        }
      }

      if (typeFilter === 'inflow' && m.type !== 'inflow') return false;
      if (typeFilter === 'outflow' && m.type !== 'outflow') return false;
      if (typeFilter === 'conta' && (m.type !== 'outflow' || m.isExpense)) return false;
      if (typeFilter === 'despesa' && (m.type !== 'outflow' || !m.isExpense)) return false;
      if (entityFilter !== 'all' && m.entityName !== entityFilter) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchDesc = m.description.toLowerCase().includes(q);
        const matchEntity = m.entityName.toLowerCase().includes(q);
        if (!matchDesc && !matchEntity) return false;
      }
      return true;
    });
  }, [allMovements, periodType, selectedDate, selectedMonth, selectedSemester, selectedYear, typeFilter, entityFilter, searchTerm]);

  // Label describing current selected period
  const currentPeriodLabel = useMemo(() => {
    if (periodType === "diario") {
      const [y, m, d] = selectedDate.split("-");
      return `Dia ${d}/${m}/${y}`;
    }
    if (periodType === "mensal") {
      return `${MONTH_NAMES[selectedMonth]} de ${selectedYear}`;
    }
    if (periodType === "semestral") {
      return `${selectedSemester}º Semestre de ${selectedYear}`;
    }
    return `Ano de ${selectedYear}`;
  }, [periodType, selectedDate, selectedMonth, selectedSemester, selectedYear]);

  const yearOptions = [
    today.getFullYear() - 2,
    today.getFullYear() - 1,
    today.getFullYear(),
    today.getFullYear() + 1
  ];

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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Caixa e Resumo Financeiro</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Movimentações de caixa, saldo disponível e extrato financeiro sincronizado
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)} className="gap-2">
              <Settings className="w-4 h-4" />
              Saldo Inicial / Ref.
            </Button>
            <Button variant="outline" size="sm" onClick={loadAllCashData} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Period Filter Bar */}
        <Card className="border shadow-xs bg-card/90 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground shrink-0">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span>Filtro por Período de Caixa:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full lg:w-auto">
                {/* Period Type Selector */}
                <div>
                  <Select 
                    value={periodType} 
                    onValueChange={(val: any) => setPeriodType(val)}
                  >
                    <SelectTrigger className="h-9 text-xs sm:text-sm font-medium">
                      <SelectValue placeholder="Selecione o tipo de período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diario">Diário (Dia Específico)</SelectItem>
                      <SelectItem value="mensal">Mensal (Mês e Ano)</SelectItem>
                      <SelectItem value="semestral">Semestral (1º / 2º Semestre)</SelectItem>
                      <SelectItem value="anual">Anual (Ano Específico)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Specific Filters depending on Period Type */}
                {periodType === "diario" && (
                  <div>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="h-9 text-xs sm:text-sm"
                    />
                  </div>
                )}

                {periodType === "mensal" && (
                  <>
                    <Select 
                      value={selectedMonth.toString()} 
                      onValueChange={(val) => setSelectedMonth(Number(val))}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((month, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select 
                      value={selectedYear.toString()} 
                      onValueChange={(val) => setSelectedYear(Number(val))}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map(yr => (
                          <SelectItem key={yr} value={yr.toString()}>
                            {yr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                {periodType === "semestral" && (
                  <>
                    <Select 
                      value={selectedSemester.toString()} 
                      onValueChange={(val) => setSelectedSemester(Number(val))}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1º Semestre (Jan - Jun)</SelectItem>
                        <SelectItem value="2">2º Semestre (Jul - Dez)</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select 
                      value={selectedYear.toString()} 
                      onValueChange={(val) => setSelectedYear(Number(val))}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map(yr => (
                          <SelectItem key={yr} value={yr.toString()}>
                            {yr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                {periodType === "anual" && (
                  <div>
                    <Select 
                      value={selectedYear.toString()} 
                      onValueChange={(val) => setSelectedYear(Number(val))}
                    >
                      <SelectTrigger className="h-9 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map(yr => (
                          <SelectItem key={yr} value={yr.toString()}>
                            Ano {yr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

            </div>
          </CardContent>
        </Card>

        {/* 6 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* 1. Saldo Inicial */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center justify-between">
                <span>Saldo Inicial</span>
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              </CardDescription>
              <CardTitle className="text-xl font-bold text-foreground">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(initialBalance)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">
                Ref: {format(new Date(referenceDate + 'T00:00:00'), 'dd/MM/yyyy')}
              </p>
            </CardContent>
          </Card>

          {/* 2. Total Entradas Recebidas */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center justify-between text-emerald-600 font-semibold">
                <span>Entradas Recebidas</span>
                <ArrowDownLeft className="w-4 h-4" />
              </CardDescription>
              <CardTitle className="text-xl font-bold text-emerald-600">
                +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceivedInflows)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">{currentPeriodLabel}</p>
            </CardContent>
          </Card>

          {/* 3. Total Contas Pagas (Separado) */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center justify-between text-blue-600 font-semibold">
                <span>Contas Pagas</span>
                <Receipt className="w-4 h-4" />
              </CardDescription>
              <CardTitle className="text-xl font-bold text-blue-600">
                -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalContasPagas)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">{currentPeriodLabel}</p>
            </CardContent>
          </Card>

          {/* 4. Total Despesas (Separado) */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center justify-between text-orange-500 font-semibold">
                <span>Despesas</span>
                <ShoppingCart className="w-4 h-4" />
              </CardDescription>
              <CardTitle className="text-xl font-bold text-orange-500">
                -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">{currentPeriodLabel}</p>
            </CardContent>
          </Card>

          {/* 5. Total Geral de Saídas */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center justify-between text-rose-600 font-bold">
                <span>Total Geral de Saídas</span>
                <TrendingDown className="w-4 h-4" />
              </CardDescription>
              <CardTitle className="text-xl font-bold text-rose-600">
                -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeralSaidas)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">Contas Pagas + Despesas</p>
            </CardContent>
          </Card>

          {/* 6. Saldo Atual Disponível (Destacado) */}
          <Card className="border-2 border-primary/40 shadow-md bg-primary/5 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-primary flex items-center justify-between">
                <span>SALDO ATUAL DISPONÍVEL</span>
                <Wallet className="w-4 h-4" />
              </CardDescription>
              <CardTitle className={`text-2xl font-black ${currentAvailableBalance >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentAvailableBalance)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">
                = Saldo inicial + Entradas − Total de Saídas
              </p>
            </CardContent>
          </Card>

          {/* 7. Total a Receber (Pendente) */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-amber-600">Total a Receber (Pendente)</CardDescription>
              <CardTitle className="text-xl font-bold text-amber-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendingInflows)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">Entradas previstas em aberto</p>
            </CardContent>
          </Card>

          {/* 8. Total a Pagar (Em Aberto) */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-orange-600">Total a Pagar (Em Aberto)</CardDescription>
              <CardTitle className="text-xl font-bold text-orange-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendingOutflows)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">Saldo restante das contas pendentes</p>
            </CardContent>
          </Card>

        </div>

        {/* Extrato de Movimentações */}
        <Card className="border shadow-md bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Extrato de Movimentações de Caixa
                </CardTitle>
                <CardDescription>
                  Histórico cronológico consolidado das entradas recebidas e saídas (contas pagas e despesas).
                </CardDescription>
              </div>

              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline" onClick={() => navigate('/entradas')}>
                  + Nova Entrada
                </Button>
                <Button size="sm" onClick={() => navigate('/contas')}>
                  Ir para Contas
                </Button>
              </div>
            </div>

            {/* Statement Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t mt-4">
              {/* Empresa / Fornecedor */}
              <div className="space-y-1">
                <Label className="text-xs">Empresa / Fornecedor</Label>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {entityOptions.map(ent => (
                      <SelectItem key={ent} value={ent}>{ent}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Movimento */}
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Movimento</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos os Tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    <SelectItem value="inflow">Apenas Entradas</SelectItem>
                    <SelectItem value="outflow">Todas as Saídas</SelectItem>
                    <SelectItem value="conta">Apenas Contas Pagas</SelectItem>
                    <SelectItem value="despesa">Apenas Despesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-1">
                <Label className="text-xs">Busca</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando movimentações de caixa...</div>
            ) : filteredMovements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma movimentação de caixa encontrada para os filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground font-medium">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3">Empresa / Fornecedor</th>
                      <th className="py-2.5 px-3">Categoria / Tipo</th>
                      <th className="py-2.5 px-3 text-right">Valor</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Saldo Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMovements.map((m) => {
                      const displayDate = m.date ? format(new Date(m.date + 'T00:00:00'), 'dd/MM/yyyy') : 'Sem data';
                      return (
                        <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs">
                            {displayDate}
                          </td>
                          <td className="py-2.5 px-3 font-medium">{m.description}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{m.entityName}</td>
                          <td className="py-2.5 px-3">
                            {m.type === 'initial' && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                Saldo Inicial
                              </Badge>
                            )}
                            {m.type === 'inflow' && (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700">
                                Entrada
                              </Badge>
                            )}
                            {m.type === 'outflow' && (
                              m.isExpense ? (
                                <Badge className="bg-orange-500/10 text-orange-600 border border-orange-200">
                                  Despesa
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-500/10 text-blue-600 border border-blue-200">
                                  Conta Paga
                                </Badge>
                              )
                            )}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${m.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {m.amount >= 0 ? '+' : ''}
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap font-mono">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.runningBalance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para Configurar Saldo Inicial e Data de Referência */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuração do Saldo Inicial do Caixa</DialogTitle>
            <DialogDescription>
              Defina o saldo inicial de caixa e a data de referência para contagem dos movimentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="init_bal">Saldo Inicial (R$)</Label>
              <Input
                id="init_bal"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={inputInitialBalance}
                onChange={(e) => setInputInitialBalance(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref_date">Data de Referência</Label>
              <Input
                id="ref_date"
                type="date"
                value={inputReferenceDate}
                onChange={(e) => setInputReferenceDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Movimentações com data igual ou posterior a esta data serão consideradas no caixa.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings}>
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashRegister;
