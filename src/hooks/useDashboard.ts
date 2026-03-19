import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DashboardSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalCommissions: number;
  partnerShare: number;
  partnerPercentage: number;
}

export interface TrendPoint {
  month: string;
  receitas: number;
  despesas: number;
  lucro: number;
}

interface UseDashboardOptions {
  dateFrom: Date;
  dateTo: Date;
  storeId?: string;
  partnerId?: string;
}

export function useDashboard(options: UseDashboardOptions) {
  const { user, profile } = useAuth();
  const { dateFrom, dateTo, storeId = 'all', partnerId = 'all' } = options;

  const [summary, setSummary] = useState<DashboardSummary>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalCommissions: 0,
    partnerShare: 0,
    partnerPercentage: 30,
  });
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!user?.id) return;

    try {
      const dateFromStr = format(dateFrom, 'yyyy-MM-dd');
      const dateToStr = format(dateTo, 'yyyy-MM-dd');

      const buildFilter = (query: any) => {
        if (storeId !== 'all') query = query.eq('store_id', storeId);
        if (profile?.role === 'socio') query = query.eq('user_id', user.id);
        return query;
      };

      const [revenueResult, expenseResult] = await Promise.all([
        buildFilter(
          supabase
            .from('revenues')
            .select('amount')
            .gte('date', dateFromStr)
            .lte('date', dateToStr)
            .limit(5000)
        ),
        buildFilter(
          supabase
            .from('expenses')
            .select('amount')
            .gte('date', dateFromStr)
            .lte('date', dateToStr)
            .limit(5000)
        ),
      ]);

      const totalRevenue = (revenueResult.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const totalExpenses = (expenseResult.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      setSummary(prev => ({
        ...prev,
        totalRevenue,
        totalExpenses,
        netProfit,
        partnerShare: netProfit * (prev.partnerPercentage / 100),
      }));
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar resumo');
    }
  }, [user?.id, profile?.role, dateFrom, dateTo, storeId]);

  const fetchTrend = useCallback(async () => {
    if (!user?.id) return;

    try {
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(), 5 - i);
        return {
          label: format(d, 'MMM/yy'),
          start: format(startOfMonth(d), 'yyyy-MM-dd'),
          end: format(endOfMonth(d), 'yyyy-MM-dd'),
        };
      });

      const results = await Promise.all(
        months.map(async m => {
          const [rev, exp] = await Promise.all([
            supabase
              .from('revenues')
              .select('amount')
              .gte('date', m.start)
              .lte('date', m.end)
              .limit(5000),
            supabase
              .from('expenses')
              .select('amount')
              .gte('date', m.start)
              .lte('date', m.end)
              .limit(5000),
          ]);
          const receitas = (rev.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
          const despesas = (exp.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
          return { month: m.label, receitas, despesas, lucro: receitas - despesas };
        })
      );

      setTrendData(results);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar tendências');
    }
  }, [user?.id, profile?.role, dateFrom, dateTo, storeId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSummary(), fetchTrend()]).finally(() => setLoading(false));
  }, [fetchSummary, fetchTrend]);

  return { summary, trendData, loading, error, refetch: () => Promise.all([fetchSummary(), fetchTrend()]) };
}
