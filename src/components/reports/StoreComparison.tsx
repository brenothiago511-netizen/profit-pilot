import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Store, 
  TrendingUp, 
  TrendingDown, 
  Award,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';

interface StorePerformance {
  storeId: string;
  storeName: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  goalAchievement: number;
}

interface StoreComparisonProps {
  storesData: StorePerformance[];
}

export default function StoreComparison({ storesData }: StoreComparisonProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const analysis = useMemo(() => {
    if (storesData.length === 0) return null;

    // Rank stores by different metrics
    const byRevenue = [...storesData].sort((a, b) => b.revenue - a.revenue);
    const byProfit = [...storesData].sort((a, b) => b.profit - a.profit);
    const byMargin = [...storesData].sort((a, b) => b.margin - a.margin);
    const byGoal = [...storesData].sort((a, b) => b.goalAchievement - a.goalAchievement);

    // Calculate totals and averages
    const totalRevenue = storesData.reduce((sum, s) => sum + s.revenue, 0);
    const totalProfit = storesData.reduce((sum, s) => sum + s.profit, 0);
    const avgMargin = storesData.reduce((sum, s) => sum + s.margin, 0) / storesData.length;
    const avgGoal = storesData.reduce((sum, s) => sum + s.goalAchievement, 0) / storesData.length;

    // Best performers
    const bestRevenue = byRevenue[0];
    const bestProfit = byProfit[0];
    const bestMargin = byMargin[0];
    const bestGoal = byGoal[0];

    // Prepare radar chart data (normalized 0-100)
    const maxRevenue = Math.max(...storesData.map(s => s.revenue)) || 1;
    const maxProfit = Math.max(...storesData.map(s => Math.max(0, s.profit))) || 1;
    const maxMargin = Math.max(...storesData.map(s => Math.max(0, s.margin))) || 1;
    const maxGoal = Math.max(...storesData.map(s => s.goalAchievement)) || 1;

    const radarData = [
      { 
        metric: 'Receita',
        ...Object.fromEntries(storesData.map(s => [s.storeName, (s.revenue / maxRevenue) * 100]))
      },
      { 
        metric: 'Lucro',
        ...Object.fromEntries(storesData.map(s => [s.storeName, (Math.max(0, s.profit) / maxProfit) * 100]))
      },
      { 
        metric: 'Margem',
        ...Object.fromEntries(storesData.map(s => [s.storeName, (Math.max(0, s.margin) / maxMargin) * 100]))
      },
      { 
        metric: 'Meta',
        ...Object.fromEntries(storesData.map(s => [s.storeName, Math.min((s.goalAchievement / maxGoal) * 100, 100)]))
      },
    ];

    // Bar chart comparison data
    const comparisonData = storesData.map(s => ({
      loja: s.storeName.length > 12 ? s.storeName.substring(0, 12) + '...' : s.storeName,
      receita: s.revenue,
      despesas: s.expenses,
      lucro: s.profit,
    }));

    return {
      byRevenue,
      byProfit,
      byMargin,
      byGoal,
      totalRevenue,
      totalProfit,
      avgMargin,
      avgGoal,
      bestRevenue,
      bestProfit,
      bestMargin,
      bestGoal,
      radarData,
      comparisonData,
    };
  }, [storesData]);

  if (!analysis || storesData.length < 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Store className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Comparativo não disponível</h3>
          <p className="text-muted-foreground text-sm">
            É necessário ter dados de pelo menos 2 lojas para gerar o comparativo.
          </p>
        </CardContent>
      </Card>
    );
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))'];

  return (
    <div className="space-y-6">
      {/* Best Performers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-success" />
              Maior Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-lg">{analysis.bestRevenue.storeName}</p>
            <p className="text-success font-medium">{formatCurrency(analysis.bestRevenue.revenue)}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Maior Lucro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-lg">{analysis.bestProfit.storeName}</p>
            <p className={`font-medium ${analysis.bestProfit.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(analysis.bestProfit.profit)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-info/30 bg-info/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-info" />
              Melhor Margem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-lg">{analysis.bestMargin.storeName}</p>
            <p className="text-info font-medium">{analysis.bestMargin.margin.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-warning" />
              Melhor Meta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-lg">{analysis.bestGoal.storeName}</p>
            <p className="text-warning font-medium">{analysis.bestGoal.goalAchievement.toFixed(1)}% atingido</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Comparativo Financeiro
          </CardTitle>
          <CardDescription>Receitas, despesas e lucro por loja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analysis.comparisonData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="loja" className="text-xs fill-muted-foreground" />
                <YAxis 
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  className="text-xs fill-muted-foreground"
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      receita: 'Receita',
                      despesas: 'Despesas',
                      lucro: 'Lucro',
                    };
                    return [formatCurrency(value), labels[name] || name];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend 
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      receita: 'Receita',
                      despesas: 'Despesas',
                      lucro: 'Lucro',
                    };
                    return labels[value] || value;
                  }}
                />
                <Bar dataKey="receita" name="receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="lucro" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Radar Chart Comparison */}
      {storesData.length <= 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Análise Multidimensional
            </CardTitle>
            <CardDescription>Comparação normalizada entre métricas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={analysis.radarData}>
                  <PolarGrid className="stroke-border" />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                  {storesData.map((store, index) => (
                    <Radar
                      key={store.storeId}
                      name={store.storeName}
                      dataKey={store.storeName}
                      stroke={COLORS[index % COLORS.length]}
                      fill={COLORS[index % COLORS.length]}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-warning" />
            Ranking de Desempenho
          </CardTitle>
          <CardDescription>Classificação das lojas por diferentes métricas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Posição</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Loja</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Receita</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Lucro</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Margem</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Meta</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Tendência</th>
                </tr>
              </thead>
              <tbody>
                {analysis.byProfit.map((store, index) => {
                  const revenueRank = analysis.byRevenue.findIndex(s => s.storeId === store.storeId) + 1;
                  const profitRank = index + 1;
                  const marginRank = analysis.byMargin.findIndex(s => s.storeId === store.storeId) + 1;
                  const avgRank = (revenueRank + profitRank + marginRank) / 3;
                  
                  return (
                    <tr key={store.storeId} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Badge className="bg-warning text-warning-foreground">1º</Badge>}
                          {index === 1 && <Badge variant="secondary">2º</Badge>}
                          {index === 2 && <Badge variant="outline">3º</Badge>}
                          {index > 2 && <span className="text-muted-foreground">{index + 1}º</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">{store.storeName}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-success">{formatCurrency(store.revenue)}</span>
                          <span className="text-xs text-muted-foreground">
                            {((store.revenue / analysis.totalRevenue) * 100).toFixed(1)}% do total
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={store.profit >= 0 ? 'text-success' : 'text-destructive'}>
                          {formatCurrency(store.profit)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={store.margin >= analysis.avgMargin ? 'text-success' : 'text-destructive'}>
                            {store.margin.toFixed(1)}%
                          </span>
                          <Progress 
                            value={Math.max(0, Math.min(store.margin, 100))} 
                            className="h-1.5 w-16"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant={store.goalAchievement >= 100 ? 'default' : store.goalAchievement >= 80 ? 'secondary' : 'destructive'}>
                          {store.goalAchievement.toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {avgRank <= storesData.length / 3 ? (
                          <div className="flex items-center justify-center gap-1 text-success">
                            <ArrowUp className="w-4 h-4" />
                            <span className="text-xs">Acima</span>
                          </div>
                        ) : avgRank <= (storesData.length * 2) / 3 ? (
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <Minus className="w-4 h-4" />
                            <span className="text-xs">Média</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-destructive">
                            <ArrowDown className="w-4 h-4" />
                            <span className="text-xs">Abaixo</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
              <p><strong>Receita Total:</strong> {formatCurrency(analysis.totalRevenue)}</p>
              <p><strong>Lucro Total:</strong> {formatCurrency(analysis.totalProfit)}</p>
              <p><strong>Margem Média:</strong> {analysis.avgMargin.toFixed(1)}%</p>
              <p><strong>Atingimento Médio de Meta:</strong> {analysis.avgGoal.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
