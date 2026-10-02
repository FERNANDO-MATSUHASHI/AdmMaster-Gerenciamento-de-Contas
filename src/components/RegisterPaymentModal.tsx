import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useBillPaymentOperations } from "@/hooks/useBillPaymentOperations";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";

const PAYMENT_METHODS = [
  "Pix",
  "Transferência BANCÁRIA",
  "Boleto",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Dinheiro",
  "Cheque",
  "Outro"
];

interface RegisterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: {
    id: string;
    description: string;
    amount: number;
    supplier?: string;
    supplier_name?: string;
  } | null;
  onSuccess: () => void;
}

export const RegisterPaymentModal = ({
  isOpen,
  onClose,
  bill,
  onSuccess
}: RegisterPaymentModalProps) => {
  const { registerPayment, isLoading } = useBillPaymentOperations();

  const [alreadyPaid, setAlreadyPaid] = useState<number>(0);
  const [remainingBalance, setRemainingBalance] = useState<number>(0);
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState<string>("Pix");
  const [observation, setObservation] = useState<string>("");

  useEffect(() => {
    if (isOpen && bill) {
      fetchBillPaymentsInfo();
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentMethod("Pix");
      setObservation("");
    }
  }, [isOpen, bill]);

  const fetchBillPaymentsInfo = async () => {
    if (!bill) return;

    try {
      const { data, error } = await supabase
        .from('bill_payments')
        .select('amount_paid')
        .eq('bill_id', bill.id);

      if (error) throw error;

      const totalPaid = (data || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);
      const remaining = Number(bill.amount) - totalPaid;

      setAlreadyPaid(totalPaid);
      setRemainingBalance(remaining > 0 ? remaining : 0);
      setAmountPaidInput(remaining > 0 ? remaining.toFixed(2) : "0.00");
    } catch (err) {
      console.error('Erro ao buscar histórico de pagamentos da conta:', err);
      setAlreadyPaid(0);
      setRemainingBalance(Number(bill.amount));
      setAmountPaidInput(Number(bill.amount).toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill) return;

    const parsedValue = parseFloat(amountPaidInput.replace(',', '.'));
    if (isNaN(parsedValue) || parsedValue <= 0) {
      return;
    }

    const result = await registerPayment({
      bill_id: bill.id,
      amount_paid: parsedValue,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      observation: observation
    });

    if (result) {
      onSuccess();
      onClose();
    }
  };

  if (!bill) return null;

  const currentInputValue = parseFloat(amountPaidInput.replace(',', '.')) || 0;
  const expectedRemaining = remainingBalance - currentInputValue;
  const isFullPayment = expectedRemaining <= 0.001;

  const supplierName = bill.supplier || bill.supplier_name || 'Sem fornecedor';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5 text-primary" />
            Registrar Pagamento de Conta
          </DialogTitle>
          <DialogDescription>
            {bill.description} — <span className="font-medium text-foreground">{supplierName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Summary Box */}
          <div className="p-3 bg-secondary/40 rounded-lg border text-xs sm:text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Total da Conta:</span>
              <span className="font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bill.amount)}</span>
            </div>
            {alreadyPaid > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Já Pago Anteriormente:</span>
                <span className="font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(alreadyPaid)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-semibold text-primary">
              <span>Saldo Devedor Restante:</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingBalance)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor a pagar */}
            <div className="space-y-2">
              <Label htmlFor="amount_paid">Valor do Pagamento (R$) *</Label>
              <Input
                id="amount_paid"
                type="number"
                step="0.01"
                min="0.01"
                max={remainingBalance.toFixed(2)}
                value={amountPaidInput}
                onChange={(e) => setAmountPaidInput(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                {isFullPayment ? "💡 Pagamento total da conta" : "💡 Pagamento parcial"}
              </p>
            </div>

            {/* Data do pagamento */}
            <div className="space-y-2">
              <Label htmlFor="payment_date">Data do Pagamento *</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="payment_method">Forma de Pagamento *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment_method">
                <SelectValue placeholder="Selecione a forma" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              placeholder="Número de comprovante, detalhes da transferência, etc."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={2}
            />
          </div>

          {/* Preview Badge of new status */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">Status resultante da conta:</span>
            <Badge variant={isFullPayment ? "default" : "secondary"} className={isFullPayment ? "bg-emerald-600" : "bg-amber-500 text-white"}>
              {isFullPayment ? "Pago" : "Parcialmente pago"}
            </Badge>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {isLoading ? "Salvando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
