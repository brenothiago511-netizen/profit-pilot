import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users as UsersIcon, Loader2, Store, Shield, UserCheck, UserX, Search, X, Key, Trash2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { CsvImportDialog } from '@/components/users/CsvImportDialog';
import { PermissionsDialog } from '@/components/users/PermissionsDialog';

type AppRole = 'admin' | 'financeiro' | 'socio' | 'gestor' | 'captador';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: string;
  created_at: string;
  is_custom_permissions?: boolean;
}

interface StoreData {
  id: string;
  name: string;
}

interface UserStore {
  store_id: string;
  store?: StoreData;
}

export default function Users() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [userStores, setUserStores] = useState<Record<string, string[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<AppRole>('financeiro');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'financeiro' as AppRole,
  });

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');

  // Remap orphaned data state
  const [remapDialogOpen, setRemapDialogOpen] = useState(false);
  const [orphanedUsers, setOrphanedUsers] = useState<{ user_id: string; count: number }[]>([]);
  const [remapSelections, setRemapSelections] = useState<Record<string, string>>({});
  const [remapping, setRemapping] = useState(false);
  const [loadingOrphans, setLoadingOrphans] = useState(false);

  // Filtered users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchTerm === '' ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    const userStoreIds = userStores[user.id] || [];
    const matchesStore =
      storeFilter === 'all' ||
      (storeFilter === 'none' && userStoreIds.length === 0) ||
      userStoreIds.includes(storeFilter);

    return matchesSearch && matchesRole && matchesStatus && matchesStore;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
    setStoreFilter('all');
  };

  const hasActiveFilters = searchTerm !== '' || roleFilter !== 'all' || statusFilter !== 'all' || storeFilter !== 'all';

  useEffect(() => {
    fetchUsers();
    fetchStores();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, status, created_at, is_custom_permissions')
      .order('name');
    
    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setUsers((data || []) as UserProfile[]);
      // Fetch store assignments for all users
      const userIds = (data || []).map(u => u.id);
      if (userIds.length > 0) {
        const { data: storeAssignments } = await supabase
          .from('user_stores')
          .select('user_id, store_id')
          .in('user_id', userIds);
        
        const storeMap: Record<string, string[]> = {};
        (storeAssignments || []).forEach(assignment => {
          if (!storeMap[assignment.user_id]) {
            storeMap[assignment.user_id] = [];
          }
          storeMap[assignment.user_id].push(assignment.store_id);
        });
        setUserStores(storeMap);
      }
    }
    setLoading(false);
  };

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    setStores(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.name) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    // Salva a sessão do admin antes de criar o usuário
    // (signUp pode substituir a sessão ativa se auto-confirm estiver ligado)
    const { data: { session: adminSession } } = await supabase.auth.getSession();

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          role: formData.role,
        },
      },
    });

    // Restaura a sessão do admin caso tenha sido substituída
    if (adminSession) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession || currentSession.user.id !== adminSession.user.id) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }
    }

    if (error) {
      setSaving(false);
      toast({
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    const newUserId = signUpData?.user?.id;
    if (newUserId) {
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: 'active',
        });

      if (upsertError) {
        console.error('Erro ao criar perfil:', upsertError);
        toast({
          title: 'Usuário criado, mas houve um erro no perfil',
          description: upsertError.message,
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast({
      title: 'Sucesso',
      description: 'Usuário criado com sucesso',
    });
    setDialogOpen(false);
    setFormData({ email: '', password: '', name: '', role: 'financeiro' });
    setTimeout(fetchUsers, 500);
  };

  const toggleStatus = async (user: UserProfile) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', user.id);
    
    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Atualizado',
        description: `Usuário ${newStatus === 'active' ? 'ativado' : 'desativado'}`,
      });
      fetchUsers();
    }
  };

  const deleteUser = async (user: UserProfile) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${user.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    // Delete related data first
    await supabase.from('user_stores').delete().eq('user_id', user.id);
    await supabase.from('user_permissions').delete().eq('user_id', user.id);
    await supabase.from('user_roles').delete().eq('user_id', user.id);
    
    // Delete profile
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);
    
    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Usuário excluído',
        description: 'O usuário foi removido com sucesso',
      });
      fetchUsers();
    }
  };

  const openStoreDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setSelectedStores(userStores[user.id] || []);
    setStoreDialogOpen(true);
  };

  const openRoleDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setRoleDialogOpen(true);
  };

  const openPermissionsDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setPermissionsDialogOpen(true);
  };

  const handleStoreAssignment = async () => {
    if (!selectedUser) return;

    setSaving(true);

    // Delete existing assignments
    await supabase
      .from('user_stores')
      .delete()
      .eq('user_id', selectedUser.id);

    // Insert new assignments
    if (selectedStores.length > 0) {
      const assignments = selectedStores.map(store_id => ({
        user_id: selectedUser.id,
        store_id,
      }));
      
      const { error } = await supabase
        .from('user_stores')
        .insert(assignments);

      if (error) {
        toast({
          title: 'Erro',
          description: error.message,
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
    }

    toast({
      title: 'Sucesso',
      description: 'Lojas atribuídas com sucesso',
    });
    setStoreDialogOpen(false);
    setSaving(false);
    fetchUsers();
  };

  const handleRoleUpdate = async () => {
    if (!selectedUser) return;

    await executeRoleUpdate();
  };

  const executeRoleUpdate = async () => {
    if (!selectedUser) return;

    setSaving(true);

    // Update direto na tabela profiles (role agora é TEXT, aceita qualquer valor)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: selectedRole })
      .eq('id', selectedUser.id);

    if (profileError) {
      toast({
        title: 'Erro',
        description: profileError.message,
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    // user_roles — tenta atualizar sem bloquear (pode falhar no enum)
    await supabase.from('user_roles').delete().eq('user_id', selectedUser.id);
    await supabase.from('user_roles').insert({ user_id: selectedUser.id, role: selectedRole }).then(() => {});

    toast({
      title: 'Sucesso',
      description: 'Papel atualizado com sucesso',
    });
    setRoleDialogOpen(false);
    setSaving(false);
    fetchUsers();
  };

  const fetchOrphanedUsers = async () => {
    setLoadingOrphans(true);
    const profileIds = users.map(u => u.id);

    const [{ data: expUsers }, { data: revUsers }] = await Promise.all([
      supabase.from('expenses').select('user_id').not('user_id', 'is', null),
      supabase.from('revenues').select('user_id').not('user_id', 'is', null),
    ]);

    const allIds = new Set([
      ...(expUsers || []).map((e: any) => e.user_id),
      ...(revUsers || []).map((r: any) => r.user_id),
    ]);

    const orphanIds = [...allIds].filter(id => !profileIds.includes(id));

    const orphanData = await Promise.all(
      orphanIds.map(async (uid) => {
        const [{ count: expCount }, { count: revCount }] = await Promise.all([
          supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('user_id', uid),
          supabase.from('revenues').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        ]);
        return { user_id: uid, count: (expCount || 0) + (revCount || 0) };
      })
    );

    setOrphanedUsers(orphanData.filter(o => o.count > 0));
    setRemapSelections({});
    setLoadingOrphans(false);
  };

  const handleRemap = async () => {
    setRemapping(true);
    for (const [oldId, newId] of Object.entries(remapSelections)) {
      if (!newId) continue;
      await Promise.all([
        supabase.from('expenses').update({ user_id: newId }).eq('user_id', oldId),
        supabase.from('revenues').update({ user_id: newId }).eq('user_id', oldId),
        supabase.from('partners').update({ user_id: newId }).eq('user_id', oldId),
      ]);
    }
    toast({ title: 'Sucesso', description: 'Dados reatribuídos com sucesso' });
    setRemapping(false);
    setRemapDialogOpen(false);
    setOrphanedUsers([]);
    setRemapSelections({});
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'financeiro':
        return 'default';
      case 'socio':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleName = (role: AppRole) => {
    const roles: Record<AppRole, string> = {
      admin: 'Administrador',
      financeiro: 'Financeiro',
      socio: 'Sócio',
      gestor: 'Gestor',
      captador: 'Captador',
    };
    return roles[role] || role;
  };

  const getStoreNames = (userId: string) => {
    const storeIds = userStores[userId] || [];
    return stores
      .filter(s => storeIds.includes(s.id))
      .map(s => s.name)
      .join(', ') || 'Nenhuma';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-description">Gerencie usuários, papéis e atribuições de lojas</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { fetchOrphanedUsers(); setRemapDialogOpen(true); }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reatribuir Dados
          </Button>
          <CsvImportDialog onImportComplete={fetchUsers} />
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Senha *</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Papel</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData({ ...formData, role: v as AppRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="socio">Sócio</SelectItem>
                    <SelectItem value="captador">Captador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Usuário'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5" />
            Lista de Usuários
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredUsers.length} de {users.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
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
            <div className="flex flex-wrap gap-2">
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppRole | 'all')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os papéis</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="socio">Sócio</SelectItem>
                  <SelectItem value="captador">Captador</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as lojas</SelectItem>
                  <SelectItem value="none">Sem loja</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <UsersIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum usuário cadastrado</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum usuário encontrado com os filtros aplicados</p>
              <Button variant="link" onClick={clearFilters} className="mt-2">
                Limpar filtros
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Permissões</TableHead>
                    <TableHead>Lojas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {getRoleName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.is_custom_permissions ? (
                          <Badge variant="outline" className="text-xs">
                            <Key className="w-3 h-3 mr-1" />
                            Custom
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Padrão</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {getStoreNames(user.id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                          {user.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPermissionsDialog(user)}
                            title="Gerenciar permissões"
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRoleDialog(user)}
                            title="Alterar papel"
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStoreDialog(user)}
                            title="Atribuir lojas"
                          >
                            <Store className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStatus(user)}
                            title={user.status === 'active' ? 'Desativar' : 'Ativar'}
                          >
                            {user.status === 'active' ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteUser(user)}
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* Store Assignment Dialog */}
      <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Lojas - {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione as lojas que este usuário terá acesso:
            </p>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {stores.map((store) => (
                <div key={store.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={store.id}
                    checked={selectedStores.includes(store.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedStores([...selectedStores, store.id]);
                      } else {
                        setSelectedStores(selectedStores.filter(id => id !== store.id));
                      }
                    }}
                  />
                  <label
                    htmlFor={store.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {store.name}
                  </label>
                </div>
              ))}
              {stores.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma loja cadastrada
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setStoreDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleStoreAssignment} disabled={saving}>
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
        </DialogContent>
      </Dialog>

      {/* Role Update Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Papel - {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as AppRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="socio">Sócio</SelectItem>
                  <SelectItem value="captador">Captador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRoleUpdate} disabled={saving}>
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
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <PermissionsDialog
        open={permissionsDialogOpen}
        onOpenChange={setPermissionsDialogOpen}
        userId={selectedUser?.id || null}
        userName={selectedUser?.name || ''}
        userRole={selectedUser?.role || 'financeiro'}
      />

      {/* Remap Orphaned Data Dialog */}
      <Dialog open={remapDialogOpen} onOpenChange={setRemapDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reatribuir Dados Órfãos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dados com user_id sem perfil cadastrado. Selecione o usuário correto para cada entrada.
            </p>
            {loadingOrphans ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : orphanedUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum dado órfão encontrado.
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto">
                {orphanedUsers.map((orphan) => (
                  <div key={orphan.user_id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[260px]">
                        {orphan.user_id}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {orphan.count} registro(s)
                      </span>
                    </div>
                    <Select
                      value={remapSelections[orphan.user_id] || ''}
                      onValueChange={(v) =>
                        setRemapSelections(prev => ({ ...prev, [orphan.user_id]: v }))
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Selecionar usuário..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setRemapDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleRemap}
                disabled={remapping || orphanedUsers.length === 0 || Object.values(remapSelections).every(v => !v)}
              >
                {remapping ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Reatribuindo...
                  </>
                ) : (
                  'Reatribuir'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
