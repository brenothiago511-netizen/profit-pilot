import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2, Plus, Building2, TrendingUp, TrendingDown, ArrowRightLeft,
  Wallet, CreditCard, Star, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface BankAccount {
  id: string;
  store_id: string;
  bank_name: string;
  account_holder: string;
  account_type: string;
  account_number: string;
  currency: string;
  country: string;
  is_primary: boolean;
  balance: number;
  status: string;
  stores?: { name: string };
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  type: string;
  amount: number;
  balance_after: number | null;
  date: string;
  description: string;
  reference_type: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  bank_accounts?: { bank_name: string; currency: string; stores?: { name: string } };
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', BRL: 'R$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', JPY: '¥', CNY: '¥', MXN: '$',
};

function formatCurrency(amount: number, currency: string = 'BRL') {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BANK_OPTIONS = ['Airwallex', 'Mercury', 'Relay', 'Revolut'];

export default function Banks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({
    bank_name: '',
    store_id: '',
    account_holder: '',
    account_number: '',
    currency: 'USD',
  });
  const [txForm, setTxForm] = useState({
    bank_account_id: '',
    type: 'entrada',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    reference_type: 'manual',
    category: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
    fetchStores();
    const channel = supabase
      .channel('bank-transactions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_transactions' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('id, name').eq('status', 'active').order('name');
    if (data) setStores(data);
  };

  const fetchData = async () => {
    setLoading(true);
    const [accountsRes, txRes] = await Promise.all([
      supabase
        .from('bank_accounts')
        .select('*, stores(name)')
        .eq('status', 'active')
        .order('is_primary', { ascending: false }),
      supabase
        .from('bank_transactions')
        .select('*, bank_accounts(bank_name, currency, stores(name))')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (accountsRes.data) setAccounts(accountsRes.data as any);
    if (txRes.data) setTransactions(txRes.data as any);
    setLoading(false);
  };

  const filteredTransactions = useMemo(() => {
    if (selectedAccount === 'all') return transactions;
    return transactions.filter(tx => tx.bank_account_id === selectedAccount);
  }, [transactions, selectedAccount]);

  // Dashboard metrics
  const metrics = useMemo(() => {
    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthTx = transactions.filter(tx => new Date(tx.date) >= monthStart);
    const monthIn = monthTx.filter(tx => tx.type === 'entrada' || tx.type === 'transferencia_entrada')
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const monthOut = monthTx.filter(tx => tx.type === 'saida' || tx.type === 'transferencia_saida')
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    return { totalBalance, monthIn, monthOut, netFlow: monthIn - monthOut };
  }, [accounts, transactions]);

  // Chart data - last 6 months
  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return { month: format(d, 'MMM', { locale: ptBR }), start: startOfMonth(d), end: endOfMonth(d), entradas: 0, saidas: 0 };
    });
    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const m = months.find(m => txDate >= m.start && txDate <= m.end);
      if (m) {
        if (tx.type === 'entrada' || tx.type === 'transferencia_entrada') m.entradas += Number(tx.amount);
        else m.saidas += Number(tx.amount);
      }
    });
    return months.map(m => ({ month: m.month, entradas: m.entradas, saidas: m.saidas }));
  }, [transactions]);

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.bank_account_id || !txForm.amount || !txForm.description) {
      toast({ title: 'Erro', description: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const amount = parseFloat(txForm.amount);
    const account = accounts.find(a => a.id === txForm.bank_account_id);
    if (!account) { setSaving(false); return; }

    const isDebit = txForm.type === 'saida' || txForm.type === 'transferencia_saida';
    const newBalance = isDebit ? Number(account.balance) - amount : Number(account.balance) + amount;

    // Insert transaction
    const { error: txError } = await supabase.from('bank_transactions').insert({
      bank_account_id: txForm.bank_account_id,
      type: txForm.type,
      amount,
      balance_after: newBalance,
      date: txForm.date,
      description: txForm.description,
      reference_type: txForm.reference_type || 'manual',
      category: txForm.category || null,
      notes: txForm.notes || null,
      created_by: user?.id,
    });

    if (txError) {
      toast({ title: 'Erro', description: txError.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    // Update account balance
    const { error: balError } = await supabase
      .from('bank_accounts')
      .update({ balance: newBalance })
      .eq('id', txForm.bank_account_id);

    if (balError) {
      toast({ title: 'Aviso', description: 'Transação salva mas saldo não atualizado', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Movimentação registrada' });
    }

    setShowTransactionDialog(false);
    setTxForm({ bank_account_id: '', type: 'entrada', amount: '', date: format(new Date(), 'yyyy-MM-dd'), description: '', reference_type: 'manual', category: '', notes: '' });
    setSaving(false);
    fetchData();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.bank_name || !accountForm.store_id || !accountForm.account_holder || !accountForm.account_number) {
      toast({ title: 'Erro', description: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('bank_accounts').insert({
      bank_name: accountForm.bank_name,
      store_id: accountForm.store_id,
      account_holder: accountForm.account_holder,
      account_number: accountForm.account_number,
      currency: accountForm.currency,
      country: 'US',
      is_primary: accounts.length === 0,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Conta bancária cadastrada' });
      setShowAccountDialog(false);
      setAccountForm({ bank_name: '', store_id: '', account_holder: '', account_number: '', currency: 'USD' });
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bancos</h1>
          <p className="text-muted-foreground">Gerencie suas contas bancárias e movimentações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAccountDialog(true)}>
            <Building2 className="w-4 h-4 mr-2" />
            Cadastrar Banco
          </Button>
          <Button onClick={() => setShowTransactionDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Movimentação
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Total</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(metrics.totalBalance)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entradas (Mês)</p>
                <p className="text-2xl font-bold text-[hsl(var(--success))] mt-1">
                  {formatCurrency(metrics.monthIn)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[hsl(var(--success-light))] flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-[hsl(var(--success))]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saídas (Mês)</p>
                <p className="text-2xl font-bold text-destructive mt-1">
                  {formatCurrency(metrics.monthOut)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fluxo Líquido</p>
                <p className={`text-2xl font-bold mt-1 ${metrics.netFlow >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                  {formatCurrency(metrics.netFlow)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">
            <CreditCard className="w-4 h-4 mr-2" />
            Contas
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Extrato
          </TabsTrigger>
          <TabsTrigger value="dashboard">
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(account => (
              <Card key={account.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{account.bank_name}</p>
                        <p className="text-xs text-muted-foreground">{(account as any).stores?.name}</p>
                      </div>
                    </div>
                    {account.is_primary && (
                      <Badge variant="default" className="text-xs">
                        <Star className="w-3 h-3 mr-1" /> Principal
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground">Saldo Atual</p>
                    <p className={`text-xl font-bold ${Number(account.balance) >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                      {formatCurrency(Number(account.balance), account.currency)}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>{account.account_holder}</span>
                    <span>•••• {account.account_number.slice(-4)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {accounts.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="p-10 text-center">
                  <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Nenhuma conta bancária cadastrada</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Cadastre contas bancárias nas suas lojas para começar</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Extrato de Movimentações</CardTitle>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filtrar por conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as contas</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.bank_name} - {(a as any).stores?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma movimentação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map(tx => {
                      const isDebit = tx.type === 'saida' || tx.type === 'transferencia_saida';
                      const currency = tx.bank_accounts?.currency || 'BRL';
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm">
                            {format(new Date(tx.date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{tx.description}</p>
                              {tx.reference_type && tx.reference_type !== 'manual' && (
                                <span className="text-xs text-muted-foreground capitalize">{tx.reference_type}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {tx.bank_accounts?.bank_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isDebit ? 'destructive' : 'default'} className="text-xs">
                              {isDebit ? (
                                <><TrendingDown className="w-3 h-3 mr-1" /> Saída</>
                              ) : (
                                <><TrendingUp className="w-3 h-3 mr-1" /> Entrada</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${isDebit ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>
                            {isDebit ? '-' : '+'}{formatCurrency(Number(tx.amount), currency)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {tx.balance_after != null ? formatCurrency(Number(tx.balance_after), currency) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fluxo de Caixa - Últimos 6 Meses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      />
                      <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Saldo por Conta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {accounts.map(account => {
                    const balance = Number(account.balance);
                    const maxBalance = Math.max(...accounts.map(a => Math.abs(Number(a.balance))), 1);
                    const pct = Math.min((Math.abs(balance) / maxBalance) * 100, 100);
                    return (
                      <div key={account.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{account.bank_name}</span>
                            <span className="text-xs text-muted-foreground">({(account as any).stores?.name})</span>
                          </div>
                          <span className={`text-sm font-bold ${balance >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                            {formatCurrency(balance, account.currency)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${balance >= 0 ? 'bg-[hsl(var(--success))]' : 'bg-destructive'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {accounts.length === 0 && (
                    <p className="text-center text-muted-foreground py-6">Nenhuma conta para exibir</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Transaction Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Nova Movimentação
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitTransaction} className="space-y-4">
            <div className="space-y-2">
              <Label>Conta Bancária *</Label>
              <Select value={txForm.bank_account_id} onValueChange={v => setTxForm({ ...txForm, bank_account_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.bank_name} - {(a as any).stores?.name} ({formatCurrency(Number(a.balance), a.currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={txForm.type} onValueChange={v => setTxForm({ ...txForm, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="transferencia_entrada">Transferência (Entrada)</SelectItem>
                    <SelectItem value="transferencia_saida">Transferência (Saída)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={txForm.amount}
                  onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={txForm.date}
                  onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={txForm.reference_type} onValueChange={v => setTxForm({ ...txForm, reference_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="shopify_withdrawal">Saque Shopify</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                placeholder="Descrição da movimentação"
                value={txForm.description}
                onChange={e => setTxForm({ ...txForm, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Informações adicionais..."
                value={txForm.notes}
                onChange={e => setTxForm({ ...txForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowTransactionDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
