import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Calendar,
  CalendarIcon,
  CheckCircle2,
  Clock,
  DollarSign,
  Percent,
  Store,
  User,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface PartnershipInfo {
  id: string;
  user_id: string;
  store_id: string;
  capital_percentage: number;
  store_name: string;
  store_status: string;
  partner_status: string;
}

interface PartnerProfile {
  user_id: string;
  user_name: string;
}

interface PartnerSummary {
  userId: string;
  userName: string;
  totalRevenues: number;
  totalExpenses: number;
  totalProfitRegistered: number;
  totalProfitConfirmed: number;
  totalProfitPending: number;
  partnerPercentage: number;
  amountToPay: number;
  amountPending: number;
  storeBreakdown: StoreBreakdown[];
}

interface StoreBreakdown {
  storeId: string;
  storeName: string;
  storeStatus: string;
  partnerStatus: string;
  revenues: number;
  expenses: number;
  profitRegistered: number;
  profitConfirmed: number;
  profitPending: number;
  percentage: number;
  amountToPay: number;
}

interface MonthlyTrend {
  month: string;
  receitas: number;
  despesas: number;
  lucroRegistrado: number;
  lucroConfirmado: number;
}

const PARTNER_PERCENTAGE = 30;

export default function PartnerDashboardPage() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allPartners, setAllPartners] = useState<PartnerProfile[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [summaries, setSummaries] = useState<PartnerSummary[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);

  const periodDates = useMemo(() => {
    if (useCustomDates) {
      return {
        start: format(dateRange.from, 'yyyy-MM-dd'),
        end: format(dateRange.to, 'yyyy-MM-dd'),
      };
    }
    const today = new Date();
    if (selectedPeriod === 'current') {
      return {
        start: format(startOfMonth(today), 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd'),
      };
    }
    const monthsBack = parseInt(selectedPeriod);
    return {
      start: format(subMonths(today, monthsBack), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    };
  }, [useCustomDates, dateRange, selectedPeriod]);

  useEffect(() => {
    fetchAllPartners();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedPartner, periodDates]);

  const fetchAllPartners = async () => {
    try {
      const { data: partnersData } = await supabase
        .from('partners')
        .select('id, user_id');

      if (partnersData && partnersData.length > 0) {
        const uniqueUserIds = [...new Set(partnersData.map(p => p.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', uniqueUserIds);

        const profilesMap = new Map((profilesData || []).map(p => [p.id, p.name]));
        setAllPartners(uniqueUserIds.map(uid => ({
          user_id: uid,
          user_name: profilesMap.get(uid) || 'Sócio',
        })));
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get partnerships
      let partnerQuery = supabase
        .from('partners')
        .select('id, user_id, store_id, capital_percentage, status');

      if (selectedPartner !== 'all') {
        partnerQuery = partnerQuery.eq('user_id', selectedPartner);
      } else if (!isAdmin) {
        partnerQuery = partnerQuery.eq('user_id', user!.id);
      }

      const { data: partnersData } = await partnerQuery;
      if (!partnersData || partnersData.length === 0) {
        setSummaries([]);
        setMonthlyTrend([]);
        setLoading(false);
        return;
      }

      // 2. Get store names
      const storeIds = [...new Set(partnersData.map(p => p.store_id).filter(Boolean))];
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name, status')
        .in('id', storeIds);
      const storesMap = new Map((storesData || []).map(s => [s.id, { name: s.name, status: s.status }]));

      // 3. Get user names
      const userIds = [...new Set(partnersData.map(p => p.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p.name]));

      // 4. Build partnerships with info
      const partnerships: PartnershipInfo[] = partnersData.map(p => ({
        id: p.id,
        user_id: p.user_id,
        store_id: p.store_id,
        capital_percentage: p.capital_percentage,
        store_name: storesMap.get(p.store_id) || 'N/A',
      }));

      // 5. Group by user
      const userPartnerships = new Map<string, PartnershipInfo[]>();
      partnerships.forEach(p => {
        const list = userPartnerships.get(p.user_id) || [];
        list.push(p);
        userPartnerships.set(p.user_id, list);
      });

      // 6. Fetch data per user
      const results: PartnerSummary[] = [];

      for (const [userId, userParts] of userPartnerships) {
        const userStoreIds = userParts.map(p => p.store_id).filter(Boolean);
        const userName = profilesMap.get(userId) || 'Sócio';

        // Revenues registered by this user in the period
        let revQuery = supabase
          .from('revenues')
          .select('amount, store_id')
          .eq('user_id', userId)
          .gte('date', periodDates.start)
          .lte('date', periodDates.end);
        if (userStoreIds.length > 0) {
          revQuery = revQuery.in('store_id', userStoreIds);
        }
        const { data: revenues } = await revQuery;

        // Expenses registered by this user in the period
        let expQuery = supabase
          .from('expenses')
          .select('amount, store_id')
          .eq('user_id', userId)
          .gte('date', periodDates.start)
          .lte('date', periodDates.end);
        if (userStoreIds.length > 0) {
          expQuery = expQuery.in('store_id', userStoreIds);
        }
        const { data: expenses } = await expQuery;

        // Daily records (profit) registered by this user
        let profitQuery = supabase
          .from('daily_records')
          .select('daily_profit, store_id, shopify_status')
          .eq('created_by', userId)
          .gte('date', periodDates.start)
          .lte('date', periodDates.end);
        if (userStoreIds.length > 0) {
          profitQuery = profitQuery.in('store_id', userStoreIds);
        }
        const { data: dailyRecords } = await profitQuery;

        // Build store breakdown
        const storeBreakdown: StoreBreakdown[] = userParts.map(p => {
          const storeRevenues = (revenues || [])
            .filter(r => r.store_id === p.store_id)
            .reduce((sum, r) => sum + Number(r.amount), 0);
          const storeExpenses = (expenses || [])
            .filter(e => e.store_id === p.store_id)
            .reduce((sum, e) => sum + Number(e.amount), 0);
          const storeRecords = (dailyRecords || []).filter(d => d.store_id === p.store_id);
          const profitRegistered = storeRecords.reduce((sum, d) => sum + Number(d.daily_profit), 0);
          const profitConfirmed = storeRecords
            .filter(d => d.shopify_status === 'received')
            .reduce((sum, d) => sum + Number(d.daily_profit), 0);
          const profitPending = storeRecords
            .filter(d => d.shopify_status !== 'received')
            .reduce((sum, d) => sum + Number(d.daily_profit), 0);

          return {
            storeId: p.store_id,
            storeName: p.store_name,
            revenues: storeRevenues,
            expenses: storeExpenses,
            profitRegistered,
            profitConfirmed,
            profitPending,
            percentage: PARTNER_PERCENTAGE,
            amountToPay: profitConfirmed * (PARTNER_PERCENTAGE / 100),
          };
        });

        const totalRevenues = storeBreakdown.reduce((s, b) => s + b.revenues, 0);
        const totalExpenses = storeBreakdown.reduce((s, b) => s + b.expenses, 0);
        const totalProfitRegistered = storeBreakdown.reduce((s, b) => s + b.profitRegistered, 0);
        const totalProfitConfirmed = storeBreakdown.reduce((s, b) => s + b.profitConfirmed, 0);
        const totalProfitPending = storeBreakdown.reduce((s, b) => s + b.profitPending, 0);
        const amountToPay = storeBreakdown.reduce((s, b) => s + b.amountToPay, 0);
        const amountPending = totalProfitPending * (PARTNER_PERCENTAGE / 100);

        results.push({
          userId,
          userName,
          totalRevenues,
          totalExpenses,
          totalProfitRegistered,
          totalProfitConfirmed,
          totalProfitPending,
          partnerPercentage: PARTNER_PERCENTAGE,
          amountToPay,
          amountPending,
          storeBreakdown,
        });
      }

      setSummaries(results);

      // 7. Monthly trend (last 6 months)
      const today = new Date();
      const trends: MonthlyTrend[] = [];
      const allUserIds = [...userPartnerships.keys()];
      const allStoreIds = storeIds;

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const mStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const mEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
        const label = format(monthDate, 'MMM', { locale: ptBR });

        let revQ = supabase.from('revenues').select('amount').gte('date', mStart).lte('date', mEnd);
        let expQ = supabase.from('expenses').select('amount').gte('date', mStart).lte('date', mEnd);
        let drQ = supabase.from('daily_records').select('daily_profit, shopify_status').gte('date', mStart).lte('date', mEnd);

        if (selectedPartner !== 'all') {
          revQ = revQ.eq('user_id', selectedPartner);
          expQ = expQ.eq('user_id', selectedPartner);
          drQ = drQ.eq('created_by', selectedPartner);
        } else if (!isAdmin) {
          revQ = revQ.eq('user_id', user!.id);
          expQ = expQ.eq('user_id', user!.id);
          drQ = drQ.eq('created_by', user!.id);
        }

        if (allStoreIds.length > 0) {
          revQ = revQ.in('store_id', allStoreIds);
          expQ = expQ.in('store_id', allStoreIds);
          drQ = drQ.in('store_id', allStoreIds);
        }

        const [{ data: revs }, { data: exps }, { data: drs }] = await Promise.all([revQ, expQ, drQ]);

        trends.push({
          month: label.charAt(0).toUpperCase() + label.slice(1),
          receitas: (revs || []).reduce((s, r) => s + Number(r.amount), 0),
          despesas: (exps || []).reduce((s, e) => s + Number(e.amount), 0),
          lucroRegistrado: (drs || []).reduce((s, d) => s + Number(d.daily_profit), 0),
          lucroConfirmado: (drs || []).filter(d => d.shopify_status === 'received').reduce((s, d) => s + Number(d.daily_profit), 0),
        });
      }

      setMonthlyTrend(trends);
    } catch (error) {
      console.error('Error fetching partner data:', error);
    }
    setLoading(false);
  };

  const fmt = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Aggregated totals
  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        revenues: acc.revenues + s.totalRevenues,
        expenses: acc.expenses + s.totalExpenses,
        profitRegistered: acc.profitRegistered + s.totalProfitRegistered,
        profitConfirmed: acc.profitConfirmed + s.totalProfitConfirmed,
        profitPending: acc.profitPending + s.totalProfitPending,
        amountToPay: acc.amountToPay + s.amountToPay,
        amountPending: acc.amountPending + s.amountPending,
      }),
      { revenues: 0, expenses: 0, profitRegistered: 0, profitConfirmed: 0, profitPending: 0, amountToPay: 0, amountPending: 0 }
    );
  }, [summaries]);

  const confirmationRate = totals.profitRegistered > 0 
    ? (totals.profitConfirmed / totals.profitRegistered) * 100 
    : 0;

  const periodLabel = useCustomDates
    ? `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}`
    : selectedPeriod === 'current'
      ? 'Mês atual'
      : `Últimos ${selectedPeriod} ${selectedPeriod === '1' ? 'mês' : 'meses'}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Painel de Sócios</h1>
          <p className="page-description">
            Resumo financeiro por sócio — {periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && allPartners.length > 0 && (
            <Select value={selectedPartner} onValueChange={setSelectedPartner}>
              <SelectTrigger className="w-48">
                <User className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Todos os sócios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sócios</SelectItem>
                {allPartners.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.user_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2">
            <Button variant={useCustomDates ? "outline" : "default"} size="sm" onClick={() => setUseCustomDates(false)}>Período</Button>
            <Button variant={useCustomDates ? "default" : "outline"} size="sm" onClick={() => setUseCustomDates(true)}>Datas</Button>
          </div>
          {!useCustomDates ? (
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-44">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mês atual</SelectItem>
                <SelectItem value="1">Último mês</SelectItem>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-32 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, "dd/MM/yy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dateRange.from} onSelect={(d) => d && setDateRange(prev => ({ ...prev, from: d }))} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-32 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dateRange.to} onSelect={(d) => d && setDateRange(prev => ({ ...prev, to: d }))} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {summaries.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma participação encontrada</h3>
            <p className="text-muted-foreground">Nenhum sócio vinculado a lojas ativas no período selecionado.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Entradas Registradas</CardTitle>
                <ArrowUpRight className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(totals.revenues)}</div>
                <p className="text-xs text-muted-foreground mt-1">receitas cadastradas no período</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-destructive">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Saídas Registradas</CardTitle>
                <ArrowDownRight className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(totals.expenses)}</div>
                <p className="text-xs text-muted-foreground mt-1">despesas cadastradas no período</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-warning">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Lucro Registrado</CardTitle>
                <BarChart3 className="h-5 w-5 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(totals.profitRegistered)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                  <span className="text-xs text-success">{fmt(totals.profitConfirmed)} confirmado</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{fmt(totals.profitPending)} pendente</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-success bg-success/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar ao Sócio ({PARTNER_PERCENTAGE}%)</CardTitle>
                <Wallet className="h-5 w-5 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{fmt(totals.amountToPay)}</div>
                <p className="text-xs text-muted-foreground mt-1">sobre lucro confirmado</p>
                {totals.amountPending > 0 && (
                  <Badge variant="outline" className="mt-2 bg-warning/10 text-warning border-warning/30 text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {fmt(totals.amountPending)} pendente confirmação
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Confirmation Progress */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Taxa de Confirmação do Lucro</CardTitle>
                <span className="text-sm font-semibold text-muted-foreground">{confirmationRate.toFixed(1)}%</span>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={Math.min(confirmationRate, 100)} className="h-3" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Confirmado: {fmt(totals.profitConfirmed)}</span>
                <span>Total Registrado: {fmt(totals.profitRegistered)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução Mensal</CardTitle>
              <CardDescription>Receitas, despesas e lucro nos últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => [fmt(value), name]}
                    />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.7} />
                    <Bar dataKey="lucroConfirmado" name="Lucro Confirmado" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lucroRegistrado" name="Lucro Registrado" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Per-User Breakdown */}
          {summaries.map((summary) => (
            <Card key={summary.userId}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{summary.userName}</CardTitle>
                      <CardDescription>
                        {summary.storeBreakdown.length} {summary.storeBreakdown.length === 1 ? 'loja' : 'lojas'} vinculada{summary.storeBreakdown.length > 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">A pagar</p>
                      <p className="text-xl font-bold text-success">{fmt(summary.amountToPay)}</p>
                    </div>
                    {summary.amountPending > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Pendente</p>
                        <p className="text-xl font-bold text-warning">{fmt(summary.amountPending)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Summary metrics row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Entradas</p>
                    <p className="text-lg font-semibold">{fmt(summary.totalRevenues)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Saídas</p>
                    <p className="text-lg font-semibold">{fmt(summary.totalExpenses)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-success" /> Lucro Confirmado</p>
                    <p className="text-lg font-semibold text-success">{fmt(summary.totalProfitConfirmed)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3 text-warning" /> Lucro Pendente</p>
                    <p className="text-lg font-semibold text-warning">{fmt(summary.totalProfitPending)}</p>
                  </div>
                </div>

                {/* Store breakdown table */}
                {summary.storeBreakdown.length > 0 && (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loja</TableHead>
                          <TableHead className="text-right">Entradas</TableHead>
                          <TableHead className="text-right">Saídas</TableHead>
                          <TableHead className="text-right">Lucro Registrado</TableHead>
                          <TableHead className="text-right">Lucro Confirmado</TableHead>
                          <TableHead className="text-right">A Pagar ({PARTNER_PERCENTAGE}%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.storeBreakdown.map((store) => (
                          <TableRow key={store.storeId}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Store className="w-4 h-4 text-muted-foreground" />
                                {store.storeName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{fmt(store.revenues)}</TableCell>
                            <TableCell className="text-right">{fmt(store.expenses)}</TableCell>
                            <TableCell className="text-right">{fmt(store.profitRegistered)}</TableCell>
                            <TableCell className="text-right">
                              <span className="text-success">{fmt(store.profitConfirmed)}</span>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-success">
                              {fmt(store.amountToPay)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
