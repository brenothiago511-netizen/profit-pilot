import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useCurrency, AVAILABLE_CURRENCIES } from '@/hooks/useCurrency';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, 
  Loader2, 
  Target, 
  TrendingUp,
  Calendar,
  Store,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RevenueGoal {
  id: string;
  store_id: string;
  period_start: string;
  period_end: string;
  goal_amount_original: number;
  goal_currency: string;
  goal_amount_converted: number | null;
  exchange_rate_used: number | null;
  created_at: string;
  stores?: { name: string; currency: string };
}

interface Store {
  id: string;
  name: string;
  currency: string;
}

export default function Goals() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const { formatCurrency, getCurrencySymbol, config, getExchangeRate } = useCurrency();
  
  const [goals, setGoals] = useState<RevenueGoal[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [revenuesByStore, setRevenuesByStore] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<RevenueGoal | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    store_id: '',
    period_start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    period_end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    goal_amount_original: '',
    goal_currency: 'BRL',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stores
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name, currency')
        .eq('status', 'active')
        .order('name');
      
      setStores(storesData || []);

      // Fetch goals with store info
      const { data: goalsData } = await supabase
        .from('revenue_goals')
        .select('*, stores(name, currency)')
        .order('period_start', { ascending: false });
      
      setGoals(goalsData || []);

      // Fetch current month revenues by store
      const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const currentMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      
      const { data: revenuesData } = await supabase
        .from('revenues')
        .select('store_id, converted_amount, amount')
        .gte('date', currentMonthStart)
        .lte('date', currentMonthEnd);

      // Sum revenues by store
      const revenueMap: Record<string, number> = {};
      (revenuesData || []).forEach(rev => {
        const amount = rev.converted_amount || rev.amount;
        revenueMap[rev.store_id] = (revenueMap[rev.store_id] || 0) + amount;
      });
      setRevenuesByStore(revenueMap);

    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.store_id || !formData.goal_amount_original) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    
    const goalAmount = parseFloat(formData.goal_amount_original);
    const exchangeRate = getExchangeRate(formData.goal_currency, config.baseCurrency);
    const convertedAmount = goalAmount * exchangeRate;

    const goalData = {
      store_id: formData.store_id,
      period_start: formData.period_start,
      period_end: formData.period_end,
      goal_amount_original: goalAmount,
      goal_currency: formData.goal_currency,
      goal_amount_converted: convertedAmount,
      exchange_rate_used: exchangeRate,
    };

    try {
      if (editingGoal) {
        const { error } = await supabase
          .from('revenue_goals')
          .update(goalData)
          .eq('id', editingGoal.id);
        
        if (error) throw error;
        
        toast({ title: 'Sucesso', description: 'Meta atualizada' });
      } else {
        const { error } = await supabase
          .from('revenue_goals')
          .insert(goalData);
        
        if (error) throw error;
        
        toast({ title: 'Sucesso', description: 'Meta criada' });
      }

      setDialogOpen(false);
      setEditingGoal(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar a meta',
        variant: 'destructive',
      });
    }
    
    setSaving(false);
  };

  const handleEdit = (goal: RevenueGoal) => {
    setEditingGoal(goal);
    setFormData({
      store_id: goal.store_id,
      period_start: goal.period_start,
      period_end: goal.period_end,
      goal_amount_original: goal.goal_amount_original.toString(),
      goal_currency: goal.goal_currency,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from('revenue_goals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: 'Sucesso', description: 'Meta removida' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover a meta',
        variant: 'destructive',
      });
    }
    setDeleting(null);
  };

  const resetForm = () => {
    setFormData({
      store_id: '',
      period_start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      period_end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
      goal_amount_original: '',
      goal_currency: 'BRL',
    });
  };

  const handleStoreChange = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    setFormData(prev => ({
      ...prev,
      store_id: storeId,
      goal_currency: store?.currency || 'BRL',
    }));
  };

  // Get current month goals with progress
  const currentGoals = useMemo(() => {
    const now = new Date();
    return goals.filter(goal => {
      const start = parseISO(goal.period_start);
      const end = parseISO(goal.period_end);
      return isWithinInterval(now, { start, end });
    }).map(goal => {
      const revenue = revenuesByStore[goal.store_id] || 0;
      const target = goal.goal_amount_converted || goal.goal_amount_original;
      const percentage = target > 0 ? (revenue / target) * 100 : 0;
      return { ...goal, revenue, percentage };
    });
  }, [goals, revenuesByStore]);

  const getStatusBadge = (percentage: number) => {
    if (percentage >= 100) {
      return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Atingida</Badge>;
    } else if (percentage >= 75) {
      return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> Em progresso</Badge>;
    } else if (percentage >= 50) {
      return <Badge className="bg-orange-500"><Clock className="w-3 h-3 mr-1" /> Atenção</Badge>;
    }
    return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Crítico</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Metas de Faturamento</h1>
          <p className="text-muted-foreground">
            Defina e acompanhe metas de receita por loja
          </p>
        </div>
        <PermissionGate permission="manage_goals">
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingGoal(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  {editingGoal ? 'Editar Meta' : 'Nova Meta de Faturamento'}
                </DialogTitle>
                <DialogDescription>
                  Defina uma meta de receita para um período específico
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Loja *</Label>
                  <Select
                    value={formData.store_id}
                    onValueChange={(v) => {
                      const store = stores.find(s => s.id === v);
                      setFormData({ 
                        ...formData, 
                        store_id: v, 
                        goal_currency: store?.currency || 'BRL' 
                      });
                    }}
                    disabled={!!editingGoal}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name} ({store.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início *</Label>
                    <Input
                      type="date"
                      value={formData.period_start}
                      onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim *</Label>
                    <Input
                      type="date"
                      value={formData.period_end}
                      onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor da Meta *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={formData.goal_amount_original}
                      onChange={(e) => setFormData({ ...formData, goal_amount_original: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Select
                      value={formData.goal_currency}
                      onValueChange={(v) => setFormData({ ...formData, goal_currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">BRL (R$)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      editingGoal ? 'Atualizar' : 'Criar Meta'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {/* Current Month Goals Progress */}
      {currentGoals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {currentGoals.map(goal => (
            <Card key={goal.id} className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    {goal.stores?.name}
                  </CardTitle>
                  {getStatusBadge(goal.percentage)}
                </div>
                <CardDescription>
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {format(parseISO(goal.period_start), "dd MMM", { locale: ptBR })} - {format(parseISO(goal.period_end), "dd MMM, yyyy", { locale: ptBR })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-bold">{Math.min(goal.percentage, 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(goal.percentage, 100)} className="h-3" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Realizado</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(goal.revenue, config.baseCurrency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Meta</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(goal.goal_amount_converted || goal.goal_amount_original, config.baseCurrency)}
                    </p>
                  </div>
                </div>

                {goal.goal_currency !== config.baseCurrency && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Meta original: {formatCurrency(goal.goal_amount_original, goal.goal_currency)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {currentGoals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Nenhuma meta ativa para o período atual</p>
          </CardContent>
        </Card>
      )}

      {/* All Goals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Histórico de Metas
          </CardTitle>
          <CardDescription>
            Todas as metas cadastradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma meta cadastrada</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Meta (Original)</TableHead>
                    <TableHead className="text-right">Meta (Base)</TableHead>
                    {can('manage_goals') && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goals.map(goal => (
                    <TableRow key={goal.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-muted-foreground" />
                          {goal.stores?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(goal.period_start), "dd/MM/yyyy")} - {format(parseISO(goal.period_end), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(goal.goal_amount_original, goal.goal_currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {goal.goal_amount_converted 
                          ? formatCurrency(goal.goal_amount_converted, config.baseCurrency)
                          : '-'
                        }
                      </TableCell>
                      {can('manage_goals') && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEdit(goal)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDelete(goal.id)}
                              disabled={deleting === goal.id}
                            >
                              {deleting === goal.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
