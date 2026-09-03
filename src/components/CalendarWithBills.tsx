import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarIcon, Clock, Edit, Trash2, Check, Eye, Paperclip, User, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, capitalizeFirst } from "@/lib/utils";

import { useExpenseUsers } from "@/hooks/useExpenseUsers";

interface Bill {
  id: string;
  description: string;
  dueDate: Date;
  amount: number;
  supplier: string;
  status: string;
  attachmentUrl?: string;
  paymentProofUrl?: string;
  paymentType?: string;
  checkNumber?: string;
  bankName?: string;
  accountHolder?: string;
  billType?: string;
}

interface CalendarWithBillsProps {
  bills: Bill[];
  onDateSelect?: (date: Date) => void;
  onEditBill?: (billId: string) => void;
  onDeleteBill?: (billId: string) => void;
  onMarkAsPaid?: (billId: string) => void;
  onViewAttachment?: (attachmentUrl: string) => void;
  onUploadPaymentProof?: (billId: string) => void;
  isUpdating?: boolean;
  onMonthChange?: (date: Date) => void;
  selectedUser?: string | null;
  onSelectUser?: (user: string | null) => void;
}

export const CalendarWithBills: React.FC<CalendarWithBillsProps> = ({ 
  bills, 
  onDateSelect,
  onEditBill,
  onDeleteBill,
  onMarkAsPaid,
  onViewAttachment,
  onUploadPaymentProof,
  isUpdating = false,
  onMonthChange,
  selectedUser,
  onSelectUser
}) => {
  const { getUserBadgeStyle } = useExpenseUsers();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [paymentProofDialog, setPaymentProofDialog] = useState<{open: boolean, billId: string | null}>({
    open: false,
    billId: null
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Align calendar to week start (Sunday=0)
  const startDayOfWeek = getDay(monthStart);
  const leadingBlankDays = Array.from({ length: startDayOfWeek });

  const totalCells = startDayOfWeek + calendarDays.length;
  const trailingBlankDays = Array.from({ length: (7 - (totalCells % 7)) % 7 });

  const getBillsForDate = (date: Date) => {
    return bills.filter(bill => isSameDay(bill.dueDate, date));
  };

  const getUserBillsForMonth = (user: string) => {
    return bills.filter(bill => {
      const isMonth = isSameMonth(bill.dueDate, currentDate);
      const holder = bill.accountHolder?.trim();
      if (user === "Sem Usuário") {
        return isMonth && (!holder || holder === "");
      }
      return isMonth && holder === user;
    }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  };

  const safeFormatDate = (dateVal: any, formatStr: string = "dd/MM/yyyy") => {
    try {
      if (!dateVal) return "";
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      if (isNaN(d.getTime())) return "";
      return format(d, formatStr, { locale: ptBR });
    } catch (e) {
      return "";
    }
  };

  const renderBillList = (billsList: Bill[]) => (
    <div className="space-y-3">
      {billsList.map((bill) => (
        <div key={bill.id} className="p-3 bg-secondary/50 rounded-lg space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{bill.description}</p>
                {bill.billType === 'despesa' && (
                  <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-orange-100 text-orange-700 border border-orange-300">
                    Despesa
                  </span>
                )}
                {bill.accountHolder && (
                  <Badge 
                    variant="outline" 
                    className="text-xs font-semibold"
                    style={getUserBadgeStyle(bill.accountHolder) || {
                      backgroundColor: "hsl(var(--primary) / 0.1)",
                      color: "hsl(var(--primary))",
                      borderColor: "hsl(var(--primary) / 0.3)"
                    }}
                  >
                    {bill.accountHolder}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {safeFormatDate(bill.dueDate, "dd/MM/yyyy")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{bill.supplier}</p>
              {bill.accountHolder && bill.paymentType !== 'cheque' && (
                <p className="text-xs text-primary font-medium">Pessoa: {bill.accountHolder}</p>
              )}
              {bill.paymentType === 'cheque' && (
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                  {bill.checkNumber && <p>Nº Cheque: {bill.checkNumber}</p>}
                  {bill.bankName && <p>Banco: {bill.bankName}</p>}
                  {bill.accountHolder && <p>Titular/Pessoa: {bill.accountHolder}</p>}
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="font-semibold text-primary">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(bill.amount)}
              </p>
              <Badge className={`${getStatusColor(bill.status)} text-xs`}>
                {bill.status === 'pending' ? 'Pendente' :
                 bill.status === 'overdue' ? 'Vencida' :
                 bill.status === 'paid' ? 'Paga' : 'Desconhecido'}
              </Badge>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {bill.status === 'paid' && bill.paymentProofUrl && (
              <Button 
                size="sm"
                variant="outline" 
                onClick={() => onViewAttachment?.(bill.paymentProofUrl!)}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Ver Comprovante
              </Button>
            )}
            
            {bill.attachmentUrl && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onViewAttachment?.(bill.attachmentUrl!)}
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver Anexo
              </Button>
            )}
            
            {onEditBill && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onEditBill(bill.id)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
            )}
            
            {onDeleteBill && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir "{bill.description}"? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeleteBill(bill.id)}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            
            {bill.status !== 'paid' && bill.billType !== 'despesa' && onMarkAsPaid && onUploadPaymentProof && (
              <Dialog 
                open={paymentProofDialog.open && paymentProofDialog.billId === bill.id}
                onOpenChange={(open) => setPaymentProofDialog({ open, billId: open ? bill.id : null })}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Check className="w-4 h-4 mr-1" />
                    Marcar como Paga
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Marcar Conta como Paga</DialogTitle>
                    <DialogDescription>
                      Deseja anexar um comprovante de pagamento?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="text-sm text-muted-foreground">
                      Você pode anexar um comprovante de pagamento (PDF, JPG ou PNG) ou marcar como paga sem comprovante.
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        onMarkAsPaid(bill.id);
                        setPaymentProofDialog({ open: false, billId: null });
                      }}
                      disabled={isUpdating}
                    >
                      Marcar sem Comprovante
                    </Button>
                    <Button
                      onClick={() => {
                        onUploadPaymentProof(bill.id);
                        setPaymentProofDialog({ open: false, billId: null });
                      }}
                      disabled={isUpdating}
                    >
                      <Paperclip className="w-4 h-4 mr-2" />
                      Anexar Comprovante
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'bg-destructive text-destructive-foreground';
      case 'pending':
        return 'bg-warning text-warning-foreground';
      case 'paid':
        return 'bg-success text-success-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const handlePreviousMonth = () => {
    const newDate = subMonths(currentDate, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };

  const handleNextMonth = () => {
    const newDate = addMonths(currentDate, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4">
        <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          {capitalizeFirst(format(currentDate, "MMMM 'de' yyyy", { locale: ptBR }))}
        </h2>
        <Button variant="outline" size="sm" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {/* Leading blanks to align first day */}
        {leadingBlankDays.map((_, i) => (
          <div
            key={`blank-start-${i}`}
            className="min-h-[60px] sm:min-h-[120px] rounded-md bg-muted/30"
            aria-hidden="true"
          />
        ))}

        {/* Actual month days */}
        {calendarDays.map((day) => {
          const dayBills = getBillsForDate(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDayToday = isToday(day);

          return (
            <Card
              key={day.toString()}
              className={cn(
                "min-h-[60px] sm:min-h-[120px] cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary",
                !isCurrentMonth && "opacity-50",
                isDayToday && "ring-1 ring-primary/50"
              )}
              onClick={() => handleDateClick(day)}
            >
              <CardContent className="p-1 sm:p-2 h-full">
                <div className="flex flex-col h-full">
                  {/* Day Number */}
                  <div className={cn(
                    "text-xs sm:text-sm font-medium mb-1 flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full",
                    isDayToday && "bg-primary text-primary-foreground",
                    isSelected && !isDayToday && "bg-secondary text-secondary-foreground"
                  )}>
                    {format(day, 'd')}
                  </div>

                  {/* Bills - Simplified for mobile */}
                  <div className="flex-1 overflow-hidden">
                    {/* Mobile: Show indicator dots with status colors */}
                    <div className="sm:hidden">
                      {dayBills.length > 0 && (
                        <div className="flex justify-center gap-0.5">
                          {dayBills.slice(0, 3).map((bill) => (
                            <div 
                              key={bill.id}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                bill.status === 'paid' && "bg-success",
                                bill.status === 'overdue' && "bg-destructive",
                                bill.status === 'pending' && "bg-primary"
                              )} 
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Desktop: Show bill details with status colors */}
                    <div className="hidden sm:block space-y-1">
                      {dayBills.slice(0, 3).map((bill) => {
                        const isUserMatch = selectedUser 
                          ? (selectedUser === "Sem Usuário" ? (!bill.accountHolder || !bill.accountHolder.trim()) : bill.accountHolder === selectedUser)
                          : true;

                        return (
                          <div
                            key={bill.id}
                            className={cn(
                              "text-xs p-1 rounded truncate transition-all",
                              bill.billType === 'despesa' && "border-l-2 border-orange-400",
                              bill.status === 'paid' && "bg-success/20 text-success",
                              bill.status === 'overdue' && "bg-destructive/20 text-destructive",
                              bill.status === 'pending' && (bill.billType === 'despesa' ? "bg-orange-50 text-orange-700" : "bg-primary/10 text-primary"),
                              selectedUser && isUserMatch && "ring-2 ring-primary font-bold shadow-xs bg-primary/25",
                              selectedUser && !isUserMatch && "opacity-30"
                            )}
                          title={`${bill.description} - ${bill.supplier} - ${new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(bill.amount)}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{bill.description}</span>
                            {bill.accountHolder && (
                              <span 
                                className="text-[10px] px-1 rounded font-semibold shrink-0 border"
                                style={getUserBadgeStyle(bill.accountHolder) || {
                                  backgroundColor: "hsl(var(--primary) / 0.2)",
                                  color: "hsl(var(--primary))",
                                  borderColor: "transparent"
                                }}
                              >
                                {bill.accountHolder}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center opacity-80 text-[11px]">
                            <span>
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              }).format(bill.amount)}
                            </span>
                          </div>
                        </div>
                        );
                      })}
                      
                      {dayBills.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayBills.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Trailing blanks to complete the grid */}
        {trailingBlankDays.map((_, i) => (
          <div
            key={`blank-end-${i}`}
            className="min-h-[60px] sm:min-h-[120px] rounded-md bg-muted/30"
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Selected User Details */}
      {selectedUser && (
        <Card className="mt-4 border-primary/40 shadow-md bg-card/90 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <div>
                <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2 text-primary">
                  <User className="h-5 w-5" />
                  Despesas de {selectedUser} - {capitalizeFirst(format(currentDate, "MMMM 'de' yyyy", { locale: ptBR }))}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-bold text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    getUserBillsForMonth(selectedUser).reduce((acc, b) => acc + Number(b.amount), 0)
                  )}</span> ({getUserBillsForMonth(selectedUser).length} {getUserBillsForMonth(selectedUser).length === 1 ? 'conta' : 'contas'})
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onSelectUser?.(null)}
                className="text-xs text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar Filtro
              </Button>
            </div>
            
            {getUserBillsForMonth(selectedUser).length > 0 ? (
              renderBillList(getUserBillsForMonth(selectedUser))
            ) : (
              <p className="text-muted-foreground text-center py-4 text-sm">
                Nenhuma conta encontrada para {selectedUser} neste mês.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected Date Details */}
      {selectedDate && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h3>
            
            {getBillsForDate(selectedDate).length > 0 ? (
              renderBillList(getBillsForDate(selectedDate))
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma conta nesta data
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};