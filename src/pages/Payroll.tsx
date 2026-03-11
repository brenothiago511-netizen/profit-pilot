import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, DollarSign, Users, Calendar, Receipt } from 'lucide-react';
import PayrollPaymentsDialog from '@/components/payroll/PayrollPaymentsDialog';

interface PayrollEntry {
  id: string;
  employee_name: string;
  payment_day: number;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
}

export default function Payroll() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollEntry | null>(null);

  const [formData, setFormData] = useState({
    employee_name: '',
    payment_day: 5,
    amount: 0,
    description: '',
    status: 'active',
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll')
      .select('*')
      .order('payment_day', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao carregar folha de pagamento', description: error.message, variant: 'destructive' });
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  const openNewDialog = () => {
    setEditingEntry(null);
    setFormData({
      employee_name: '',
      payment_day: 5,
      amount: 0,
      description: '',
      status: 'active',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (entry: PayrollEntry) => {
    setEditingEntry(entry);
    setFormData({
      employee_name: entry.employee_name,
      payment_day: entry.payment_day,
      amount: entry.amount,
      description: entry.description || '',
      status: entry.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.employee_name.trim()) {
      toast({ title: 'Erro', description: 'Nome do funcionário é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);

    if (editingEntry) {
      const { error } = await supabase
        .from('payroll')
        .update({
          employee_name: formData.employee_name,
          payment_day: formData.payment_day,
          amount: formData.amount,
          description: formData.description || null,
          status: formData.status,
        })
        .eq('id', editingEntry.id);

      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Registro atualizado' });
        setDialogOpen(false);
        fetchEntries();
      }
    } else {
      const { error } = await supabase.from('payroll').insert({
        employee_name: formData.employee_name,
        payment_day: formData.payment_day,
        amount: formData.amount,
        description: formData.description || null,
        status: formData.status,
        created_by: user?.id,
      });

      if (error) {
        toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Funcionário cadastrado na folha' });
        setDialogOpen(false);
        fetchEntries();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('payroll').delete().eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Registro excluído' });
      fetchEntries();
    }
  };

  const totalPayroll = entries
    .filter((e) => e.status === 'active')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const activeEmployees = entries.filter((e) => e.status === 'active').length;

  const getOrdinal = (day: number) => {
    return `Dia ${day}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Folha de Pagamento</h1>
          <p className="text-muted-foreground">Gerencie os pagamentos dos funcionários</p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Funcionário
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total da Folha</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalPayroll)}
            </div>
            <p className="text-xs text-muted-foreground">Soma de todos os salários ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEmployees}</div>
            <p className="text-xs text-muted-foreground">Funcionários na folha</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Salarial</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeEmployees > 0 ? formatCurrency(totalPayroll / activeEmployees) : formatCurrency(0)}
            </div>
            <p className="text-xs text-muted-foreground">Média por funcionário</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Dia de Pagamento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum funcionário cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.employee_name}</TableCell>
                    <TableCell>{getOrdinal(entry.payment_day)}</TableCell>
                    <TableCell>{formatCurrency(entry.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'active' ? 'default' : 'secondary'}>
                        {entry.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(entry)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? 'Editar Funcionário' : 'Adicionar Funcionário'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employee_name">Nome do Funcionário</Label>
              <Input
                id="employee_name"
                value={formData.employee_name}
                onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_day">Dia de Pagamento</Label>
              <Select
                value={String(formData.payment_day)}
                onValueChange={(value) => setFormData({ ...formData, payment_day: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o dia" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      Dia {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Cargo, observações..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Salvando...' : editingEntry ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
