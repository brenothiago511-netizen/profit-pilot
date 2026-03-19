import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/hooks/useDashboard';

type ComparisonMode = 'mom' | 'yoy' | 'custom';

function DeltaBadge({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0;
  const isZero = value === 0;
  const color = isZero ? 'text-muted-foreground' : isPositive ? 'text-green-500' : 'text-red-500';
  const Icon = isZero ? Minus : isPositive ? TrendingUp : TrendingDown;
  const pct = isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : '—';

  return (
    <div className={`flex items-center gap-1 text-sm font-medium ${color}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{pct}</span>
      <span className="text-xs text-muted-foreground font-normal">{label}</span>
    </div>
  );
}

function MetricCard({
  title,
  current,
  previous,
  label,
  loading,
}: {
  title: string;
  current: number;
  previous: number;
  label: string;
  loading: boolean;
}) {
  const delta = previous === 0 ? (current > 0 ? Infinity : 0) : ((current - previous) / previous) * 100;
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{fmt(current)}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Anterior: {fmt(previous)}
        </p>
        <DeltaBadge value={delta} label={label} />
      </CardContent>
    </Card>
  );
}

export default function ComparativeReport() {
  const [mode, setMode] = useState<ComparisonMode>('mom');

  const now = new Date();

  const { currentFrom, currentTo, previousFrom, previousTo, compareLabel } = useMemo(() => {
    if (mode === 'mom') {
      return {
        currentFrom: startOfMonth(now),
        currentTo: endOfMonth(now),
        previousFrom: startOfMonth(subMonths(now, 1)),
        previousTo: endOfMonth(subMonths(now, 1)),
        compareLabel: 'vs mês anterior',
      };
    }
    if (mode === 'yoy') {
      return {
        currentFrom: startOfMonth(now),
        currentTo: endOfMonth(now),
        previousFrom: startOfMonth(subYears(now, 1)),
        previousTo: endOfMonth(subYears(now, 1)),
        compareLabel: 'vs mesmo período ano passado',
      };
    }
    // quarter
    return {
      currentFrom: startOfMonth(subMonths(now, 2)),
      currentTo: endOfMonth(now),
      previousFrom: startOfMonth(subMonths(now, 5)),
      previousTo: endOfMonth(subMonths(now, 3)),
      compareLabel: 'vs trimestre anterior',
    };
  }, [mode]);

  const current = useDashboard({ dateFrom: currentFrom, dateTo: currentTo });
  const previous = useDashboard({ dateFrom: previousFrom, dateTo: previousTo });

  const loading = current.loading || previous.loading;

  const currentPeriodLabel = `${format(currentFrom, 'MMM/yy', { locale: ptBR })} – ${format(currentTo, 'MMM/yy', { locale: ptBR })}`;
  const previousPeriodLabel = `${format(previousFrom, 'MMM/yy', { locale: ptBR })} – ${format(previousTo, 'MMM/yy', { locale: ptBR })}`;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" aria-hidden="true" />
            Relatório Comparativo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentPeriodLabel} <span className="text-muted-foreground/60">vs</span> {previousPeriodLabel}
          </p>
        </div>

        <Select value={mode} onValueChange={(v) => setMode(v as ComparisonMode)}>
          <SelectTrigger className="w-56" aria-label="Modo de comparação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mom">Mês a Mês</SelectItem>
            <SelectItem value="yoy">Ano a Ano</SelectItem>
            <SelectItem value="custom">Trimestre a Trimestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Métricas comparativas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Receita Total"
          current={current.summary.totalRevenue}
          previous={previous.summary.totalRevenue}
          label={compareLabel}
          loading={loading}
        />
        <MetricCard
          title="Despesas Totais"
          current={current.summary.totalExpenses}
          previous={previous.summary.totalExpenses}
          label={compareLabel}
          loading={loading}
        />
        <MetricCard
          title="Lucro Líquido"
          current={current.summary.netProfit}
          previous={previous.summary.netProfit}
          label={compareLabel}
          loading={loading}
        />
      </div>

      {/* Tabela comparativa */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo Comparativo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table" aria-label="Tabela comparativa de períodos">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-3 text-left font-medium">Métrica</th>
                    <th className="pb-3 text-right font-medium">{currentPeriodLabel}</th>
                    <th className="pb-3 text-right font-medium">{previousPeriodLabel}</th>
                    <th className="pb-3 text-right font-medium">Variação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { label: 'Receita', curr: current.summary.totalRevenue, prev: previous.summary.totalRevenue },
                    { label: 'Despesas', curr: current.summary.totalExpenses, prev: previous.summary.totalExpenses },
                    { label: 'Lucro Líquido', curr: current.summary.netProfit, prev: previous.summary.netProfit },
                  ].map(row => {
                    const delta = row.prev === 0 ? 0 : ((row.curr - row.prev) / row.prev) * 100;
                    const fmt = (v: number) =>
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
                    const color = delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground';
                    return (
                      <tr key={row.label}>
                        <td className="py-3 font-medium">{row.label}</td>
                        <td className="py-3 text-right">{fmt(row.curr)}</td>
                        <td className="py-3 text-right text-muted-foreground">{fmt(row.prev)}</td>
                        <td className={`py-3 text-right font-medium ${color}`}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
