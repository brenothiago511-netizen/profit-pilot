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
import { Loader2, Check, Pencil, Trash2, Plus, DollarSign, Clock, TrendingUp } from 'lucide-react';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  const [recordForm, setRecordForm] = useState({
    id: '',
    store_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    daily_profit: '',
    notes: '',
  });
  
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

    // If editing existing record
    if (editingRecord) {
      const { error } = await supabase
        .from('daily_records')
        .update({
          store_id: recordForm.store_id,
          date: recordForm.date,
          daily_profit: profit,
          notes: recordForm.notes || null,
        })
        .eq('id', editingRecord.id);

      setSavingRecord(false);

      if (error) {
        toast({
          title: 'Erro ao atualizar',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Lucro atualizado!',
        });
        setRecordDialogOpen(false);
        setRecordForm({ id: '', store_id: '', date: format(new Date(), 'yyyy-MM-dd'), daily_profit: '', notes: '' });
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
      setRecordForm({ id: '', store_id: '', date: format(new Date(), 'yyyy-MM-dd'), daily_profit: '', notes: '' });
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
    if (filterStatus === 'all') return dailyRecords;
    if (filterStatus === 'received') return dailyRecords.filter(r => r.shopify_status === 'received');
    if (filterStatus === 'pending') return dailyRecords.filter(r => r.shopify_status === 'pending');
    return dailyRecords;
  }, [dailyRecords, filterStatus]);

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
      date: format(new Date(r.date), 'dd/MM'),
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
              setRecordForm({ id: '', store_id: '', date: format(new Date(), 'yyyy-MM-dd'), daily_profit: '', notes: '' });
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

      {/* Filter */}
      <div className="flex gap-4 items-center">
        <Label>Filtrar por status:</Label>
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

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            Registros de Lucro
          </CardTitle>
          <CardDescription>
            Clique em "Confirmar Shopify" quando o valor for recebido na sua conta Shopify
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Sócio</th>
                    <th>Loja</th>
                    <th className="text-right">Lucro</th>
                    <th>Status Shopify</th>
                    {canApprove && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{format(new Date(record.date), 'dd/MM/yyyy', { locale: ptBR })}</td>
                      <td>{record.user_name}</td>
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
          )}
        </CardContent>
      </Card>

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
