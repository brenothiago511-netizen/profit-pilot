import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { usePermissions } from '@/hooks/usePermissions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2, Store } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DREData {
  revenues: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  commissions: number;
  netProfit: number;
}

interface StoreOption {
  id: string;
  name: string;
}

export default function Reports() {
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));
  const [dreData, setDreData] = useState<DREData>({
    revenues: [],
    expenses: [],
    totalRevenue: 0,
    totalExpenses: 0,
    grossProfit: 0,
    commissions: 0,
    netProfit: 0,
  });

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchDREData();
  }, [selectedStore, selectedMonth]);

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    if (data) setStores(data);
  };

  const fetchDREData = async () => {
    setLoading(true);
    
    const monthDate = new Date(selectedMonth + '-01');
    const periodStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const periodEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    try {
      // Fetch revenues grouped by source
      let revenueQuery = supabase
        .from('revenues')
        .select('source, amount')
        .gte('date', periodStart)
        .lte('date', periodEnd);
      
      if (selectedStore !== 'all') {
        revenueQuery = revenueQuery.eq('store_id', selectedStore);
      }
      
      const { data: revenues } = await revenueQuery;
      
      // Group revenues by source
      const revenuesBySource: Record<string, number> = {};
      revenues?.forEach(r => {
        const source = r.source || 'Outros';
        revenuesBySource[source] = (revenuesBySource[source] || 0) + Number(r.amount);
      });
      
      const revenueList = Object.entries(revenuesBySource).map(([category, amount]) => ({
        category,
        amount,
      }));
      
      const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

      // Fetch expenses with categories
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_categories(name)')
        .gte('date', periodStart)
        .lte('date', periodEnd);
      
      if (selectedStore !== 'all') {
        expenseQuery = expenseQuery.eq('store_id', selectedStore);
      }
      
      const { data: expenses } = await expenseQuery;
      
      // Group expenses by category
      const expensesByCategory: Record<string, number> = {};
      expenses?.forEach((e: any) => {
        const category = e.expense_categories?.name || 'Outros';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + Number(e.amount);
      });
      
      const expenseList = Object.entries(expensesByCategory).map(([category, amount]) => ({
        category,
        amount,
      }));
      
      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Fetch commissions
      let commissionQuery = supabase
        .from('commissions')
        .select('commission_amount')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd);
      
      if (selectedStore !== 'all') {
        commissionQuery = commissionQuery.eq('store_id', selectedStore);
      }
      
      const { data: commissions } = await commissionQuery;
      const totalCommissions = commissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

      const grossProfit = totalRevenue - totalExpenses;
      const netProfit = grossProfit - totalCommissions;

      setDreData({
        revenues: revenueList,
        expenses: expenseList,
        totalRevenue,
        totalExpenses,
        grossProfit,
        commissions: totalCommissions,
        netProfit,
      });
    } catch (error) {
      console.error('Error fetching DRE data:', error);
    }

    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const exportToCSV = () => {
    const monthLabel = format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR });
    
    let csv = `DRE - ${monthLabel}\n\n`;
    csv += 'RECEITAS\n';
    csv += 'Categoria,Valor\n';
    dreData.revenues.forEach(r => {
      csv += `${r.category},${r.amount}\n`;
    });
    csv += `TOTAL RECEITAS,${dreData.totalRevenue}\n\n`;
    
    csv += 'DESPESAS\n';
    csv += 'Categoria,Valor\n';
    dreData.expenses.forEach(e => {
      csv += `${e.category},${e.amount}\n`;
    });
    csv += `TOTAL DESPESAS,${dreData.totalExpenses}\n\n`;
    
    csv += 'RESULTADO\n';
    csv += `Lucro Bruto,${dreData.grossProfit}\n`;
    csv += `Comissões,${dreData.commissions}\n`;
    csv += `Lucro Líquido,${dreData.netProfit}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DRE_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-description">Demonstrativo de Resultado do Exercício (DRE)</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <input
            type="month"
            className="flex h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />

          <PermissionGate permission="export_reports">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </PermissionGate>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              DRE - {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Receitas */}
            <div>
              <h3 className="font-semibold text-success mb-3">RECEITAS</h3>
              <div className="space-y-2">
                {dreData.revenues.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma receita no período</p>
                ) : (
                  dreData.revenues.map((r, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">{r.category}</span>
                      <span className="text-success">{formatCurrency(r.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-2 font-semibold">
                  <span>Total Receitas</span>
                  <span className="text-success">{formatCurrency(dreData.totalRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Despesas */}
            <div>
              <h3 className="font-semibold text-danger mb-3">DESPESAS</h3>
              <div className="space-y-2">
                {dreData.expenses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma despesa no período</p>
                ) : (
                  dreData.expenses.map((e, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">{e.category}</span>
                      <span className="text-danger">({formatCurrency(e.amount)})</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-2 font-semibold">
                  <span>Total Despesas</span>
                  <span className="text-danger">({formatCurrency(dreData.totalExpenses)})</span>
                </div>
              </div>
            </div>

            {/* Resultado */}
            <div className="pt-4 border-t-2 border-border">
              <div className="space-y-3">
                <div className="flex justify-between py-2">
                  <span className="font-medium">Lucro Bruto</span>
                  <span className={dreData.grossProfit >= 0 ? 'text-success' : 'text-danger'}>
                    {formatCurrency(dreData.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">(-) Comissões</span>
                  <span className="text-info">({formatCurrency(dreData.commissions)})</span>
                </div>
                <div className="flex justify-between py-3 text-lg font-bold bg-muted/50 rounded-lg px-4 -mx-4">
                  <span>Lucro Líquido</span>
                  <span className={dreData.netProfit >= 0 ? 'text-success' : 'text-danger'}>
                    {formatCurrency(dreData.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
