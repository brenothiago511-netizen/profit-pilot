import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Store, Loader2, Building2, CreditCard, Pencil, Target } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BankAccountsDialog from '@/components/stores/BankAccountsDialog';

interface StoreData {
  id: string;
  name: string;
  country: string;
  currency: string;
  status: string;
  created_at: string;
}

interface GoalData {
  id: string;
  store_id: string;
  goal_amount_original: number;
  goal_currency: string;
  period_start: string;
  period_end: string;
}

interface RevenueTotal {
  store_id: string;
  total: number;
}

export default function Stores() {
  const { can } = usePermissions();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [revenues, setRevenues] = useState<RevenueTotal[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    country: 'Brasil',
    currency: 'BRL',
  });
  const [goalFormData, setGoalFormData] = useState({
    goal_amount: '',
  });

  const currentMonth = new Date();
  const periodStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const periodEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [storesRes, goalsRes, revenuesRes] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('revenue_goals')
        .select('*')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd),
      supabase.from('revenues')
        .select('store_id, amount')
        .gte('date', periodStart)
        .lte('date', periodEnd),
    ]);

    if (storesRes.data) setStores(storesRes.data);
    if (goalsRes.data) setGoals(goalsRes.data);
    
    // Calculate totals per store
    if (revenuesRes.data) {
      const totals: Record<string, number> = {};
      revenuesRes.data.forEach((r) => {
        totals[r.store_id] = (totals[r.store_id] || 0) + Number(r.amount);
      });
      setRevenues(Object.entries(totals).map(([store_id, total]) => ({ store_id, total })));
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: 'Erro', description: 'Nome da loja é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);

    if (editingStore) {
      const { error } = await supabase
        .from('stores')
        .update({
          name: formData.name,
          country: formData.country,
          currency: formData.currency,
        })
        .eq('id', editingStore.id);

      setSaving(false);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Loja atualizada' });
        closeDialog();
        fetchData();
      }
    } else {
      const { error } = await supabase.from('stores').insert({
        name: formData.name,
        country: formData.country,
        currency: formData.currency,
      });

      setSaving(false);
      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Loja cadastrada' });
        closeDialog();
        fetchData();
      }
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingStore(null);
    setFormData({ name: '', country: 'Brasil', currency: 'BRL' });
  };

  const openEditDialog = (store: StoreData) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      country: store.country,
      currency: store.currency,
    });
    setDialogOpen(true);
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('stores').update({ status: newStatus }).eq('id', id);
    
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atualizado', description: `Loja ${newStatus === 'active' ? 'ativada' : 'desativada'}` });
      fetchData();
    }
  };

  const openBankDialog = (store: StoreData) => {
    setSelectedStore(store);
    setBankDialogOpen(true);
  };

  const openGoalDialog = (store: StoreData) => {
    setSelectedStore(store);
    const existingGoal = goals.find(g => g.store_id === store.id);
    setGoalFormData({ goal_amount: existingGoal ? String(existingGoal.goal_amount_original) : '' });
    setGoalDialogOpen(true);
  };

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !goalFormData.goal_amount) {
      toast({ title: 'Erro', description: 'Informe o valor da meta', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const existingGoal = goals.find(g => g.store_id === selectedStore.id);

    if (existingGoal) {
      const { error } = await supabase
        .from('revenue_goals')
        .update({ goal_amount_original: parseFloat(goalFormData.goal_amount) })
        .eq('id', existingGoal.id);

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Meta atualizada' });
        setGoalDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from('revenue_goals').insert({
        store_id: selectedStore.id,
        goal_amount_original: parseFloat(goalFormData.goal_amount),
        goal_currency: selectedStore.currency,
        period_start: periodStart,
        period_end: periodEnd,
      });

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Meta cadastrada' });
        setGoalDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const getStoreGoal = (storeId: string) => goals.find(g => g.store_id === storeId);
  const getStoreRevenue = (storeId: string) => revenues.find(r => r.store_id === storeId)?.total || 0;

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Lojas</h1>
          <p className="page-description">
            Gerencie as unidades • {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Loja
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingStore ? 'Editar Loja' : 'Cadastrar Loja'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Loja *</Label>
                <Input
                  placeholder="Ex: Loja Centro"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>País</Label>
                  <Input
                    placeholder="Brasil"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(v) => setFormData({ ...formData, currency: v })}
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
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editingStore ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : stores.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Store className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma loja cadastrada</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          stores.map((store) => {
            const goal = getStoreGoal(store.id);
            const revenue = getStoreRevenue(store.id);
            const progress = goal ? Math.min((revenue / goal.goal_amount_original) * 100, 100) : 0;

            return (
              <Card key={store.id} className="hover:shadow-card-hover transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{store.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {store.country} • {store.currency}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(store)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                      {store.status === 'active' ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Goal Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        Meta do mês
                      </span>
                      {goal ? (
                        <span className="font-medium">{progress.toFixed(0)}%</span>
                      ) : (
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => openGoalDialog(store)}>
                          Definir meta
                        </Button>
                      )}
                    </div>
                    {goal && (
                      <>
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatCurrency(revenue, store.currency)}</span>
                          <span>{formatCurrency(goal.goal_amount_original, store.currency)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(store.created_at), 'dd/MM/yyyy')}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openGoalDialog(store)}>
                        <Target className="w-4 h-4 mr-1" />
                        Meta
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openBankDialog(store)}>
                        <CreditCard className="w-4 h-4 mr-1" />
                        Banco
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(store.id, store.status)}>
                        {store.status === 'active' ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {selectedStore && (
        <>
          <BankAccountsDialog
            open={bankDialogOpen}
            onOpenChange={setBankDialogOpen}
            storeId={selectedStore.id}
            storeName={selectedStore.name}
          />

          <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Meta de Faturamento - {selectedStore.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleGoalSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Período: {format(startOfMonth(currentMonth), 'dd/MM/yyyy')} a {format(endOfMonth(currentMonth), 'dd/MM/yyyy')}
                </p>
                <div className="space-y-2">
                  <Label>Valor da Meta ({selectedStore.currency}) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 50000"
                    value={goalFormData.goal_amount}
                    onChange={(e) => setGoalFormData({ goal_amount: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setGoalDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Salvar Meta
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}