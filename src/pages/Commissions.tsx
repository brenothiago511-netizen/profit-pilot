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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Percent, Loader2, Check, Pencil, Trash2, BarChart3, Plus, DollarSign, Clock, TrendingUp, X, Settings, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface CommissionTier {
  id: string;
  min_profit: number;
  max_profit: number | null;
  commission_percentage: number;
  active: boolean;
}

interface DailyRecord {
  id: string;
  manager_id: string;
  store_id: string;
  date: string;
  daily_profit: number;
  commission_amount: number;
  status: string;
  shopify_status: string;
  notes: string | null;
  created_at: string;
  manager_name?: string;
  store_name?: string;
}

interface StoreOption {
  id: string;
  name: string;
}

interface ManagerOption {
  id: string;
  user_id: string;
  store_id: string | null;
  profile_name?: string;
}

export default function Commissions() {
  const { user, isAdmin, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [commissionTiers, setCommissionTiers] = useState<CommissionTier[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  
  // Dialog states
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [savingTier, setSavingTier] = useState(false);
  
  // Forms
  const [recordForm, setRecordForm] = useState({
    store_id: '',
    manager_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    daily_profit: '',
    notes: '',
  });
  
  const [tierForm, setTierForm] = useState({
    min_profit: '',
    max_profit: '',
    commission_percentage: '',
  });
  
  // Edit/Delete states
  const [editingTier, setEditingTier] = useState<CommissionTier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<DailyRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isFinanceiro = profile?.role === 'financeiro';
  const canApprove = isAdmin || isFinanceiro;
  const canManageTiers = isAdmin;

  // Calculate estimated commission based on tiers
  const estimatedCommission = useMemo(() => {
    const profit = parseFloat(recordForm.daily_profit) || 0;
    if (profit <= 0 || commissionTiers.length === 0) return 0;
    
    const tier = commissionTiers
      .filter(t => t.active)
      .find(t => profit >= t.min_profit && (t.max_profit === null || profit <= t.max_profit));
    
    if (!tier) return 0;
    return profit * tier.commission_percentage;
  }, [recordForm.daily_profit, commissionTiers]);

  // Find matching tier for display
  const matchingTier = useMemo(() => {
    const profit = parseFloat(recordForm.daily_profit) || 0;
    if (profit <= 0) return null;
    
    return commissionTiers
      .filter(t => t.active)
      .find(t => profit >= t.min_profit && (t.max_profit === null || profit <= t.max_profit));
  }, [recordForm.daily_profit, commissionTiers]);

  useEffect(() => {
    fetchAll();
  }, []);


  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchDailyRecords(),
      fetchCommissionTiers(),
      fetchStores(),
      fetchManagers(),
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

    // Fetch manager names
    const managerIds = [...new Set(data.map(r => r.manager_id))];
    const { data: managersData } = await supabase
      .from('managers')
      .select('id, user_id')
      .in('id', managerIds);
    
    const userIds = managersData?.map(m => m.user_id) || [];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);
    
    const managerProfileMap = new Map<string, string>();
    managersData?.forEach(m => {
      const profile = profilesData?.find(p => p.id === m.user_id);
      if (profile) managerProfileMap.set(m.id, profile.name);
    });

    const enrichedRecords: DailyRecord[] = data.map(r => ({
      id: r.id,
      manager_id: r.manager_id,
      store_id: r.store_id,
      date: r.date,
      daily_profit: r.daily_profit,
      commission_amount: r.commission_amount || 0,
      status: r.status || 'pending',
      shopify_status: r.shopify_status || 'pending',
      notes: r.notes,
      created_at: r.created_at,
      store_name: (r.stores as any)?.name || '-',
      manager_name: managerProfileMap.get(r.manager_id) || '-',
    }));

    setDailyRecords(enrichedRecords);
  };

  const fetchCommissionTiers = async () => {
    const { data, error } = await supabase
      .from('commission_tiers')
      .select('*')
      .order('min_profit', { ascending: true });
    
    if (error) {
      console.error('Error fetching commission tiers:', error);
      return;
    }

    setCommissionTiers(data || []);
  };

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    if (data) setStores(data);
  };

  const fetchManagers = async () => {
    const { data: managersData } = await supabase
      .from('managers')
      .select('id, user_id, store_id')
      .eq('status', 'active');
    
    if (!managersData) {
      setManagers([]);
      return;
    }

    const userIds = managersData.map(m => m.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    const enrichedManagers: ManagerOption[] = managersData.map(m => ({
      id: m.id,
      user_id: m.user_id,
      store_id: m.store_id,
      profile_name: profilesMap.get(m.user_id)?.name || 'N/A',
    }));

    setManagers(enrichedManagers);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recordForm.store_id || !recordForm.manager_id || !recordForm.date || !recordForm.daily_profit) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSavingRecord(true);
    
    // Commission is calculated automatically by the database trigger
    const { error } = await supabase.from('daily_records').insert({
      store_id: recordForm.store_id,
      manager_id: recordForm.manager_id,
      date: recordForm.date,
      daily_profit: parseFloat(recordForm.daily_profit),
      notes: recordForm.notes || null,
      created_by: user?.id,
      status: canApprove ? 'approved' : 'pending',
      approved_by: canApprove ? user?.id : null,
      approved_at: canApprove ? new Date().toISOString() : null,
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
        description: `Registro salvo! Comissão calculada: ${formatCurrency(estimatedCommission)}`,
      });
      setRecordDialogOpen(false);
      setRecordForm({ store_id: '', manager_id: '', date: format(new Date(), 'yyyy-MM-dd'), daily_profit: '', notes: '' });
      fetchDailyRecords();
    }
  };

  const handleTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tierForm.min_profit || !tierForm.commission_percentage) {
      toast({
        title: 'Erro',
        description: 'Preencha os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSavingTier(true);
    
    const tierData = {
      min_profit: parseFloat(tierForm.min_profit),
      max_profit: tierForm.max_profit ? parseFloat(tierForm.max_profit) : null,
      commission_percentage: parseFloat(tierForm.commission_percentage) / 100, // Convert % to decimal
      active: true,
    };

    let error;
    if (editingTier) {
      const result = await supabase
        .from('commission_tiers')
        .update(tierData)
        .eq('id', editingTier.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('commission_tiers')
        .insert(tierData);
      error = result.error;
    }

    setSavingTier(false);

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: editingTier ? 'Faixa atualizada!' : 'Nova faixa criada!',
      });
      setTierDialogOpen(false);
      setEditingTier(null);
      setTierForm({ min_profit: '', max_profit: '', commission_percentage: '' });
      fetchCommissionTiers();
    }
  };

  const openEditTier = (tier: CommissionTier) => {
    setEditingTier(tier);
    setTierForm({
      min_profit: tier.min_profit.toString(),
      max_profit: tier.max_profit?.toString() || '',
      commission_percentage: (tier.commission_percentage * 100).toString(),
    });
    setTierDialogOpen(true);
  };

  const deleteTier = async (tierId: string) => {
    const { error } = await supabase
      .from('commission_tiers')
      .delete()
      .eq('id', tierId);
    
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Faixa excluída' });
      fetchCommissionTiers();
    }
  };

  const approveRecord = async (id: string, approved: boolean) => {
    const { error } = await supabase
      .from('daily_records')
      .update({
        status: approved ? 'approved' : 'pending',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: approved ? 'Registro aprovado!' : 'Status atualizado' });
      fetchDailyRecords();
    }
  };

  const toggleManagerPaid = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'approved' : 'paid';
    const { error } = await supabase
      .from('daily_records')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: newStatus === 'paid' ? 'Pagamento ao gestor confirmado' : 'Pagamento ao gestor desmarcado' });
      fetchDailyRecords();
    }
  };

  const toggleShopifyPaid = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    const { error } = await supabase
      .from('daily_records')
      .update({ shopify_status: newStatus })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: newStatus === 'paid' ? 'Recebimento Shopify confirmado' : 'Recebimento Shopify desmarcado' });
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
      toast({ title: 'Registro excluído' });
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

  // Stats
  const stats = useMemo(() => {
    const approved = dailyRecords.filter(r => r.status === 'approved' || r.status === 'paid');
    const totalProfit = approved.reduce((sum, r) => sum + r.daily_profit, 0);
    const totalCommission = approved.reduce((sum, r) => sum + r.commission_amount, 0);
    const pending = dailyRecords.filter(r => r.status === 'pending').length;
    const paid = dailyRecords.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.commission_amount, 0);
    
    return { totalProfit, totalCommission, pending, paid };
  }, [dailyRecords]);

  // Chart data
  const chartData = useMemo(() => {
    const last30Days = dailyRecords
      .filter(r => r.status === 'approved' || r.status === 'paid')
      .slice(0, 30)
      .reverse();
    
    return last30Days.map(r => ({
      date: format(new Date(r.date), 'dd/MM'),
      lucro: r.daily_profit,
      comissao: r.commission_amount,
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
          <h1 className="page-title">Comissões</h1>
          <p className="page-description">
            Gerencie lucros e comissões
          </p>
        </div>

        <PermissionGate permission="register_profits">
          <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Registrar Lucro do Dia
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Lucro Diário</DialogTitle>
                <DialogDescription>
                  A comissão será calculada automaticamente com base nas faixas configuradas.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRecordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Loja *</Label>
                  <Select
                    value={recordForm.store_id}
                    onValueChange={(v) => setRecordForm({ ...recordForm, store_id: v, manager_id: '' })}
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
                  <Label>Gestor *</Label>
                  <Select
                    value={recordForm.manager_id}
                    onValueChange={(v) => setRecordForm({ ...recordForm, manager_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gestor" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers
                        .filter((m) => !recordForm.store_id || !m.store_id || m.store_id === recordForm.store_id)
                        .map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.profile_name}
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
                  <Label>Lucro do Dia (R$) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={recordForm.daily_profit}
                      onChange={(e) => setRecordForm({ ...recordForm, daily_profit: e.target.value })}
                      placeholder="0,00"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Estimated commission preview */}
                {recordForm.daily_profit && parseFloat(recordForm.daily_profit) > 0 && (
                  <div className={`p-4 rounded-lg border ${matchingTier ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    {matchingTier ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-emerald-400" />
                          <span className="font-medium text-emerald-400">Comissão Estimada</span>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{formatCurrency(estimatedCommission)}</p>
                        <p className="text-sm text-muted-foreground">
                          Faixa: {matchingTier.commission_percentage * 100}% ({formatCurrency(matchingTier.min_profit)} - {matchingTier.max_profit ? formatCurrency(matchingTier.max_profit) : '∞'})
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-400">
                        ⚠ Nenhuma faixa de comissão encontrada para este valor
                      </p>
                    )}
                  </div>
                )}

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
                    'Registrar'
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
            <CardDescription>Lucro Total</CardDescription>
            <CardTitle className="text-2xl text-success">{formatCurrency(stats.totalProfit)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Comissão Total</CardDescription>
            <CardTitle className="text-2xl text-primary">{formatCurrency(stats.totalCommission)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Comissões Pagas</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(stats.paid)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendentes</CardDescription>
            <CardTitle className="text-2xl text-amber-500">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="registros" className="space-y-6">
        <TabsList>
          <TabsTrigger value="registros" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Registros Diários
          </TabsTrigger>
          <TabsTrigger value="charts" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Gráficos
          </TabsTrigger>
          {canManageTiers && (
            <TabsTrigger value="faixas" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Faixas de Comissão
            </TabsTrigger>
          )}
        </TabsList>

        {/* Daily Records Tab */}
        <TabsContent value="registros">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Registros de Lucro Diário
              </CardTitle>
              <CardDescription>
                Cada registro tem sua comissão calculada automaticamente com base nas faixas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dailyRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Gestor</th>
                        <th>Loja</th>
                        <th className="text-right">Lucro</th>
                        <th className="text-right">Comissão</th>
                        <th>Pago Gestor</th>
                        <th>Shopify Pagou</th>
                        {canApprove && <th>Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {dailyRecords.map((record) => (
                        <tr key={record.id}>
                          <td>{format(new Date(record.date), 'dd/MM/yyyy', { locale: ptBR })}</td>
                          <td>{record.manager_name}</td>
                          <td>{record.store_name}</td>
                          <td className="text-right font-medium">{formatCurrency(record.daily_profit)}</td>
                          <td className="text-right font-medium text-primary">{formatCurrency(record.commission_amount)}</td>
                          <td>
                            {record.status === 'paid' ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                <Check className="w-3 h-3 mr-1" />Pago
                              </Badge>
                            ) : record.status === 'approved' ? (
                              <Badge variant="secondary">
                                <Clock className="w-3 h-3 mr-1" />Aprovado
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <Clock className="w-3 h-3 mr-1" />Pendente
                              </Badge>
                            )}
                          </td>
                          <td>
                            {record.shopify_status === 'paid' ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                <Check className="w-3 h-3 mr-1" />Recebido
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <Clock className="w-3 h-3 mr-1" />Pendente
                              </Badge>
                            )}
                          </td>
                          {canApprove && (
                            <td>
                              <div className="flex items-center gap-1 flex-wrap">
                                {record.status === 'pending' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-success hover:text-success"
                                    onClick={() => approveRecord(record.id, true)}
                                    title="Aprovar lucro"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                )}
                                {record.status !== 'pending' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={record.status === 'paid' 
                                      ? "text-emerald-500 border-emerald-500/50 hover:bg-emerald-500/10" 
                                      : "text-primary border-primary/50 hover:bg-primary/10"
                                    }
                                    onClick={() => toggleManagerPaid(record.id, record.status)}
                                    title={record.status === 'paid' ? "Desmarcar pagamento ao gestor" : "Confirmar pagamento ao gestor"}
                                  >
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    {record.status === 'paid' ? 'Pago ✓' : 'Pagar Gestor'}
                                  </Button>
                                )}
                                {record.status !== 'pending' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={record.shopify_status === 'paid'
                                      ? "text-emerald-500 border-emerald-500/50 hover:bg-emerald-500/10"
                                      : "text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
                                    }
                                    onClick={() => toggleShopifyPaid(record.id, record.shopify_status)}
                                    title={record.shopify_status === 'paid' ? "Desmarcar recebimento Shopify" : "Confirmar recebimento Shopify"}
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    {record.shopify_status === 'paid' ? 'Recebido ✓' : 'Shopify Pagou'}
                                  </Button>
                                )}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setDeletingRecord(record);
                                      setDeleteDialogOpen(true);
                                    }}
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts">
          <Card>
            <CardHeader>
              <CardTitle>Lucro vs Comissão por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Sem dados para exibir
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
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
                    <Bar dataKey="comissao" name="Comissão" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission Tiers Tab (Admin only) */}
        {canManageTiers && (
          <TabsContent value="faixas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="w-5 h-5" />
                    Faixas de Comissão
                  </CardTitle>
                  <CardDescription>
                    Configure as faixas de lucro e seus percentuais de comissão
                  </CardDescription>
                </div>
                <Dialog open={tierDialogOpen} onOpenChange={(open) => {
                  setTierDialogOpen(open);
                  if (!open) {
                    setEditingTier(null);
                    setTierForm({ min_profit: '', max_profit: '', commission_percentage: '' });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Faixa
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingTier ? 'Editar Faixa' : 'Nova Faixa de Comissão'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleTierSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Lucro Mínimo (R$) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tierForm.min_profit}
                            onChange={(e) => setTierForm({ ...tierForm, min_profit: e.target.value })}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Lucro Máximo (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tierForm.max_profit}
                            onChange={(e) => setTierForm({ ...tierForm, max_profit: e.target.value })}
                            placeholder="Sem limite"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Percentual de Comissão (%) *</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={tierForm.commission_percentage}
                            onChange={(e) => setTierForm({ ...tierForm, commission_percentage: e.target.value })}
                            placeholder="20"
                            className="pr-8"
                            required
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={savingTier}>
                        {savingTier ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingTier ? 'Atualizar' : 'Criar Faixa')}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {commissionTiers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma faixa configurada. Adicione faixas para calcular comissões automaticamente.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Lucro Mínimo</th>
                          <th>Lucro Máximo</th>
                          <th>Comissão</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissionTiers.map((tier) => (
                          <tr key={tier.id}>
                            <td>{formatCurrency(tier.min_profit)}</td>
                            <td>{tier.max_profit ? formatCurrency(tier.max_profit) : '∞ (Sem limite)'}</td>
                            <td className="font-medium text-primary">{(tier.commission_percentage * 100).toFixed(1)}%</td>
                            <td>
                              {tier.active ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400">Ativa</Badge>
                              ) : (
                                <Badge variant="secondary">Inativa</Badge>
                              )}
                            </td>
                            <td>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditTier(tier)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => deleteTier(tier.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
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
