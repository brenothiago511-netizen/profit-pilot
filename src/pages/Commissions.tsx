import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, Pencil, Trash2, Plus, DollarSign, Clock, TrendingUp, Zap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função para parsear data ISO (YYYY-MM-DD) sem conversão de timezone
const parseLocalDate = (dateString: string) => {
  // Adiciona T12:00:00 para evitar problemas de timezone ao meio-dia
  return parseISO(dateString + 'T12:00:00');
};
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CURRENCIES = [
  { code: 'BRL', symbol: 'R$', name: 'Real Brasileiro' },
  { code: 'USD', symbol: '$', name: 'Dólar Americano' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'Libra Esterlina' },
  { code: 'MXN', symbol: '$', name: 'Peso Mexicano' },
];

interface DailyRecord {
  id: string;
  user_id: string | null;
  store_id: string;
  date: string;
  daily_profit: number;
  status: string;
  shopify_status: string;
  notes: string | null;
  created_at: string;
  user_name?: string;
  store_name?: string;
  shopify_deposit_1?: number | null;
  shopify_deposit_2?: number | null;
  shopify_deposit_1_currency?: string | null;
  shopify_deposit_2_currency?: string | null;
  shopify_deposit_1_converted?: number | null;
  shopify_deposit_2_converted?: number | null;
  shopify_deposit_1_number?: string | null;
  shopify_deposit_2_number?: string | null;
}

interface StoreOption {
  id: string;
  name: string;
}

