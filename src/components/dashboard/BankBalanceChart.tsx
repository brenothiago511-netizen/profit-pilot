import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Landmark } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subMonths, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '@/hooks/useCurrency';

interface BalancePoint {
  month: string;
  saldo: number;
}

interface BankBalanceChartProps {
  userId?: string | null;
}

export function BankBalanceChart({ userId }: BankBalanceChartProps = {}) {
  const [data, setData] = useState<BalancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatCurrency, config } = useCurrency();

  useEffect(() => {
    fetchBankEvolution();
  }, [userId]);

  const fetchBankEvolution = async () => {
    try {
      const today = new Date();
      const months: BalancePoint[] = [];

      // For each of the last 6 months, compute end-of-month total balance
      // by summing transactions up to end of that month
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
        const label = format(monthDate, 'MMM', { locale: ptBR });
        const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

        // Get all bank_accounts balances as of month end by summing transactions
        // We'll use a simpler approach: get net transaction amounts up to month end
        let query = supabase
          .from('bank_transactions')
          .select('amount, type')
          .lte('date', monthEnd);

        if (userId) query = query.eq('user_id', userId);

        const { data: txData, error } = await query;

        if (error) {
          console.error('Error fetching bank transactions:', error);
          months.push({ month: capitalizedLabel, saldo: 0 });
          continue;
        }

        // Calculate net balance from all transactions
        const totalBalance = (txData || []).reduce((sum, tx) => {
          const amt = Number(tx.amount) || 0;
          return tx.type === 'entrada' ? sum + amt : sum - amt;
        }, 0);

        months.push({ month: capitalizedLabel, saldo: totalBalance });
      }

      setData(months);
    } catch (error) {
      console.error('Error fetching bank evolution:', error);
    }
    setLoading(false);
  };

  const formatValue = (value: number) => {
    return formatCurrency(value, config.baseCurrency);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Evolução Bancária
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          Evolução do Saldo Bancário
        </CardTitle>
        <p className="text-sm text-muted-foreground">Saldo total nos bancos nos últimos 6 meses</p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {data.every(d => d.saldo === 0) ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma transação bancária encontrada
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                  formatter={(value: number) => [formatValue(value), 'Saldo']}
                />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorSaldo)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
