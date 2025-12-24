import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Store, 
  Loader2,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Calendar,
  FileText,
  Target,
  BarChart3
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts';

interface PartnerData {
  id: string;
  store_id: string;
  capital_amount: number;
  capital_percentage: number;
  status: string;
  store?: {
    id: string;
    name: string;
    currency: string;
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

interface StorePerformance {
  storeId: string;
  storeName: string;
  revenue: number;
  expenses: number;
  profit: number;
  partnerShare: number;
  percentage: number;
  goal: number;
  goalProgress: number;
}

interface MonthlyData {
  month: string;
  aportes: number;
  distribuicoes: number;
  capital: number;
  lucro: number;
  receita: number;
  despesa: number;
}

interface GoalData {
  storeId: string;
  storeName: string;
  goal: number;
  achieved: number;
  progress: number;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--info))',
  'hsl(142, 76%, 36%)',
  'hsl(221, 83%, 53%)',
];

export default function PartnerDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partnerships, setPartnerships] = useState<PartnerData[]>([]);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [storePerformance, setStorePerformance] = useState<StorePerformance[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('12');

  const filteredPerformance = selectedStore === 'all' 
    ? storePerformance 
    : storePerformance.filter(s => s.storeId === selectedStore);

  const totalCapital = partnerships.reduce((sum, p) => sum + (p.capital_amount || 0), 0);
  const totalDistributions = transactions
    .filter(t => t.type === 'distribuicao')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalAportes = transactions
    .filter(t => t.type === 'aporte')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalRetiradas = transactions
    .filter(t => t.type === 'retirada')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPartnerShare = filteredPerformance.reduce((sum, s) => sum + s.partnerShare, 0);
  const totalRevenue = filteredPerformance.reduce((sum, s) => sum + s.revenue, 0);
  const totalExpenses = filteredPerformance.reduce((sum, s) => sum + s.expenses, 0);
  const totalProfit = filteredPerformance.reduce((sum, s) => sum + s.profit, 0);
  const avgPercentage = partnerships.length > 0 
    ? partnerships.reduce((sum, p) => sum + (p.capital_percentage || 0), 0) / partnerships.length 
    : 0;

  useEffect(() => {
    if (user?.id) {
      fetchPartnerData();
    }
  }, [user?.id, selectedPeriod]);

  const fetchPartnerData = async () => {
    setLoading(true);
    try {
      const monthsBack = parseInt(selectedPeriod);
      const today = new Date();
      const periodStart = format(subMonths(today, monthsBack), 'yyyy-MM-dd');
      const periodEnd = format(today, 'yyyy-MM-dd');

      // Fetch partnerships
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active');

      if (partnerError) throw partnerError;

      if (!partnerData || partnerData.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch store details
      const storeIds = partnerData.map(p => p.store_id);
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name, currency')
        .in('id', storeIds);

      const storesMap = new Map((storesData || []).map(s => [s.id, s]));
      const partnershipsWithStores = partnerData.map(p => ({
        ...p,
        store: storesMap.get(p.store_id),
      }));

      setPartnerships(partnershipsWithStores);

      // Fetch transactions
      const partnerIds = partnerData.map(p => p.id);
      const { data: txData } = await supabase
        .from('partner_transactions')
        .select('*')
        .in('partner_id', partnerIds)
        .order('date', { ascending: false });

      setTransactions(txData || []);

      // Fetch goals
      const { data: goalsData } = await supabase
        .from('revenue_goals')
        .select('*')
        .in('store_id', storeIds)
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd);

      // Calculate store performance
      const performanceData: StorePerformance[] = [];
      const goalsResult: GoalData[] = [];

      for (const partnership of partnershipsWithStores) {
        // Fetch revenues
        const { data: revenues } = await supabase
          .from('revenues')
          .select('amount')
          .eq('store_id', partnership.store_id)
          .gte('date', periodStart)
          .lte('date', periodEnd);

        const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

        // Fetch expenses
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('store_id', partnership.store_id)
          .gte('date', periodStart)
          .lte('date', periodEnd);

        const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
        const profit = totalRevenue - totalExpenses;
        const partnerShare = profit * ((partnership.capital_percentage || 0) / 100);

        // Get goal for this store
        const storeGoals = goalsData?.filter(g => g.store_id === partnership.store_id) || [];
        const totalGoal = storeGoals.reduce((sum, g) => sum + Number(g.goal_amount_original), 0);
        const goalProgress = totalGoal > 0 ? (totalRevenue / totalGoal) * 100 : 0;

        performanceData.push({
          storeId: partnership.store_id,
          storeName: partnership.store?.name || 'N/A',
          revenue: totalRevenue,
          expenses: totalExpenses,
          profit,
          partnerShare,
          percentage: partnership.capital_percentage || 0,
          goal: totalGoal,
          goalProgress,
        });

        goalsResult.push({
          storeId: partnership.store_id,
          storeName: partnership.store?.name || 'N/A',
          goal: totalGoal,
          achieved: totalRevenue,
          progress: goalProgress,
        });
      }

      setStorePerformance(performanceData);
      setGoals(goalsResult);

      // Calculate monthly evolution
      const monthlyEvolution: MonthlyData[] = [];
      let runningCapital = totalCapital - totalAportes + totalRetiradas + totalDistributions;

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
        const monthLabel = format(monthDate, 'MMM', { locale: ptBR });

        const monthTransactions = (txData || []).filter(t => {
          return t.date >= monthStart && t.date <= monthEnd;
        });

        const aportes = monthTransactions
          .filter(t => t.type === 'aporte')
          .reduce((sum, t) => sum + t.amount, 0);

        const distribuicoes = monthTransactions
          .filter(t => t.type === 'distribuicao' || t.type === 'retirada')
          .reduce((sum, t) => sum + t.amount, 0);

        runningCapital += aportes - distribuicoes;

        // Fetch monthly revenue/expenses for all partner stores
        let monthRevenue = 0;
        let monthExpenses = 0;

        for (const partnership of partnershipsWithStores) {
          const { data: revs } = await supabase
            .from('revenues')
            .select('amount')
            .eq('store_id', partnership.store_id)
            .gte('date', monthStart)
            .lte('date', monthEnd);

          const { data: exps } = await supabase
            .from('expenses')
            .select('amount')
            .eq('store_id', partnership.store_id)
            .gte('date', monthStart)
            .lte('date', monthEnd);

          const storeRevenue = revs?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
          const storeExpenses = exps?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

          monthRevenue += storeRevenue * ((partnership.capital_percentage || 0) / 100);
          monthExpenses += storeExpenses * ((partnership.capital_percentage || 0) / 100);
        }

        monthlyEvolution.push({
          month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          aportes,
          distribuicoes,
          capital: Math.max(0, runningCapital),
          receita: monthRevenue,
          despesa: monthExpenses,
          lucro: monthRevenue - monthExpenses,
        });
      }

      setMonthlyData(monthlyEvolution);

    } catch (error) {
      console.error('Error fetching partner data:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'aporte': return <ArrowUpRight className="w-4 h-4 text-success" />;
      case 'distribuicao': return <ArrowDownRight className="w-4 h-4 text-primary" />;
      case 'retirada': return <ArrowDownRight className="w-4 h-4 text-warning" />;
      default: return <DollarSign className="w-4 h-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'aporte': return 'Aporte';
      case 'distribuicao': return 'Distribuição';
      case 'retirada': return 'Retirada';
      default: return type;
    }
  };

  const pieData = partnerships.map((p, i) => ({
    name: p.store?.name || 'Loja',
    value: p.capital_amount || 0,
    percentage: p.capital_percentage || 0,
  }));

  const recentTransactions = transactions.slice(0, 8);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (partnerships.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Meu Painel de Sócio</h1>
          <p className="page-description">
            Acompanhe seus investimentos e resultados
          </p>
        </div>
        <Card className="text-center py-12">
          <CardContent>
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma participação encontrada</h3>
            <p className="text-muted-foreground">
              Você ainda não está vinculado como sócio em nenhuma loja.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Meu Painel de Sócio</h1>
          <p className="page-description">
            Acompanhe seus investimentos, participações e resultados
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-48">
              <Store className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Todas as lojas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {partnerships.map((p) => (
                <SelectItem key={p.store_id} value={p.store_id}>
                  {p.store?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="metric-card-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Capital Total
            </CardTitle>
            <Wallet className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCapital)}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {partnerships.length} {partnerships.length === 1 ? 'loja' : 'lojas'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Média {avgPercentage.toFixed(1)}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card-success">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sua Parte do Lucro
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPartnerShare >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(totalPartnerShare)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              nos últimos {selectedPeriod} meses
            </p>
          </CardContent>
        </Card>

        <Card className="metric-card-info">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribuições Recebidas
            </CardTitle>
            <PiggyBank className="h-5 w-5 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDistributions)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              total histórico
            </p>
          </CardContent>
        </Card>

        <Card className="metric-card-warning">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Aportes
            </CardTitle>
            <ArrowUpRight className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAportes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              total investido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita (Sua Parte)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-success">{formatCurrency(totalRevenue * (avgPercentage / 100))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Despesas (Sua Parte)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-destructive">{formatCurrency(totalExpenses * (avgPercentage / 100))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Retiradas
            </CardTitle>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(totalRetiradas)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="stores" className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            Por Loja
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Capital & Profit Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evolução Mensal</CardTitle>
                <CardDescription>Capital e lucro nos últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCapitalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <YAxis 
                        yAxisId="left"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="capital"
                        name="Capital"
                        stroke="hsl(var(--primary))"
                        fillOpacity={1}
                        fill="url(#colorCapitalGrad)"
                        strokeWidth={2}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="lucro"
                        name="Lucro (sua parte)"
                        fill="hsl(var(--success))"
                        radius={[4, 4, 0, 0]}
                        opacity={0.8}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Distribution by Store */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribuição por Loja</CardTitle>
                <CardDescription>Participação no capital</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percentage }) => `${name} (${percentage}%)`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [formatCurrency(value), 'Capital']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aportes vs Distributions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aportes vs Distribuições</CardTitle>
              <CardDescription>Movimentações mensais</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Legend />
                    <Bar dataKey="aportes" name="Aportes" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="distribuicoes" name="Distribuições" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="space-y-4">
          {filteredPerformance.map((store) => (
            <Card key={store.storeId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{store.storeName}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                          <Percent className="w-3 h-3 mr-1" />
                          {store.percentage}% participação
                        </Badge>
                        {store.goalProgress > 0 && (
                          <Badge variant={store.goalProgress >= 100 ? 'default' : 'secondary'}>
                            <Target className="w-3 h-3 mr-1" />
                            {store.goalProgress.toFixed(0)}% da meta
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Sua parte do lucro</p>
                    <p className={`text-2xl font-bold ${store.partnerShare >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(store.partnerShare)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Receita Total</p>
                    <p className="font-semibold text-success">{formatCurrency(store.revenue)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Despesas Total</p>
                    <p className="font-semibold text-destructive">{formatCurrency(store.expenses)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Lucro Total</p>
                    <p className={`font-semibold ${store.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(store.profit)}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-primary/10">
                    <p className="text-xs text-muted-foreground mb-1">Sua Receita</p>
                    <p className="font-semibold text-primary">
                      {formatCurrency(store.revenue * (store.percentage / 100))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          {goals.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Nenhuma meta encontrada</h3>
                <p className="text-muted-foreground">
                  Não há metas definidas para o período selecionado.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <Card key={goal.storeId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Target className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{goal.storeName}</CardTitle>
                          <p className="text-sm text-muted-foreground">Meta de receita</p>
                        </div>
                      </div>
                      <Badge variant={goal.progress >= 100 ? 'default' : goal.progress >= 75 ? 'secondary' : 'outline'}>
                        {goal.progress >= 100 ? 'Atingida!' : `${goal.progress.toFixed(1)}%`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Alcançado: {formatCurrency(goal.achieved)}</span>
                        <span>Meta: {formatCurrency(goal.goal)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            goal.progress >= 100 ? 'bg-success' : goal.progress >= 75 ? 'bg-primary' : 'bg-warning'
                          }`}
                          style={{ width: `${Math.min(goal.progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Movimentações Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((tx) => {
                    const partnership = partnerships.find(p => p.id === tx.partner_id);
                    return (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            tx.type === 'aporte' ? 'bg-success/10' : 
                            tx.type === 'distribuicao' ? 'bg-primary/10' : 'bg-warning/10'
                          }`}>
                            {getTransactionIcon(tx.type)}
                          </div>
                          <div>
                            <p className="font-medium">{getTransactionLabel(tx.type)}</p>
                            <p className="text-sm text-muted-foreground">
                              {partnership?.store?.name} • {format(parseISO(tx.date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                            </p>
                            {tx.description && (
                              <p className="text-xs text-muted-foreground mt-1">{tx.description}</p>
                            )}
                          </div>
                        </div>
                        <div className={`text-lg font-bold ${
                          tx.type === 'aporte' ? 'text-success' : 'text-foreground'
                        }`}>
                          {tx.type === 'aporte' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
