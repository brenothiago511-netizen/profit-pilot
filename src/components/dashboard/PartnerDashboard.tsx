import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Building2
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
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
}

interface MonthlyData {
  month: string;
  aportes: number;
  distribuicoes: number;
  capital: number;
}

interface DailyRecord {
  id: string;
  daily_profit: number;
  status: string;
  shopify_status: string | null;
  date: string;
  store_id: string;
}

export default function PartnerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partnerships, setPartnerships] = useState<PartnerData[]>([]);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [storePerformance, setStorePerformance] = useState<StorePerformance[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);

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
  
  // Calculate partner's share from daily_records (30% fixed) - only when Shopify confirmed received
  const PARTNER_PERCENTAGE = 30;
  const totalPartnerShare = dailyRecords
    .filter(r => r.shopify_status === 'received')
    .reduce((sum, r) => sum + ((r.daily_profit || 0) * (PARTNER_PERCENTAGE / 100)), 0);

  // Count pending Shopify confirmations
  const pendingShopifyCount = dailyRecords.filter(r => r.shopify_status !== 'received' && r.status === 'approved').length;
  const pendingShopifyAmount = dailyRecords
    .filter(r => r.shopify_status !== 'received' && r.status === 'approved')
    .reduce((sum, r) => sum + ((r.daily_profit || 0) * (PARTNER_PERCENTAGE / 100)), 0);
  
  // Average percentage for display purposes
  const avgPercentage = partnerships.length > 0 
    ? partnerships.reduce((sum, p) => sum + (p.capital_percentage || 0), 0) / partnerships.length 
    : 0;

  useEffect(() => {
    if (user?.id) {
      fetchPartnerData();
    }
  }, [user?.id]);

  const fetchPartnerData = async () => {
    setLoading(true);
    try {
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

      // Fetch store names
      const storeIds = partnerData.map(p => p.store_id).filter(Boolean);
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name')
        .in('id', storeIds);

      const storesMap = new Map((storesData || []).map(s => [s.id, s]));
      const partnershipsWithStores = partnerData.map(p => ({
        ...p,
        store: storesMap.get(p.store_id),
      }));

      setPartnerships(partnershipsWithStores);

      // Fetch transactions for all partnerships
      const partnerIds = partnerData.map(p => p.id);
      const { data: txData } = await supabase
        .from('partner_transactions')
        .select('*')
        .in('partner_id', partnerIds)
        .order('date', { ascending: false });

      setTransactions(txData || []);

      // Fetch daily records for partner's stores to calculate commission share
      if (storeIds.length > 0) {
        const { data: recordsData } = await supabase
          .from('daily_records')
          .select('id, daily_profit, status, shopify_status, date, store_id')
          .in('store_id', storeIds)
          .order('date', { ascending: false });

        setDailyRecords(recordsData || []);
      }

      // Calculate store performance (last 12 months)
      const today = new Date();
      const yearStart = format(subMonths(today, 12), 'yyyy-MM-dd');
      const yearEnd = format(today, 'yyyy-MM-dd');

      const performanceData: StorePerformance[] = [];

      for (const partnership of partnershipsWithStores) {
        if (!partnership.store_id) continue;
        
        // Fetch revenues
        const { data: revenues } = await supabase
          .from('revenues')
          .select('amount')
          .eq('store_id', partnership.store_id)
          .gte('date', yearStart)
          .lte('date', yearEnd);

        const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

        // Fetch expenses
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('store_id', partnership.store_id)
          .gte('date', yearStart)
          .lte('date', yearEnd);

        const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
        const profit = totalRevenue - totalExpenses;
        const partnerShare = profit * ((partnership.capital_percentage || 0) / 100);

        performanceData.push({
          storeId: partnership.store_id,
          storeName: partnership.store?.name || 'N/A',
          revenue: totalRevenue,
          expenses: totalExpenses,
          profit,
          partnerShare,
          percentage: partnership.capital_percentage || 0,
        });
      }

      setStorePerformance(performanceData);

      // Calculate monthly capital evolution (last 6 months)
      const monthlyCapital: MonthlyData[] = [];
      let runningCapital = 0;

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
        const monthLabel = format(monthDate, 'MMM', { locale: ptBR });

        const monthTransactions = (txData || []).filter(t => {
          const txDate = t.date;
          return txDate >= monthStart && txDate <= monthEnd;
        });

        const aportes = monthTransactions
          .filter(t => t.type === 'aporte')
          .reduce((sum, t) => sum + t.amount, 0);

        const distribuicoes = monthTransactions
          .filter(t => t.type === 'distribuicao' || t.type === 'retirada')
          .reduce((sum, t) => sum + t.amount, 0);

        runningCapital += aportes - distribuicoes;

        monthlyCapital.push({
          month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          aportes,
          distribuicoes,
          capital: Math.max(0, runningCapital + totalCapital - (totalAportes - totalRetiradas - totalDistributions)),
        });
      }

      // Adjust to show actual capital evolution
      const currentCapital = totalCapital;
      const lastMonthCapital = monthlyCapital[monthlyCapital.length - 1]?.capital || 0;
      const adjustment = currentCapital - lastMonthCapital;
      
      monthlyCapital.forEach((m, i) => {
        m.capital = Math.max(0, m.capital + adjustment);
      });

      setMonthlyData(monthlyCapital);

    } catch (error) {
      console.error('Error fetching partner data:', error);
    }
    setLoading(false);
  };

  const formatCurrencyUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatCurrencyBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))'];

  const pieData = partnerships.map((p, i) => ({
    name: p.store?.name || 'Loja',
    value: p.capital_amount || 0,
    percentage: p.capital_percentage || 0,
  }));

  const recentTransactions = transactions.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (partnerships.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma participação encontrada</h3>
          <p className="text-muted-foreground">
            Você ainda não está vinculado como sócio em nenhuma loja.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
            <div className="text-2xl font-bold">{formatCurrencyUSD(totalCapital)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              em {partnerships.length} {partnerships.length === 1 ? 'loja' : 'lojas'}
            </p>
          </CardContent>
        </Card>

        <Card className="metric-card-success">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribuições Recebidas
            </CardTitle>
            <PiggyBank className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyUSD(totalDistributions)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              total histórico
            </p>
          </CardContent>
        </Card>

        <Card className="metric-card-info">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sua Parte do Lucro (30%)
            </CardTitle>
            <Percent className="h-5 w-5 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyBRL(totalPartnerShare)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              recebido da Shopify
            </p>
            {pendingShopifyCount > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  {pendingShopifyCount} pendente{pendingShopifyCount > 1 ? 's' : ''}
                </Badge>
                <span className="text-muted-foreground">
                  ({formatCurrencyBRL(pendingShopifyAmount)})
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="metric-card-warning">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Aportes
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyUSD(totalAportes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              total investido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Capital Evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução do Capital</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                    formatter={(value: number) => [formatCurrencyUSD(value), '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="capital"
                    name="Capital"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorCapital)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribution by Store */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Loja</CardTitle>
            <CardDescription>Capital investido</CardDescription>
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
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrencyUSD(value), 'Capital']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Store Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="w-5 h-5" />
            Desempenho das Lojas
          </CardTitle>
          <CardDescription>Últimos 12 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {storePerformance.map((store) => (
              <div key={store.storeId} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{store.storeName}</h4>
                      <Badge variant="outline">
                        <Percent className="w-3 h-3 mr-1" />
                        {store.percentage}% participação
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Sua parte do lucro</p>
                    <p className={`text-lg font-bold ${store.partnerShare >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrencyBRL(store.partnerShare)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Receita</p>
                    <p className="font-medium text-success">{formatCurrencyBRL(store.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Despesas</p>
                    <p className="font-medium text-destructive">{formatCurrencyBRL(store.expenses)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lucro Total</p>
                    <p className={`font-medium ${store.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrencyBRL(store.profit)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Movimentações Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma movimentação registrada
            </p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx) => {
                const partnership = partnerships.find(p => p.id === tx.partner_id);
                const isPositive = tx.type === 'aporte';
                
                return (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isPositive ? 'bg-success/10' : 'bg-destructive/10'
                      }`}>
                        {isPositive ? (
                          <ArrowUpRight className="w-5 h-5 text-success" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {tx.type === 'aporte' ? 'Aporte' : tx.type === 'retirada' ? 'Retirada' : 'Distribuição'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {partnership?.store?.name} • {format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}
                        </p>
                        {tx.description && (
                          <p className="text-xs text-muted-foreground mt-1">{tx.description}</p>
                        )}
                      </div>
                    </div>
                    <span className={`font-bold ${isPositive ? 'text-success' : 'text-destructive'}`}>
                      {isPositive ? '+' : '-'}{formatCurrencyUSD(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
