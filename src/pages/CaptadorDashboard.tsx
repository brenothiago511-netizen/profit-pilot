import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Zap, TrendingDown, TrendingUp, CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DailyRecord {
  id: string;
  date: string;
  daily_profit: number;
  shopify_status: string;
  store_name: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function CaptadorDashboard() {
  const { user, profile } = useAuth();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [commissionRate, setCommissionRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));

  useEffect(() => {
    if (user?.id) {
      fetchCommissionRate();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && commissionRate !== null) {
      fetchRecords();
    }
  }, [user?.id, commissionRate, dateFrom, dateTo]);

  const fetchCommissionRate = async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any)
      .from('captador_commissions')
      .select('commission_rate')
      .eq('user_id', user.id)
      .maybeSingle();
    setCommissionRate(data?.commission_rate ?? null);
  };

  const fetchRecords = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('daily_records')
      .select('id, date, daily_profit, shopify_status, stores:store_id(name)')
      .gte('date', format(dateFrom, 'yyyy-MM-dd'))
      .lte('date', format(dateTo, 'yyyy-MM-dd'))
      .order('date', { ascending: false });

    if (!error && data) {
      // Filter to only captação stores (case-insensitive)
      const captacaoRecords = (data as any[])
        .filter((r) => {
          const name: string = r.stores?.name || '';
          return name.toLowerCase().includes('captação') || name.toLowerCase().includes('captacao');
        })
        .map((r) => ({
          id: r.id,
          date: r.date,
          daily_profit: r.daily_profit,
          shopify_status: r.shopify_status || 'pending',
          store_name: r.stores?.name || '-',
        }));
      setRecords(captacaoRecords);
    }
    setLoading(false);
  };

  const rate = commissionRate ?? 0;

  const pending   = records.filter(r => r.shopify_status === 'pending');
  const confirmed = records.filter(r => r.shopify_status === 'confirmed' || r.shopify_status === 'received');
  const lost      = records.filter(r => r.daily_profit < 0);

  const totalPending   = pending.reduce((s, r) => s + r.daily_profit, 0) * rate;
  const totalConfirmed = confirmed.reduce((s, r) => s + r.daily_profit, 0) * rate;
  const totalLost      = lost.reduce((s, r) => s + r.daily_profit, 0) * rate;
  const totalAll       = records.reduce((s, r) => s + r.daily_profit, 0) * rate;

  if (commissionRate === null && !loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Olá, {profile?.name?.split(' ')[0]}</h1>
          <p className="text-muted-foreground text-sm mt-1">Dashboard do Captador</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Comissão não configurada. Contate o administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + date filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Olá, {profile?.name?.split(' ')[0]}</h1>
          <p className="text-muted-foreground text-sm mt-1">Resumo das suas comissões de captação</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateFrom, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground">até</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateTo, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Aguardando
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{fmt(totalPending)}</p>
            <p className="text-xs text-muted-foreground mt-1">{pending.length} registro(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" /> A Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">{fmt(totalConfirmed)}</p>
            <p className="text-xs text-muted-foreground mt-1">{confirmed.length} registro(s) confirmado(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" /> Perdidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{fmt(totalLost)}</p>
            <p className="text-xs text-muted-foreground mt-1">{lost.length} dia(s) negativo(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Total no Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">{fmt(totalAll)}</p>
            <p className="text-xs text-muted-foreground mt-1">{records.length} registro(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros do Período</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Loja</th>
                    <th className="text-right">Lucro da Loja</th>
                    <th className="text-right">Sua Comissão (%)</th>
                    <th className="text-right">Sua Comissão (R$)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td>{format(new Date(r.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</td>
                      <td>{r.store_name}</td>
                      <td className="text-right font-medium">{fmt(r.daily_profit)}</td>
                      <td className="text-right">{(rate * 100).toFixed(2)}%</td>
                      <td className="text-right font-medium">{fmt(r.daily_profit * rate)}</td>
                      <td>
                        {r.shopify_status === 'confirmed' || r.shopify_status === 'received' ? (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            <Zap className="w-3 h-3 mr-1" /> A Receber
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                            <Clock className="w-3 h-3 mr-1" /> Aguardando
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Taxa de comissão: {commissionRate !== null ? `${(commissionRate * 100).toFixed(2)}%` : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
