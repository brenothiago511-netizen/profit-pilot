import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Check, X, Clock, TrendingUp, Pencil, Trash2, Store } from 'lucide-react';
import { PermissionGate } from '@/components/permissions/PermissionGate';

interface ManagerProfile {
  name: string;
}

interface ManagerWithProfile {
  id: string;
  user_id: string;
  profiles: ManagerProfile | null;
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
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  stores?: { name: string; currency: string };
  managers?: { 
    id: string;
    user_id: string;
    profiles?: { name: string } | null;
  };
}

export default function Profits() {
  const { user, profile } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfit, setEditingProfit] = useState<Profit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const isAdmin = profile?.role === 'admin';
  const isFinanceiro = profile?.role === 'financeiro';
  const isGestor = profile?.role === 'gestor';
  const canApprove = isAdmin || isFinanceiro;

  // Get current user's manager record if gestor
  const { data: currentManager } = useQuery({
    queryKey: ['current-manager', user?.id],
    queryFn: async () => {
      if (!user?.id || !isGestor) return null;
      const { data, error } = await supabase
        .from('managers')
        .select('id, store_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && isGestor,
  });

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, currency')
        .eq('status', 'active');
      if (error) throw error;
      return data;
    },
  });

  // Fetch managers
  const { data: managers = [] } = useQuery({
    queryKey: ['managers-with-profiles-for-profits'],
    queryFn: async () => {
      const { data: managersData, error } = await supabase
        .from('managers')
        .select('id, user_id, store_id')
        .eq('status', 'active');
      if (error) throw error;
      
      const userIds = managersData?.map(m => m.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      
      return managersData.map(m => ({
        ...m,
        profiles: profilesData?.find(p => p.id === m.user_id) || null
      }));
    },
  });

  // Fetch profits
  const { data: profits = [], isLoading } = useQuery({
    queryKey: ['profits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profits')
        .select(`
          *,
          stores:store_id(name, currency)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Fetch manager names separately
      const managerIds = [...new Set(data.map(p => p.manager_id))];
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
      
      return data.map(profit => ({
        ...profit,
        managers: {
          id: profit.manager_id,
          user_id: managersData?.find(m => m.id === profit.manager_id)?.user_id || '',
          profiles: { name: managerProfileMap.get(profit.manager_id) || '-' }
        }
      })) as Profit[];
    },
  });

  const filteredProfits = useMemo(() => {
    if (filterStatus === 'all') return profits;
    return profits.filter((p) => p.status === filterStatus);
  }, [profits, filterStatus]);

  // Form state - initialize with gestor data when available
  const [formData, setFormData] = useState({
    store_id: '',
    manager_id: '',
    period_start: '',
    period_end: '',
    profit_amount: '',
    notes: '',
  });

  // Update form with gestor data when currentManager loads
  useEffect(() => {
    if (isGestor && currentManager && !formData.manager_id) {
      setFormData(prev => ({
        ...prev,
        store_id: currentManager.store_id || '',
        manager_id: currentManager.id,
      }));
    }
  }, [isGestor, currentManager]);

  const resetForm = () => {
    setFormData({
      store_id: isGestor && currentManager?.store_id ? currentManager.store_id : '',
      manager_id: isGestor && currentManager?.id ? currentManager.id : '',
      period_start: '',
      period_end: '',
      profit_amount: '',
      notes: '',
    });
    setEditingProfit(null);
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // For gestor, ensure we use their manager data
      const storeId = isGestor && currentManager?.store_id ? currentManager.store_id : data.store_id;
      const managerId = isGestor && currentManager?.id ? currentManager.id : data.manager_id;

      if (!storeId || !managerId) {
        throw new Error('Loja e gestor são obrigatórios');
      }

      const payload = {
        store_id: storeId,
        manager_id: managerId,
        period_start: data.period_start,
        period_end: data.period_end,
        profit_amount: parseFloat(data.profit_amount),
        notes: data.notes || null,
        created_by: user?.id,
        status: canApprove ? 'approved' : 'pending',
        approved_by: canApprove ? user?.id : null,
        approved_at: canApprove ? new Date().toISOString() : null,
      };

      const { error } = await supabase.from('profits').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profits'] });
      toast.success('Lucro registrado com sucesso!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar lucro: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const payload: Record<string, unknown> = {};
      if (data.profit_amount) payload.profit_amount = parseFloat(data.profit_amount);
      if (data.notes !== undefined) payload.notes = data.notes || null;
      if (data.period_start) payload.period_start = data.period_start;
      if (data.period_end) payload.period_end = data.period_end;

      const { error } = await supabase.from('profits').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profits'] });
      toast.success('Lucro atualizado!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase
        .from('profits')
        .update({
          status: approved ? 'approved' : 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { approved }) => {
      queryClient.invalidateQueries({ queryKey: ['profits'] });
      toast.success(approved ? 'Lucro aprovado!' : 'Lucro rejeitado');
    },
    onError: (error: Error) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('profits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profits'] });
      toast.success('Lucro excluído!');
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProfit) {
      updateMutation.mutate({ id: editingProfit.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (profit: Profit) => {
    setFormData({
      store_id: profit.store_id,
      manager_id: profit.manager_id,
      period_start: profit.period_start,
      period_end: profit.period_end,
      profit_amount: profit.profit_amount.toString(),
      notes: profit.notes || '',
    });
    setEditingProfit(profit);
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><Check className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  // Summary stats
  const stats = useMemo(() => {
    const pending = profits.filter((p) => p.status === 'pending').length;
    const approved = profits.filter((p) => p.status === 'approved');
    const totalApproved = approved.reduce((sum, p) => sum + p.profit_amount, 0);
    return { pending, approved: approved.length, totalApproved };
  }, [profits]);

  // For gestor, auto-select their store/manager
  const availableManagers = isGestor && currentManager
    ? managers.filter((m) => m.id === currentManager.id)
    : managers;

  // Check if gestor has a store assigned
  const gestorWithoutStore = isGestor && currentManager && !currentManager.store_id;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro de Lucros</h1>
          <p className="text-muted-foreground">
            {isGestor ? 'Registre os lucros da sua loja para cálculo de comissões' : 'Gerencie os lucros para cálculo de comissões'}
          </p>
        </div>

        {gestorWithoutStore ? (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
            Você não possui uma loja associada. Entre em contato com o administrador.
          </div>
        ) : (
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={isGestor && !currentManager}>
                <Plus className="w-4 h-4" />
                Registrar Lucro
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProfit ? 'Editar Lucro' : 'Registrar Novo Lucro'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isGestor && (
                <>
                  <div className="space-y-2">
                    <Label>Loja</Label>
                    <Select
                      value={formData.store_id}
                      onValueChange={(v) => setFormData({ ...formData, store_id: v, manager_id: '' })}
                      disabled={!!editingProfit}
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
                      value={formData.manager_id}
                      onValueChange={(v) => setFormData({ ...formData, manager_id: v })}
                      disabled={!!editingProfit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o gestor" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers
                          .filter((m) => !formData.store_id || !m.store_id || m.store_id === formData.store_id)
                          .map((manager) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.profiles?.name || 'Gestor sem nome'}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {isGestor && currentManager && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Registrando lucro para:</p>
                      <p className="font-semibold text-foreground">
                        {stores.find(s => s.id === currentManager.store_id)?.name || 'Sua Loja'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Período Início</Label>
                  <Input
                    type="date"
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Período Fim</Label>
                  <Input
                    type="date"
                    value={formData.period_end}
                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor do Lucro</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.profit_amount}
                  onChange={(e) => setFormData({ ...formData, profit_amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações opcionais..."
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingProfit ? 'Salvar Alterações' : 'Registrar Lucro'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <Check className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovados</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Aprovado</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalApproved)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-4 items-center">
        <Label>Filtrar por status:</Label>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle>Lucros Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredProfits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum lucro registrado</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Gestor</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfits.map((profit) => (
                    <TableRow key={profit.id}>
                      <TableCell className="font-medium">{profit.stores?.name}</TableCell>
                      <TableCell>{profit.managers?.profiles?.name || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(profit.period_start), 'dd/MM/yy', { locale: ptBR })} -{' '}
                        {format(new Date(profit.period_end), 'dd/MM/yy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: profit.stores?.currency || 'BRL',
                        }).format(profit.profit_amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(profit.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(profit.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canApprove && profit.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-emerald-500 hover:text-emerald-400"
                                onClick={() => approveMutation.mutate({ id: profit.id, approved: true })}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive/80"
                                onClick={() => approveMutation.mutate({ id: profit.id, approved: false })}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <PermissionGate permission="manage_commissions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(profit)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </PermissionGate>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive/80"
                              onClick={() => setDeleteId(profit.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de lucro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
