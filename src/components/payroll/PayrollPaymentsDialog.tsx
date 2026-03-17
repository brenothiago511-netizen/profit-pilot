import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Upload, ExternalLink, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PayrollPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollId: string;
  employeeName: string;
  expectedAmount: number;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
}

export default function PayrollPaymentsDialog({
  open,
  onOpenChange,
  payrollId,
  employeeName,
  expectedAmount,
}: PayrollPaymentsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    amount: expectedAmount,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      fetchPayments();
      setFormData(f => ({ ...f, amount: expectedAmount }));
    }
  }, [open, payrollId]);

  const fetchPayments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll_payments')
      .select('*')
      .eq('payroll_id', payrollId)
      .order('date', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar pagamentos', description: error.message, variant: 'destructive' });
    } else {
      setPayments(data || []);
    }
    setLoading(false);
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${user?.id}/${payrollId}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('payroll-receipts')
      .upload(filePath, file);

    if (error) {
      toast({ title: 'Erro ao enviar comprovante', description: error.message, variant: 'destructive' });
      return null;
    }

    const { data } = supabase.storage.from('payroll-receipts').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!formData.amount || formData.amount <= 0) {
      toast({ title: 'Erro', description: 'Valor deve ser maior que zero', variant: 'destructive' });
      return;
    }

    setSaving(true);

    let receiptUrl: string | null = null;
    if (receiptFile) {
      receiptUrl = await uploadReceipt(receiptFile);
    }

    const { error } = await supabase.from('payroll_payments').insert({
      payroll_id: payrollId,
      amount: formData.amount,
      date: formData.date,
      notes: formData.notes || null,
      receipt_url: receiptUrl,
      created_by: user?.id,
    });

    if (error) {
      toast({ title: 'Erro ao registrar pagamento', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Pagamento registrado' });
      setShowForm(false);
      setReceiptFile(null);
      setFormData({ amount: expectedAmount, date: new Date().toISOString().split('T')[0], notes: '' });
      fetchPayments();
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('payroll_payments').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Pagamento removido' });
      fetchPayments();
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Pagamentos - {employeeName}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="flex gap-4 text-sm">
          <div className="flex-1 p-3 rounded-lg bg-muted">
            <p className="text-muted-foreground">Salário</p>
            <p className="font-bold text-foreground">{formatCurrency(expectedAmount, 'BRL')}</p>
          </div>
          <div className="flex-1 p-3 rounded-lg bg-muted">
            <p className="text-muted-foreground">Total Pago</p>
            <p className="font-bold text-primary">{formatCurrency(totalPaid, 'BRL')}</p>
          </div>
          <div className="flex-1 p-3 rounded-lg bg-muted">
            <p className="text-muted-foreground">Pagamentos</p>
            <p className="font-bold text-foreground">{payments.length}</p>
          </div>
        </div>

        {/* New Payment Form */}
        {showForm ? (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observação (opcional)</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ex: Pagamento referente a março"
              />
            </div>
            <div className="space-y-1">
              <Label>Comprovante (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {receiptFile && (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    <Upload className="w-3 h-3 mr-1" />
                    {receiptFile.name.slice(0, 20)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setReceiptFile(null); }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Salvando...' : 'Registrar Pagamento'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setShowForm(true)} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Registrar Pagamento
          </Button>
        )}

        {/* Payments List */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead>Comprovante</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">Carregando...</TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  Nenhum pagamento registrado
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{format(new Date(payment.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{payment.notes || '-'}</TableCell>
                  <TableCell>
                    {payment.receipt_url ? (
                      <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Ver
                        </Badge>
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(payment.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
