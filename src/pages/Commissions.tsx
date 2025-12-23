import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Percent, Loader2, Calculator, Check, Store } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  managers: { profiles: { name: string } | null; commission_type: string } | null;
  stores: { name: string } | null;
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
  profiles: { name: string } | null;
}

export default function Commissions() {
  const { isAdmin, isGestor } = useAuth();
  const { toast } = useToast();
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

  useEffect(() => {
    fetchCommissions();
    if (isAdmin) {
      fetchStores();
      fetchManagers();
    }
  }, [isAdmin]);

  const fetchCommissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('commissions')
      .select('*, managers(profiles(name), commission_type), stores(name)')
      .order('period_start', { ascending: false });
    
    if (error) {
      console.error('Error fetching commissions:', error);
    } else {
      setCommissions(data || []);
    }
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
    const { data } = await supabase
      .from('managers')
      .select('id, user_id, commission_percent, commission_type, profiles(name)')
      .eq('status', 'active');
    if (data) setManagers(data);
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

        {isAdmin && (
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
                          {manager.profiles?.name} ({manager.commission_percent}% - {manager.commission_type})
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
        )}
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
                    {isAdmin && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((commission) => (
                    <tr key={commission.id}>
                      <td>
                        {format(new Date(commission.period_start), 'MMM yyyy', { locale: ptBR })}
                      </td>
                      <td>{commission.managers?.profiles?.name || '-'}</td>
                      <td>{commission.stores?.name || '-'}</td>
                      <td className="capitalize">
                        {commission.managers?.commission_type === 'lucro' ? 'Lucro' : 'Faturamento'}
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
                      {isAdmin && (
                        <td>
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
    </div>
  );
}
