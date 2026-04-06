import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Percent, UserCheck, UserX, Edit2, Store } from 'lucide-react';

interface CaptadorProfile {
  id: string;
  name: string;
  email: string;
  status: string;
  commission_rate: number | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function Captadores() {
  const { toast } = useToast();
  const [captadores, setCaptadores] = useState<CaptadorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPending, setTotalPending] = useState(0);
  const [totalToReceive, setTotalToReceive] = useState(0);

  // Edit commission dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCaptador, setSelectedCaptador] = useState<CaptadorProfile | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Store assignment dialog
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [storeCaptador, setStoreCaptador] = useState<CaptadorProfile | null>(null);
  const [allStores, setAllStores] = useState<{ id: string; name: string }[]>([]);
  const [assignedStoreIds, setAssignedStoreIds] = useState<string[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [savingStores, setSavingStores] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch captador profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, status')
      .eq('role', 'captador' as any)
      .order('name');

    // Fetch all commission rates
    const { data: commissions } = await (supabase as any)
      .from('captador_commissions')
      .select('user_id, commission_rate');

    const commissionMap: Record<string, number> = {};
    (commissions || []).forEach((c: any) => {
      commissionMap[c.user_id] = c.commission_rate;
    });

    const captadorList: CaptadorProfile[] = (profiles || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      status: p.status,
      commission_rate: commissionMap[p.id] ?? null,
    }));
    setCaptadores(captadorList);

    // Fetch daily_records from captação stores to compute totals
    await fetchCommissionTotals(captadorList, commissionMap);

    setLoading(false);
  };

  const fetchCommissionTotals = async (
    captadorList: CaptadorProfile[],
    commissionMap: Record<string, number>
  ) => {
    // Fetch all stores with captação in the name
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name');

    const captacaoStoreIds = (stores || [])
      .filter((s: any) => {
        const name: string = s.name || '';
        return name.toLowerCase().includes('captação') || name.toLowerCase().includes('captacao');
      })
      .map((s: any) => s.id);

    if (captacaoStoreIds.length === 0) {
      setTotalPending(0);
      setTotalToReceive(0);
      return;
    }

    const { data: records } = await supabase
      .from('daily_records')
      .select('daily_profit, shopify_status')
      .in('store_id', captacaoStoreIds);

    // Sum across all captadores (each captador has their own rate)
    // For the summary cards: aggregate across all captadores using average or per-captador
    // We'll compute global totals by summing each captador's share
    let pending = 0;
    let toReceive = 0;

    captadorList.forEach((c) => {
      const rate = commissionMap[c.id] ?? 0;
      (records || []).forEach((r: any) => {
        const profit = r.daily_profit ?? 0;
        if (r.shopify_status === 'pending') {
          pending += profit * rate;
        } else if (r.shopify_status === 'confirmed' || r.shopify_status === 'received') {
          toReceive += profit * rate;
        }
      });
    });

    setTotalPending(pending);
    setTotalToReceive(toReceive);
  };

  const toggleStatus = async (captador: CaptadorProfile) => {
    const newStatus = captador.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', captador.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atualizado', description: `Captador ${newStatus === 'active' ? 'ativado' : 'desativado'}` });
      fetchData();
    }
  };

  const openStoreDialog = async (captador: CaptadorProfile) => {
    setStoreCaptador(captador);
    setStoreDialogOpen(true);
    setLoadingStores(true);

    const [storesRes, assignedRes] = await Promise.all([
      supabase.from('stores').select('id, name').eq('status', 'active').order('name'),
      supabase.from('user_stores').select('store_id').eq('user_id', captador.id),
    ]);

    setAllStores((storesRes.data as any[]) ?? []);
    setAssignedStoreIds((assignedRes.data as any[] ?? []).map((r: any) => r.store_id));
    setLoadingStores(false);
  };

  const toggleStoreAssignment = (storeId: string) => {
    setAssignedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId],
    );
  };

  const handleSaveStores = async () => {
    if (!storeCaptador) return;
    setSavingStores(true);

    // Delete existing assignments
    await supabase.from('user_stores').delete().eq('user_id', storeCaptador.id);

    // Insert new assignments
    if (assignedStoreIds.length > 0) {
      const { error } = await supabase
        .from('user_stores')
        .insert(assignedStoreIds.map((store_id) => ({ user_id: storeCaptador.id, store_id })));

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        setSavingStores(false);
        return;
      }
    }

    toast({ title: 'Sucesso', description: 'Lojas atribuídas com sucesso.' });
    setSavingStores(false);
    setStoreDialogOpen(false);
  };

  const openEditDialog = (captador: CaptadorProfile) => {
    setSelectedCaptador(captador);
    setRateInput(
      captador.commission_rate !== null
        ? (captador.commission_rate * 100).toFixed(2)
        : ''
    );
    setEditDialogOpen(true);
  };

  const handleSaveRate = async () => {
    if (!selectedCaptador) return;

    const ratePercent = parseFloat(rateInput);
    if (isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      toast({ title: 'Erro', description: 'Informe uma taxa entre 0 e 100.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const rateDecimal = ratePercent / 100;

    const { error } = await (supabase as any)
      .from('captador_commissions')
      .upsert(
        { user_id: selectedCaptador.id, commission_rate: rateDecimal, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    setSaving(false);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Taxa de comissão atualizada.' });
      setEditDialogOpen(false);
      fetchData();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Captadores</h1>
        <p className="page-description">Gerencie captadores e suas taxas de comissão</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="w-4 h-4" /> Total de Captadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{captadores.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {captadores.filter(c => c.status === 'active').length} ativo(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Comissões Aguardando
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{fmt(totalPending)}</p>
            <p className="text-xs text-muted-foreground mt-1">Lojas com captação — status pendente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Comissões a Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">{fmt(totalToReceive)}</p>
            <p className="text-xs text-muted-foreground mt-1">Lojas com captação — confirmados</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de Captadores</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : captadores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhum captador cadastrado. Crie um usuário com papel "Captador" em Usuários.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Taxa de Comissão (%)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {captadores.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell className="text-right">
                        {c.commission_rate !== null
                          ? `${(c.commission_rate * 100).toFixed(2)}%`
                          : <span className="text-muted-foreground text-sm">Não configurada</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                          {c.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStoreDialog(c)}
                            title="Atribuir lojas"
                          >
                            <Store className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(c)}
                            title="Editar taxa de comissão"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStatus(c)}
                            title={c.status === 'active' ? 'Desativar' : 'Ativar'}
                          >
                            {c.status === 'active' ? (
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
            <DialogTitle>Lojas — {storeCaptador?.name}</DialogTitle>
          </DialogHeader>
          {loadingStores ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-64 overflow-y-auto space-y-2">
                {allStores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma loja cadastrada</p>
                ) : (
                  allStores.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={assignedStoreIds.includes(s.id)}
                        onCheckedChange={() => toggleStoreAssignment(s.id)}
                      />
                      <span className="text-sm">{s.name}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {assignedStoreIds.length} loja{assignedStoreIds.length !== 1 ? 's' : ''} selecionada{assignedStoreIds.length !== 1 ? 's' : ''}
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setStoreDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveStores} disabled={savingStores}>
                  {savingStores ? (
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

      {/* Edit Commission Rate Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Taxa de Comissão — {selectedCaptador?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Taxa (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Ex: 5.00"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Informe o valor em porcentagem (ex: 5 = 5%). Será armazenado como 0.05.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveRate} disabled={saving}>
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
