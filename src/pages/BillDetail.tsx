import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, Upload, Trash2, FileText, Image } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { translateErrorMessage } from "@/lib/errorMessages";

interface Bill {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  entry_date: string;
  status: string;
  payment_type: string;
  check_number?: string;
  account_number?: string;
  account_name?: string;
  attachment_url?: string;
  payment_proof_url?: string;
  suppliers?: { name: string };
}

interface InstallmentAttachment {
  id: string;
  installment_number: number;
  attachment_url: string;
  file_name?: string;
  file_type?: string;
}

const BillDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [bill, setBill] = useState<Bill | null>(null);
  const [installmentAttachments, setInstallmentAttachments] = useState<InstallmentAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchBillDetails();
      fetchInstallmentAttachments();
    }
  }, [id]);

  const fetchBillDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          suppliers (name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setBill(data);
    } catch (error) {
      console.error('Erro ao buscar detalhes da conta:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstallmentAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('bill_installment_attachments')
        .select('*')
        .eq('bill_id', id)
        .order('installment_number');

      if (error) throw error;
      setInstallmentAttachments(data || []);
    } catch (error) {
      console.error('Erro ao buscar anexos das parcelas:', error);
    }
  };

  const handleFileUpload = async (installmentNumber: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await uploadAttachment(file, installmentNumber);
      }
    };
    input.click();
  };

  const uploadAttachment = async (file: File, installmentNumber: number) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('bill-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save attachment record
      const { error: dbError } = await supabase
        .from('bill_installment_attachments')
        .insert({
          bill_id: id,
          installment_number: installmentNumber,
          attachment_url: filePath,
          file_name: file.name,
          file_type: file.type,
        });

      if (dbError) throw dbError;

      toast({
        title: "Sucesso",
        description: "Anexo enviado com sucesso!",
      });

      fetchInstallmentAttachments();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleViewAttachment = async (attachmentUrl: string) => {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated');

      // Make direct fetch request to edge function with authentication
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

      if (!response.ok) {
        throw new Error('Failed to load attachment');
      }

      // Get blob from response
      const blob = await response.blob();
      
      // Create blob URL with correct content type
      const blobUrl = URL.createObjectURL(blob);
      
      // Open in new tab
      window.open(blobUrl, '_blank');
      
      // Clean up URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      console.error('Erro ao visualizar anexo:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar anexo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, attachmentUrl: string) => {
    if (!confirm('Tem certeza que deseja excluir este anexo?')) return;

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('bill_installment_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) throw dbError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('bill-attachments')
        .remove([attachmentUrl]);

      if (storageError) throw storageError;

      toast({
        title: "Sucesso",
        description: "Anexo excluído com sucesso!",
      });

      fetchInstallmentAttachments();
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
    }
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'overdue': return 'Vencida';
      case 'paid': return 'Paga';
      default: return 'Desconhecido';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Carregando...</div>;
  }

  if (!bill) {
    return <div className="flex justify-center items-center min-h-screen">Conta não encontrada</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-xl font-semibold">Detalhes da Conta</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-6">
          {/* Bill Details */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>{bill.description}</CardTitle>
                <Badge className={getStatusColor(bill.status)}>
                  {getStatusText(bill.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="font-semibold text-lg">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(bill.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fornecedor</p>
                  <p className="font-medium">{bill.suppliers?.name || 'Sem fornecedor'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Vencimento</p>
                  <p className="font-medium">
                    {format(new Date(bill.due_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Lançamento</p>
                  <p className="font-medium">
                    {format(new Date(bill.entry_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Pagamento</p>
                  <p className="font-medium capitalize">{bill.payment_type}</p>
                </div>
                {bill.check_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Número do Cheque</p>
                    <p className="font-medium">{bill.check_number}</p>
                  </div>
                )}
              </div>

              {/* Original Attachment */}
              {bill.status === 'paid' && bill.payment_proof_url && (
                <Button 
                  variant="outline" 
                  onClick={() => handleViewAttachment(bill.payment_proof_url!)}
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Ver Comprovante de Pagamento
                </Button>
              )}
              
              {bill.attachment_url && (
                <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
                  <h3 className="font-medium mb-2">Anexo Original</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewAttachment(bill.attachment_url!)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Anexo
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Installment Attachments */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Anexos por Parcela</CardTitle>
              <p className="text-sm text-muted-foreground">
                Adicione anexos específicos para cada parcela. Suportados: PDF e JPEG.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Generate installment slots based on payment type */}
                {Array.from({ length: bill.payment_type === 'boleto' ? 12 : 6 }, (_, index) => {
                  const installmentNumber = index + 1;
                  const attachment = installmentAttachments.find(
                    a => a.installment_number === installmentNumber
                  );

                  return (
                    <div key={installmentNumber} className="p-4 border rounded-lg bg-background/50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Parcela {installmentNumber}</h4>
                        <div className="flex items-center gap-2">
                          {attachment ? (
                            <>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {attachment.file_type?.includes('pdf') ? (
                                  <FileText className="w-4 h-4" />
                                ) : (
                                  <Image className="w-4 h-4" />
                                )}
                                {attachment.file_name}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewAttachment(attachment.attachment_url)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteAttachment(attachment.id, attachment.attachment_url)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFileUpload(installmentNumber)}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              Adicionar Anexo
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BillDetail;