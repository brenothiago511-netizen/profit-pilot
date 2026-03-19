import { useState, useEffect, useCallback } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Expense {
  id: string;
  store_id: string | null;
  user_id: string;
  date: string;
  amount: number;
  description: string;
  category_id: string | null;
  type: string | null;
  payment_method: string | null;
  ai_extracted: boolean | null;
  original_currency: string | null;
  original_amount: number | null;
  store_name?: string;
  category_name?: string;
}

interface UseExpensesOptions {
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  storeId?: string;
  page?: number;
  pageSize?: number;
}

export function useExpenses(options: UseExpensesOptions = {}) {
  const { user, profile } = useAuth();
  const {
    dateFrom = startOfMonth(new Date()),
    dateTo = endOfMonth(new Date()),
    userId = 'all',
    storeId = 'all',
    page = 1,
    pageSize = 20,
  } = options;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const dateFromStr = format(dateFrom, 'yyyy-MM-dd');
      const dateToStr = format(dateTo, 'yyyy-MM-dd');
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let countQuery = supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .gte('date', dateFromStr)
        .lte('date', dateToStr);

      let dataQuery = supabase
        .from('expenses')
        .select(`
          id, store_id, user_id, date, amount, description,
          category_id, type, payment_method, ai_extracted,
          original_currency, original_amount,
          stores(name), expense_categories(name)
        `)
        .gte('date', dateFromStr)
        .lte('date', dateToStr)
        .order('date', { ascending: false })
        .range(from, to);

      if (userId !== 'all') {
        countQuery = countQuery.eq('user_id', userId);
        dataQuery = dataQuery.eq('user_id', userId);
      } else if (profile?.role === 'socio') {
        countQuery = countQuery.eq('user_id', user.id);
        dataQuery = dataQuery.eq('user_id', user.id);
      }

      if (storeId !== 'all') {
        countQuery = countQuery.eq('store_id', storeId);
        dataQuery = dataQuery.eq('store_id', storeId);
      }

      const [{ count }, { data, error: fetchError }] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      if (fetchError) throw fetchError;

      setTotalCount(count || 0);
      setExpenses(
        (data || []).map((e: any) => ({
          ...e,
          store_name: e.stores?.name,
          category_name: e.expense_categories?.name,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.role, dateFrom, dateTo, userId, storeId, page, pageSize]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return { expenses, totalCount, loading, error, refetch: fetchExpenses };
}
