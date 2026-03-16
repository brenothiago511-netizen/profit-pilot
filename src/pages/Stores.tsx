import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Store, Loader2, Building2, CreditCard, Pencil, Trash2, Users, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
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

interface PartnerUser {
  id: string;
  name: string;
  email: string;
}

interface StorePartner {
  id: string;
  user_id: string;
  store_id: string;
  capital_percentage: number;
  profiles?: { name: string; email: string };
}

interface FilterUser {
  id: string;
  name: string;
}

export default function Stores() {
  const { can } = usePermissions();
  const { isAdmin, user, profile } = useAuth();
  const { toast } = useToast();
  const isNonAdmin = !isAdmin;
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [filterUsers, setFilterUsers] = useState<FilterUser[]>([]);
  const [partnerStoreMap, setPartnerStoreMap] = useState<Record<string, string[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);
  const [availablePartners, setAvailablePartners] = useState<PartnerUser[]>([]);
  const [storePartners, setStorePartners] = useState<StorePartner[]>([]);
  const [allUsers, setAllUsers] = useState<PartnerUser[]>([]);
  const [transferUserId, setTransferUserId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    country: 'Brasil',
    currency: 'BRL',
  });
  const [partnerFormData, setPartnerFormData] = useState({
    user_id: '',
    capital_percentage: '',
  });

  useEffect(() => {
    fetchData();
    if (isAdmin) fetchFilterUsers();
  }, []);

  const fetchFilterUsers = async () => {
    const { data: partnersData } = await supabase
      .from('partners')
      .select('user_id, store_id, profiles(name)')
      .eq('status', 'active');

    if (partnersData) {
      const usersMap: Record<string, string> = {};
      const storeMap: Record<string, string[]> = {};
      
      for (const p of partnersData) {
        const uid = p.user_id;
        const name = (p.profiles as any)?.name || 'Sem nome';
        usersMap[uid] = name;
        if (p.store_id) {
          if (!storeMap[uid]) storeMap[uid] = [];
          storeMap[uid].push(p.store_id);
        }
      }

      setFilterUsers(
        Object.entries(usersMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
      );
      setPartnerStoreMap(storeMap);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    let storeIds: string[] | null = null;
    
    if (isNonAdmin && user?.id) {
      const { data: partnerData } = await supabase
        .from('partners')
        .select('store_id')
        .eq('user_id', user.id)
        .eq('status', 'active');
      
      storeIds = partnerData?.map(p => p.store_id).filter(Boolean) as string[] || [];
      
      if (storeIds.length === 0) {
        setStores([]);
        setLoading(false);
        return;
      }
    }

    let storesQuery = supabase.from('stores').select('*').order('name');
    if (storeIds && storeIds.length > 0) {
      storesQuery = storesQuery.in('id', storeIds);
    }

    const { data } = await storesQuery;
    if (data) setStores(data);
    setLoading(false);
  };

  const filteredStores = filterUserId === 'all'
    ? stores
    : stores.filter(s => partnerStoreMap[filterUserId]?.includes(s.id));

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
      const { data: storeData, error } = await supabase.from('stores').insert({
        name: formData.name,
        country: formData.country,
        currency: formData.currency,
      }).select('id').single();

      setSaving(false);
      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      } else {
        if (isNonAdmin && user?.id && storeData?.id) {
          const { error: partnerError } = await supabase.from('partners').insert({
            user_id: user.id,
            store_id: storeData.id,
            capital_percentage: 100,
            capital_amount: 0,
            status: 'active',
          });
          
          if (partnerError) {
            console.error('Error linking store to partner:', partnerError);
          }
        }
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

  const deleteStore = async (store: StoreData) => {
    if (!confirm(`Tem certeza que deseja excluir a loja "${store.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    await Promise.all([
      supabase.from('revenues').delete().eq('store_id', store.id),
      supabase.from('expenses').delete().eq('store_id', store.id),
      supabase.from('revenue_goals').delete().eq('store_id', store.id),
      supabase.from('bank_accounts').delete().eq('store_id', store.id),
      supabase.from('partners').delete().eq('store_id', store.id),
      supabase.from('profits').delete().eq('store_id', store.id),
      supabase.from('commissions').delete().eq('store_id', store.id),
      supabase.from('store_roi_alerts').delete().eq('store_id', store.id),
      supabase.from('partner_transactions').delete().eq('store_id', store.id),
      supabase.from('user_stores').delete().eq('store_id', store.id),
    ]);

    const { error } = await supabase.from('stores').delete().eq('id', store.id);

    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Loja excluída' });
      fetchData();
    }
  };

  const openBankDialog = (store: StoreData) => {
    setSelectedStore(store);
    setBankDialogOpen(true);
  };

  // Transfer store functions
  const openTransferDialog = async (store: StoreData) => {
    setSelectedStore(store);
    setTransferUserId('');

    // Fetch all active users except current partners of this store
    const [usersRes, partnersRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email').eq('status', 'active'),
      supabase.from('partners').select('user_id').eq('store_id', store.id).eq('status', 'active'),
    ]);

    const existingPartnerIds = (partnersRes.data || []).map(p => p.user_id);
    const available = (usersRes.data || []).filter(u => !existingPartnerIds.includes(u.id));
    setAllUsers(available);
    setTransferDialogOpen(true);
  };

  const handleTransfer = async () => {
    if (!selectedStore || !transferUserId) {
      toast({ title: 'Erro', description: 'Selecione um usuário', variant: 'destructive' });
      return;
    }

    if (!confirm(`Tem certeza que deseja transferir a loja "${selectedStore.name}"? Todos os sócios atuais serão removidos e a loja será vinculada ao novo usuário.`)) {
      return;
    }

    setSaving(true);

    // Remove all current partners from this store
    const { error: deleteError } = await supabase
      .from('partners')
      .delete()
      .eq('store_id', selectedStore.id);

    if (deleteError) {
      toast({ title: 'Erro', description: deleteError.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    // Create new partner record for the target user
    const { error: insertError } = await supabase.from('partners').insert({
      user_id: transferUserId,
      store_id: selectedStore.id,
      capital_percentage: 100,
      capital_amount: 0,
      status: 'active',
    });

    setSaving(false);

    if (insertError) {
      toast({ title: 'Erro', description: insertError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Loja transferida com sucesso' });
      setTransferDialogOpen(false);
      fetchData();
    }
  };

  // Partner management functions
  const openPartnerDialog = async (store: StoreData) => {
    setSelectedStore(store);
    setPartnerFormData({ user_id: '', capital_percentage: '' });
    
    const [partnersRes, existingRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email').eq('role', 'socio').eq('status', 'active'),
      supabase.from('partners').select('id, user_id, store_id, capital_percentage, profiles(name, email)').eq('store_id', store.id),
    ]);

    if (partnersRes.data) {
      const existingUserIds = (existingRes.data || []).map(p => p.user_id);
      setAvailablePartners(partnersRes.data.filter(p => !existingUserIds.includes(p.id)));
    }
    setStorePartners((existingRes.data as unknown as StorePartner[]) || []);
    setPartnerDialogOpen(true);
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !partnerFormData.user_id) {
      toast({ title: 'Erro', description: 'Selecione um sócio', variant: 'destructive' });
      return;
    }

    setSaving(true);
    
    const { data: existingPartner } = await supabase
      .from('partners')
      .select('id, store_id')
      .eq('user_id', partnerFormData.user_id)
      .eq('status', 'active')
      .maybeSingle();
    
    let error;
    
    if (existingPartner && !existingPartner.store_id) {
      const result = await supabase
        .from('partners')
        .update({
          store_id: selectedStore.id,
          capital_percentage: parseFloat(partnerFormData.capital_percentage) || 0,
        })
        .eq('id', existingPartner.id);
      error = result.error;
    } else if (existingPartner && existingPartner.store_id === selectedStore.id) {
      const result = await supabase
        .from('partners')
        .update({
          capital_percentage: parseFloat(partnerFormData.capital_percentage) || 0,
        })
        .eq('id', existingPartner.id);
      error = result.error;
    } else {
      const result = await supabase.from('partners').insert({
        user_id: partnerFormData.user_id,
        store_id: selectedStore.id,
        capital_percentage: parseFloat(partnerFormData.capital_percentage) || 0,
        capital_amount: 0,
        status: 'active',
      });
      error = result.error;
    }

    setSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Sócio vinculado à loja' });
      openPartnerDialog(selectedStore);
    }
  };

  const removePartner = async (partnerId: string) => {
    if (!confirm('Tem certeza que deseja remover este sócio da loja?')) return;
    
    const { error } = await supabase.from('partners').delete().eq('id', partnerId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Sócio removido da loja' });
      if (selectedStore) openPartnerDialog(selectedStore);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Lojas</h1>
          <p className="page-description">
            {isNonAdmin ? 'Suas lojas vinculadas' : 'Gerencie as unidades'}
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

      {isAdmin && (
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Filtrar por sócio:</Label>
          <Select value={filterUserId} onValueChange={setFilterUserId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todos os usuários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filterUsers.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">
              Ativas ({filteredStores.filter(s => s.status === 'active').length})
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inativas ({filteredStores.filter(s => s.status !== 'active').length})
            </TabsTrigger>
          </TabsList>

          {(['active', 'inactive'] as const).map((tabStatus) => {
            const filtered = filteredStores.filter(s => tabStatus === 'active' ? s.status === 'active' : s.status !== 'active');
            return (
              <TabsContent key={tabStatus} value={tabStatus}>
                {filtered.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Store className="w-12 h-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {tabStatus === 'active' ? 'Nenhuma loja ativa' : 'Nenhuma loja inativa'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((store) => (
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
                            {isAdmin && (
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteStore(store)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                            <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                              {store.status === 'active' ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(store.created_at), 'dd/MM/yyyy')}
                            </span>
                            <div className="flex gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => openBankDialog(store)}>
                                <CreditCard className="w-4 h-4 mr-1" />
                                Banco
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openTransferDialog(store)}>
                                <ArrowRightLeft className="w-4 h-4 mr-1" />
                                Transferir
                              </Button>
                              {isAdmin && (
                                <Button variant="outline" size="sm" onClick={() => openPartnerDialog(store)}>
                                  <Users className="w-4 h-4 mr-1" />
                                  Sócios
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => toggleStatus(store.id, store.status)}>
                                {store.status === 'active' ? 'Desativar' : 'Ativar'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {selectedStore && (
        <>
          <BankAccountsDialog
            open={bankDialogOpen}
            onOpenChange={setBankDialogOpen}
            storeId={selectedStore.id}
            storeName={selectedStore.name}
          />

          {/* Transfer Dialog */}
          <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Transferir Loja - {selectedStore.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ao transferir, todos os sócios atuais serão removidos e a loja será vinculada ao novo usuário com 100% de participação.
                </p>
                <div className="space-y-2">
                  <Label>Transferir para</Label>
                  {allUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum usuário disponível para transferência</p>
                  ) : (
                    <Select value={transferUserId} onValueChange={setTransferUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>
                    Cancelar
                  </Button>
                  {transferUserId && (
                    <Button onClick={handleTransfer} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                      Transferir
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Partner Dialog - Admin only */}
          <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Sócios - {selectedStore.name}</DialogTitle>
              </DialogHeader>
              
              {storePartners.length > 0 && (
                <div className="space-y-2">
                  <Label>Sócios Vinculados</Label>
                  <div className="space-y-2">
                    {storePartners.map((partner) => (
                      <div key={partner.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{partner.profiles?.name}</p>
                          <p className="text-sm text-muted-foreground">{partner.profiles?.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{partner.capital_percentage}%</Badge>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removePartner(partner.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handlePartnerSubmit} className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Adicionar Sócio</Label>
                  {availablePartners.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todos os sócios já estão vinculados a esta loja</p>
                  ) : (
                    <Select
                      value={partnerFormData.user_id}
                      onValueChange={(v) => setPartnerFormData({ ...partnerFormData, user_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um sócio" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePartners.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                {partnerFormData.user_id && (
                  <div className="space-y-2">
                    <Label>Percentual de Participação (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="Ex: 50"
                      value={partnerFormData.capital_percentage}
                      onChange={(e) => setPartnerFormData({ ...partnerFormData, capital_percentage: e.target.value })}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setPartnerDialogOpen(false)}>
                    Fechar
                  </Button>
                  {availablePartners.length > 0 && partnerFormData.user_id && (
                    <Button type="submit" disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Vincular Sócio
                    </Button>
                  )}
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
