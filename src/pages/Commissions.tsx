import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Percent, Loader2, Calculator, Check, Pencil, Trash2, BarChart3, List, Plus, DollarSign, Clock, TrendingUp, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
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
import { CommissionTrendChart } from '@/components/commissions/CommissionTrendChart';

interface Commission {
  id: string;
  manager_id: string;
  store_id: string;
  period_start: string;
  period_end: string;
  base_amount: number;
  percent: number;
  commission_amount: number;
  status: string;
  paid_at: string | null;
  manager_name?: string;
  manager_commission_type?: string;
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
  commission_percent: number;
  commission_type: string;
  profile_name?: string;
}

interface Profit {
  id: string;
  store_id: string;
  manager_id: string;
  period_start: string;
  period_end: string;
  profit_amount: number;
  notes: string | null;
  status: string;
  created_at: string;
  store_name?: string;
  manager_name?: string;
}

export default function Commissions() {
  const { user, isAdmin, isGestor, profile } = useAuth();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [profits, setProfits] = useState<Profit[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profitDialogOpen, setProfitDialogOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [savingProfit, setSavingProfit] = useState(false);
  const [availableProfits, setAvailableProfits] = useState<{ total: number; count: number } | null>(null);
  const [loadingProfits, setLoadingProfits] = useState(false);
  const [calcForm, setCalcForm] = useState({
    store_id: '',
    manager_id: '',
    month: format(subMonths(new Date(), 1), 'yyyy-MM'),
  });
  
  // Profit registration form
  const [profitForm, setProfitForm] = useState({
    store_id: '',
    manager_id: '',
    period_start: '',
    period_end: '',
    profit_amount: '',
    notes: '',
  });

  const isFinanceiro = profile?.role === 'financeiro';
  const canApprove = isAdmin || isFinanceiro;

  // Check available profits when form changes
  const checkAvailableProfits = async () => {
    if (!calcForm.store_id || !calcForm.manager_id || !calcForm.month) {
      setAvailableProfits(null);
      return;
    }

    setLoadingProfits(true);
    const monthDate = new Date(calcForm.month + '-01');
    const periodStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const periodEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('profits')
      .select('profit_amount')
      .eq('manager_id', calcForm.manager_id)
      .eq('store_id', calcForm.store_id)
      .eq('status', 'approved')
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd);

    if (data && data.length > 0) {
      const total = data.reduce((sum, p) => sum + Number(p.profit_amount), 0);
      setAvailableProfits({ total, count: data.length });
    } else {
      setAvailableProfits({ total: 0, count: 0 });
    }
    setLoadingProfits(false);
  };

  useEffect(() => {
    checkAvailableProfits();
  }, [calcForm.store_id, calcForm.manager_id, calcForm.month]);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
  const [editForm, setEditForm] = useState({
    base_amount: '',
    percent: '',
    commission_amount: '',
    status: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCommission, setDeletingCommission] = useState<Commission | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCommissions();
    fetchProfits();
    fetchStores();
    fetchManagers();
  }, []);

  const fetchCommissions = async () => {
    setLoading(true);
    
    // Fetch commissions with stores
    const { data: commissionsData, error } = await supabase
      .from('commissions')
      .select('*, stores(name)')
      .order('period_start', { ascending: false });
    
    if (error) {
      console.error('Error fetching commissions:', error);
      setLoading(false);
      return;
    }

    if (!commissionsData || commissionsData.length === 0) {
      setCommissions([]);
      setLoading(false);
      return;
    }

    // Get unique manager_ids
    const managerIds = [...new Set(commissionsData.map(c => c.manager_id))];
    
    // Fetch managers for these commissions
    const { data: managersData } = await supabase
      .from('managers')
      .select('id, user_id, commission_type')
      .in('id', managerIds);

    // Get user_ids from managers
    const userIds = managersData?.map(m => m.user_id) || [];
    
    // Fetch profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    // Create lookup maps
    const managersMap = new Map(managersData?.map(m => [m.id, m]) || []);
    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    // Combine data
    const enrichedCommissions: Commission[] = commissionsData.map(c => {
      const manager = managersMap.get(c.manager_id);
      const profile = manager ? profilesMap.get(manager.user_id) : null;
      
      return {
        id: c.id,
        manager_id: c.manager_id,
        store_id: c.store_id,
        period_start: c.period_start,
        period_end: c.period_end,
        base_amount: c.base_amount,
        percent: c.percent,
        commission_amount: c.commission_amount,
        status: c.status,
        paid_at: c.paid_at,
        manager_name: profile?.name || '-',
        manager_commission_type: manager?.commission_type || 'lucro',
        store_name: c.stores?.name || '-',
      };
    });

    setCommissions(enrichedCommissions);
    setLoading(false);
  };

  const fetchProfits = async () => {
    const { data: profitsData, error } = await supabase
      .from('profits')
      .select('*, stores:store_id(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching profits:', error);
      return;
    }

    if (!profitsData || profitsData.length === 0) {
      setProfits([]);
      return;
    }

    // Fetch manager names
    const managerIds = [...new Set(profitsData.map(p => p.manager_id))];
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

    const enrichedProfits: Profit[] = profitsData.map(p => ({
      id: p.id,
      store_id: p.store_id,
      manager_id: p.manager_id,
      period_start: p.period_start,
      period_end: p.period_end,
      profit_amount: p.profit_amount,
      notes: p.notes,
      status: p.status,
      created_at: p.created_at,
      store_name: p.stores?.name || '-',
      manager_name: managerProfileMap.get(p.manager_id) || '-',
    }));

    setProfits(enrichedProfits);
  };

  const handleProfitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profitForm.store_id || !profitForm.manager_id || !profitForm.period_start || !profitForm.period_end || !profitForm.profit_amount) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSavingProfit(true);
    
    const { error } = await supabase.from('profits').insert({
      store_id: profitForm.store_id,
      manager_id: profitForm.manager_id,
      period_start: profitForm.period_start,
      period_end: profitForm.period_end,
      profit_amount: parseFloat(profitForm.profit_amount),
      notes: profitForm.notes || null,
      created_by: user?.id,
      status: canApprove ? 'approved' : 'pending',
      approved_by: canApprove ? user?.id : null,
      approved_at: canApprove ? new Date().toISOString() : null,
    });

    setSavingProfit(false);

    if (error) {
      toast({
        title: 'Erro ao registrar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Lucro registrado com sucesso',
      });
      setProfitDialogOpen(false);
      setProfitForm({ store_id: '', manager_id: '', period_start: '', period_end: '', profit_amount: '', notes: '' });
      fetchProfits();
      checkAvailableProfits();
    }
  };

  const approveProfit = async (id: string, approved: boolean) => {
    const { error } = await supabase
      .from('profits')
      .update({
        status: approved ? 'approved' : 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: approved ? 'Lucro aprovado!' : 'Lucro rejeitado' });
      fetchProfits();
    }
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
      .select('id, user_id, store_id, commission_percent, commission_type')
      .eq('status', 'active');
    
    if (!managersData) {
      setManagers([]);
      return;
    }

    // Fetch profiles for managers
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
      commission_percent: m.commission_percent,
      commission_type: m.commission_type,
      profile_name: profilesMap.get(m.user_id)?.name || 'N/A',
    }));

    setManagers(enrichedManagers);
  };

  const calculateCommission = async () => {
    if (!calcForm.store_id || !calcForm.manager_id || !calcForm.month) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }

    const selectedManager = managers.find(m => m.id === calcForm.manager_id);
    if (!selectedManager) return;

    const monthDate = new Date(calcForm.month + '-01');
    const periodStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const periodEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    setCalculating(true);

    try {
      // Check if commission already exists
      const { data: existing } = await supabase
        .from('commissions')
        .select('id')
        .eq('manager_id', calcForm.manager_id)
        .eq('store_id', calcForm.store_id)
        .eq('period_start', periodStart)
        .maybeSingle();

      if (existing) {
        toast({
          title: 'Aviso',
          description: 'Já existe comissão calculada para este período',
          variant: 'destructive',
        });
        setCalculating(false);
        return;
      }

      // Fetch approved profits for this manager, store, and period
      const { data: approvedProfits } = await supabase
        .from('profits')
        .select('profit_amount')
        .eq('manager_id', calcForm.manager_id)
        .eq('store_id', calcForm.store_id)
        .eq('status', 'approved')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd);

      if (!approvedProfits || approvedProfits.length === 0) {
        toast({
          title: 'Aviso',
          description: 'Não há lucros aprovados para este período. O gestor precisa registrar os lucros primeiro.',
          variant: 'destructive',
        });
        setCalculating(false);
        return;
      }

      // Sum all approved profits for the period
      const baseAmount = approvedProfits.reduce((sum, p) => sum + Number(p.profit_amount), 0);
      const commissionAmount = (baseAmount * selectedManager.commission_percent) / 100;

      // Insert commission
      const { error } = await supabase.from('commissions').insert({
        manager_id: calcForm.manager_id,
        store_id: calcForm.store_id,
        period_start: periodStart,
        period_end: periodEnd,
        base_amount: baseAmount,
        percent: selectedManager.commission_percent,
        commission_amount: Math.max(0, commissionAmount),
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Comissão calculada: ${formatCurrency(commissionAmount)} (${selectedManager.commission_percent}% de ${formatCurrency(baseAmount)})`,
      });

      setDialogOpen(false);
      fetchCommissions();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }

    setCalculating(false);
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('commissions')
      .update({ status: 'paga', paid_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Atualizado',
        description: 'Comissão marcada como paga',
      });
      fetchCommissions();
    }
  };

  const openEditDialog = (commission: Commission) => {
    setEditingCommission(commission);
    setEditForm({
      base_amount: commission.base_amount.toString(),
      percent: commission.percent.toString(),
      commission_amount: commission.commission_amount.toString(),
      status: commission.status,
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingCommission) return;

    setSaving(true);
    const { error } = await supabase
      .from('commissions')
      .update({
        base_amount: parseFloat(editForm.base_amount) || 0,
        percent: parseFloat(editForm.percent) || 0,
        commission_amount: parseFloat(editForm.commission_amount) || 0,
        status: editForm.status,
        paid_at: editForm.status === 'paga' ? new Date().toISOString() : null,
      })
      .eq('id', editingCommission.id);

    setSaving(false);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Comissão atualizada com sucesso',
      });
      setEditDialogOpen(false);
      setEditingCommission(null);
      fetchCommissions();
    }
  };

  const openDeleteDialog = (commission: Commission) => {
    setDeletingCommission(commission);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingCommission) return;

    setDeleting(true);
    const { error } = await supabase
      .from('commissions')
      .delete()
      .eq('id', deletingCommission.id);

    setDeleting(false);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Comissão excluída com sucesso',
      });
      setDeleteDialogOpen(false);
      setDeletingCommission(null);
      fetchCommissions();
    }
  };

  // Recalculate commission when percent or base changes
  const handleEditFormChange = (field: string, value: string) => {
    const newForm = { ...editForm, [field]: value };
    
    if (field === 'base_amount' || field === 'percent') {
      const base = parseFloat(field === 'base_amount' ? value : newForm.base_amount) || 0;
      const percent = parseFloat(field === 'percent' ? value : newForm.percent) || 0;
      newForm.commission_amount = ((base * percent) / 100).toFixed(2);
    }
    
    setEditForm(newForm);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Comissões</h1>
          <p className="page-description">
            {isGestor ? 'Visualize suas comissões' : 'Gerencie as comissões dos gestores'}
          </p>
        </div>

        <PermissionGate permission="manage_commissions">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Calculator className="w-4 h-4 mr-2" />
                Calcular Comissão
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Calcular Comissão</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Loja</Label>
                  <Select
                    value={calcForm.store_id}
                    onValueChange={(v) => setCalcForm({ ...calcForm, store_id: v })}
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
                  <Label>Gestor</Label>
                  <Select
                    value={calcForm.manager_id}
                    onValueChange={(v) => setCalcForm({ ...calcForm, manager_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gestor" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.profile_name} ({manager.commission_percent}% - {manager.commission_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Mês de Referência</Label>
                  <input
                    type="month"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={calcForm.month}
                    onChange={(e) => setCalcForm({ ...calcForm, month: e.target.value })}
                  />
                </div>

                {/* Available profits indicator */}
                {calcForm.store_id && calcForm.manager_id && calcForm.month && (
                  <div className={`p-3 rounded-lg border ${availableProfits && availableProfits.count > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    {loadingProfits ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verificando lucros aprovados...
                      </div>
                    ) : availableProfits && availableProfits.count > 0 ? (
                      <div className="text-sm">
                        <p className="font-medium text-emerald-400">
                          ✓ {availableProfits.count} lucro(s) aprovado(s) encontrado(s)
                        </p>
                        <p className="text-muted-foreground">
                          Total: {formatCurrency(availableProfits.total)}
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-amber-400">
                        ⚠ Nenhum lucro aprovado para este período. O gestor precisa registrar e ter os lucros aprovados primeiro.
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={calculateCommission} 
                    disabled={calculating || !availableProfits || availableProfits.count === 0}
                  >
                    {calculating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Calculando...
                      </>
                    ) : (
                      'Calcular'
                    )}
                  </Button>
                </div>
              </div>
          </DialogContent>
        </Dialog>
      </PermissionGate>
      </div>

      <Tabs defaultValue="lucros" className="space-y-6">
        <TabsList>
          <TabsTrigger value="lucros" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Lucros
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="flex items-center gap-2">
            <Percent className="w-4 h-4" />
            Comissões
          </TabsTrigger>
          <TabsTrigger value="charts" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Gráficos
          </TabsTrigger>
        </TabsList>

        {/* Lucros Tab */}
        <TabsContent value="lucros">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Registro de Lucros
              </CardTitle>
              <PermissionGate permission="register_profits">
                <Dialog open={profitDialogOpen} onOpenChange={setProfitDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Registrar Lucro
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Lucro</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleProfitSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Loja *</Label>
                        <Select
                          value={profitForm.store_id}
                          onValueChange={(v) => setProfitForm({ ...profitForm, store_id: v, manager_id: '' })}
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
                          value={profitForm.manager_id}
                          onValueChange={(v) => setProfitForm({ ...profitForm, manager_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o gestor" />
                          </SelectTrigger>
                          <SelectContent>
                            {managers
                              .filter((m) => !profitForm.store_id || !m.store_id || m.store_id === profitForm.store_id)
                              .map((manager) => (
                                <SelectItem key={manager.id} value={manager.id}>
                                  {manager.profile_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Período Início *</Label>
                          <Input
                            type="date"
                            value={profitForm.period_start}
                            onChange={(e) => setProfitForm({ ...profitForm, period_start: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Período Fim *</Label>
                          <Input
                            type="date"
                            value={profitForm.period_end}
                            onChange={(e) => setProfitForm({ ...profitForm, period_end: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Valor do Lucro (R$) *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={profitForm.profit_amount}
                            onChange={(e) => setProfitForm({ ...profitForm, profit_amount: e.target.value })}
                            placeholder="0,00"
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={profitForm.notes}
                          onChange={(e) => setProfitForm({ ...profitForm, notes: e.target.value })}
                          placeholder="Observações opcionais..."
                          rows={3}
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={savingProfit}>
                        {savingProfit ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Registrar Lucro'
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </PermissionGate>
            </CardHeader>
            <CardContent>
              {profits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum lucro registrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Período</th>
                        <th>Gestor</th>
                        <th>Loja</th>
                        <th className="text-right">Valor (R$)</th>
                        <th>Status</th>
                        {canApprove && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {profits.map((profit) => (
                        <tr key={profit.id}>
                          <td>
                            {format(new Date(profit.period_start), 'dd/MM', { locale: ptBR })} - {format(new Date(profit.period_end), 'dd/MM/yy', { locale: ptBR })}
                          </td>
                          <td>{profit.manager_name}</td>
                          <td>{profit.store_name}</td>
                          <td className="text-right font-medium">{formatCurrency(profit.profit_amount)}</td>
                          <td>
                            {profit.status === 'approved' ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                <Check className="w-3 h-3 mr-1" />Aprovado
                              </Badge>
                            ) : profit.status === 'rejected' ? (
                              <Badge variant="destructive">
                                <X className="w-3 h-3 mr-1" />Rejeitado
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="w-3 h-3 mr-1" />Pendente
                              </Badge>
                            )}
                          </td>
                          {canApprove && (
                            <td>
                              {profit.status === 'pending' && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-success hover:text-success"
                                    onClick={() => approveProfit(profit.id, true)}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => approveProfit(profit.id, false)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
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

        {/* Comissões Tab */}
        <TabsContent value="comissoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-info" />
                Comissões Calculadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : commissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma comissão calculada
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Período</th>
                        <th>Gestor</th>
                        <th>Loja</th>
                        <th>Tipo</th>
                        <th className="text-right">Base</th>
                        <th className="text-center">%</th>
                        <th className="text-right">Valor</th>
                        <th>Status</th>
                        {hasPermission('manage_commissions') && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((commission) => (
                        <tr key={commission.id}>
                          <td>
                            {format(new Date(commission.period_start), 'MMM yyyy', { locale: ptBR })}
                          </td>
                          <td>{commission.manager_name}</td>
                          <td>{commission.store_name}</td>
                          <td className="capitalize">
                            {commission.manager_commission_type === 'lucro' ? 'Lucro' : 'Faturamento'}
                          </td>
                          <td className="text-right">{formatCurrency(commission.base_amount)}</td>
                          <td className="text-center">{commission.percent}%</td>
                          <td className="text-right font-medium text-info">
                            {formatCurrency(commission.commission_amount)}
                          </td>
                          <td>
                            <Badge variant={commission.status === 'paga' ? 'default' : 'secondary'}>
                              {commission.status === 'paga' ? 'Paga' : 'Pendente'}
                            </Badge>
                          </td>
                          {hasPermission('manage_commissions') && (
                            <td>
                              <div className="flex items-center gap-1">
                                {commission.status === 'pendente' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-success hover:text-success"
                                    onClick={() => markAsPaid(commission.id)}
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Pagar
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(commission)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => openDeleteDialog(commission)}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <CommissionTrendChart commissions={commissions} />
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Comissão</DialogTitle>
          </DialogHeader>
          {editingCommission && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p><strong>Gestor:</strong> {editingCommission.manager_name}</p>
                <p><strong>Loja:</strong> {editingCommission.store_name}</p>
                <p><strong>Período:</strong> {format(new Date(editingCommission.period_start), 'MMM yyyy', { locale: ptBR })}</p>
              </div>

              <div className="space-y-2">
                <Label>Base de Cálculo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.base_amount}
                  onChange={(e) => handleEditFormChange('base_amount', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Percentual (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.percent}
                  onChange={(e) => handleEditFormChange('percent', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Valor da Comissão (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.commission_amount}
                  onChange={(e) => setEditForm({ ...editForm, commission_amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleEditSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Comissão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta comissão de{' '}
              <strong>{deletingCommission?.manager_name}</strong> referente a{' '}
              <strong>
                {deletingCommission && format(new Date(deletingCommission.period_start), 'MMM yyyy', { locale: ptBR })}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
