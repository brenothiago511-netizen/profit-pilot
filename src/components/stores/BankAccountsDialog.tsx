import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, CreditCard, Star, Building } from 'lucide-react';

interface BankAccount {
  id: string;
  store_id: string;
  bank_name: string;
  account_holder: string;
  account_type: string;
  routing_number: string | null;
  account_number: string;
  swift_code: string | null;
  iban: string | null;
  currency: string;
  country: string;
  notes: string | null;
  is_primary: boolean;
  status: string;
}

interface BankAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
}

const COUNTRIES = [
  { code: 'US', name: 'Estados Unidos', currency: 'USD' },
  { code: 'BR', name: 'Brasil', currency: 'BRL' },
  { code: 'GB', name: 'Reino Unido', currency: 'GBP' },
  { code: 'EU', name: 'União Europeia', currency: 'EUR' },
  { code: 'CA', name: 'Canadá', currency: 'CAD' },
  { code: 'AU', name: 'Austrália', currency: 'AUD' },
  { code: 'JP', name: 'Japão', currency: 'JPY' },
  { code: 'CN', name: 'China', currency: 'CNY' },
  { code: 'MX', name: 'México', currency: 'MXN' },
  { code: 'OTHER', name: 'Outro', currency: 'USD' },
];

export default function BankAccountsDialog({ 
  open, 
  onOpenChange, 
  storeId, 
  storeName 
}: BankAccountsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    bank_name: '',
    account_holder: '',
    account_type: 'checking',
    routing_number: '',
    account_number: '',
    swift_code: '',
    iban: '',
    currency: 'USD',
    country: 'US',
    notes: '',
    is_primary: false,
  });

  useEffect(() => {
    if (open && storeId) {
      fetchAccounts();
    }
  }, [open, storeId]);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('store_id', storeId)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('Error fetching bank accounts:', error);
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      bank_name: '',
      account_holder: '',
      account_type: 'checking',
      routing_number: '',
      account_number: '',
      swift_code: '',
      iban: '',
      currency: 'USD',
      country: 'US',
      notes: '',
      is_primary: accounts.length === 0,
    });
  };

  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    setFormData({
      ...formData,
      country: countryCode,
      currency: country?.currency || 'USD',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.bank_name || !formData.account_holder || !formData.account_number) {
      toast({
        title: 'Erro',
        description: 'Preencha os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    // If this is set as primary, unset others first
    if (formData.is_primary && accounts.length > 0) {
      await supabase
        .from('bank_accounts')
        .update({ is_primary: false })
        .eq('store_id', storeId);
    }

    const { error } = await supabase.from('bank_accounts').insert({
      store_id: storeId,
      bank_name: formData.bank_name,
      account_holder: formData.account_holder,
      account_type: formData.account_type,
      routing_number: formData.routing_number || null,
      account_number: formData.account_number,
      swift_code: formData.swift_code || null,
      iban: formData.iban || null,
      currency: formData.currency,
      country: formData.country,
      notes: formData.notes || null,
      is_primary: formData.is_primary || accounts.length === 0,
    });

    setSaving(false);

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Conta bancária cadastrada',
      });
      resetForm();
      setShowForm(false);
      fetchAccounts();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Removido',
        description: 'Conta bancária removida',
      });
      fetchAccounts();
    }
  };

  const handleSetPrimary = async (id: string) => {
    // Unset all primary first
    await supabase
      .from('bank_accounts')
      .update({ is_primary: false })
      .eq('store_id', storeId);

    // Set the selected one as primary
    const { error } = await supabase
      .from('bank_accounts')
      .update({ is_primary: true })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Atualizado',
        description: 'Conta principal definida',
      });
      fetchAccounts();
    }
  };

  const getCountryName = (code: string) => {
    return COUNTRIES.find(c => c.code === code)?.name || code;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Dados Bancários - {storeName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Existing accounts */}
            {accounts.length > 0 && (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <Card key={account.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                            <CreditCard className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{account.bank_name}</span>
                              {account.is_primary && (
                                <Badge variant="default" className="text-xs">
                                  <Star className="w-3 h-3 mr-1" />
                                  Principal
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {account.account_holder}
                            </p>
                            <div className="mt-2 text-sm space-y-1">
                              <p>
                                <span className="text-muted-foreground">País:</span>{' '}
                                {getCountryName(account.country)} ({account.currency})
                              </p>
                              {account.routing_number && (
                                <p>
                                  <span className="text-muted-foreground">Routing:</span>{' '}
                                  {account.routing_number}
                                </p>
                              )}
                              <p>
                                <span className="text-muted-foreground">Conta:</span>{' '}
                                {account.account_number}
                              </p>
                              {account.swift_code && (
                                <p>
                                  <span className="text-muted-foreground">SWIFT:</span>{' '}
                                  {account.swift_code}
                                </p>
                              )}
                              {account.iban && (
                                <p>
                                  <span className="text-muted-foreground">IBAN:</span>{' '}
                                  {account.iban}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!account.is_primary && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetPrimary(account.id)}
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(account.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Add new button or form */}
            {!showForm ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Conta Bancária
              </Button>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>País *</Label>
                        <Select
                          value={formData.country}
                          onValueChange={handleCountryChange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Moeda</Label>
                        <Select
                          value={formData.currency}
                          onValueChange={(v) => setFormData({ ...formData, currency: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="BRL">BRL (R$)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="CAD">CAD ($)</SelectItem>
                            <SelectItem value="AUD">AUD ($)</SelectItem>
                            <SelectItem value="JPY">JPY (¥)</SelectItem>
                            <SelectItem value="CNY">CNY (¥)</SelectItem>
                            <SelectItem value="MXN">MXN ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Nome do Banco *</Label>
                      <Input
                        placeholder="Ex: Bank of America, Itaú, Santander"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Titular da Conta *</Label>
                      <Input
                        placeholder="Nome completo do titular"
                        value={formData.account_holder}
                        onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Conta</Label>
                        <Select
                          value={formData.account_type}
                          onValueChange={(v) => setFormData({ ...formData, account_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="checking">Corrente</SelectItem>
                            <SelectItem value="savings">Poupança</SelectItem>
                            <SelectItem value="business">Empresarial</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Routing Number</Label>
                        <Input
                          placeholder="Ex: 021000021"
                          value={formData.routing_number}
                          onChange={(e) => setFormData({ ...formData, routing_number: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Account Number *</Label>
                      <Input
                        placeholder="Ex: 123456789"
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>SWIFT/BIC Code</Label>
                        <Input
                          placeholder="Ex: BOFAUS3N"
                          value={formData.swift_code}
                          onChange={(e) => setFormData({ ...formData, swift_code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>IBAN</Label>
                        <Input
                          placeholder="Ex: DE89370400440532013000"
                          value={formData.iban}
                          onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Textarea
                        placeholder="Informações adicionais..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowForm(false)}
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
                          'Salvar'
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {accounts.length === 0 && !showForm && (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma conta bancária cadastrada para esta loja
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
