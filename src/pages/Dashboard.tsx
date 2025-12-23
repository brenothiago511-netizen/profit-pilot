import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, Percent, Store, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalCommissions: number;
}

interface TrendData {
  month: string;
  receitas: number;
  despesas: number;
  lucro: number;
}

interface StoreOption {
  id: string;
  name: string;
}

export default function Dashboard() {
  const { profile, isGestor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [data, setData] = useState<DashboardData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalCommissions: 0,
  });

  const [trendData, setTrendData] = useState<TrendData[]>([]);

  const currentMonth = new Date();
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  useEffect(() => {
    fetchStores();
    fetchTrendData();
  }, []);

  useEffect(() => {
    if (!isGestor) {
      fetchDashboardData();
    } else {
      fetchGestorData();
    }
  }, [selectedStore, isGestor]);

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    
    if (data) setStores(data);
  };

  const fetchTrendData = async () => {
    try {
      const months: TrendData[] = [];
      
      // Fetch last 6 months of data
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(currentMonth, i);
        const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');
        const monthLabel = format(monthDate, 'MMM', { locale: ptBR });

        // Fetch revenues for this month
        const { data: revenues } = await supabase
          .from('revenues')
          .select('amount')
          .gte('date', start)
          .lte('date', end);
        
        const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

        // Fetch expenses for this month
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .gte('date', start)
          .lte('date', end);
        
        const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

        months.push({
          month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          receitas: totalRevenue,
          despesas: totalExpenses,
          lucro: totalRevenue - totalExpenses,
        });
      }

      setTrendData(months);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch revenues
      let revenueQuery = supabase
        .from('revenues')
        .select('amount')
        .gte('date', monthStart)
        .lte('date', monthEnd);
      
      if (selectedStore !== 'all') {
        revenueQuery = revenueQuery.eq('store_id', selectedStore);
      }
      
      const { data: revenues } = await revenueQuery;
      const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

      // Fetch expenses
      let expenseQuery = supabase
        .from('expenses')
        .select('amount')
        .gte('date', monthStart)
        .lte('date', monthEnd);
      
      if (selectedStore !== 'all') {
        expenseQuery = expenseQuery.eq('store_id', selectedStore);
      }
      
      const { data: expenses } = await expenseQuery;
      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Fetch commissions
      let commissionQuery = supabase
        .from('commissions')
        .select('commission_amount')
        .gte('period_start', monthStart)
        .lte('period_end', monthEnd);
      
      if (selectedStore !== 'all') {
        commissionQuery = commissionQuery.eq('store_id', selectedStore);
      }
      
      const { data: commissions } = await commissionQuery;
      const totalCommissions = commissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

      setData({
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        totalCommissions,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  const fetchGestorData = async () => {
    setLoading(true);
    try {
      // For gestor, only show their commissions
      const { data: commissions } = await supabase
        .from('commissions')
        .select('commission_amount')
        .gte('period_start', monthStart)
        .lte('period_end', monthEnd);
      
      const totalCommissions = commissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

      setData({
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        totalCommissions,
      });
    } catch (error) {
      console.error('Error fetching gestor data:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const metrics = [
    {
      title: 'Receita Total',
      value: data.totalRevenue,
      icon: TrendingUp,
      className: 'metric-card-success',
      iconColor: 'text-success',
      show: !isGestor,
    },
    {
      title: 'Despesas Totais',
      value: data.totalExpenses,
      icon: TrendingDown,
      className: 'metric-card-danger',
      iconColor: 'text-danger',
      show: !isGestor,
    },
    {
      title: 'Lucro Líquido',
      value: data.netProfit,
      icon: DollarSign,
      className: data.netProfit >= 0 ? 'metric-card-success' : 'metric-card-danger',
      iconColor: data.netProfit >= 0 ? 'text-success' : 'text-danger',
      show: !isGestor,
    },
    {
      title: 'Comissões',
      value: data.totalCommissions,
      icon: Percent,
      className: 'metric-card-info',
      iconColor: 'text-info',
      show: true,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Visão geral de {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </p>
        </div>

        {!isGestor && (
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics
            .filter((m) => m.show)
            .map((metric) => (
              <Card key={metric.title} className={metric.className}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </CardTitle>
                  <metric.icon className={`h-5 w-5 ${metric.iconColor}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold number-animate">
                    {formatCurrency(metric.value)}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Charts Section */}
      {!isGestor && !loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue vs Expenses Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Receitas vs Despesas</CardTitle>
              <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--danger))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="receitas"
                      name="Receitas"
                      stroke="hsl(var(--success))"
                      fillOpacity={1}
                      fill="url(#colorReceitas)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="despesas"
                      name="Despesas"
                      stroke="hsl(var(--danger))"
                      fillOpacity={1}
                      fill="url(#colorDespesas)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Profit Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lucro Mensal</CardTitle>
              <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Bar
                      dataKey="lucro"
                      name="Lucro"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isGestor && (
        <Card>
          <CardHeader>
            <CardTitle>Suas Comissões</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Visualize suas comissões na página de Comissões para mais detalhes.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
