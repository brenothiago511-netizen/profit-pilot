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
import { Plus, Users as UsersIcon, Loader2, Store, Shield, UserCheck, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { CsvImportDialog } from '@/components/users/CsvImportDialog';

type AppRole = 'admin' | 'financeiro' | 'gestor';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: string;
  created_at: string;
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

  useEffect(() => {
    fetchUsers();
    fetchStores();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setUsers(data || []);
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
    
    // Create user via auth.signUp with metadata
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          role: formData.role,
        },
      },
    });

    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Usuário criado com sucesso',
      });
      setDialogOpen(false);
      setFormData({ email: '', password: '', name: '', role: 'financeiro' });
      // Wait a moment for trigger to create profile
      setTimeout(fetchUsers, 1000);
    }
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

    setSaving(true);

    // Update profile role
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

    // Update user_roles table
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', selectedUser.id);

    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: selectedUser.id, role: selectedRole });

    if (roleError) {
      console.error('Error updating user_roles:', roleError);
    }

    toast({
      title: 'Sucesso',
      description: 'Papel atualizado com sucesso',
    });
    setRoleDialogOpen(false);
    setSaving(false);
    fetchUsers();
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'financeiro':
        return 'default';
      case 'gestor':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleName = (role: AppRole) => {
    const roles: Record<AppRole, string> = {
      admin: 'Administrador',
      financeiro: 'Financeiro',
      gestor: 'Gestor',
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <UsersIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum usuário cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Lojas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {getRoleName(user.role)}
                        </Badge>
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
    </div>
  );
}
