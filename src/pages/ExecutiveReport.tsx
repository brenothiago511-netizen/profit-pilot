import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Download, 
  Loader2, 
  Store, 
  TrendingUp, 
  TrendingDown,
  Target,
  Users,
  DollarSign,
  FileSpreadsheet
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface StoreOption {
  id: string;
  name: string;
}

interface ReportData {
  // Revenue data
  totalRevenue: number;
  revenueBySource: { source: string; amount: number }[];
  
  // Expense data  
  totalExpenses: number;
  expensesByCategory: { category: string; amount: number }[];
  
  // Profit
  grossProfit: number;
  totalCommissions: number;
  netProfit: number;
  
  // Goals
  goals: { storeName: string; goal: number; achieved: number; percentage: number }[];
  
  // Partners
  partners: { 
    name: string; 
    storeName: string; 
    percentage: number; 
    capital: number;
    profitShare: number;
  }[];
}

export default function ExecutiveReport() {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));
  const [reportData, setReportData] = useState<ReportData>({
    totalRevenue: 0,
    revenueBySource: [],
    totalExpenses: 0,
    expensesByCategory: [],
    grossProfit: 0,
    totalCommissions: 0,
    netProfit: 0,
    goals: [],
    partners: [],
  });

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [selectedStore, selectedMonth]);

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    if (data) setStores(data);
  };

  const fetchReportData = async () => {
    setLoading(true);
    
    const monthDate = new Date(selectedMonth + '-01');
    const periodStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const periodEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    try {
      // Fetch revenues
      let revenueQuery = supabase
        .from('revenues')
        .select('source, amount')
        .gte('date', periodStart)
        .lte('date', periodEnd);
      
      if (selectedStore !== 'all') {
        revenueQuery = revenueQuery.eq('store_id', selectedStore);
      }
      
      const { data: revenues } = await revenueQuery;
      
      const revenuesBySource: Record<string, number> = {};
      revenues?.forEach(r => {
        const source = r.source || 'Outros';
        revenuesBySource[source] = (revenuesBySource[source] || 0) + Number(r.amount);
      });
      
      const revenueBySource = Object.entries(revenuesBySource).map(([source, amount]) => ({
        source,
        amount,
      }));
      
      const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

      // Fetch expenses
      let expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_categories(name)')
        .gte('date', periodStart)
        .lte('date', periodEnd);
      
      if (selectedStore !== 'all') {
        expenseQuery = expenseQuery.eq('store_id', selectedStore);
      }
      
      const { data: expenses } = await expenseQuery;
      
      const expensesByCategory: Record<string, number> = {};
      expenses?.forEach((e: any) => {
        const category = e.expense_categories?.name || 'Outros';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + Number(e.amount);
      });
      
      const expensesByCategoryList = Object.entries(expensesByCategory).map(([category, amount]) => ({
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

      // Fetch goals
      let goalsQuery = supabase
        .from('revenue_goals')
        .select('store_id, goal_amount_original, stores(name)')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd);
      
      if (selectedStore !== 'all') {
        goalsQuery = goalsQuery.eq('store_id', selectedStore);
      }
      
      const { data: goalsData } = await goalsQuery;
      
      const goals = await Promise.all((goalsData || []).map(async (g: any) => {
        // Get revenue for this store in period
        const { data: storeRevenue } = await supabase
          .from('revenues')
          .select('amount')
          .eq('store_id', g.store_id)
          .gte('date', periodStart)
          .lte('date', periodEnd);
        
        const achieved = storeRevenue?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
        const percentage = g.goal_amount_original > 0 ? (achieved / g.goal_amount_original) * 100 : 0;
        
        return {
          storeName: g.stores?.name || 'N/A',
          goal: g.goal_amount_original,
          achieved,
          percentage,
        };
      }));

      // Fetch partners with profit share
      let partnersQuery = supabase
        .from('partners')
        .select('id, user_id, store_id, capital_percentage, capital_amount, stores(name)')
        .eq('status', 'active');
      
      if (selectedStore !== 'all') {
        partnersQuery = partnersQuery.eq('store_id', selectedStore);
      }
      
      const { data: partnersData } = await partnersQuery;
      
      // Get user profiles
      const userIds = partnersData?.map(p => p.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      // Calculate profit share for each partner based on store profit and their percentage
      const partnersWithProfitShare = await Promise.all((partnersData || []).map(async (p: any) => {
        // Get store profit
        const { data: storeRevenues } = await supabase
          .from('revenues')
          .select('amount')
          .eq('store_id', p.store_id)
          .gte('date', periodStart)
          .lte('date', periodEnd);
        
        const { data: storeExpenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('store_id', p.store_id)
          .gte('date', periodStart)
          .lte('date', periodEnd);
        
        const { data: storeCommissions } = await supabase
          .from('commissions')
          .select('commission_amount')
          .eq('store_id', p.store_id)
          .gte('period_start', periodStart)
          .lte('period_end', periodEnd);
        
        const storeRevenue = storeRevenues?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
        const storeExpense = storeExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
        const storeCommission = storeCommissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;
        
        const storeProfit = storeRevenue - storeExpense - storeCommission;
        const profitShare = (storeProfit * p.capital_percentage) / 100;
        
        return {
          name: profilesMap.get(p.user_id)?.name || 'N/A',
          storeName: p.stores?.name || 'N/A',
          percentage: p.capital_percentage,
          capital: p.capital_amount,
          profitShare,
        };
      }));

      setReportData({
        totalRevenue,
        revenueBySource,
        totalExpenses,
        expensesByCategory: expensesByCategoryList,
        grossProfit,
        totalCommissions,
        netProfit,
        goals,
        partners: partnersWithProfitShare,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    }

    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const monthLabel = format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR });

  // Chart colors
  const CHART_COLORS = [
    '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#6366f1'
  ];
  const EXPENSE_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#14b8a6', '#0ea5e9', '#a855f7', '#f43f5e'
  ];

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Relatório Executivo', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), pageWidth / 2, 28, { align: 'center' });
    
    let yPos = 40;
    
    // Financial Summary
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('Resumo Financeiro', 14, yPos);
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Indicador', 'Valor']],
      body: [
        ['Receita Total', formatCurrency(reportData.totalRevenue)],
        ['Despesas Totais', formatCurrency(reportData.totalExpenses)],
        ['Lucro Bruto', formatCurrency(reportData.grossProfit)],
        ['Comissões', formatCurrency(reportData.totalCommissions)],
        ['Lucro Líquido', formatCurrency(reportData.netProfit)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Revenue by Source
    if (reportData.revenueBySource.length > 0) {
      doc.setFontSize(14);
      doc.text('Receitas por Fonte', 14, yPos);
      yPos += 8;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Fonte', 'Valor']],
        body: reportData.revenueBySource.map(r => [r.source, formatCurrency(r.amount)]),
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Expenses by Category
    if (reportData.expensesByCategory.length > 0) {
      doc.setFontSize(14);
      doc.text('Despesas por Categoria', 14, yPos);
      yPos += 8;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Categoria', 'Valor']],
        body: reportData.expensesByCategory.map(e => [e.category, formatCurrency(e.amount)]),
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68] },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Goals
    if (reportData.goals.length > 0) {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.text('Metas de Receita', 14, yPos);
      yPos += 8;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Loja', 'Meta', 'Realizado', '% Atingido']],
        body: reportData.goals.map(g => [
          g.storeName,
          formatCurrency(g.goal),
          formatCurrency(g.achieved),
          `${g.percentage.toFixed(1)}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [168, 85, 247] },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Partners
    if (reportData.partners.length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.text('Resultado Societário', 14, yPos);
      yPos += 8;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Sócio', 'Loja', 'Participação', 'Capital', 'Resultado']],
        body: reportData.partners.map(p => [
          p.name,
          p.storeName,
          `${p.percentage}%`,
          formatCurrency(p.capital),
          formatCurrency(p.profitShare)
        ]),
        theme: 'striped',
        headStyles: { fillColor: [251, 146, 60] },
      });
    }
    
    doc.save(`Relatorio_Executivo_${selectedMonth}.pdf`);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
      ['Relatório Executivo - ' + monthLabel],
      [],
      ['RESUMO FINANCEIRO'],
      ['Receita Total', reportData.totalRevenue],
      ['Despesas Totais', reportData.totalExpenses],
      ['Lucro Bruto', reportData.grossProfit],
      ['Comissões', reportData.totalCommissions],
      ['Lucro Líquido', reportData.netProfit],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumo');
    
    // Revenue sheet
    if (reportData.revenueBySource.length > 0) {
      const revenueData = [
        ['Fonte', 'Valor'],
        ...reportData.revenueBySource.map(r => [r.source, r.amount])
      ];
      const revenueSheet = XLSX.utils.aoa_to_sheet(revenueData);
      XLSX.utils.book_append_sheet(wb, revenueSheet, 'Receitas');
    }
    
    // Expenses sheet
    if (reportData.expensesByCategory.length > 0) {
      const expenseData = [
        ['Categoria', 'Valor'],
        ...reportData.expensesByCategory.map(e => [e.category, e.amount])
      ];
      const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData);
      XLSX.utils.book_append_sheet(wb, expenseSheet, 'Despesas');
    }
    
    // Goals sheet
    if (reportData.goals.length > 0) {
      const goalsData = [
        ['Loja', 'Meta', 'Realizado', '% Atingido'],
        ...reportData.goals.map(g => [g.storeName, g.goal, g.achieved, g.percentage])
      ];
      const goalsSheet = XLSX.utils.aoa_to_sheet(goalsData);
      XLSX.utils.book_append_sheet(wb, goalsSheet, 'Metas');
    }
    
    // Partners sheet
    if (reportData.partners.length > 0) {
      const partnersData = [
        ['Sócio', 'Loja', 'Participação (%)', 'Capital', 'Resultado'],
        ...reportData.partners.map(p => [p.name, p.storeName, p.percentage, p.capital, p.profitShare])
      ];
      const partnersSheet = XLSX.utils.aoa_to_sheet(partnersData);
      XLSX.utils.book_append_sheet(wb, partnersSheet, 'Sócios');
    }
    
    XLSX.writeFile(wb, `Relatorio_Executivo_${selectedMonth}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Relatório Executivo</h1>
          <p className="page-description">Visão consolidada de receitas, lucros, metas e resultado societário</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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
            className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />

          <PermissionGate permission="export_reports">
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToPDF}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" onClick={exportToExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </PermissionGate>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(reportData.totalRevenue)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Despesas</CardTitle>
                <TrendingDown className="h-4 w-4 text-danger" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-danger">{formatCurrency(reportData.totalExpenses)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Lucro Bruto</CardTitle>
                <DollarSign className="h-4 w-4 text-info" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${reportData.grossProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(reportData.grossProfit)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Comissões</CardTitle>
                <Users className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{formatCurrency(reportData.totalCommissions)}</div>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${reportData.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(reportData.netProfit)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Overview Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Visão Geral Financeira
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Receita', valor: reportData.totalRevenue, fill: 'hsl(var(--success))' },
                      { name: 'Despesas', valor: reportData.totalExpenses, fill: 'hsl(var(--danger))' },
                      { name: 'Comissões', valor: reportData.totalCommissions, fill: 'hsl(var(--warning))' },
                      { name: 'Lucro Líquido', valor: Math.max(0, reportData.netProfit), fill: 'hsl(var(--primary))' },
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      className="text-xs fill-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue by Source Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  Receitas por Fonte
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportData.revenueBySource.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhuma receita no período</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportData.revenueBySource.map((r, i) => ({
                            name: r.source,
                            value: r.amount,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportData.revenueBySource.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={CHART_COLORS[index % CHART_COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expenses by Category Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-danger" />
                  Despesas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportData.expensesByCategory.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhuma despesa no período</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportData.expensesByCategory.map((e, i) => ({
                            name: e.category,
                            value: e.amount,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportData.expensesByCategory.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Goals with Progress Bars */}
          {reportData.goals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Metas de Receita
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {reportData.goals.map((goal, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{goal.storeName}</span>
                        <Badge variant={goal.percentage >= 100 ? 'default' : goal.percentage >= 80 ? 'secondary' : 'destructive'}>
                          {goal.percentage.toFixed(1)}%
                        </Badge>
                      </div>
                      <Progress 
                        value={Math.min(goal.percentage, 100)} 
                        className="h-3"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Realizado: {formatCurrency(goal.achieved)}</span>
                        <span>Meta: {formatCurrency(goal.goal)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Goals Bar Chart */}
                <div className="mt-8 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={reportData.goals.map(g => ({
                        loja: g.storeName,
                        meta: g.goal,
                        realizado: g.achieved,
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="loja" className="text-xs fill-muted-foreground" />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                        className="text-xs fill-muted-foreground"
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Partners Result */}
          {reportData.partners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-warning" />
                  Resultado Societário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Sócio</th>
                        <th>Loja</th>
                        <th className="text-center">Participação</th>
                        <th className="text-right">Capital</th>
                        <th className="text-right">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.partners.map((partner, i) => (
                        <tr key={i}>
                          <td className="font-medium">{partner.name}</td>
                          <td>{partner.storeName}</td>
                          <td className="text-center">
                            <Badge variant="outline">{partner.percentage}%</Badge>
                          </td>
                          <td className="text-right">{formatCurrency(partner.capital)}</td>
                          <td className={`text-right font-medium ${partner.profitShare >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatCurrency(partner.profitShare)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
