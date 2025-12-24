import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Target,
  Calendar,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Line,
  Bar,
  Legend,
} from 'recharts';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthlyData {
  month: string;
  lucro: number;
  receita?: number;
  despesa?: number;
}

interface ProjectionData {
  month: string;
  lucroReal?: number;
  lucroProjetado: number;
  lucroOtimista?: number;
  lucroPessimista?: number;
  isProjection: boolean;
  confidence?: number;
}

interface EarningsProjectionProps {
  monthlyData: MonthlyData[];
  avgPercentage: number;
}

// Simple linear regression for trend calculation
function calculateLinearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

// Calculate moving average
function calculateMovingAverage(data: number[], window: number = 3): number {
  if (data.length === 0) return 0;
  const relevantData = data.slice(-window);
  return relevantData.reduce((sum, val) => sum + val, 0) / relevantData.length;
}

// Calculate growth rate
function calculateGrowthRate(data: number[]): number {
  if (data.length < 2) return 0;
  const firstHalf = data.slice(0, Math.ceil(data.length / 2));
  const secondHalf = data.slice(Math.ceil(data.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  
  if (firstAvg === 0) return 0;
  return ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
}

// Calculate standard deviation for confidence
function calculateStdDev(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length);
}

export default function EarningsProjection({ monthlyData, avgPercentage }: EarningsProjectionProps) {
  const projectionData = useMemo(() => {
    if (monthlyData.length < 3) return null;

    const profits = monthlyData.map(d => d.lucro);
    const { slope, intercept } = calculateLinearRegression(profits);
    const movingAvg = calculateMovingAverage(profits);
    const growthRate = calculateGrowthRate(profits);
    const stdDev = calculateStdDev(profits);
    
    // Combine historical and projected data
    const combined: ProjectionData[] = [];
    
    // Add historical data
    monthlyData.forEach((d, i) => {
      combined.push({
        month: d.month,
        lucroReal: d.lucro,
        lucroProjetado: d.lucro,
        isProjection: false,
      });
    });

    // Project next 3 months
    const today = new Date();
    const lastIndex = profits.length;
    
    // Calculate volatility factor based on standard deviation
    const volatilityFactor = stdDev / Math.abs(movingAvg || 1);
    // Base margin starts at 15% and increases with volatility
    const baseMargin = 0.15 + Math.min(0.25, volatilityFactor * 0.5);
    
    for (let i = 1; i <= 3; i++) {
      const projectedMonth = addMonths(today, i);
      const monthLabel = format(projectedMonth, 'MMM', { locale: ptBR });
      const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      
      // Weighted projection: 60% linear regression + 40% moving average
      const linearProjection = slope * (lastIndex + i - 1) + intercept;
      const maProjection = movingAvg * (1 + (growthRate / 100) * i * 0.5);
      const projectedValue = linearProjection * 0.6 + maProjection * 0.4;
      
      // Margin increases with distance (uncertainty grows)
      const margin = baseMargin * (1 + (i - 1) * 0.3);
      
      // Optimistic scenario: add margin + growth momentum
      const optimisticValue = projectedValue * (1 + margin) * (1 + Math.max(0, growthRate / 100) * 0.2);
      
      // Pessimistic scenario: subtract margin + consider negative momentum
      const pessimisticValue = projectedValue * (1 - margin) * (1 - Math.abs(Math.min(0, growthRate / 100)) * 0.2);
      
      // Confidence decreases with distance
      const confidence = Math.max(50, 95 - (i * 15) - volatilityFactor * 10);
      
      combined.push({
        month: capitalizedMonth,
        lucroReal: undefined,
        lucroProjetado: Math.max(0, projectedValue),
        lucroOtimista: Math.max(0, optimisticValue),
        lucroPessimista: Math.max(0, pessimisticValue),
        isProjection: true,
        confidence: Math.min(95, Math.max(30, confidence)),
      });
    }

    const projections = combined.filter(d => d.isProjection);
    
    return {
      data: combined,
      slope,
      movingAvg,
      growthRate,
      stdDev,
      nextMonthProjection: projections[0]?.lucroProjetado || 0,
      nextMonthOptimistic: projections[0]?.lucroOtimista || 0,
      nextMonthPessimistic: projections[0]?.lucroPessimista || 0,
      threeMonthProjection: projections.reduce((sum, d) => sum + d.lucroProjetado, 0),
      threeMonthOptimistic: projections.reduce((sum, d) => sum + (d.lucroOtimista || 0), 0),
      threeMonthPessimistic: projections.reduce((sum, d) => sum + (d.lucroPessimista || 0), 0),
    };
  }, [monthlyData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!projectionData || monthlyData.length < 3) {
    return (
      <Card className="text-center py-8">
        <CardContent>
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Projeção não disponível</h3>
          <p className="text-muted-foreground text-sm">
            É necessário ter pelo menos 3 meses de dados para gerar projeções.
          </p>
        </CardContent>
      </Card>
    );
  }

  const trend = projectionData.growthRate;
  const isPositiveTrend = trend >= 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={isPositiveTrend ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4" />
              Próximo Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(projectionData.nextMonthProjection)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-success">{formatCurrency(projectionData.nextMonthOptimistic)}</span>
              <span className="text-muted-foreground">~</span>
              <span className="text-destructive">{formatCurrency(projectionData.nextMonthPessimistic)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Próximos 3 Meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(projectionData.threeMonthProjection)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-success">{formatCurrency(projectionData.threeMonthOptimistic)}</span>
              <span className="text-muted-foreground">~</span>
              <span className="text-destructive">{formatCurrency(projectionData.threeMonthPessimistic)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {isPositiveTrend ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              Tendência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isPositiveTrend ? 'text-success' : 'text-warning'}`}>
              {isPositiveTrend ? '+' : ''}{trend.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Crescimento observado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projection Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Projeção de Rendimentos
              </CardTitle>
              <CardDescription>
                Baseado no histórico dos últimos {monthlyData.length} meses
              </CardDescription>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              3 meses
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projectionData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorScenario" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      lucroReal: 'Lucro Real',
                      lucroProjetado: 'Projeção Base',
                      lucroOtimista: 'Cenário Otimista',
                      lucroPessimista: 'Cenário Pessimista',
                    };
                    return [formatCurrency(value), labels[name] || name];
                  }}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    if (item?.isProjection && item?.confidence) {
                      return `${label} (Projeção - ${item.confidence.toFixed(0)}% confiança)`;
                    }
                    return label;
                  }}
                />
                <Legend 
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      lucroReal: 'Lucro Real',
                      lucroProjetado: 'Projeção Base',
                      lucroOtimista: 'Cenário Otimista',
                      lucroPessimista: 'Cenário Pessimista',
                    };
                    return labels[value] || value;
                  }}
                />
                
                {/* Reference line for current month */}
                <ReferenceLine 
                  x={monthlyData[monthlyData.length - 1]?.month} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: 'Hoje', 
                    position: 'top',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="lucroReal"
                  name="lucroReal"
                  stroke="hsl(var(--success))"
                  fillOpacity={1}
                  fill="url(#colorReal)"
                  strokeWidth={2}
                  connectNulls={false}
                />
                
                {/* Optimistic scenario line */}
                <Line
                  type="monotone"
                  dataKey="lucroOtimista"
                  name="lucroOtimista"
                  stroke="hsl(var(--success))"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  connectNulls
                />
                
                {/* Pessimistic scenario line */}
                <Line
                  type="monotone"
                  dataKey="lucroPessimista"
                  name="lucroPessimista"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  connectNulls
                />
                
                {/* Base projection line */}
                <Line
                  type="monotone"
                  dataKey="lucroProjetado"
                  name="lucroProjetado"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload?.isProjection) {
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={5} 
                          fill="hsl(var(--primary))" 
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      );
                    }
                    return null;
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Projection Details with Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhes da Projeção por Cenário</CardTitle>
          <CardDescription>
            Valores projetados para os próximos meses com cenários otimista e pessimista
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectionData.data.filter(d => d.isProjection).map((item, index) => (
              <div 
                key={item.month}
                className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{item.month}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Mês +{index + 1}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Confiança: {item.confidence?.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingDown className="w-3 h-3 text-destructive" />
                      <span className="text-xs font-medium text-destructive">Pessimista</span>
                    </div>
                    <p className="text-sm font-bold text-destructive">
                      {formatCurrency(item.lucroPessimista || 0)}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Target className="w-3 h-3 text-primary" />
                      <span className="text-xs font-medium text-primary">Base</span>
                    </div>
                    <p className="text-sm font-bold text-primary">
                      {formatCurrency(item.lucroProjetado)}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span className="text-xs font-medium text-success">Otimista</span>
                    </div>
                    <p className="text-sm font-bold text-success">
                      {formatCurrency(item.lucroOtimista || 0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              <strong>Nota:</strong> Os cenários são calculados com base na volatilidade histórica e tendência de crescimento.
              O cenário <span className="text-success font-medium">otimista</span> considera condições favoráveis, 
              enquanto o <span className="text-destructive font-medium">pessimista</span> considera condições adversas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
