import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, CalendarIcon, Pencil, Trash2, ArrowDownCircle, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency, AVAILABLE_CURRENCIES } from '@/hooks/useCurrency';
import { toast } from 'sonner';

interface ShopifyWithdrawal {
  id: string;
  store_name: string;
  amount: number;
  currency: string;
  converted_amount: number | null;
  exchange_rate_used: number | null;
  date: string;
  sale_date: string | null;
  notes: string | null;
  status: string;
  received_at: string | null;
  created_by: string | null;
  created_at: string;
}

const ShopifyWithdrawals = () => {
  const { user, profile } = useAuth();
  const { getExchangeRate, formatCurrency, getCurrencySymbol, config } = useCurrency();
  
  const [withdrawals, setWithdrawals] = useState<ShopifyWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWithdrawal, setEditingWithdrawal] = useState<ShopifyWithdrawal | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    store_name: '',
    amount: '',
    currency: 'USD',
    date: new Date(),
    sale_date: null as Date | null,
    notes: '',
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shopify_withdrawals')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Erro ao carregar saques');
    } else {
      setWithdrawals(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      store_name: '',
      amount: '',
      currency: 'USD',
      date: new Date(),
      sale_date: null,
      notes: '',
    });
    setEditingWithdrawal(null);
  };

  const openEditDialog = (withdrawal: ShopifyWithdrawal) => {
    setEditingWithdrawal(withdrawal);
    setForm({
      store_name: withdrawal.store_name,
      amount: withdrawal.amount.toString(),
      currency: withdrawal.currency,
      date: new Date(withdrawal.date),
      sale_date: withdrawal.sale_date ? new Date(withdrawal.sale_date) : null,
      notes: withdrawal.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.store_name || !form.amount) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    const amount = parseFloat(form.amount);
    
    // Convert to base currency (USD)
    let convertedAmount = amount;
    let exchangeRate = 1;
    
    if (form.currency !== config.baseCurrency) {
      exchangeRate = await getExchangeRate(form.currency, config.baseCurrency);
      convertedAmount = amount * exchangeRate;
    }

    const payload = {
      store_name: form.store_name,
      amount,
      currency: form.currency,
      converted_amount: convertedAmount,
      exchange_rate_used: exchangeRate,
      date: format(form.date, 'yyyy-MM-dd'),
      sale_date: form.sale_date ? format(form.sale_date, 'yyyy-MM-dd') : null,
      notes: form.notes || null,
      created_by: user?.id,
    };

    let error;
    if (editingWithdrawal) {
      const { error: updateError } = await supabase
        .from('shopify_withdrawals')
        .update(payload)
        .eq('id', editingWithdrawal.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('shopify_withdrawals')
        .insert(payload);
      error = insertError;
    }

    setSaving(false);

    if (error) {
      console.error('Error saving withdrawal:', error);
      toast.error('Erro ao salvar saque');
    } else {
      toast.success(editingWithdrawal ? 'Saque atualizado!' : 'Saque cadastrado!');
      setDialogOpen(false);
      resetForm();
      fetchWithdrawals();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este saque?')) return;

    const { error } = await supabase
      .from('shopify_withdrawals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting withdrawal:', error);
      toast.error('Erro ao excluir saque');
    } else {
      toast.success('Saque excluído!');
      fetchWithdrawals();
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'received' ? 'pending' : 'received';
    const receivedAt = newStatus === 'received' ? new Date().toISOString() : null;

    const { error } = await supabase
      .from('shopify_withdrawals')
      .update({ 
        status: newStatus,
        received_at: receivedAt
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    } else {
      toast.success(newStatus === 'received' ? 'Saque marcado como recebido!' : 'Saque marcado como pendente');
      fetchWithdrawals();
    }
  };

  const totalConverted = withdrawals.reduce((sum, w) => sum + (w.converted_amount || 0), 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const totalPending = pendingWithdrawals.reduce((sum, w) => sum + (w.converted_amount || 0), 0);
  const receivedWithdrawals = withdrawals.filter(w => w.status === 'received');
  const totalReceived = receivedWithdrawals.reduce((sum, w) => sum + (w.converted_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Saques Shopify</h1>
          <p className="text-muted-foreground">Gerencie os saques das lojas Shopify</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Saque
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingWithdrawal ? 'Editar Saque' : 'Cadastrar Saque'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="store_name">Nome da Loja *</Label>
                  <Input
                    id="store_name"
                    placeholder="Ex: Loja Exemplo"
                    value={form.store_name}
                    onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sale_date">Data da Venda</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !form.sale_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.sale_date ? format(form.sale_date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.sale_date || undefined}
                          onSelect={(date) => setForm({ ...form, sale_date: date || null })}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Data Recebimento *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !form.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.date ? format(form.date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.date}
                          onSelect={(date) => date && setForm({ ...form, date })}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Select
                      value={form.currency}
                      onValueChange={(value) => setForm({ ...form, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_CURRENCIES.map((curr) => (
                          <SelectItem key={curr} value={curr}>
                            {curr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="amount">Valor *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {getCurrencySymbol(form.currency)}
                      </span>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-10"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    placeholder="Observações opcionais"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : (editingWithdrawal ? 'Atualizar' : 'Cadastrar')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Saques</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalConverted, config.baseCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {withdrawals.length} saques registrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(totalPending, config.baseCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {pendingWithdrawals.length} saques aguardando
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recebidos</CardTitle>
              <Check className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalReceived, config.baseCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {receivedWithdrawals.length} saques recebidos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Saques</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : withdrawals.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum saque cadastrado
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Venda</TableHead>
                    <TableHead>Data Receb.</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                    <TableHead className="text-right">Valor Convertido</TableHead>
                    <TableHead>Observações</TableHead>
                    {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Button
                          variant={w.status === 'received' ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            "gap-1.5",
                            w.status === 'received' 
                              ? "bg-green-600 hover:bg-green-700 text-white" 
                              : "text-amber-600 border-amber-300 hover:bg-amber-50"
                          )}
                          onClick={() => toggleStatus(w.id, w.status)}
                        >
                          {w.status === 'received' ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Recebido
                            </>
                          ) : (
                            <>
                              <Clock className="h-3.5 w-3.5" />
                              Pendente
                            </>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {w.sale_date ? format(new Date(w.sale_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(w.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{w.store_name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(w.amount, w.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {w.converted_amount 
                          ? formatCurrency(w.converted_amount, config.baseCurrency)
                          : '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {w.notes || '-'}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(w)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(w.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
  );
};

export default ShopifyWithdrawals;
