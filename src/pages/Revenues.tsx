import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, TrendingUp, Loader2, Trash2, Upload, X, Image, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDate } from '@/lib/dateUtils';
import { DialogDescription } from '@/components/ui/dialog';

interface Revenue {
  id: string;
  store_id: string;
  user_id: string;
  date: string;
  amount: number;
  source: string | null;
  payment_method: string | null;
  notes: string | null;
  original_currency: string | null;
  original_amount: number | null;
  image_url: string | null;
  stores: { name: string } | null;
}

interface StoreOption {
  id: string;
  name: string;
}

interface ProfileMap {
  [userId: string]: string;
}

const CURRENCIES = [
  { code: 'BRL', label: 'R$ (BRL)', symbol: 'R$' },
  { code: 'USD', label: 'US$ (USD)', symbol: 'US$' },
  { code: 'EUR', label: '€ (EUR)', symbol: '€' },
  { code: 'GBP', label: '£ (GBP)', symbol: '£' },
  { code: 'MXN', label: 'MX$ (MXN)', symbol: 'MX$' },
];

export default function Revenues() {
  const { user, profile } = useAuth();
  const { can } = usePermissions();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [profileNames, setProfileNames] = useState<ProfileMap>({});
  const isAdmin = profile?.role === 'admin';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [formData, setFormData] = useState({
    store_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    currency: 'BRL',
    source: '',
    payment_method: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      store_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      currency: 'BRL',
      source: '',
      payment_method: '',
      notes: '',
    });
    setImageFile(null);
    setImagePreview(null);
    setEditingRevenue(null);
  };

  const openEditDialog = (revenue: Revenue) => {
    setEditingRevenue(revenue);
    setFormData({
      store_id: revenue.store_id || '',
      date: revenue.date,
      amount: revenue.original_amount?.toString() || revenue.amount.toString(),
      currency: revenue.original_currency || 'BRL',
      source: revenue.source || '',
      payment_method: revenue.payment_method || '',
      notes: revenue.notes || '',
    });
    setImagePreview(revenue.image_url);
    setDialogOpen(true);
  };

  useEffect(() => {
    fetchStores();
    fetchRevenues();
    if (isAdmin) fetchProfileNames();
  }, []);

  const fetchProfileNames = async () => {
    const { data } = await supabase.from('profiles').select('id, name');
    if (data) {
      const map: ProfileMap = {};
      data.forEach((p: any) => { map[p.id] = p.name; });
      setProfileNames(map);
    }
  };

  const fetchStores = async () => {
    const { data } = await supabase
      .from('stores')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    
    if (data) setStores(data);
  };

  const fetchRevenues = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('revenues')
      .select('*, stores(name)')
      .order('date', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Error fetching revenues:', error);
    } else {
      setRevenues(data || []);
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('revenue-images')
      .upload(fileName, file);
    
    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }
    
    const { data } = supabase.storage
      .from('revenue-images')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) {
      toast({
        title: 'Erro',
        description: 'Preencha o valor da receita',
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
    
    // Upload image if present (new file)
    let imageUrl: string | null = editingRevenue?.image_url || null;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
    }

    const revenueData = {
      store_id: formData.store_id || null,
      date: formData.date,
      amount: convertedAmount,
      original_amount: originalAmount,
      original_currency: formData.currency,
      converted_amount: convertedAmount,
      exchange_rate_used: exchangeRate,
      source: formData.source || null,
      payment_method: formData.payment_method || null,
      notes: formData.notes || null,
      image_url: imageUrl,
    };

    let error;
    
    if (editingRevenue) {
      // Update existing revenue
      const { error: updateError } = await supabase
        .from('revenues')
        .update(revenueData)
        .eq('id', editingRevenue.id);
      error = updateError;
    } else {
      // Insert new revenue
      const { error: insertError } = await supabase.from('revenues').insert({
        ...revenueData,
        user_id: user?.id,
      });
      error = insertError;
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
      const actionText = editingRevenue ? 'atualizada' : 'cadastrada';
      const message = formData.currency !== 'BRL' 
        ? `Receita ${actionText}: ${currencyInfo?.symbol}${originalAmount.toFixed(2)} → R$${convertedAmount.toFixed(2)}`
        : `Receita ${actionText} com sucesso`;
      
      toast({
        title: 'Sucesso',
        description: message,
      });
      setDialogOpen(false);
      resetForm();
      fetchRevenues();
    }
  };

  const handleDelete = async (id: string) => {
    if (!can('delete_revenue')) return;
    
    const { error } = await supabase.from('revenues').delete().eq('id', id);
    
    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Excluído',
        description: 'Receita excluída com sucesso',
      });
      fetchRevenues();
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
          <h1 className="page-title">Receitas</h1>
          <p className="page-description">Gerencie as entradas financeiras</p>
        </div>

        <PermissionGate permission="create_revenue">
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Receita
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRevenue ? 'Editar Receita' : 'Cadastrar Receita'}</DialogTitle>
              <DialogDescription>
                {editingRevenue ? 'Atualize os dados da receita' : 'Preencha os dados da nova receita'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Loja (opcional)</Label>
                <Select
                  value={formData.store_id || '__none__'}
                  onValueChange={(v) => setFormData({ ...formData, store_id: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a loja (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma loja</SelectItem>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Input
                    placeholder="Ex: Vendas, Serviços"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  />
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
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Comprovante (opcional)</Label>
                {imagePreview ? (
                  <div className="relative">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-32 object-cover rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-2 pb-3">
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <p className="text-sm text-muted-foreground">Clique para enviar imagem</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Notas adicionais..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            Receitas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : revenues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma receita cadastrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Data</th>
                    <th>Loja</th>
                    <th>Origem</th>
                    <th>Pagamento</th>
                    <th className="text-right">Valor Original</th>
                    <th className="text-right">Valor (BRL)</th>
                    {(can('edit_revenue') || can('delete_revenue')) && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {revenues.map((revenue) => {
                    const currencyInfo = CURRENCIES.find(c => c.code === revenue.original_currency);
                    const showOriginal = revenue.original_currency && revenue.original_currency !== 'BRL' && revenue.original_amount;
                    
                    return (
                      <tr key={revenue.id}>
                        <td className="w-10">
                          {revenue.image_url ? (
                            <a href={revenue.image_url} target="_blank" rel="noopener noreferrer">
                              <img 
                                src={revenue.image_url} 
                                alt="Comprovante" 
                                className="w-8 h-8 object-cover rounded border hover:opacity-80 transition-opacity"
                              />
                            </a>
                          ) : (
                            <div className="w-8 h-8 flex items-center justify-center text-muted-foreground">
                              <Image className="w-4 h-4" />
                            </div>
                          )}
                        </td>
                        <td>{format(parseDate(revenue.date), 'dd/MM/yyyy')}</td>
                        <td>{revenue.stores?.name || '-'}</td>
                        <td>{revenue.source || '-'}</td>
                        <td className="capitalize">{revenue.payment_method?.replace('_', ' ') || '-'}</td>
                        <td className="text-right font-medium">
                          {showOriginal 
                            ? `${currencyInfo?.symbol || ''}${revenue.original_amount?.toFixed(2)}`
                            : '-'
                          }
                        </td>
                        <td className="text-right font-medium text-success">
                          {formatCurrency(revenue.amount)}
                        </td>
                        {(can('edit_revenue') || can('delete_revenue')) && (
                          <td className="flex gap-1">
                            {can('edit_revenue') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(revenue)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {can('delete_revenue') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(revenue.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
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
