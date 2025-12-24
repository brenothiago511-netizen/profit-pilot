import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
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
  LineChart,
  Line,
} from 'recharts';

interface Commission {
  id: string;
  manager_id: string;
  period_start: string;
  commission_amount: number;
  manager_name?: string;
  status: string;
}

interface CommissionTrendChartProps {
  commissions: Commission[];
}

// Color palette for different managers
const MANAGER_COLORS = [
  'hsl(199, 89%, 48%)',   // info blue
  'hsl(152, 69%, 31%)',   // success green
  'hsl(25, 95%, 53%)',    // warning orange
  'hsl(280, 65%, 60%)',   // purple
  'hsl(0, 72%, 51%)',     // danger red
  'hsl(180, 70%, 45%)',   // teal
  'hsl(45, 93%, 47%)',    // yellow
  'hsl(320, 70%, 50%)',   // pink
];

export function CommissionTrendChart({ commissions }: CommissionTrendChartProps) {
  const { chartData, managers, totalsPerManager } = useMemo(() => {
    if (!commissions || commissions.length === 0) {
      return { chartData: [], managers: [], totalsPerManager: [] };
    }

    // Get unique managers
    const uniqueManagers = [...new Set(commissions.map(c => c.manager_name || c.manager_id))];
    
    // Group commissions by month
    const monthlyData: Record<string, Record<string, number>> = {};
    
    commissions.forEach(c => {
      const monthKey = format(parseISO(c.period_start), 'yyyy-MM');
      const managerName = c.manager_name || c.manager_id;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {};
      }
      
      monthlyData[monthKey][managerName] = (monthlyData[monthKey][managerName] || 0) + c.commission_amount;
    });

    // Convert to chart format and sort by date
    const sortedMonths = Object.keys(monthlyData).sort();
    const data = sortedMonths.map(month => {
      const entry: Record<string, any> = {
        month: format(parseISO(month + '-01'), 'MMM yy', { locale: ptBR }),
        monthFull: format(parseISO(month + '-01'), 'MMMM yyyy', { locale: ptBR }),
      };
      
      uniqueManagers.forEach(manager => {
        entry[manager] = monthlyData[month][manager] || 0;
      });
      
      return entry;
    });

    // Calculate totals per manager
    const totals = uniqueManagers.map(manager => {
      const total = commissions
        .filter(c => (c.manager_name || c.manager_id) === manager)
        .reduce((sum, c) => sum + c.commission_amount, 0);
      
      const paidTotal = commissions
        .filter(c => (c.manager_name || c.manager_id) === manager && c.status === 'paga')
        .reduce((sum, c) => sum + c.commission_amount, 0);
      
      return { manager, total, paidTotal };
    }).sort((a, b) => b.total - a.total);

    return { chartData: data, managers: uniqueManagers, totalsPerManager: totals };
  }, [commissions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (commissions.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Trend Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-info" />
            Evolução de Comissões
          </CardTitle>
          <p className="text-sm text-muted-foreground">Tendência por gestor nos últimos meses</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                />
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
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.monthFull || label}
                />
                <Legend />
                {managers.map((manager, index) => (
                  <Line
                    key={manager}
                    type="monotone"
                    dataKey={manager}
                    name={manager}
                    stroke={MANAGER_COLORS[index % MANAGER_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart - Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparativo por Gestor</CardTitle>
          <p className="text-sm text-muted-foreground">Total de comissões acumuladas</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={totalsPerManager} 
                layout="vertical"
                margin={{ top: 10, right: 30, left: 80, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis 
                  type="number"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <YAxis 
                  type="category" 
                  dataKey="manager" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value), 
                    name === 'total' ? 'Total' : 'Pago'
                  ]}
                />
                <Legend 
                  formatter={(value) => value === 'total' ? 'Total' : 'Pago'}
                />
                <Bar 
                  dataKey="total" 
                  name="total"
                  fill="hsl(var(--info))" 
                  radius={[0, 4, 4, 0]}
                />
                <Bar 
                  dataKey="paidTotal" 
                  name="paidTotal"
                  fill="hsl(var(--success))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Resumo por Gestor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {totalsPerManager.map((item, index) => (
              <div 
                key={item.manager}
                className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: MANAGER_COLORS[index % MANAGER_COLORS.length] }}
                  />
                  <span className="font-medium text-sm truncate">{item.manager}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">{formatCurrency(item.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pago:</span>
                    <span className="text-success font-medium">{formatCurrency(item.paidTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pendente:</span>
                    <span className="text-warning font-medium">{formatCurrency(item.total - item.paidTotal)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
