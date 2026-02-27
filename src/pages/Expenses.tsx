import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, TrendingDown, Loader2, Trash2, Camera, Sparkles, Upload, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { parseDate } from '@/lib/dateUtils';

interface Expense {
  id: string;
  store_id: string;
  date: string;
  amount: number;
  description: string;
  category_id: string | null;
  type: string;
  payment_method: string | null;
  ai_extracted: boolean;
  original_currency: string | null;
  original_amount: number | null;
  store_name?: string;
  category_name?: string;
}

interface StoreOption {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

const CURRENCIES = [
  { code: 'BRL', label: 'R$ (BRL)', symbol: 'R$' },
  { code: 'USD', label: 'US$ (USD)', symbol: 'US$' },
  { code: 'EUR', label: '€ (EUR)', symbol: '€' },
  { code: 'GBP', label: '£ (GBP)', symbol: '£' },
  { code: 'MXN', label: 'MX$ (MXN)', symbol: 'MX$' },
];

export default function Expenses() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  const [formData, setFormData] = useState({
    store_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    currency: 'BRL',
    description: '',
    category_id: '',
    type: 'variavel',
    payment_method: '',
  });

  const [aiFormData, setAiFormData] = useState({
    store_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    currency: 'BRL',
    description: '',
    category_id: '',
    type: 'variavel',
    payment_method: '',
  });