export default function Commissions() {
  const { user, isAdmin, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Dialog states
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  
  // Forms
  const getInitialRecordForm = () => ({
    id: '',
    store_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    daily_profit: '',
    notes: '',
    shopify_deposit_1: '',
    shopify_deposit_2: '',
    shopify_deposit_1_currency: 'BRL',
    shopify_deposit_2_currency: 'BRL',
    shopify_deposit_1_number: '',
    shopify_deposit_2_number: '',
  });

  const [recordForm, setRecordForm] = useState(getInitialRecordForm());
  
  // Edit/Delete states
  const [editingRecord, setEditingRecord] = useState<DailyRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<DailyRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isFinanceiro = profile?.role === 'financeiro';
  const isSocio = profile?.role === 'socio';
  const canApprove = isAdmin || isFinanceiro || isSocio;

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchDailyRecords(),
      fetchStores(),
    ]);
    setLoading(false);
  };

  const fetchDailyRecords = async () => {
    const { data, error } = await supabase
      .from('daily_records')
      .select('*, stores:store_id(name)')
      .order('date', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Error fetching daily records:', error);
      return;
    }

    if (!data || data.length === 0) {
      setDailyRecords([]);
      return;
    }

    // Fetch user names for records that have created_by
    const userIds = [...new Set(data.map(r => r.created_by).filter(Boolean))];
    let profilesMap = new Map<string, string>();
    
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      
      profilesData?.forEach(p => profilesMap.set(p.id, p.name));
    }

    const enrichedRecords: DailyRecord[] = data.map(r => ({
      id: r.id,
      user_id: r.created_by,
      store_id: r.store_id,
      date: r.date,
      daily_profit: r.daily_profit,
      status: r.status || 'pending',
      shopify_status: r.shopify_status || 'pending',
      notes: r.notes,
      created_at: r.created_at || '',
      store_name: (r.stores as any)?.name || '-',
      user_name: r.created_by ? profilesMap.get(r.created_by) || '-' : '-',
      shopify_deposit_1: (r as any).shopify_deposit_1,
      shopify_deposit_2: (r as any).shopify_deposit_2,
      shopify_deposit_1_currency: (r as any).shopify_deposit_1_currency,
      shopify_deposit_2_currency: (r as any).shopify_deposit_2_currency,
      shopify_deposit_1_converted: (r as any).shopify_deposit_1_converted,
      shopify_deposit_2_converted: (r as any).shopify_deposit_2_converted,
      shopify_deposit_1_number: (r as any).shopify_deposit_1_number,
      shopify_deposit_2_number: (r as any).shopify_deposit_2_number,
    }));

    setDailyRecords(enrichedRecords);
  };

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    if (data) setStores(data);
  };

  const getExchangeRate = async (fromCurrency: string, toCurrency: string): Promise<number> => {
    if (fromCurrency === toCurrency) return 1;
    
    const { data } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('base_currency', fromCurrency)
      .eq('target_currency', toCurrency)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data?.rate) return Number(data.rate);
    
    // Try reverse rate
    const { data: reverseData } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('base_currency', toCurrency)
      .eq('target_currency', fromCurrency)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (reverseData?.rate) return 1 / Number(reverseData.rate);
    
    return 1;
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recordForm.store_id || !recordForm.date || !recordForm.daily_profit) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSavingRecord(true);
    
    const profit = parseFloat(recordForm.daily_profit);

    const deposit1 = recordForm.shopify_deposit_1 ? parseFloat(recordForm.shopify_deposit_1) : null;
    const deposit2 = recordForm.shopify_deposit_2 ? parseFloat(recordForm.shopify_deposit_2) : null;

    // Calculate conversions for deposits
    let deposit1Converted = null;
    let deposit1Rate = 1;
    let deposit2Converted = null;
    let deposit2Rate = 1;

    if (deposit1 !== null && recordForm.shopify_deposit_1_currency !== 'BRL') {
      deposit1Rate = await getExchangeRate(recordForm.shopify_deposit_1_currency, 'BRL');
      deposit1Converted = deposit1 * deposit1Rate;
    } else if (deposit1 !== null) {
      deposit1Converted = deposit1;
    }

    if (deposit2 !== null && recordForm.shopify_deposit_2_currency !== 'BRL') {
      deposit2Rate = await getExchangeRate(recordForm.shopify_deposit_2_currency, 'BRL');
      deposit2Converted = deposit2 * deposit2Rate;
    } else if (deposit2 !== null) {
      deposit2Converted = deposit2;
    }

    // If editing existing record
    if (editingRecord) {
      const { error, count } = await supabase
        .from('daily_records')
        .update({
          store_id: recordForm.store_id,
          date: recordForm.date,
          daily_profit: profit,
          notes: recordForm.notes || null,
          shopify_deposit_1: deposit1,
          shopify_deposit_2: deposit2,
          shopify_deposit_1_currency: recordForm.shopify_deposit_1_currency,
          shopify_deposit_2_currency: recordForm.shopify_deposit_2_currency,
          shopify_deposit_1_converted: deposit1Converted,
          shopify_deposit_2_converted: deposit2Converted,
          shopify_deposit_1_rate: deposit1Rate,
          shopify_deposit_2_rate: deposit2Rate,
          shopify_deposit_1_number: recordForm.shopify_deposit_1_number || null,
          shopify_deposit_2_number: recordForm.shopify_deposit_2_number || null,
        }, { count: 'exact' })
        .eq('id', editingRecord.id);

      setSavingRecord(false);

      if (error) {
        toast({
          title: 'Erro ao atualizar',
          description: error.message,
          variant: 'destructive',
        });
      } else if (count === 0) {
        toast({
          title: 'Erro ao atualizar',
          description: 'Sem permissão para atualizar este registro. Verifique se você tem acesso à loja associada.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Lucro atualizado!',
        });
        setRecordDialogOpen(false);
        setRecordForm(getInitialRecordForm());
        setEditingRecord(null);
        fetchDailyRecords();
      }
      return;
    }

    // Buscar o manager_id do usuário atual
    let managerId: string | null = null;
    const { data: managerData } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user?.id || '')
      .maybeSingle();
    
    if (managerData) {
      managerId = managerData.id;
    } else {
      // Se não tem manager, criar um automaticamente para o usuário
      const { data: newManager, error: managerError } = await supabase
        .from('managers')
        .insert({
          user_id: user?.id,
          store_id: recordForm.store_id,
          commission_percent: 0,
          commission_type: 'lucro',
          status: 'active',
        })
        .select('id')
        .single();
      
      if (managerError || !newManager) {
        toast({
          title: 'Erro ao configurar gestor',
          description: 'Não foi possível configurar o gestor. Entre em contato com o administrador.',
          variant: 'destructive',
        });
        setSavingRecord(false);
        return;
      }
      managerId = newManager.id;
    }

    const { error } = await supabase.from('daily_records').insert({
      store_id: recordForm.store_id,
      date: recordForm.date,
      daily_profit: profit,
      notes: recordForm.notes || null,
      created_by: user?.id,
      manager_id: managerId,
      status: 'pending',
      shopify_status: 'pending',
      shopify_deposit_1: deposit1,
      shopify_deposit_2: deposit2,
      shopify_deposit_1_currency: recordForm.shopify_deposit_1_currency,
      shopify_deposit_2_currency: recordForm.shopify_deposit_2_currency,
      shopify_deposit_1_converted: deposit1Converted,
      shopify_deposit_2_converted: deposit2Converted,
      shopify_deposit_1_rate: deposit1Rate,
      shopify_deposit_2_rate: deposit2Rate,
      shopify_deposit_1_number: recordForm.shopify_deposit_1_number || null,
      shopify_deposit_2_number: recordForm.shopify_deposit_2_number || null,
    });

    setSavingRecord(false);

    if (error) {
      toast({
        title: 'Erro ao registrar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Lucro registrado! Aguardando confirmação de recebimento Shopify.',
      });
      setRecordDialogOpen(false);
      setRecordForm(getInitialRecordForm());
      setEditingRecord(null);
      fetchDailyRecords();
    }
  };

  const openEditRecord = (record: DailyRecord) => {
    setEditingRecord(record);
    setRecordForm({
      id: record.id,
      store_id: record.store_id,
      date: record.date,
      daily_profit: record.daily_profit.toString(),
      notes: record.notes || '',
      shopify_deposit_1: record.shopify_deposit_1?.toString() || '',
      shopify_deposit_2: record.shopify_deposit_2?.toString() || '',
      shopify_deposit_1_currency: record.shopify_deposit_1_currency || 'BRL',
      shopify_deposit_2_currency: record.shopify_deposit_2_currency || 'BRL',
      shopify_deposit_1_number: (record as any).shopify_deposit_1_number || '',
      shopify_deposit_2_number: (record as any).shopify_deposit_2_number || '',
    });
    setRecordDialogOpen(true);
  };

  const toggleShopifyPaid = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'received' ? 'pending' : 'received';
    const { error } = await supabase
      .from('daily_records')
      .update({ shopify_status: newStatus })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: newStatus === 'received' ? 'Recebimento Shopify confirmado!' : 'Recebimento Shopify desmarcado' });
      fetchDailyRecords();
    }
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;
    setDeleting(true);
    
    const { error } = await supabase
      .from('daily_records')
      .delete()
      .eq('id', deletingRecord.id);

    setDeleting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lucro excluído' });
      setDeleteDialogOpen(false);
      setDeletingRecord(null);
      fetchDailyRecords();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Filtered records based on status
  const filteredRecords = useMemo(() => {
    let records = dailyRecords;
    if (filterStatus === 'received') records = records.filter(r => r.shopify_status === 'received');
    if (filterStatus === 'pending') records = records.filter(r => r.shopify_status === 'pending');
    return records;
  }, [dailyRecords, filterStatus]);

  // Group by user for admin view
  const recordsByUser = useMemo(() => {
    if (!isAdmin) return { all: filteredRecords };
    return filteredRecords.reduce((acc, r) => {
      const key = r.user_id || 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    }, {} as Record<string, DailyRecord[]>);
  }, [filteredRecords, isAdmin]);

  // Stats
  const stats = useMemo(() => {
    const received = dailyRecords.filter(r => r.shopify_status === 'received');
    const pending = dailyRecords.filter(r => r.shopify_status === 'pending');
    const totalReceived = received.reduce((sum, r) => sum + r.daily_profit, 0);
    const totalPending = pending.reduce((sum, r) => sum + r.daily_profit, 0);
    
    return { 
      totalReceived,
      totalPending,
      receivedCount: received.length,
      pendingCount: pending.length,
    };
  }, [dailyRecords]);

  // Chart data
  const chartData = useMemo(() => {
    const last30Days = dailyRecords
      .filter(r => r.shopify_status === 'received')
      .slice(0, 30)
      .reverse();
    
    return last30Days.map(r => ({
      date: format(parseLocalDate(r.date), 'dd/MM'),
      lucro: r.daily_profit,
    }));
  }, [dailyRecords]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Lucros</h1>
          <p className="page-description">
            Registre e confirme os lucros diários por loja
          </p>
        </div>

        <PermissionGate permission="register_profits">
          <Dialog open={recordDialogOpen} onOpenChange={(open) => {
            setRecordDialogOpen(open);
            if (!open) {
              setEditingRecord(null);
              setRecordForm(getInitialRecordForm());
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Registrar Lucro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingRecord ? 'Editar Lucro' : 'Registrar Lucro do Dia'}</DialogTitle>
                <DialogDescription>
                  Após registrar, confirme quando o valor for recebido na Shopify.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRecordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Loja *</Label>
                  <Select
                    value={recordForm.store_id}
                    onValueChange={(v) => setRecordForm({ ...recordForm, store_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={recordForm.date}
                    onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lucro/Prejuízo do Dia (R$) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={recordForm.daily_profit}
                      onChange={(e) => setRecordForm({ ...recordForm, daily_profit: e.target.value })}
                      placeholder="0,00"
                      className="pl-10"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">Use valor negativo para prejuízo</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Shopify 1 (opcional)</Label>
                  <Input
                    type="text"
                    value={recordForm.shopify_deposit_1_number}
                    onChange={(e) => setRecordForm({ ...recordForm, shopify_deposit_1_number: e.target.value })}
                    placeholder="Número da Shopify (ex: #12345)"
                  />
                  <div className="flex gap-2">
                    <Select
                      value={recordForm.shopify_deposit_1_currency}
                      onValueChange={(v) => setRecordForm({ ...recordForm, shopify_deposit_1_currency: v })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                        {CURRENCIES.find(c => c.code === recordForm.shopify_deposit_1_currency)?.symbol || '$'}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={recordForm.shopify_deposit_1}
                        onChange={(e) => setRecordForm({ ...recordForm, shopify_deposit_1: e.target.value })}
                        placeholder="0,00"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Shopify 2 (opcional)</Label>
                  <Input
                    type="text"
                    value={recordForm.shopify_deposit_2_number}
                    onChange={(e) => setRecordForm({ ...recordForm, shopify_deposit_2_number: e.target.value })}
                    placeholder="Número da Shopify (ex: #12345)"
                  />
                  <div className="flex gap-2">
                    <Select
                      value={recordForm.shopify_deposit_2_currency}
                      onValueChange={(v) => setRecordForm({ ...recordForm, shopify_deposit_2_currency: v })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                        {CURRENCIES.find(c => c.code === recordForm.shopify_deposit_2_currency)?.symbol || '$'}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={recordForm.shopify_deposit_2}
                        onChange={(e) => setRecordForm({ ...recordForm, shopify_deposit_2: e.target.value })}
                        placeholder="0,00"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                    placeholder="Observações opcionais..."
                    rows={2}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={savingRecord}>
                  {savingRecord ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingRecord ? 'Salvar Alterações' : 'Registrar'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lucro Recebido (Shopify)</CardDescription>
            <CardTitle className="text-2xl text-success">{formatCurrency(stats.totalReceived)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aguardando Shopify</CardDescription>
            <CardTitle className="text-2xl text-amber-500">{formatCurrency(stats.totalPending)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registros Confirmados</CardDescription>
            <CardTitle className="text-2xl">{stats.receivedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registros Pendentes</CardDescription>
            <CardTitle className="text-2xl text-amber-500">{stats.pendingCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 items-center">
          <Label>Status:</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="received">Recebido (Shopify)</SelectItem>
              <SelectItem value="pending">Aguardando Shopify</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Records Tables grouped by user */}
      {filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              Nenhum registro encontrado
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(recordsByUser).map(([userId, userRecords]) => {
          const userName = isAdmin ? (userRecords[0]?.user_name || 'Desconhecido') : '';
          const userReceived = userRecords.filter(r => r.shopify_status === 'received').reduce((sum, r) => sum + r.daily_profit, 0);
          const userPending = userRecords.filter(r => r.shopify_status === 'pending').reduce((sum, r) => sum + r.daily_profit, 0);

          return (
            <Card key={userId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-success" />
                      {isAdmin ? `Lucros - ${userName}` : 'Registros de Lucro'}
                    </CardTitle>
                    <CardDescription>
                      Clique em "Confirmar Shopify" quando o valor for recebido
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-4 text-sm">
                      <span className="text-muted-foreground">Recebido: <strong className="text-success">{formatCurrency(userReceived)}</strong></span>
                      <span className="text-muted-foreground">Pendente: <strong className="text-amber-500">{formatCurrency(userPending)}</strong></span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        {!isAdmin && <th>Sócio</th>}
                        <th>Loja</th>
                        <th className="text-right">Lucro</th>
                        <th>Status Shopify</th>
                        {canApprove && <th>Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {userRecords.map((record) => (
                        <tr key={record.id}>
                          <td>{format(parseLocalDate(record.date), 'dd/MM/yyyy', { locale: ptBR })}</td>
                          {!isAdmin && <td>{record.user_name}</td>}
                          <td>{record.store_name}</td>
                          <td className="text-right font-medium">{formatCurrency(record.daily_profit)}</td>
                          <td>
                            {record.shopify_status === 'received' ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                <Check className="w-3 h-3 mr-1" />Recebido
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                                <Clock className="w-3 h-3 mr-1" />Aguardando
                              </Badge>
                            )}
                          </td>
                          {canApprove && (
                            <td>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditRecord(record)}
                                  title="Editar registro"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                {record.shopify_status === 'received' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-amber-500"
                                    onClick={() => toggleShopifyPaid(record.id, record.shopify_status)}
                                    title="Desmarcar recebimento Shopify"
                                  >
                                    Desmarcar
                                  </Button>
                                ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => toggleShopifyPaid(record.id, record.shopify_status)}
                                    title="Confirmar que o valor foi recebido na Shopify"
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Confirmar Recebido
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                                  onClick={() => {
                                    setDeletingRecord(record);
                                    setDeleteDialogOpen(true);
                                  }}
                                  title="Excluir lucro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lucros Recebidos (Últimos 30 registros)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro de lucro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRecord}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
