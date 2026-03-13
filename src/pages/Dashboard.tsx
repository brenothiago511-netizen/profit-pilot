import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrendingUp, TrendingDown, DollarSign, Percent, Store, Loader2, CalendarIcon, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
} from 'recharts';
import { CurrencyToggle } from '@/components/currency/CurrencyToggle';
import { useCurrency } from '@/hooks/useCurrency';

interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalCommissions: number;
  partnerShare: number;
  partnerPercentage: number;
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

interface PartnerOption {
  user_id: string;
  name: string;
}

interface DateRange {
  from: Date;
  to: Date;
}

export default function Dashboard() {
  const { user, profile, isAdmin } = useAuth();
  const { formatCurrency, config } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [partnerStoreIds, setPartnerStoreIds] = useState<string[] | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedPartner, setSelectedPartner] = useState<string>('all');
  const [displayCurrency, setDisplayCurrency] = useState<'base' | 'original' | 'preferred'>('base');
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [data, setData] = useState<DashboardData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalCommissions: 0,
    partnerShare: 0,
    partnerPercentage: 0,
  });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  
  const isSocio = profile?.role === 'socio';
  
  // Date range state - default to current month
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const dateStart = format(dateRange.from, 'yyyy-MM-dd');
  const dateEnd = format(dateRange.to, 'yyyy-MM-dd');

  useEffect(() => {
    if (user?.id && profile) {
      fetchInitialData();
    }
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (initialDataLoaded) {
      fetchTrendData();
      fetchDashboardData();
    }
  }, [selectedStore, selectedPartner, dateRange, initialDataLoaded]);

  const fetchInitialData = async () => {
    console.log('fetchInitialData - isSocio:', isSocio, 'user?.id:', user?.id, 'isAdmin:', isAdmin, 'profile?.role:', profile?.role);
    
    if (isSocio && user?.id) {
      // Fetch partner's stores
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('store_id, capital_percentage')
        .eq('user_id', user.id)
        .eq('status', 'active');
      
      console.log('Partner data for socio:', partnerData, 'error:', partnerError);
      
      const storeIds = partnerData?.map(p => p.store_id).filter(Boolean) as string[] || [];
      console.log('Partner store IDs:', storeIds);
      setPartnerStoreIds(storeIds);
      
      // Fetch store names for partner
      if (storeIds.length > 0) {
        const { data: storesData, error: storesError } = await supabase
          .from('stores')
          .select('id, name')
          .in('id', storeIds)
          .eq('status', 'active')
          .order('name');
        
        console.log('Stores for socio:', storesData, 'error:', storesError);
        if (storesData) setStores(storesData);
      } else {
        console.log('No store IDs found for socio, setting empty stores');
        setStores([]);
      }
    } else {
      // Admin and Financeiro see all stores
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      
      console.log('All stores for admin/financeiro:', storesData, 'error:', storesError);
      if (storesData) setStores(storesData);
      
      // Admin can filter by user
      if (isAdmin) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .neq('id', user!.id)
          .eq('status', 'active')
          .order('name');
        
        const partnersList: PartnerOption[] = (profilesData || []).map(p => ({
          user_id: p.id,
          name: p.name,
        }));
        
        setPartners(partnersList);
      }
      
      setPartnerStoreIds(null); // null means no restriction
    }
    
    setInitialDataLoaded(true);
    console.log('Initial data loaded');
  };

  const getStoreIdsForQuery = async (): Promise<string[] | null> => {
    // For admin filtering by partner - return null so we don't filter by store
    // The user_id filter applied separately is sufficient
    if (isAdmin && selectedPartner !== 'all') {
      return null;
    }
    
    // For sócio - use their own stores
    if (isSocio && partnerStoreIds && partnerStoreIds.length > 0) {
      return partnerStoreIds;
    }
    
    // For admin/financeiro with no partner filter - ALL stores (no restriction)
    return null;
  };

  const fetchTrendData = async () => {
    try {
      const storeIdsToFilter = await getStoreIdsForQuery();
      const months: TrendData[] = [];
      const today = new Date();
      const includeNullStore = isSocio && storeIdsToFilter && storeIdsToFilter.length > 0;
      const filterUserId = (isSocio && includeNullStore) ? user!.id : 
                           (isAdmin && selectedPartner !== 'all') ? selectedPartner : null;
      
      // Build all 12 RPC calls (6 months × 2 tables) in parallel
      const monthMeta: { start: string; end: string; label: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');
        const raw = format(monthDate, 'MMM', { locale: ptBR });
        monthMeta.push({ start, end, label: raw.charAt(0).toUpperCase() + raw.slice(1) });
      }

      const rpcArgs = (table: string, s: string, e: string) => ({
        p_table: table,
        p_date_start: s,
        p_date_end: e,
        p_store_ids: storeIdsToFilter || null,
        p_user_id: filterUserId,
        p_include_null_store: includeNullStore || false,
      });

      const allCalls = monthMeta.flatMap(m => [
        supabase.rpc('sum_amounts', rpcArgs('revenues', m.start, m.end)),
        supabase.rpc('sum_amounts', rpcArgs('expenses', m.start, m.end)),
      ]);

      const results = await Promise.all(allCalls);

      for (let i = 0; i < monthMeta.length; i++) {
        const rev = Number(results[i * 2].data) || 0;
        const exp = Number(results[i * 2 + 1].data) || 0;
        months.push({
          month: monthMeta[i].label,
          receitas: rev,
          despesas: exp,
          lucro: rev - exp,
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
      let storeIdsToFilter = await getStoreIdsForQuery();
      
      // Apply store filter if selected
      if (selectedStore !== 'all') {
        storeIdsToFilter = [selectedStore];
      }

      // Use server-side SUM to avoid 1000-row limit
      const includeNullStore = isSocio && storeIdsToFilter && storeIdsToFilter.length > 0;
      const filterUserId = (isSocio && includeNullStore) ? user!.id : 
                           (isAdmin && selectedPartner !== 'all') ? selectedPartner : null;

      // Run revenue + expenses queries in parallel
      const rpcParams = (table: string) => ({
        p_table: table,
        p_date_start: dateStart,
        p_date_end: dateEnd,
        p_store_ids: storeIdsToFilter || null,
        p_user_id: filterUserId,
        p_include_null_store: includeNullStore || false,
      });

      const [{ data: revSum }, { data: expSum }] = await Promise.all([
        supabase.rpc('sum_amounts', rpcParams('revenues')),
        supabase.rpc('sum_amounts', rpcParams('expenses')),
      ]);
      const totalRevenue = Number(revSum) || 0;
      const totalExpenses = Number(expSum) || 0;

      // Calculate net profit: revenue - expenses
      const netProfit = totalRevenue - totalExpenses;
      
      // Calculate partner share: 30% of confirmed profits from daily_records
      let partnerShare = 0;
      const PARTNER_PERCENTAGE = 30;
      
      if (isSocio && user?.id) {
        // Fetch confirmed profits (shopify_status = 'received' or 'confirmed') created by this user
        let profitsQuery = supabase
          .from('daily_records')
          .select('daily_profit')
          .in('shopify_status', ['received', 'confirmed'])
          .eq('created_by', user.id)
          .gte('date', dateStart)
          .lte('date', dateEnd);
        
        if (storeIdsToFilter && storeIdsToFilter.length > 0) {
          profitsQuery = profitsQuery.in('store_id', storeIdsToFilter);
        }
        
        const { data: profitsData } = await profitsQuery;
        const totalConfirmedProfits = profitsData?.reduce((sum, p) => sum + Number(p.daily_profit), 0) || 0;
        
        partnerShare = totalConfirmedProfits * (PARTNER_PERCENTAGE / 100);
      }

      setData({
        totalRevenue,
        totalExpenses,
        netProfit,
        totalCommissions: 0,
        partnerShare,
        partnerPercentage: PARTNER_PERCENTAGE,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  const formatValue = (value: number) => {
    return formatCurrency(value, config.baseCurrency);
  };

  const metrics = [
    {
      title: 'Receita Total',
      value: data.totalRevenue,
      icon: TrendingUp,
      className: 'metric-card-success',
      iconColor: 'text-success',
      show: true,
    },
    {
      title: 'Despesas Totais',
      value: data.totalExpenses,
      icon: TrendingDown,
      className: 'metric-card-danger',
      iconColor: 'text-danger',
      show: true,
    },
    {
      title: 'Lucro Líquido',
      value: data.netProfit,
      icon: DollarSign,
      className: data.netProfit >= 0 ? 'metric-card-success' : 'metric-card-danger',
      iconColor: data.netProfit >= 0 ? 'text-success' : 'text-danger',
      show: true,
    },
    {
      title: `Sua Parte (${data.partnerPercentage.toFixed(0)}%)`,
      value: data.partnerShare,
      icon: Percent,
      className: data.partnerShare >= 0 ? 'metric-card-success' : 'metric-card-danger',
      iconColor: data.partnerShare >= 0 ? 'text-success' : 'text-danger',
      show: isSocio,
    },
    {
      title: 'Comissões',
      value: data.totalCommissions,
      icon: Percent,
      className: 'metric-card-info',
      iconColor: 'text-info',
      show: !isSocio,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-description">
              {format(dateRange.from, "d 'de' MMM", { locale: ptBR })} - {format(dateRange.to, "d 'de' MMM, yyyy", { locale: ptBR })}
              {isSocio && <span className="ml-2 text-primary">(Seus dados)</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, "dd/MM/yy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateRange.to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Partner Filter (Admin only) */}
              {isAdmin && partners.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por sócio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os sócios</SelectItem>
                      {partners.map((partner) => (
                        <SelectItem key={partner.user_id} value={partner.user_id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Store Filter */}
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-muted-foreground" />
                <Select 
                  value={selectedStore} 
                  onValueChange={setSelectedStore}
                  disabled={stores.length === 0}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={stores.length === 0 ? "Nenhuma loja vinculada" : "Selecione a loja"} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-50">
                    {stores.length > 0 ? (
                      <>
                        <SelectItem value="all">Todas as lojas</SelectItem>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </>
                    ) : (
                      <SelectItem value="all" disabled>Nenhuma loja disponível</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
          </div>
        </div>
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
                    {formatValue(metric.value)}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Charts Section */}
      {!loading && (
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
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
                      formatter={(value: number) => [formatValue(value), '']}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
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
                      formatter={(value: number) => [formatValue(value), '']}
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
    </div>
  );
}
