import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarIcon, Clock, Edit, Trash2, Check, Eye, Paperclip } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  onMonthChange
}) => {
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
          {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
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
                      {dayBills.slice(0, 3).map((bill) => (
                        <div
                          key={bill.id}
                          className={cn(
                            "text-xs p-1 rounded truncate",
                            bill.status === 'paid' && "bg-success/20 text-success",
                            bill.status === 'overdue' && "bg-destructive/20 text-destructive",
                            bill.status === 'pending' && "bg-primary/10 text-primary"
                          )}
                          title={`${bill.description} - ${bill.supplier} - ${new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(bill.amount)}`}
                        >
                          <div className="flex items-center gap-1">
                            <Clock className="h-2 w-2" />
                            <span className="truncate">{bill.description}</span>
                          </div>
                          <div className="truncate opacity-80">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(bill.amount)}
                          </div>
                        </div>
                      ))}
                      
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

      {/* Selected Date Details */}
      {selectedDate && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h3>
            
            {getBillsForDate(selectedDate).length > 0 ? (
                  <div className="space-y-3">
                {getBillsForDate(selectedDate).map((bill) => (
                  <div 
                    key={bill.id} 
                    className="p-3 bg-secondary/50 rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{bill.description}</p>
                        <p className="text-sm text-muted-foreground">{bill.supplier}</p>
                        {bill.paymentType === 'cheque' && (
                          <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                            {bill.checkNumber && <p>Nº Cheque: {bill.checkNumber}</p>}
                            {bill.bankName && <p>Banco: {bill.bankName}</p>}
                            {bill.accountHolder && <p>Titular: {bill.accountHolder}</p>}
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
                          onClick={() => onViewAttachment(bill.attachmentUrl!)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Anexo
                        </Button>
                      )}
                      
                      {bill.status !== 'paid' && (
                        <>
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
                                    Tem certeza que deseja excluir a conta "{bill.description}"? Esta ação não pode ser desfeita.
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
                          
                          {onMarkAsPaid && onUploadPaymentProof && (
                            <Dialog 
                              open={paymentProofDialog.open && paymentProofDialog.billId === bill.id}
                              onOpenChange={(open) => setPaymentProofDialog({ open, billId: open ? bill.id : null })}
                            >
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                >
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
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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