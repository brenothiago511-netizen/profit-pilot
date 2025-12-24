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
import { useToast } from '@/hooks/use-toast';
import { Percent, Loader2, Calculator, Check, Pencil, Trash2 } from 'lucide-react';
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
  commission_percent: number;
  commission_type: string;
  profile_name?: string;
}

export default function Commissions() {
  const { isAdmin, isGestor } = useAuth();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calcForm, setCalcForm] = useState({
    store_id: '',
    manager_id: '',
    month: format(subMonths(new Date(), 1), 'yyyy-MM'),
  });

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
    if (isAdmin) {
      fetchStores();
      fetchManagers();
    }
  }, [isAdmin]);

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
      .select('id, user_id, commission_percent, commission_type')
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

      // Calculate base amount (revenue or profit)
      const { data: revenues } = await supabase
        .from('revenues')
        .select('amount')
        .eq('store_id', calcForm.store_id)
        .gte('date', periodStart)
        .lte('date', periodEnd);

      const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

      let baseAmount = totalRevenue;

      if (selectedManager.commission_type === 'lucro') {
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('store_id', calcForm.store_id)
          .gte('date', periodStart)
          .lte('date', periodEnd);

        const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
        baseAmount = totalRevenue - totalExpenses;
      }

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
        description: 'Comissão calculada com sucesso',
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

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={calculateCommission} disabled={calculating}>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-info" />
            Comissões
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
