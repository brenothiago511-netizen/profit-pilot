import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useCurrency, ExchangeRate, AVAILABLE_CURRENCIES } from '@/hooks/useCurrency';
import { 
  Plus, 
  Loader2, 
  Settings, 
  DollarSign, 
  RefreshCw, 
  Trash2, 
  Globe,
  TrendingUp,
  Calendar,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDate, compareDatesDesc } from '@/lib/dateUtils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function CurrencySettings() {
  const { toast } = useToast();
  const { 
    config, 
    loading, 
    updateBaseCurrency, 
    addExchangeRate, 
    deleteExchangeRate,
    getCurrencyName,
    getCurrencySymbol,
    formatCurrency,
    refetch,
  } = useCurrency();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [selectedBaseCurrency, setSelectedBaseCurrency] = useState(config.baseCurrency);
  const [rateForm, setRateForm] = useState({
    base_currency: 'USD',
    target_currency: 'BRL',
    rate: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    source: 'manual',
  });

  const handleFetchRates = async () => {
    setFetchingRates(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-exchange-rates');
      
      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: 'Sucesso',
          description: `${data.rates?.length || 0} taxas de câmbio atualizadas`,
        });
        refetch();
      } else {
        throw new Error(data?.error || 'Erro ao buscar cotações');
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível buscar as cotações',
        variant: 'destructive',
      });
    } finally {
      setFetchingRates(false);
    }
  };

  useEffect(() => {
    setSelectedBaseCurrency(config.baseCurrency);
  }, [config.baseCurrency]);

  const handleSaveBaseCurrency = async () => {
    setSaving(true);
    const { error } = await updateBaseCurrency(selectedBaseCurrency);
    setSaving(false);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a moeda base',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Moeda base atualizada com sucesso',
      });
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!rateForm.rate || parseFloat(rateForm.rate) <= 0) {
      toast({
        title: 'Erro',
        description: 'Informe uma taxa válida',
        variant: 'destructive',
      });
      return;
    }

    if (rateForm.base_currency === rateForm.target_currency) {
      toast({
        title: 'Erro',
        description: 'Moeda de origem e destino devem ser diferentes',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await addExchangeRate({
      base_currency: rateForm.base_currency,
      target_currency: rateForm.target_currency,
      rate: parseFloat(rateForm.rate),
      date: rateForm.date,
      source: rateForm.source,
    });
    setSaving(false);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Taxa de câmbio adicionada',
      });
      setDialogOpen(false);
      setRateForm({
        base_currency: 'USD',
        target_currency: 'BRL',
        rate: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        source: 'manual',
      });
    }
  };

  const handleDeleteRate = async (id: string) => {
    const { error } = await deleteExchangeRate(id);
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a taxa',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Taxa removida',
      });
    }
  };

  // Group rates by currency pair
  const ratesByPair = config.exchangeRates.reduce((acc, rate) => {
    const key = `${rate.base_currency}-${rate.target_currency}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(rate);
    return acc;
  }, {} as Record<string, ExchangeRate[]>);

  // Get latest rate for each pair
  const latestRates = Object.entries(ratesByPair).map(([pair, rates]) => {
    const sorted = [...rates].sort((a, b) => compareDatesDesc(a.date, b.date));
    return sorted[0];
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Configurações de Moeda</h1>
        <p className="page-description">
          Gerencie a moeda base e as taxas de câmbio do sistema
        </p>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList>
          <TabsTrigger value="config">Configuração Geral</TabsTrigger>
          <TabsTrigger value="rates">Taxas de Câmbio</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* General Configuration */}
        <TabsContent value="config" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Moeda Base
                </CardTitle>
                <CardDescription>
                  Todos os relatórios consolidados usam a moeda base para cálculos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Moeda Base Global</Label>
                  <Select 
                    value={selectedBaseCurrency} 
                    onValueChange={setSelectedBaseCurrency}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {getCurrencySymbol(currency)} {currency} - {getCurrencyName(currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleSaveBaseCurrency}
                  disabled={saving || selectedBaseCurrency === config.baseCurrency}
                  className="w-full"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Moeda Base'
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Como Funciona
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0">1</Badge>
                  <p>Cada loja opera em sua própria moeda</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0">2</Badge>
                  <p>Receitas e despesas são registradas na moeda original</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0">3</Badge>
                  <p>Valores são convertidos para moeda base usando a taxa do dia</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0">4</Badge>
                  <p>Relatórios consolidados mostram tudo na moeda base</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Rates Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Taxas Atuais
                  </CardTitle>
                  <CardDescription>
                    Últimas taxas de câmbio cadastradas
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleFetchRates}
                    disabled={fetchingRates}
                  >
                    {fetchingRates ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4 mr-2" />
                        Buscar Cotações
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {latestRates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma taxa cadastrada</p>
                  <p className="text-sm">Adicione taxas de câmbio na aba "Taxas de Câmbio"</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {latestRates.map((rate) => (
                    <div key={rate.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{rate.base_currency}</Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="secondary">{rate.target_currency}</Badge>
                        </div>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="text-xs">
                              {rate.source}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Fonte: {rate.source === 'manual' ? 'Manual' : 'API'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-2xl font-bold">
                        {rate.rate.toFixed(4)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {format(parseDate(rate.date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exchange Rates Management */}
        <TabsContent value="rates" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gerenciar Taxas de Câmbio</CardTitle>
                  <CardDescription>
                    Adicione ou atualize taxas de câmbio para conversões
                  </CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Taxa
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Taxa de Câmbio</DialogTitle>
                      <DialogDescription>
                        Cadastre uma nova taxa de conversão entre moedas
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddRate} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>De (Moeda Origem)</Label>
                          <Select 
                            value={rateForm.base_currency}
                            onValueChange={(v) => setRateForm({ ...rateForm, base_currency: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_CURRENCIES.map((currency) => (
                                <SelectItem key={currency} value={currency}>
                                  {getCurrencySymbol(currency)} {currency}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Para (Moeda Destino)</Label>
                          <Select 
                            value={rateForm.target_currency}
                            onValueChange={(v) => setRateForm({ ...rateForm, target_currency: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_CURRENCIES.map((currency) => (
                                <SelectItem key={currency} value={currency}>
                                  {getCurrencySymbol(currency)} {currency}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Taxa de Conversão</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">1 {rateForm.base_currency} =</span>
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="0.0000"
                            value={rateForm.rate}
                            onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                            className="flex-1"
                          />
                          <span className="text-sm text-muted-foreground">{rateForm.target_currency}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Data da Cotação</Label>
                        <Input
                          type="date"
                          value={rateForm.date}
                          onChange={(e) => setRateForm({ ...rateForm, date: e.target.value })}
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={saving}>
                          {saving ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            'Adicionar Taxa'
                          )}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {latestRates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma taxa cadastrada ainda</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Par de Moedas</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {latestRates.map((rate) => (
                        <TableRow key={rate.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{rate.base_currency}</Badge>
                              <span>→</span>
                              <Badge variant="outline">{rate.target_currency}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {rate.rate.toFixed(4)}
                          </TableCell>
                          <TableCell>
                            {format(parseDate(rate.date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {rate.source === 'manual' ? 'Manual' : 'API'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRate(rate.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Taxas</CardTitle>
              <CardDescription>
                Todas as taxas de câmbio cadastradas, ordenadas por data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config.exchangeRates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum histórico disponível</p>
                </div>
              ) : (
                <div className="rounded-md border max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Par</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {config.exchangeRates
                        .sort((a, b) => compareDatesDesc(a.date, b.date))
                        .map((rate) => (
                          <TableRow key={rate.id}>
                            <TableCell>
                              {format(parseDate(rate.date), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono">
                                {rate.base_currency}/{rate.target_currency}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono">
                              {rate.rate.toFixed(4)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {rate.source}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(rate.created_at), "dd/MM/yy 'às' HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
