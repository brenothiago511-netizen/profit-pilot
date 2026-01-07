import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { usePermissions } from '@/hooks/usePermissions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
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
import { Plus, Users, Loader2, Store, DollarSign, TrendingUp, TrendingDown, Percent, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Partner {
  id: string;
  user_id: string;
  store_id: string;
  capital_amount: number;
  capital_percentage: number;
  status: string;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
  store?: {
    name: string;
  };
}

interface PartnerTransaction {
  id: string;
  partner_id: string;
  store_id: string;
  type: string;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
}

interface StoreData {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function Partners() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    user_id: '',
    store_id: '',
    capital_amount: '',
    capital_percentage: '',
  });

  const [transactionForm, setTransactionForm] = useState({
    type: 'aporte' as 'aporte' | 'retirada' | 'distribuicao',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const filteredPartners = partners.filter((partner) => {
    const matchesSearch =
      searchTerm === '' ||
      partner.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.user?.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStore = storeFilter === 'all' || partner.store_id === storeFilter;

    return matchesSearch && matchesStore;
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPartners(), fetchStores(), fetchUsers()]);
    setLoading(false);
  };

  const fetchPartners = async () => {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching partners:', error);
      return;
    }

    // Fetch user and store info separately
    const userIds = [...new Set((data || []).map(p => p.user_id))];
    const storeIds = [...new Set((data || []).map(p => p.store_id))];

    const [usersResult, storesResult] = await Promise.all([
      supabase.from('profiles').select('id, name, email').in('id', userIds),
      supabase.from('stores').select('id, name').in('id', storeIds),
    ]);

    const usersMap = new Map((usersResult.data || []).map(u => [u.id, u]));
    const storesMap = new Map((storesResult.data || []).map(s => [s.id, s]));

    const partnersWithInfo = (data || []).map(p => ({
      ...p,
      user: usersMap.get(p.user_id),
      store: storesMap.get(p.store_id),
    }));

    setPartners(partnersWithInfo);
  };

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    setStores(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('status', 'active')
      .order('name');
    setUsers(data || []);
  };

  const fetchTransactions = async (partnerId: string) => {
    const { data, error } = await supabase
      .from('partner_transactions')
      .select('*')
      .eq('partner_id', partnerId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }

    setTransactions(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id || !formData.store_id) {
      toast({
        title: 'Erro',
        description: 'Selecione o usuário e a loja',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('partners').insert({
      user_id: formData.user_id,
      store_id: formData.store_id,
      capital_amount: parseFloat(formData.capital_amount) || 0,
      capital_percentage: parseFloat(formData.capital_percentage) || 0,
    });

    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao adicionar sócio',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Sócio adicionado com sucesso',
      });
      setDialogOpen(false);
      setFormData({ user_id: '', store_id: '', capital_amount: '', capital_percentage: '' });
      fetchPartners();
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner || !transactionForm.amount) {
      toast({
        title: 'Erro',
        description: 'Preencha o valor da transação',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('partner_transactions').insert({
      partner_id: selectedPartner.id,
      store_id: selectedPartner.store_id,
      type: transactionForm.type,
      amount: parseFloat(transactionForm.amount),
      description: transactionForm.description || null,
      date: transactionForm.date,
    });

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    // Update capital amount based on transaction type
    let newCapital = selectedPartner.capital_amount;
    const amount = parseFloat(transactionForm.amount);
    
    if (transactionForm.type === 'aporte') {
      newCapital += amount;
    } else if (transactionForm.type === 'retirada' || transactionForm.type === 'distribuicao') {
      newCapital -= amount;
    }

    await supabase
      .from('partners')
      .update({ capital_amount: newCapital })
      .eq('id', selectedPartner.id);

    setSaving(false);
    toast({
      title: 'Sucesso',
      description: 'Transação registrada com sucesso',
    });
    setTransactionDialogOpen(false);
    setTransactionForm({ type: 'aporte', amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
    fetchPartners();
    fetchTransactions(selectedPartner.id);
  };

  const openTransactionDialog = async (partner: Partner) => {
    setSelectedPartner(partner);
    await fetchTransactions(partner.id);
    setTransactionDialogOpen(true);
  };

  const toggleStatus = async (partner: Partner) => {
    const newStatus = partner.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('partners')
      .update({ status: newStatus })
      .eq('id', partner.id);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: `Sócio ${newStatus === 'active' ? 'ativado' : 'desativado'}`,
      });
      fetchPartners();
    }
  };

  const deletePartner = async (partner: Partner) => {
    if (!confirm(`Tem certeza que deseja excluir o sócio "${partner.user?.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    // Delete related transactions first
    await supabase.from('partner_transactions').delete().eq('partner_id', partner.id);
    
    // Delete partner
    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', partner.id);
    
    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sócio excluído',
        description: 'O sócio foi removido com sucesso',
      });
      fetchPartners();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'aporte':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'retirada':
      case 'distribuicao':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      aporte: 'Aporte',
      retirada: 'Retirada',
      distribuicao: 'Distribuição',
    };
    return labels[type] || type;
  };

  const totalCapital = partners.reduce((sum, p) => sum + (p.capital_amount || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Sócios</h1>
          <p className="page-description">Gerencie sócios, capital social e movimentações</p>
        </div>

        <PermissionGate permission="manage_partners">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Sócio
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Sócio</DialogTitle>
              <DialogDescription>
                Vincule um usuário como sócio de uma loja
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Usuário *</Label>
                <Select
                  value={formData.user_id}
                  onValueChange={(v) => setFormData({ ...formData, user_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Loja *</Label>
                <Select
                  value={formData.store_id}
                  onValueChange={(v) => setFormData({ ...formData, store_id: v })}
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
                <Label>Capital Inicial (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.capital_amount}
                  onChange={(e) => setFormData({ ...formData, capital_amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Participação (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={formData.capital_percentage}
                  onChange={(e) => setFormData({ ...formData, capital_percentage: e.target.value })}
                />
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
                    'Adicionar Sócio'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Sócios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partners.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Capital Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCapital)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lojas com Sócios</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(partners.map(p => p.store_id)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Lista de Sócios
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredPartners.length} de {partners.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {partners.length === 0 ? 'Nenhum sócio cadastrado' : 'Nenhum sócio encontrado'}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sócio</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-right">Participação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPartners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{partner.user?.name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{partner.user?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{partner.store?.name || 'N/A'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(partner.capital_amount || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          <Percent className="w-3 h-3 mr-1" />
                          {partner.capital_percentage || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={partner.status === 'active' ? 'default' : 'secondary'}>
                          {partner.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTransactionDialog(partner)}
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            Movimentar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStatus(partner)}
                          >
                            {partner.status === 'active' ? 'Desativar' : 'Ativar'}
                          </Button>
                          <PermissionGate permission="manage_partners">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deletePartner(partner)}
                              title="Excluir sócio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </PermissionGate>
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

      {/* Transaction Dialog */}
      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Movimentações de Capital</DialogTitle>
            <DialogDescription>
              {selectedPartner?.user?.name} - {selectedPartner?.store?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            {/* New Transaction Form */}
            <div className="space-y-4">
              <h4 className="font-medium">Nova Movimentação</h4>
              <form onSubmit={handleTransactionSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={transactionForm.type}
                    onValueChange={(v) => setTransactionForm({ ...transactionForm, type: v as 'aporte' | 'retirada' | 'distribuicao' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aporte">Aporte de Capital</SelectItem>
                      <SelectItem value="retirada">Retirada</SelectItem>
                      <SelectItem value="distribuicao">Distribuição de Lucros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={transactionForm.date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Descrição opcional"
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Registrar Movimentação'
                  )}
                </Button>
              </form>
            </div>

            {/* Transaction History */}
            <div className="space-y-4">
              <h4 className="font-medium">Histórico</h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma movimentação registrada
                  </p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(tx.type)}
                        <div>
                          <p className="text-sm font-medium">{getTransactionLabel(tx.type)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                          {tx.description && (
                            <p className="text-xs text-muted-foreground">{tx.description}</p>
                          )}
                        </div>
                      </div>
                      <span className={`font-medium ${tx.type === 'aporte' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'aporte' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
