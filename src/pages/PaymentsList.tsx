import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Search, 
  Calendar, 
  DollarSign, 
  Building, 
  Undo2, 
  Filter, 
  Receipt,
  ShoppingCart,
  TrendingDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBillPaymentOperations, getLocalBillPayments } from "@/hooks/useBillPaymentOperations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
export const isExpenseMovement = (p: any): boolean => {
  if (p.payment_type === 'despesa' || p.bill_type === 'despesa') return true;
  if (p.bills) {
    if (p.bills.payment_type === 'despesa' || p.bills.bill_type === 'despesa') return true;
  }
  return false;
};

const PaymentsList = () => {
  const navigate = useNavigate();
  const { reversePayment } = useBillPaymentOperations();

  const [payments, setPayments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "conta" | "despesa">("all");
  const [reverseCandidate, setReverseCandidate] = useState<any | null>(null);

  // Period Filter State (Default: Mensal / Mês Atual)
  const today = new Date();
  const [periodType, setPeriodType] = useState<"diario" | "mensal" | "semestral" | "anual">("mensal");
  const [selectedDate, setSelectedDate] = useState<string>(format(today, "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedSemester, setSelectedSemester] = useState<number>(today.getMonth() < 6 ? 1 : 2);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      let remotePayments: any[] = [];
      let remotePaidBills: any[] = [];
      const supplierMap: Record<string, string> = {};

      // 0. Fetch suppliers lookup map
      try {
        const { data: suppliersData } = await supabase.from('suppliers').select('id, name');
        if (suppliersData) {
          suppliersData.forEach((s: any) => {
            supplierMap[s.id] = s.name;
          });
        }
      } catch (e) {
        console.warn('Erro ao carregar lista de fornecedores:', e);
      }

      // 1. Fetch remote bill_payments with fallbacks
      try {
        const { data: pData, error: pErr } = await supabase
          .from('bill_payments')
          .select(`
            *,
            bills (
              id,
              description,
              amount,
              payment_type,
              due_date,
              entry_date,
              supplier_id,
              suppliers (
                name
              )
            )
          `)
          .order('payment_date', { ascending: false });

        if (!pErr && pData) {
          remotePayments = pData;
        } else if (pErr) {
          console.warn('Erro na consulta bill_payments com relacionamentos, tentando fallback simplificado:', pErr);
          const { data: fallbackPData } = await supabase
            .from('bill_payments')
            .select('*')
            .order('payment_date', { ascending: false });
          if (fallbackPData) {
            remotePayments = fallbackPData;
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar bill_payments do Supabase:', e);
      }

      // 2. Fetch paid bills from `bills` table safely (case-insensitive status check)
      try {
        const { data: bData, error: bErr } = await supabase
          .from('bills')
          .select(`
            id, user_id, description, amount, status, due_date, entry_date, updated_at, payment_type, supplier_id, suppliers(name)
          `);

        if (!bErr && bData) {
          const paidStatuses = new Set(['paid', 'partially_paid', 'paga', 'pago', 'concluido', 'parcialmente_paga']);
          remotePaidBills = bData.filter((b: any) => paidStatuses.has((b.status || '').toLowerCase()));
        }
      } catch (e) {
        console.warn('Erro ao carregar contas pagas do Supabase:', e);
      }

      const localPayments = getLocalBillPayments();
      
      // Track all bill_ids that already have payment records
      const trackedBillIds = new Set<string>();
      remotePayments.forEach(rp => {
        if (rp.bill_id) trackedBillIds.add(rp.bill_id);
      });
      localPayments.forEach(lp => {
        if (lp.bill_id) trackedBillIds.add(lp.bill_id);
      });

      // Synthesize entries for any paid bills from `bills` table without an explicit payment row
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

      const existingRemoteIds = new Set(remotePayments.map(r => r.id));
      const combinedLocals = localPayments.filter(l => !existingRemoteIds.has(l.id));

      const finalAllPayments = [...remotePayments, ...combinedLocals, ...syntheticPayments];
      
      // Normalize dates on all payment items and populate supplier names if missing
      finalAllPayments.forEach(p => {
        p.normalized_date = normalizeDateStr(p.payment_date || p.bills?.due_date || p.bills?.entry_date || p.bills?.updated_at);
        if (p.bills && !p.bills.suppliers?.name && p.bills.supplier_id && supplierMap[p.bills.supplier_id]) {
          p.bills.suppliers = { name: supplierMap[p.bills.supplier_id] };
        }
      });

      finalAllPayments.sort((a, b) => (b.normalized_date || '').localeCompare(a.normalized_date || ''));

      setPayments(finalAllPayments);
    } catch (err) {
      console.error('Erro ao buscar histórico de pagamentos:', err);
    }
  };

  const handleConfirmReverse = async () => {
    if (!reverseCandidate) return;

    const ok = await reversePayment(reverseCandidate.id, reverseCandidate.bill_id);
    if (ok) {
      setReverseCandidate(null);
      fetchPayments();
    }
  };

  // Payments filtered strictly by period (effective payment date YYYY-MM-DD)
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

  // Separate Totals for the selected period
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

  // Final list filtering (Period + Category + Search term)
  const filteredPayments = useMemo(() => {
    return periodFilteredPayments.filter(p => {
      const isExp = isExpenseMovement(p);

      if (categoryFilter === "conta" && isExp) return false;
      if (categoryFilter === "despesa" && !isExp) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const desc = (p.bills?.description || "").toLowerCase();
        const supplier = (p.bills?.suppliers?.name || "").toLowerCase();
        const method = (p.payment_method || "").toLowerCase();
        const obs = (p.observation || "").toLowerCase();

        if (!desc.includes(q) && !supplier.includes(q) && !method.includes(q) && !obs.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [periodFilteredPayments, categoryFilter, searchTerm]);

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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Histórico de Pagamentos de Contas e Despesas</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Consulte separadamente os pagamentos de contas e despesas efetuadas no sistema
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/contas")} className="gap-2">
            <Receipt className="w-4 h-4" />
            Ver Contas
          </Button>
        </div>

        {/* Period Filter Bar */}
        <Card className="border shadow-xs bg-card/90 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground shrink-0">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span>Filtro por Período de Pagamento:</span>
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

        {/* 3 Summary Cards (Separated Totals & Total General) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Total Contas Pagas */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total Contas Pagas
                  </p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalContasPagas)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{currentPeriodLabel}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 shrink-0">
                <Receipt className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Total Despesas */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingCart className="w-4 h-4 text-orange-500" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total Despesas
                  </p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-orange-500">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{currentPeriodLabel}</p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500 shrink-0">
                <ShoppingCart className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Total Geral de Saídas */}
          <Card className="border-2 border-rose-500/30 shadow-md bg-rose-500/5 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                    Total Geral de Saídas
                  </p>
                </div>
                <p className="text-xl sm:text-2xl font-black text-rose-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeralSaidas)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Contas Pagas + Despesas</p>
              </div>
              <div className="p-3 bg-rose-500/15 rounded-xl text-rose-600 shrink-0">
                <DollarSign className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* List Section */}
        <Card className="border shadow-md bg-card/90 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">
                  Lançamentos de Saída ({filteredPayments.length})
                </CardTitle>
                <CardDescription>
                  Cada lançamento é categorizado exclusivamente como Conta Paga ou Despesa e integrado ao Caixa.
                </CardDescription>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                {/* Category Filter */}
                <Select 
                  value={categoryFilter} 
                  onValueChange={(val: any) => setCategoryFilter(val)}
                >
                  <SelectTrigger className="h-9 text-xs sm:text-sm w-full sm:w-44">
                    <SelectValue placeholder="Todas as Saídas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Saídas</SelectItem>
                    <SelectItem value="conta">Apenas Contas Pagas</SelectItem>
                    <SelectItem value="despesa">Apenas Despesas</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar descrição, fornecedor..."
                    className="pl-9 text-xs sm:text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredPayments.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground space-y-2">
                <Calendar className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p className="font-medium text-sm">Nenhum lançamento encontrado para o filtro selecionado.</p>
                <p className="text-xs text-muted-foreground">Tente alterar os filtros de data ou categoria acima.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPayments.map((p) => {
                  const isExp = isExpenseMovement(p);
                  const displayDate = p.normalized_date ? format(new Date(p.normalized_date + 'T00:00:00'), 'dd/MM/yyyy') : 'Sem data';

                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-lg border bg-card/50 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">{p.bills?.description || 'Pagamento'}</h3>
                          
                          {/* Distinct Category Badge */}
                          {isExp ? (
                            <Badge className="bg-orange-500/10 text-orange-600 border border-orange-200 text-xs font-semibold gap-1">
                              <ShoppingCart className="w-3 h-3" />
                              Despesa
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-500/10 text-blue-600 border border-blue-200 text-xs font-semibold gap-1">
                              <Receipt className="w-3 h-3" />
                              Conta Paga
                            </Badge>
                          )}

                          <Badge variant="outline" className="text-xs bg-muted/50">
                            {p.payment_method}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Building className="h-3.5 w-3.5 text-primary" />
                            {p.bills?.suppliers?.name || 'Sem fornecedor'}
                          </span>
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            Data do Pagamento: {displayDate}
                          </span>
                        </div>

                        {p.observation && (
                          <p className="text-xs text-muted-foreground italic">Obs: {p.observation}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Valor Pago</p>
                          <p className={`text-lg font-bold ${isExp ? 'text-orange-500' : 'text-blue-600'}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.amount_paid)}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 gap-1"
                          onClick={() => setReverseCandidate(p)}
                          title="Estornar este pagamento"
                        >
                          <Undo2 className="h-4 w-4" /> Estornar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estorno Confirmation Dialog */}
      <AlertDialog open={!!reverseCandidate} onOpenChange={() => setReverseCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar Pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja estornar o pagamento de{" "}
              <strong>
                {reverseCandidate &&
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reverseCandidate.amount_paid)}
              </strong>{" "}
              referente a <strong>"{reverseCandidate?.bills?.description}"</strong>?
              <br /><br />
              Esta ação irá devolver o valor ao saldo do caixa e recalcular o saldo e o status da conta/despesa automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={handleConfirmReverse}
            >
              Confirmar Estorno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PaymentsList;
