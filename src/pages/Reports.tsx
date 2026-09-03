import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getExpenseUsers, ExpenseUser } from "@/lib/expenseUsers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Calendar, 
  Users, 
  Store, 
  DollarSign, 
  TrendingUp, 
  FileText,
  Filter,
  Printer,
  Download
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie
} from "recharts";

interface BillData {
  id: string;
  description: string;
  dueDate: Date;
  amount: number;
  supplier: string;
  status: string;
  accountHolder?: string;
  billType?: string;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DEFAULT_COLORS = [
  "#3b82f6", "#ec4899", "#10b981", "#f59e0b", 
  "#8b5cf6", "#06b6d4", "#ef4444", "#64748b",
  "#84cc16", "#d97706", "#6366f1", "#14b8a6"
];

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [bills, setBills] = useState<BillData[]>([]);
  const [users, setUsers] = useState<ExpenseUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filters state
  const currentDate = new Date();
  const [periodMode, setPeriodMode] = useState<"month" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedBillType, setSelectedBillType] = useState<string>("all");

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const page1 = document.getElementById("report-pdf-page-1");
    const page2 = document.getElementById("report-pdf-page-2");
    if (!page1 || !page2) return;

    setIsExporting(true);
    try {
      toast({
        title: "Gerando PDF...",
        description: "Aguarde enquanto o PDF é preparado.",
      });

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const periodText = periodMode === "month"
        ? `${MONTH_NAMES[selectedMonth]}_${selectedYear}`
        : `Ano_${selectedYear}`;

      page1.classList.add("is-exporting");
      page2.classList.add("is-exporting");

      // Allow styles to apply and Recharts to re-render
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => setTimeout(resolve, 500));

      const captureOptions = {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      };

      const canvas1 = await html2canvas(page1, captureOptions);
      const canvas2 = await html2canvas(page2, captureOptions);

      // A4 dimensions in mm
      const pdfW = 210;
      const pdfH = 297;
      const margin = 10;
      const usableW = pdfW - margin * 2;
      const usableH = pdfH - margin * 2;

      const pdf = new jsPDF("p", "mm", "a4");

      const addPageToPdf = (canvas: HTMLCanvasElement, isFirst: boolean) => {
        if (!isFirst) pdf.addPage();
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const aspect = canvas.height / canvas.width;
        let w = usableW;
        let h = w * aspect;
        // Scale down if taller than usable height
        if (h > usableH) {
          h = usableH;
          w = h / aspect;
        }
        const x = margin + (usableW - w) / 2;
        pdf.addImage(imgData, "JPEG", x, margin, w, h);
      };

      addPageToPdf(canvas1, true);
      addPageToPdf(canvas2, false);

      pdf.save(`Relatorio_Contas_${periodText}.pdf`);

      toast({
        title: "PDF Gerado!",
        description: `Relatorio_Contas_${periodText}.pdf salvo com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o arquivo PDF.",
        variant: "destructive",
      });
    } finally {
      document.getElementById("report-pdf-page-1")?.classList.remove("is-exporting");
      document.getElementById("report-pdf-page-2")?.classList.remove("is-exporting");
      window.dispatchEvent(new Event("resize"));
      setIsExporting(false);
    }
  };


  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Load users
        const fetchedUsers = await getExpenseUsers();
        setUsers(fetchedUsers);

        // Load bills
        const { data: billsData, error } = await supabase
          .from("bills")
          .select(`
            *,
            suppliers (name)
          `)
          .order("due_date", { ascending: true });

        if (error) throw error;

        const formatted = billsData?.map((b: any) => ({
          id: b.id,
          description: b.description,
          dueDate: new Date(b.due_date + "T00:00:00"),
          amount: Number(b.amount) || 0,
          supplier: b.suppliers?.name || "Sem fornecedor",
          status: b.status,
          accountHolder: b.account_holder || "Sem Usuário",
          billType: b.bill_type || "conta",
        })) || [];

        setBills(formatted);
      } catch (err) {
        console.error("Erro ao carregar dados dos relatórios:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentDate.getFullYear());
    bills.forEach((b) => {
      if (b.dueDate && !isNaN(b.dueDate.getFullYear())) {
        yearsSet.add(b.dueDate.getFullYear());
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [bills]);

  // Filtered Bills by selected period & status & type
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const yearMatches = b.dueDate.getFullYear() === selectedYear;
      const monthMatches = periodMode === "year" || b.dueDate.getMonth() === selectedMonth;
      const statusMatches = selectedStatus === "all" || b.status === selectedStatus;
      const typeMatches = selectedBillType === "all" || b.billType === selectedBillType;
      return yearMatches && monthMatches && statusMatches && typeMatches;
    });
  }, [bills, periodMode, selectedMonth, selectedYear, selectedStatus, selectedBillType]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalAmount = filteredBills.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCount = filteredBills.length;
    const paidBills = filteredBills.filter((b) => b.status === "paid");
    const paidAmount = paidBills.reduce((acc, curr) => acc + curr.amount, 0);
    const pendingAmount = filteredBills
      .filter((b) => b.status === "pending" || b.status === "overdue")
      .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      totalAmount,
      totalCount,
      paidAmount,
      pendingAmount
    };
  }, [filteredBills]);

  // Data: Expenses by User
  const userChartData = useMemo(() => {
    const userMap: { [name: string]: { name: string; amount: number; count: number; color: string } } = {};

    // Initialize with known users
    users.forEach((u) => {
      userMap[u.name] = { name: u.name, amount: 0, count: 0, color: u.color || "#3b82f6" };
    });
    userMap["Sem Usuário"] = { name: "Sem Usuário", amount: 0, count: 0, color: "#64748b" };

    filteredBills.forEach((b) => {
      const uName = b.accountHolder || "Sem Usuário";
      if (!userMap[uName]) {
        userMap[uName] = { name: uName, amount: 0, count: 0, color: "#8b5cf6" };
      }
      userMap[uName].amount += b.amount;
      userMap[uName].count += 1;
    });

    return Object.values(userMap)
      .filter((u) => u.amount > 0 || u.count > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [filteredBills, users]);

  // Data: Expenses by Supplier
  const supplierChartData = useMemo(() => {
    const suppMap: { [name: string]: { name: string; amount: number; count: number } } = {};

    filteredBills.forEach((b) => {
      const sName = b.supplier || "Sem fornecedor";
      if (!suppMap[sName]) {
        suppMap[sName] = { name: sName, amount: 0, count: 0 };
      }
      suppMap[sName].amount += b.amount;
      suppMap[sName].count += 1;
    });

    return Object.values(suppMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Top 10 suppliers
  }, [filteredBills]);

  // Data: Expenses by Status (Pie)
  const statusChartData = useMemo(() => {
    const paid = filteredBills.filter((b) => b.status === "paid").reduce((a, c) => a + c.amount, 0);
    const pending = filteredBills.filter((b) => b.status === "pending").reduce((a, c) => a + c.amount, 0);
    const overdue = filteredBills.filter((b) => b.status === "overdue").reduce((a, c) => a + c.amount, 0);

    return [
      { name: "Pagas", value: paid, color: "#10b981" },
      { name: "Pendentes", value: pending, color: "#f59e0b" },
      { name: "Vencidas", value: overdue, color: "#ef4444" }
    ].filter((item) => item.value > 0);
  }, [filteredBills]);

  // Data: Monthly Evolution (when in Year mode)
  const monthlyEvolutionData = useMemo(() => {
    const monthsData = MONTH_NAMES.map((name, index) => ({
      month: name.substring(0, 3),
      fullName: name,
      amount: 0,
      count: 0
    }));

    bills
      .filter((b) => b.dueDate.getFullYear() === selectedYear && (selectedStatus === "all" || b.status === selectedStatus))
      .forEach((b) => {
        const m = b.dueDate.getMonth();
        if (m >= 0 && m < 12) {
          monthsData[m].amount += b.amount;
          monthsData[m].count += 1;
        }
      });

    return monthsData;
  }, [bills, selectedYear, selectedStatus]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20 p-4 sm:p-6 print:p-0 print:bg-white">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 10mm;
        }
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          /* Each report page occupies exactly one printed page */
          .pdf-page-container {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            margin-top: 0 !important;
            padding: 4mm !important;
            box-sizing: border-box !important;
          }
          /* Last page: no blank page after it */
          .pdf-page-container:last-of-type {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          /* Cards should not break across pages */
          .pdf-page-container > * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Reduce chart height for A4 fit */
          .chart-container {
            height: 220px !important;
            max-height: 220px !important;
          }
          /* Remove decorative shadows and backgrounds */
          .shadow-md, .shadow-sm {
            box-shadow: none !important;
          }
          .border-0 {
            border: 1px solid #e2e8f0 !important;
          }
          /* Metric cards: force 2-column grid on print */
          .print-grid-2 {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          /* Charts side by side on print */
          .print-grid-charts {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          /* Reduce padding inside cards on print */
          .print-compact-card .p-4,
          .print-compact-card .p-6,
          .print-compact-card .sm\\:p-6 {
            padding: 8px !important;
          }
        }
        /* PDF export canvas sizing */
        .is-exporting {
          background-color: #ffffff !important;
          color: #0f172a !important;
          padding: 12px !important;
          width: 860px !important;
          max-width: 860px !important;
          margin: 0 auto !important;
          box-shadow: none !important;
          box-sizing: border-box !important;
        }
        /* Show report header only during PDF export */
        .is-exporting .is-exporting-header {
          display: block !important;
        }
        /* Force grids side-by-side during export */
        .is-exporting .export-grid-2 {
          display: grid !important;
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 12px !important;
        }
        .is-exporting .chart-container {
          height: 240px !important;
          max-height: 240px !important;
        }
        .is-exporting .border-0 {
          border: 1px solid #e2e8f0 !important;
        }
        .is-exporting .shadow-md, 
        .is-exporting .shadow-sm {
          box-shadow: none !important;
        }
        .is-exporting .bg-card\/80, 
        .is-exporting .bg-card\/70, 
        .is-exporting .bg-card\/60,
        .is-exporting .bg-card {
          background-color: #ffffff !important;
        }
        .is-exporting .backdrop-blur-sm {
          backdrop-filter: none !important;
        }
      `}</style>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="print:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-primary print:hidden" />
                Relatório de Contas e Despesas
              </h1>
              <p className="text-sm text-muted-foreground">
                Análise gráfica detalhada das suas contas por usuário, fornecedor e período.
              </p>
            </div>
          </div>

          {/* Action Print / PDF Dropdown */}
          <div className="print:hidden flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </Button>
            <Button
              variant="default"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? "Gerando..." : "Salvar PDF"}</span>
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm print:shadow-none print:bg-white print:border">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 print:hidden">
              {/* Period Mode Toggle */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Visualização:</span>
                <Tabs value={periodMode} onValueChange={(val) => setPeriodMode(val as "month" | "year")}>
                  <TabsList>
                    <TabsTrigger value="month">Por Mês</TabsTrigger>
                    <TabsTrigger value="year">Por Ano</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Selectors */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {periodMode === "month" && (
                  <div className="w-36">
                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(val) => setSelectedMonth(Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((name, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="w-28">
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(val) => setSelectedYear(Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((yr) => (
                        <SelectItem key={yr} value={yr.toString()}>
                          {yr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-36">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="paid">Pagas</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="overdue">Vencidas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-36">
                  <Select value={selectedBillType} onValueChange={setSelectedBillType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Tipos</SelectItem>
                      <SelectItem value="conta">Somente Contas</SelectItem>
                      <SelectItem value="despesa">Somente Despesas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Active filter indication badge */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 print:pt-0">
              <Calendar className="w-3.5 h-3.5 text-primary print:hidden" />
              <span>
                Exibindo relatórios de:{" "}
                <strong className="text-foreground">
                  {periodMode === "month"
                    ? `${MONTH_NAMES[selectedMonth]} de ${selectedYear}`
                    : `Ano de ${selectedYear}`}
                </strong>
                {selectedStatus !== "all" && (
                  <span>
                    {" "}
                    (Status:{" "}
                    <Badge variant="outline" className="text-xs py-0">
                      {selectedStatus === "paid" ? "Pagas" : selectedStatus === "pending" ? "Pendentes" : "Vencidas"}
                    </Badge>
                    )
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* REPORT PAGE 1 WRAPPER */}
        <div id="report-pdf-page-1" className="pdf-page-container space-y-6 p-1 rounded-xl">
          {/* Active Filter Title Header for Export/Print */}
          <div className="hidden print:block is-exporting-header mb-4">
            <h2 className="text-xl font-bold text-foreground">Relatório de Contas e Despesas - Página 1</h2>
            <p className="text-xs text-muted-foreground">
              Período: {periodMode === "month" ? `${MONTH_NAMES[selectedMonth]} / ${selectedYear}` : `Ano ${selectedYear}`}
            </p>
          </div>

          {/* Metric Cards Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print-grid-2">
            <Card className="border-0 shadow-sm bg-card/70 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total no Período</p>
                  <p className="text-xl sm:text-2xl font-bold text-primary">{formatCurrency(summary.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{summary.totalCount} contas lançadas</p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <DollarSign className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card/70 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Contas Pagas</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600">{formatCurrency(summary.paidAmount)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {filteredBills.filter((b) => b.status === "paid").length} contas pagas
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card/70 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pendentes / Vencidas</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-600">{formatCurrency(summary.pendingAmount)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {filteredBills.filter((b) => b.status !== "paid").length} contas a pagar
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600">
                  <FileText className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card/70 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Maior Gastador</p>
                  <p className="text-lg sm:text-xl font-bold truncate">
                    {userChartData.length > 0 ? userChartData[0].name : "Nenhum"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {userChartData.length > 0 ? formatCurrency(userChartData[0].amount) : "R$ 0,00"}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-600">
                  <Users className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-grid-charts">
            {/* Chart 1: Expense by User */}
            <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Contas por Usuário
                </CardTitle>
                <CardDescription>
                  Total de valores acumulados por usuário no período selecionado.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] chart-container">
                {userChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Nenhum dado encontrado para os filtros selecionados.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `R$${val}`}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), "Valor Total"]}
                        labelFormatter={(label) => `Usuário: ${label}`}
                        contentStyle={{ borderRadius: "8px", backgroundColor: "#ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {userChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Chart 2: Expense by Supplier */}
            <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" />
                  Contas por Fornecedor (Top 10)
                </CardTitle>
                <CardDescription>
                  Fornecedores com maior volume de gastos no período.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] chart-container">
                {supplierChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Nenhum dado encontrado para os filtros selecionados.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={supplierChartData}
                      margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                    >
                      <XAxis type="number" tickFormatter={(val) => `R$${val}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={140}
                        tickFormatter={(val: string) => (val && val.length > 18 ? `${val.substring(0, 16)}...` : val)}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val), "Total Lançado"]}
                        labelFormatter={(label) => `Fornecedor: ${label}`}
                        contentStyle={{ borderRadius: "8px", backgroundColor: "#ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* REPORT PAGE 2 WRAPPER */}
        <div id="report-pdf-page-2" className="pdf-page-container space-y-6 p-1 rounded-xl mt-6">
          {/* Active Filter Title Header for Export/Print */}
          <div className="hidden print:block is-exporting-header mb-4">
            <h2 className="text-xl font-bold text-foreground">Relatório de Contas e Despesas - Página 2</h2>
            <p className="text-xs text-muted-foreground">
              Período: {periodMode === "month" ? `${MONTH_NAMES[selectedMonth]} / ${selectedYear}` : `Ano ${selectedYear}`}
            </p>
          </div>

          {/* Charts Grid 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-grid-charts">
            {/* Chart 3: Monthly Evolution */}
            <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Evolução Mensal ({selectedYear})
                </CardTitle>
                <CardDescription>
                  Comparativo mês a mês dos totais de despesas no ano de {selectedYear}.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyEvolutionData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => `R$${val}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val), "Total do Mês"]}
                      labelFormatter={(label) => `Mês: ${label}`}
                      contentStyle={{ borderRadius: "8px", backgroundColor: "#ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    />
                    <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chart 4: Status Distribution */}
            <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-primary" />
                  Distribuição por Status
                </CardTitle>
                <CardDescription>
                  Proporção entre contas pagas, pendentes e vencidas.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] chart-container flex flex-col items-center justify-center">
                {statusChartData.length === 0 ? (
                  <div className="text-muted-foreground text-sm">Nenhum dado no período.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-status-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => [formatCurrency(val), "Valor"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Summary Table */}
          <Card className="border-0 shadow-md bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Resumo por Usuário
              </CardTitle>
              <CardDescription>
                Tabela de valores e quantidade de contas atribuídas a cada usuário no período.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
                    <tr>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Qtd. Contas</th>
                      <th className="py-3 px-4">Total Gasto</th>
                      <th className="py-3 px-4">% do Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userChartData.map((u, i) => {
                      const pct = summary.totalAmount > 0 ? ((u.amount / summary.totalAmount) * 100).toFixed(1) : "0";
                      return (
                        <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: u.color }}
                            />
                            {u.name}
                          </td>
                          <td className="py-3 px-4">{u.count}</td>
                          <td className="py-3 px-4 font-semibold text-primary">{formatCurrency(u.amount)}</td>
                          <td className="py-3 px-4">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Reports;
