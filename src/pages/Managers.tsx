import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { usePermissions } from '@/hooks/usePermissions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Loader2, Percent, User, Store, Pencil } from 'lucide-react';
import { format } from 'date-fns';

interface Manager {
  id: string;
  user_id: string;
  store_id: string | null;
  commission_percent: number;
  commission_type: string;
  status: string;
  created_at: string;
  profile_name?: string;
  profile_email?: string;
  store_name?: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface StoreOption {
  id: string;
  name: string;
}

export default function Managers() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    store_id: '',
    commission_percent: '',
    commission_type: 'lucro',
  });
  const [editFormData, setEditFormData] = useState({
    store_id: '',
    commission_percent: '',
    commission_type: 'lucro',
  });

  useEffect(() => {
    fetchManagers();
    fetchAvailableUsers();
    fetchStores();
  }, []);

  const fetchManagers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('managers')
      .select('*, stores(name)')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching managers:', error);
      setLoading(false);
      return;
    }
    
    // Fetch profiles for each manager
    const managerData = data || [];
    const userIds = managerData.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);
    
    const managersWithProfiles = managerData.map((m: any) => ({
      ...m,
      profile_name: profiles?.find(p => p.id === m.user_id)?.name,
      profile_email: profiles?.find(p => p.id === m.user_id)?.email,
      store_name: m.stores?.name,
    }));
    
    setManagers(managersWithProfiles);
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

  const fetchAvailableUsers = async () => {
    // Get all active profiles that are not already managers
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('status', 'active');
    
    const { data: existingManagers } = await supabase
      .from('managers')
      .select('user_id');
    
    const managerIds = existingManagers?.map(m => m.user_id) || [];
    const available = allProfiles?.filter(p => !managerIds.includes(p.id)) || [];
    
    setAvailableUsers(available);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id || !formData.commission_percent) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('managers').insert({
      user_id: formData.user_id,
      store_id: formData.store_id || null,
      commission_percent: parseFloat(formData.commission_percent),
      commission_type: formData.commission_type,
    });

    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Gestor cadastrado com sucesso',
      });
      setDialogOpen(false);
      setFormData({ user_id: '', store_id: '', commission_percent: '', commission_type: 'lucro' });
      fetchManagers();
      fetchAvailableUsers();
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('managers')
      .update({ status: newStatus })
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
        description: `Gestor ${newStatus === 'active' ? 'ativado' : 'desativado'}`,
      });
      fetchManagers();
    }
  };

  const openEditDialog = (manager: Manager) => {
    setEditingManager(manager);
    setEditFormData({
      store_id: manager.store_id || '',
      commission_percent: manager.commission_percent.toString(),
      commission_type: manager.commission_type,
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingManager || !editFormData.commission_percent) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('managers')
      .update({
        store_id: editFormData.store_id || null,
        commission_percent: parseFloat(editFormData.commission_percent),
        commission_type: editFormData.commission_type,
      })
      .eq('id', editingManager.id);

    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Gestor atualizado com sucesso',
      });
      setEditDialogOpen(false);
      setEditingManager(null);
      fetchManagers();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Gestores</h1>
          <p className="page-description">Gerencie os gestores e suas comissões</p>
        </div>

        <PermissionGate permission="manage_managers">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={availableUsers.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Gestor
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Gestor</DialogTitle>
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
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum usuário com perfil "Gestor" disponível. Crie um usuário com esse perfil primeiro.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Loja (opcional)</Label>
                <Select
                  value={formData.store_id}
                  onValueChange={(v) => setFormData({ ...formData, store_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as lojas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as lojas</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para comissão sobre todas as lojas
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Percentual de Comissão *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="10"
                      value={formData.commission_percent}
                      onChange={(e) => setFormData({ ...formData, commission_percent: e.target.value })}
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Comissão</Label>
                  <Select
                    value={formData.commission_type}
                    onValueChange={(v) => setFormData({ ...formData, commission_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lucro">Sobre Lucro</SelectItem>
                      <SelectItem value="faturamento">Sobre Faturamento</SelectItem>
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
                    'Salvar'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PermissionGate>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : managers.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum gestor cadastrado</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          managers.map((manager) => (
            <Card key={manager.id} className="hover:shadow-card-hover transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
                    <User className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{manager.profile_name || 'N/A'}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {manager.profile_email}
                    </p>
                  </div>
                </div>
                <Badge variant={manager.status === 'active' ? 'default' : 'secondary'}>
                  {manager.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {manager.store_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Store className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Loja:</span>
                    <Badge variant="outline">{manager.store_name}</Badge>
                  </div>
                )}
                {!manager.store_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <Store className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Loja:</span>
                    <Badge variant="secondary">Todas as lojas</Badge>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Comissão</span>
                  <span className="font-semibold">
                    {manager.commission_percent}% sobre {manager.commission_type === 'lucro' ? 'Lucro' : 'Faturamento'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Desde {format(new Date(manager.created_at), 'dd/MM/yyyy')}
                  </span>
                  <PermissionGate permission="manage_managers">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(manager)}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(manager.id, manager.status)}
                      >
                        {manager.status === 'active' ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </PermissionGate>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Manager Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Gestor</DialogTitle>
          </DialogHeader>
          {editingManager && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{editingManager.profile_name}</p>
                  <p className="text-sm text-muted-foreground">{editingManager.profile_email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Loja Associada</Label>
                <Select
                  value={editFormData.store_id}
                  onValueChange={(v) => setEditFormData({ ...editFormData, store_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as lojas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as lojas</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para comissão sobre todas as lojas
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Percentual de Comissão *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="10"
                      value={editFormData.commission_percent}
                      onChange={(e) => setEditFormData({ ...editFormData, commission_percent: e.target.value })}
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Comissão</Label>
                  <Select
                    value={editFormData.commission_type}
                    onValueChange={(v) => setEditFormData({ ...editFormData, commission_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lucro">Sobre Lucro</SelectItem>
                      <SelectItem value="faturamento">Sobre Faturamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
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
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
