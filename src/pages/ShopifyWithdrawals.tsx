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
import { Plus, CalendarIcon, Pencil, Trash2, ArrowDownCircle, Check, Clock, Filter, X, AlertTriangle, Building2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { parseDate } from '@/lib/dateUtils';
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

interface Store {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  account_type: string;
  currency: string;
  country: string;
  is_primary: boolean;
  status: string;
}

interface ProfileMap {
  [userId: string]: string;
}

const ShopifyWithdrawals = () => {
  const { user, profile } = useAuth();
  const { getExchangeRate, formatCurrency, getCurrencySymbol, config } = useCurrency();
  
  const [withdrawals, setWithdrawals] = useState<ShopifyWithdrawal[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [profileNames, setProfileNames] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWithdrawal, setEditingWithdrawal] = useState<ShopifyWithdrawal | null>(null);
  const [storeBankAccounts, setStoreBankAccounts] = useState<BankAccount[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [filterStore, setFilterStore] = useState<string>('all');
  const [filterDateStart, setFilterDateStart] = useState<Date | undefined>(undefined);
  const [filterDateEnd, setFilterDateEnd] = useState<Date | undefined>(undefined);
  const [form, setForm] = useState({
    store_name: '',
    amount: '',
    currency: 'USD',
    date: new Date(),
    sale_dates: [] as Date[],
    notes: '',
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchWithdrawals();
    fetchStores();
    if (isAdmin) fetchProfileNames();
  }, []);

  // Fetch bank accounts when store is selected in the form
  useEffect(() => {
    const fetchBankAccounts = async () => {
      if (!form.store_name) {
        setStoreBankAccounts([]);
        return;
      }
      const selectedStore = stores.find(s => s.name === form.store_name);
      if (!selectedStore) {
        setStoreBankAccounts([]);
        return;
      }
      const { data } = await supabase
        .from('bank_accounts')
        .select('id, bank_name, account_holder, account_number, account_type, currency, country, is_primary, status')
        .eq('store_id', selectedStore.id)
        .eq('status', 'active')
        .order('is_primary', { ascending: false });
      setStoreBankAccounts(data || []);
    };
    fetchBankAccounts();
  }, [form.store_name, stores]);

  const fetchStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');

    if (error) {
      console.error('Error fetching stores:', error);
    } else {
      setStores(data || []);
    }
  };

  const fetchProfileNames = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name');

    if (!error && data) {
      const map: ProfileMap = {};
      data.forEach((p: any) => { map[p.id] = p.name; });
      setProfileNames(map);
    }
  };

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
      sale_dates: [],
      notes: '',
    });
    setEditingWithdrawal(null);
  };

  const parseSaleDates = (saleDateStr: string | null): Date[] => {
    if (!saleDateStr) return [];
    return saleDateStr.split(',').map(d => parseDate(d.trim()));
  };

  const formatSaleDatesForDb = (dates: Date[]): string | null => {
    if (dates.length === 0) return null;
    return dates
      .sort((a, b) => a.getTime() - b.getTime())
      .map(d => format(d, 'yyyy-MM-dd'))
      .join(',');
  };

  const formatSaleDatesDisplay = (saleDateStr: string | null): string => {
    if (!saleDateStr) return '-';
    const dates = saleDateStr.split(',').map(d => {
      const date = parseDate(d.trim());
      return format(date, 'dd/MM');
    });
    return dates.join(', ');
  };

  const openEditDialog = (withdrawal: ShopifyWithdrawal) => {
    setEditingWithdrawal(withdrawal);
    setForm({
      store_name: withdrawal.store_name,
      amount: withdrawal.amount.toString(),
      currency: withdrawal.currency,
      date: parseDate(withdrawal.date),
      sale_dates: parseSaleDates(withdrawal.sale_date),
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
      sale_date: formatSaleDatesForDb(form.sale_dates),
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

  const updateStatus = async (id: string, newStatus: string) => {
    const withdrawal = withdrawals.find(w => w.id === id);
    if (!withdrawal) return;

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
      return;
    }

    // Auto-create revenue when marked as received
    if (newStatus === 'received') {
      // Find matching store by name
      const matchedStore = stores.find(s => s.name === withdrawal.store_name);

      const { error: revenueError } = await supabase
        .from('revenues')
        .insert({
          amount: withdrawal.converted_amount || withdrawal.amount,
          original_amount: withdrawal.amount,
          original_currency: withdrawal.currency,
          converted_amount: withdrawal.converted_amount,
          exchange_rate_used: withdrawal.exchange_rate_used,
          date: withdrawal.date,
          source: 'Saque Shopify',
          notes: `Saque Shopify - ${withdrawal.store_name}`,
          store_id: matchedStore?.id || null,
          user_id: user?.id || '',
        });

      if (revenueError) {
        console.error('Error creating revenue:', revenueError);
        toast.error('Status atualizado, mas erro ao criar receita automaticamente');
      } else {
        toast.success('Saque recebido e receita registrada automaticamente!');
      }

      // Auto-confirm daily records (profits) matching the sale dates and store
      if (matchedStore && withdrawal.sale_date) {
        const saleDates = withdrawal.sale_date.split(',').map(d => d.trim());
        
        if (saleDates.length > 0) {
          const { data: matchingRecords, error: fetchError } = await supabase
            .from('daily_records')
            .select('id')
            .eq('store_id', matchedStore.id)
            .in('date', saleDates)
            .eq('shopify_status', 'pending');

          if (!fetchError && matchingRecords && matchingRecords.length > 0) {
            const recordIds = matchingRecords.map(r => r.id);
            const { error: updateError } = await supabase
              .from('daily_records')
              .update({ 
                shopify_status: 'confirmed',
                updated_at: new Date().toISOString()
              })
              .in('id', recordIds);

            if (updateError) {
              console.error('Error confirming daily records:', updateError);
              toast.error('Erro ao confirmar lucros diários automaticamente');
            } else {
              toast.success(`${matchingRecords.length} registro(s) de lucro confirmado(s) automaticamente!`);
            }
          }
        }
      }

      fetchWithdrawals();
      return;
    }

    const labels: Record<string, string> = { pending: 'pendente', lost: 'perdido' };
    toast.success(`Saque marcado como ${labels[newStatus] || newStatus}!`);
    fetchWithdrawals();
  };

  // Apply filters
  const filteredWithdrawals = withdrawals.filter(w => {
    if (filterStore !== 'all' && w.store_name !== filterStore) return false;
    if (filterDateStart) {
      const wDate = parseDate(w.date);
      if (wDate < filterDateStart) return false;
    }
    if (filterDateEnd) {
      const wDate = parseDate(w.date);
      if (wDate > filterDateEnd) return false;
    }
    return true;
  });

  // Group withdrawals by user for admin view
  const withdrawalsByUser = isAdmin
    ? filteredWithdrawals.reduce((acc, w) => {
        const key = w.created_by || 'unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(w);
        return acc;
      }, {} as Record<string, ShopifyWithdrawal[]>)
    : { all: filteredWithdrawals };

  const clearFilters = () => {
    setFilterStore('all');
    setFilterDateStart(undefined);
    setFilterDateEnd(undefined);
  };

  const hasActiveFilters = filterStore !== 'all' || filterDateStart || filterDateEnd;

  const totalConverted = filteredWithdrawals.reduce((sum, w) => sum + (w.converted_amount || 0), 0);
  const pendingWithdrawals = filteredWithdrawals.filter(w => w.status === 'pending');
  const totalPending = pendingWithdrawals.reduce((sum, w) => sum + (w.converted_amount || 0), 0);
  const receivedWithdrawals = filteredWithdrawals.filter(w => w.status === 'received');
  const totalReceived = receivedWithdrawals.reduce((sum, w) => sum + (w.converted_amount || 0), 0);
  const lostWithdrawals = filteredWithdrawals.filter(w => w.status === 'lost');
  const totalLost = lostWithdrawals.reduce((sum, w) => sum + (w.converted_amount || 0), 0);

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
                  <Label htmlFor="store_name">Loja *</Label>
                  <Select
                    value={form.store_name}
                    onValueChange={(value) => setForm({ ...form, store_name: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.name}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bank account info for selected store */}
                {form.store_name && storeBankAccounts.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>Conta bancária destino</span>
                    </div>
                    {storeBankAccounts.map((bank) => (
                      <div key={bank.id} className="flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{bank.bank_name}</span>
                          <span className="text-muted-foreground text-xs">
                            {bank.account_holder} • {bank.account_type === 'checking' ? 'Corrente' : 'Poupança'} • {bank.account_number}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{bank.currency} ({bank.country})</span>
                          {bank.is_primary && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                              Principal
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {form.store_name && storeBankAccounts.length === 0 && (
                  <div className="rounded-lg border border-border bg-muted/50 p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Nenhuma conta bancária cadastrada para esta loja</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sale_dates">Datas das Vendas</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-auto min-h-10",
                            form.sale_dates.length === 0 && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {form.sale_dates.length > 0 
                              ? form.sale_dates
                                  .sort((a, b) => a.getTime() - b.getTime())
                                  .map(d => format(d, "dd/MM"))
                                  .join(', ')
                              : "Selecione"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="multiple"
                          selected={form.sale_dates}
                          onSelect={(dates) => setForm({ ...form, sale_dates: dates || [] })}
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

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Loja</Label>
                <Select value={filterStore} onValueChange={setFilterStore}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todas as lojas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.name}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[140px] justify-start text-left font-normal",
                        !filterDateStart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDateStart ? format(filterDateStart, "dd/MM/yyyy") : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filterDateStart}
                      onSelect={setFilterDateStart}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[140px] justify-start text-left font-normal",
                        !filterDateEnd && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDateEnd ? format(filterDateEnd, "dd/MM/yyyy") : "Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filterDateEnd}
                      onSelect={setFilterDateEnd}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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
                {filteredWithdrawals.length} saques {hasActiveFilters ? 'filtrados' : 'registrados'}
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Perdidos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalLost, config.baseCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                {lostWithdrawals.length} saques perdidos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tables grouped by user */}
        {loading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Carregando...</p>
            </CardContent>
          </Card>
        ) : filteredWithdrawals.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                {hasActiveFilters ? 'Nenhum saque encontrado com os filtros aplicados' : 'Nenhum saque cadastrado'}
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(withdrawalsByUser).map(([userId, userWithdrawals]) => {
            const userName = isAdmin ? (profileNames[userId] || 'Desconhecido') : '';
            const userTotal = userWithdrawals.reduce((sum, w) => sum + (w.converted_amount || 0), 0);
            const userPending = userWithdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + (w.converted_amount || 0), 0);
            const userReceived = userWithdrawals.filter(w => w.status === 'received').reduce((sum, w) => sum + (w.converted_amount || 0), 0);

            return (
              <Card key={userId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {isAdmin ? `Saques - ${userName}` : 'Histórico de Saques'}
                    </CardTitle>
                    {isAdmin && (
                      <div className="flex gap-4 text-sm">
                        <span className="text-muted-foreground">Total: <strong>{formatCurrency(userTotal, config.baseCurrency)}</strong></span>
                        <span className="text-amber-600">Pendente: <strong>{formatCurrency(userPending, config.baseCurrency)}</strong></span>
                        <span className="text-green-600">Recebido: <strong>{formatCurrency(userReceived, config.baseCurrency)}</strong></span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
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
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userWithdrawals.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "gap-1.5",
                                    w.status === 'received' && "bg-green-600 hover:bg-green-700 text-white border-green-600",
                                    w.status === 'pending' && "text-amber-600 border-amber-300 hover:bg-amber-50",
                                    w.status === 'lost' && "text-red-600 border-red-300 hover:bg-red-50"
                                  )}
                                >
                                  {w.status === 'received' && <><Check className="h-3.5 w-3.5" /> Recebido</>}
                                  {w.status === 'pending' && <><Clock className="h-3.5 w-3.5" /> Pendente</>}
                                  {w.status === 'lost' && <><AlertTriangle className="h-3.5 w-3.5" /> Perdido</>}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => updateStatus(w.id, 'pending')} className="gap-2">
                                  <Clock className="h-4 w-4 text-amber-600" /> Pendente
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(w.id, 'received')} className="gap-2">
                                  <Check className="h-4 w-4 text-green-600" /> Recebido
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(w.id, 'lost')} className="gap-2">
                                  <AlertTriangle className="h-4 w-4 text-red-600" /> Perdido
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="max-w-[120px]">
                            <span className="text-xs" title={w.sale_date || ''}>
                              {formatSaleDatesDisplay(w.sale_date)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {format(parseDate(w.date), 'dd/MM/yyyy')}
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
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
  );
};

export default ShopifyWithdrawals;
