import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  FileText,
  Printer,
  Download,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Calendar,
  ExternalLink,
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface UserReportBill {
  id: string;
  description: string;
  dueDate: Date;
  amount: number;
  supplier: string;
  status: string;
  accountHolder?: string;
  billType?: string;
  paymentType?: string;
}

interface UserReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string | null;
  userColor?: string;
  periodFilter?: {
    periodMode: "month" | "year";
    selectedMonth: number;
    selectedYear: number;
    monthName?: string;
  };
  initialBills?: UserReportBill[];
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const UserReportModal: React.FC<UserReportModalProps> = ({
  isOpen,
  onClose,
  userName,
  userColor = "#3b82f6",
  periodFilter,
  initialBills,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [bills, setBills] = useState<UserReportBill[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Filters within the modal
  const [periodScope, setPeriodScope] = useState<"current" | "all">("current");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Load user bills from Supabase or initialBills
  useEffect(() => {
    if (!isOpen || !userName) return;

    const fetchUserBills = async () => {
      try {
        setIsLoading(true);
        const { data: billsData, error } = await supabase
          .from("bills")
          .select(`
            *,
            suppliers (name)
          `)
          .order("due_date", { ascending: false });

        if (error) throw error;

        const formatted = (billsData || []).map((b: any) => {
          const isDespesa = b.bill_type === "despesa" || b.payment_type === "despesa";
          return {
            id: b.id,
            description: b.description,
            dueDate: new Date(b.due_date + "T00:00:00"),
            amount: Number(b.amount) || 0,
            supplier: b.suppliers?.name || "Sem fornecedor",
            status: b.status,
            accountHolder: b.account_holder || "Sem Usuário",
            billType: isDespesa ? "despesa" : "conta",
            paymentType: b.payment_type || "conta",
          };
        });

        setBills(formatted);
      } catch (err) {
        console.error("Erro ao carregar registros do usuário:", err);
        if (initialBills) {
          setBills(initialBills);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserBills();
  }, [isOpen, userName]);

  // Helper matching user
  const isUserMatch = (accountHolder?: string) => {
    if (!userName) return false;
    if (userName === "Sem Usuário") {
      return !accountHolder || accountHolder.trim() === "" || accountHolder === "Sem Usuário";
    }
    return accountHolder?.trim().toLowerCase() === userName.trim().toLowerCase();
  };

  // Filter bills for the user and applied filters
  const userFilteredBills = useMemo(() => {
    return bills.filter((b) => {
      // 1. User match
      if (!isUserMatch(b.accountHolder)) return false;

      // 2. Period scope
      if (periodScope === "current" && periodFilter) {
        const bYear = b.dueDate.getFullYear();
        const bMonth = b.dueDate.getMonth();

        if (bYear !== periodFilter.selectedYear) return false;
        if (periodFilter.periodMode === "month" && bMonth !== periodFilter.selectedMonth) {
          return false;
        }
      }

      // 3. Status filter
      if (statusFilter !== "all" && b.status !== statusFilter) return false;

      // 4. Type filter
      if (typeFilter !== "all" && b.billType !== typeFilter) return false;

      // 5. Search term
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        const descMatch = b.description?.toLowerCase().includes(term);
        const suppMatch = b.supplier?.toLowerCase().includes(term);
        if (!descMatch && !suppMatch) return false;
      }

      return true;
    });
  }, [bills, userName, periodScope, periodFilter, statusFilter, typeFilter, searchTerm]);

  // Summary Metrics for this user
  const metrics = useMemo(() => {
    const totalAmount = userFilteredBills.reduce((acc, c) => acc + c.amount, 0);
    const totalCount = userFilteredBills.length;

    const paidBills = userFilteredBills.filter((b) => b.status === "paid");
    const paidAmount = paidBills.reduce((acc, c) => acc + c.amount, 0);

    const pendingBills = userFilteredBills.filter((b) => b.status === "pending" || b.status === "overdue");
    const pendingAmount = pendingBills.reduce((acc, c) => acc + c.amount, 0);

    return {
      totalAmount,
      totalCount,
      paidAmount,
      paidCount: paidBills.length,
      pendingAmount,
      pendingCount: pendingBills.length,
    };
  }, [userFilteredBills]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR").format(date);
  };

  // Export PDF
  const handleExportPDF = async () => {
    const printElement = document.getElementById("user-report-printable-area");
    if (!printElement) return;

    try {
      setIsExportingPdf(true);
      toast({
        title: "Gerando PDF...",
        description: `Preparando relatório para ${userName}`,
      });

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(printElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = 210;
      const pdfH = 297;
      const margin = 10;
      const usableW = pdfW - margin * 2;
      const usableH = pdfH - margin * 2;

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const aspect = canvas.height / canvas.width;
      let w = usableW;
      let h = w * aspect;

      if (h > usableH) {
        h = usableH;
        w = h / aspect;
      }

      pdf.addImage(imgData, "JPEG", margin + (usableW - w) / 2, margin, w, h);
      pdf.save(`Relatorio_Individual_${userName?.replace(/\s+/g, "_")}.pdf`);

      toast({
        title: "PDF Gerado com Sucesso!",
        description: `Arquivo de ${userName} baixado.`,
      });
    } catch (err) {
      console.error("Erro ao gerar PDF do usuário:", err);
      toast({
        title: "Erro ao gerar PDF",
        description: "Ocorreu uma falha ao preparar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (userFilteredBills.length === 0) {
      toast({
        title: "Sem registros",
        description: "Não há lançamentos para exportar.",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Data de Vencimento", "Descrição", "Fornecedor", "Tipo", "Valor (R$)", "Status"];
    const rows = userFilteredBills.map((b) => [
      formatDate(b.dueDate),
      `"${b.description.replace(/"/g, '""')}"`,
      `"${b.supplier.replace(/"/g, '""')}"`,
      b.billType === "despesa" ? "Despesa" : "Conta",
      b.amount.toFixed(2).replace(".", ","),
      b.status === "paid" ? "Paga" : b.status === "pending" ? "Pendente" : "Vencida",
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Relatorio_Individual_${userName?.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Exportado",
      description: `Planilha de ${userName} gerada com sucesso.`,
    });
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  if (!userName) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border shadow-2xl">
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #user-report-printable-area, #user-report-printable-area * {
              visibility: visible !important;
            }
            #user-report-printable-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: #ffffff !important;
              color: #000000 !important;
              padding: 15px !important;
            }
            .modal-no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-muted/50 via-background to-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 modal-no-print">
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0"
              style={{ backgroundColor: userColor }}
            >
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <span>Relatório Individual:</span>
                <span className="text-primary">{userName}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Exibindo lançamentos e totais acumulados para este usuário.
              </DialogDescription>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 text-xs"
              title="Imprimir relatório do usuário"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 text-xs"
              title="Exportar planilha CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="gap-1.5 text-xs"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isExportingPdf ? "Gerando..." : "Salvar PDF"}</span>
            </Button>
          </div>
        </div>

        {/* Modal Controls Bar */}
        <div className="p-4 bg-muted/20 border-b space-y-3 modal-no-print">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs sm:text-sm h-9"
              />
            </div>

            {/* Select Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Period Scope Toggle */}
              {periodFilter && (
                <Select
                  value={periodScope}
                  onValueChange={(val: "current" | "all") => setPeriodScope(val)}
                >
                  <SelectTrigger className="w-[170px] h-9 text-xs">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-primary" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current" className="text-xs">
                      {periodFilter.periodMode === "month"
                        ? `${MONTH_NAMES[periodFilter.selectedMonth]} / ${periodFilter.selectedYear}`
                        : `Ano ${periodFilter.selectedYear}`}
                    </SelectItem>
                    <SelectItem value="all" className="text-xs">
                      Todo o Histórico
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos Status</SelectItem>
                  <SelectItem value="paid" className="text-xs">Pagas</SelectItem>
                  <SelectItem value="pending" className="text-xs">Pendentes</SelectItem>
                  <SelectItem value="overdue" className="text-xs">Vencidas</SelectItem>
                </SelectContent>
              </Select>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos Tipos</SelectItem>
                  <SelectItem value="conta" className="text-xs">Contas</SelectItem>
                  <SelectItem value="despesa" className="text-xs">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Printable / Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" id="user-report-printable-area">
          {/* Printable Report Header */}
          <div className="hidden print:block mb-4 border-b pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Relatório Individual de Contas</h1>
                <p className="text-sm text-gray-600">
                  Usuário: <strong>{userName}</strong> | Emitido em: {new Date().toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div
                className="w-8 h-8 rounded-full"
                style={{ backgroundColor: userColor }}
              />
            </div>
          </div>

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border shadow-none bg-card/60">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total do Usuário</p>
                  <p className="text-lg sm:text-xl font-bold text-primary">{formatCurrency(metrics.totalAmount)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {metrics.totalCount} {metrics.totalCount === 1 ? "registro" : "registros"}
                  </p>
                </div>
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-none bg-card/60">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Contas Pagas</p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600">{formatCurrency(metrics.paidAmount)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {metrics.paidCount} pagas
                  </p>
                </div>
                <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-none bg-card/60">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pendentes / Vencidas</p>
                  <p className="text-lg sm:text-xl font-bold text-amber-600">{formatCurrency(metrics.pendingAmount)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {metrics.pendingCount} a pagar
                  </p>
                </div>
                <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Records Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Registros do Usuário ({userFilteredBills.length})</span>
              </h3>
            </div>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">Carregando lançamentos de {userName}...</span>
              </div>
            ) : userFilteredBills.length === 0 ? (
              <div className="py-12 border rounded-lg text-center bg-muted/10 text-muted-foreground">
                <p className="text-sm font-medium">Nenhum registro encontrado.</p>
                <p className="text-xs mt-1">Tente ajustar os filtros acima ou alterar o período.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto bg-card">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="text-[11px] uppercase bg-muted/60 text-muted-foreground border-b">
                    <tr>
                      <th className="py-2.5 px-3">Vencimento</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3">Fornecedor</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3 text-right">Valor</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right modal-no-print">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {userFilteredBills.map((b) => {
                      const isPaid = b.status === "paid";
                      const isOverdue = b.status === "overdue";

                      return (
                        <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                            {formatDate(b.dueDate)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-foreground">{b.description}</span>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {b.supplier}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 capitalize ${
                                b.billType === "despesa"
                                  ? "bg-purple-500/10 text-purple-600 border-purple-300"
                                  : "bg-blue-500/10 text-blue-600 border-blue-300"
                              }`}
                            >
                              {b.billType === "despesa" ? "Despesa" : "Conta"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground whitespace-nowrap">
                            {formatCurrency(b.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 ${
                                isPaid
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                                  : isOverdue
                                  ? "bg-rose-500/10 text-rose-600 border-rose-300"
                                  : "bg-amber-500/10 text-amber-600 border-amber-300"
                              }`}
                            >
                              {isPaid ? "Paga" : isOverdue ? "Vencida" : "Pendente"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right modal-no-print whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              title="Ver Detalhes da Conta"
                              onClick={() => {
                                onClose();
                                navigate(`/bill/${b.id}`);
                              }}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