  useEffect(() => {
    fetchStores();
    fetchCategories();
    fetchExpenses();
  }, []);

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    if (data) setStores(data);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('expense_categories')
      .select('id, name')
      .order('name');
    if (data) setCategories(data);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*, stores(name), expense_categories(name)')
      .order('date', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Error fetching expenses:', error);
    } else {
      const enrichedExpenses: Expense[] = (data || []).map((e: any) => ({
        id: e.id,
        store_id: e.store_id,
        date: e.date,
        amount: e.amount,
        description: e.description,
        category_id: e.category_id,
        type: e.type,
        payment_method: e.payment_method,
        ai_extracted: e.ai_extracted,
        original_currency: e.original_currency,
        original_amount: e.original_amount,
        store_name: e.stores?.name,
        category_name: e.expense_categories?.name,
      }));
      setExpenses(enrichedExpenses);
    }
    setLoading(false);
  };

  const getExchangeRate = async (fromCurrency: string, toCurrency: string): Promise<number> => {
    if (fromCurrency === toCurrency) return 1;
    
    // Try to get direct rate
    const { data: directRate } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('base_currency', fromCurrency)
      .eq('target_currency', toCurrency)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (directRate) return directRate.rate;
    
    // Try reverse rate
    const { data: reverseRate } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('base_currency', toCurrency)
      .eq('target_currency', fromCurrency)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (reverseRate) return 1 / reverseRate.rate;
    
    // Default to 1 if no rate found
    return 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    
    const originalAmount = parseFloat(formData.amount);
    let convertedAmount = originalAmount;
    let exchangeRate = 1;
    
    // Convert to BRL if different currency
    if (formData.currency !== 'BRL') {
      exchangeRate = await getExchangeRate(formData.currency, 'BRL');
      convertedAmount = originalAmount * exchangeRate;
    }

    const expenseData = {
      store_id: formData.store_id || null,
      date: formData.date,
      amount: convertedAmount,
      original_amount: originalAmount,
      original_currency: formData.currency,
      converted_amount: convertedAmount,
      exchange_rate_used: exchangeRate,
      description: formData.description,
      category_id: formData.category_id || null,
      type: formData.type,
      payment_method: formData.payment_method || null,
    };

    let error;
    
    if (editingExpense) {
      const result = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', editingExpense.id);
      error = result.error;
    } else {
      const result = await supabase.from('expenses').insert({
        ...expenseData,
        user_id: user?.id,
        ai_extracted: false,
      });
      error = result.error;
    }

    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      const currencyInfo = CURRENCIES.find(c => c.code === formData.currency);
      const actionText = editingExpense ? 'atualizada' : 'cadastrada';
      const message = formData.currency !== 'BRL' 
        ? `Despesa ${actionText}: ${currencyInfo?.symbol}${originalAmount.toFixed(2)} → R$${convertedAmount.toFixed(2)}`
        : `Despesa ${actionText} com sucesso`;
      
      toast({
        title: 'Sucesso',
        description: message,
      });
      setDialogOpen(false);
      resetForm();
      fetchExpenses();
    }
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      store_id: expense.store_id || '',
      date: expense.date,
      amount: expense.original_amount?.toString() || expense.amount.toString(),
      currency: expense.original_currency || 'BRL',
      description: expense.description,
      category_id: expense.category_id || '',
      type: expense.type,
      payment_method: expense.payment_method || '',
    });
    setDialogOpen(true);
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiFormData.amount || !aiFormData.description) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    
    const originalAmount = parseFloat(aiFormData.amount);
    let convertedAmount = originalAmount;
    let exchangeRate = 1;
    
    // Convert to BRL if different currency
    if (aiFormData.currency !== 'BRL') {
      exchangeRate = await getExchangeRate(aiFormData.currency, 'BRL');
      convertedAmount = originalAmount * exchangeRate;
    }
    
    const { error } = await supabase.from('expenses').insert({
      store_id: aiFormData.store_id || null,
      user_id: user?.id,
      date: aiFormData.date,
      amount: convertedAmount,
      original_amount: originalAmount,
      original_currency: aiFormData.currency,
      converted_amount: convertedAmount,
      exchange_rate_used: exchangeRate,
      description: aiFormData.description,
      category_id: aiFormData.category_id || null,
      type: aiFormData.type,
      payment_method: aiFormData.payment_method || null,
      ai_extracted: true,
    });

    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      const currencyInfo = CURRENCIES.find(c => c.code === aiFormData.currency);
      const message = aiFormData.currency !== 'BRL' 
        ? `Despesa IA cadastrada: ${currencyInfo?.symbol}${originalAmount.toFixed(2)} → R$${convertedAmount.toFixed(2)}`
        : 'Despesa com IA cadastrada com sucesso';
      
      toast({
        title: 'Sucesso',
        description: message,
      });
      setAiDialogOpen(false);
      resetAiForm();
      fetchExpenses();
    }
  };

  const resetForm = () => {
    setEditingExpense(null);
    setFormData({
      store_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      currency: 'BRL',
      description: '',
      category_id: '',
      type: 'variavel',
      payment_method: '',
    });
  };

  const resetAiForm = () => {
    setAiFormData({
      store_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      currency: 'BRL',
      description: '',
      category_id: '',
      type: 'variavel',
      payment_method: '',
    });
    setImagePreview(null);
  };

  const processImageFile = async (file: File) => {
    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Extract data with AI
    setExtracting(true);
    try {
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke('extract-expense', {
        body: { image: base64 },
      });

      if (error) throw error;

      if (data) {
        setAiFormData(prev => ({
          ...prev,
          amount: data.amount?.toString() || '',
          description: data.description || '',
          date: data.date || format(new Date(), 'yyyy-MM-dd'),
        }));

        // Try to match category
        if (data.category) {
          const matchedCategory = categories.find(c => 
            c.name.toLowerCase().includes(data.category.toLowerCase()) ||
            data.category.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matchedCategory) {
            setAiFormData(prev => ({ ...prev, category_id: matchedCategory.id }));
          }
        }

        toast({
          title: 'Dados extraídos!',
          description: 'Revise os dados antes de salvar',
        });
      }
    } catch (error: any) {
      console.error('AI extraction error:', error);
      toast({
        title: 'Erro na extração',
        description: 'Não foi possível extrair os dados. Preencha manualmente.',
        variant: 'destructive',
      });
    }
    setExtracting(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await processImageFile(file);
        }
        return;
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleDelete = async (id: string) => {
    if (!can('delete_expense')) return;
    
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    
    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Excluído',
        description: 'Despesa excluída com sucesso',
      });
      fetchExpenses();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Despesas</h1>
          <p className="page-description">Gerencie as saídas financeiras</p>
        </div>

        <div className="flex gap-2">
          <PermissionGate permission="create_expense">
            <Dialog open={aiDialogOpen} onOpenChange={(open) => {
              setAiDialogOpen(open);
              if (!open) resetAiForm();
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Despesa com IA
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-lg" onPaste={handlePaste}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-info" />
                  Cadastrar Despesa com IA
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAiSubmit} className="space-y-4">
                {/* Image upload area */}
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {extracting ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Extraindo dados com IA...</p>
                    </div>
                  ) : imagePreview ? (
                    <div className="space-y-2">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="max-h-32 mx-auto rounded-lg object-contain"
                      />
                      <p className="text-sm text-muted-foreground">Clique para trocar a imagem</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Camera className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">Tire uma foto, selecione ou cole (Ctrl+V)</p>
                      <p className="text-xs text-muted-foreground">Recibo, nota fiscal, extrato ou comprovante</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Loja (opcional)</Label>
                  <Select
                    value={aiFormData.store_id || '__none__'}
                    onValueChange={(v) => setAiFormData({ ...aiFormData, store_id: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Despesa geral (sem loja)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Despesa geral (sem loja)</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={aiFormData.date}
                    onChange={(e) => setAiFormData({ ...aiFormData, date: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Moeda *</Label>
                    <Select
                      value={aiFormData.currency}
                      onValueChange={(v) => setAiFormData({ ...aiFormData, currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr.code} value={curr.code}>
                            {curr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor ({CURRENCIES.find(c => c.code === aiFormData.currency)?.symbol || 'R$'}) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={aiFormData.amount}
                      onChange={(e) => setAiFormData({ ...aiFormData, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input
                    placeholder="Descrição da despesa"
                    value={aiFormData.description}
                    onChange={(e) => setAiFormData({ ...aiFormData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={aiFormData.category_id}
                      onValueChange={(v) => setAiFormData({ ...aiFormData, category_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={aiFormData.type}
                      onValueChange={(v) => setAiFormData({ ...aiFormData, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixa">Fixa</SelectItem>
                        <SelectItem value="variavel">Variável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setAiDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Despesa'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
          </PermissionGate>

          <PermissionGate permission="create_expense">
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Despesa
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingExpense ? 'Editar Despesa' : 'Cadastrar Despesa'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Loja (opcional)</Label>
                  <Select
                    value={formData.store_id || '__none__'}
                    onValueChange={(v) => setFormData({ ...formData, store_id: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Despesa geral (sem loja)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Despesa geral (sem loja)</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Moeda *</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(v) => setFormData({ ...formData, currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr.code} value={curr.code}>
                            {curr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor ({CURRENCIES.find(c => c.code === formData.currency)?.symbol || 'R$'}) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input
                    placeholder="Descrição da despesa"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) => setFormData({ ...formData, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixa">Fixa</SelectItem>
                        <SelectItem value="variavel">Variável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-danger" />
            Despesas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma despesa cadastrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Loja</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Tipo</th>
                    <th className="text-right">Valor Original</th>
                    <th className="text-right">Valor (BRL)</th>
                    {(can('edit_expense') || can('delete_expense')) && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const currencyInfo = CURRENCIES.find(c => c.code === expense.original_currency);
                    const showOriginal = expense.original_currency && expense.original_currency !== 'BRL' && expense.original_amount;
                    
                    return (
                      <tr key={expense.id}>
                        <td>{format(parseDate(expense.date), 'dd/MM/yyyy')}</td>
                        <td>{expense.store_name || '-'}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            {expense.description}
                            {expense.ai_extracted && (
                              <Badge variant="outline" className="text-xs">
                                <Sparkles className="w-3 h-3 mr-1" />
                                IA
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td>{expense.category_name || '-'}</td>
                        <td>
                          <Badge variant={expense.type === 'fixa' ? 'default' : 'secondary'}>
                            {expense.type === 'fixa' ? 'Fixa' : 'Variável'}
                          </Badge>
                        </td>
                        <td className="text-right font-medium">
                          {showOriginal 
                            ? `${currencyInfo?.symbol || ''}${expense.original_amount?.toFixed(2)}`
                            : '-'
                          }
                        </td>
                        <td className="text-right font-medium text-danger">
                          {formatCurrency(expense.amount)}
                        </td>
                        {(can('edit_expense') || can('delete_expense')) && (
                          <td>
                            <div className="flex items-center gap-1">
                              {can('edit_expense') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(expense)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {can('delete_expense') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(expense.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
