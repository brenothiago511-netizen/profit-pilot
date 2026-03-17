import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, CreditCard, Star, Building, Link2, Pencil, Check, X } from 'lucide-react';

interface LinkedBank {
  id: string;
  bank_account_id: string;
  is_primary: boolean;
  bank_accounts: {
    id: string;
    bank_name: string;
    account_holder: string;
    currency: string;
    country: string;
    account_number: string;
    routing_number: string | null;
    swift_code: string | null;
    iban: string | null;
    balance: number;
  };
}

interface AvailableBank {
  id: string;
  bank_name: string;
  account_holder: string;
  currency: string;
}

interface BankAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', BRL: 'R$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$',
};

const CURRENCIES = ['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'AUD'];

function formatCurrency(amount: number, currency: string = 'USD') {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BankAccountsDialog({ 
  open, 
  onOpenChange, 
  storeId, 
  storeName 
}: BankAccountsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkedBanks, setLinkedBanks] = useState<LinkedBank[]>([]);
  const [availableBanks, setAvailableBanks] = useState<AvailableBank[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [linkForm, setLinkForm] = useState({ account_number: '', routing_number: '', iban: '', currency: 'USD' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ account_number: '', routing_number: '', iban: '', currency: '' });

  useEffect(() => {
    if (open && storeId) {
      fetchLinkedBanks();
      fetchAvailableBanks();
    }
  }, [open, storeId]);

  const fetchLinkedBanks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('store_bank_accounts')
      .select('id, bank_account_id, is_primary, bank_accounts(id, bank_name, account_holder, currency, country, account_number, routing_number, swift_code, iban, balance)')
      .eq('store_id', storeId)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('Error fetching linked banks:', error);
    } else {
      setLinkedBanks((data as any) || []);
    }
    setLoading(false);
  };

  const fetchAvailableBanks = async () => {
    const { data } = await supabase
      .from('bank_accounts')
      .select('id, bank_name, account_holder, currency')
      .eq('status', 'active')
      .order('account_holder');

    if (data) setAvailableBanks(data);
  };

  const getUnlinkedBanks = () => {
    const linkedIds = new Set(linkedBanks.map(lb => lb.bank_account_id));
    return availableBanks.filter(b => !linkedIds.has(b.id));
  };

  const handleLink = async () => {
    if (!selectedBankId) return;
    setSaving(true);

    // Update bank account details if any were filled
    const updates: Record<string, any> = {};
    if (linkForm.account_number) updates.account_number = linkForm.account_number;
    if (linkForm.routing_number) updates.routing_number = linkForm.routing_number;
    if (linkForm.iban) updates.iban = linkForm.iban;
    if (linkForm.currency) updates.currency = linkForm.currency;

    if (Object.keys(updates).length > 0) {
      await supabase.from('bank_accounts').update(updates).eq('id', selectedBankId);
    }

    const { error } = await supabase.from('store_bank_accounts').insert({
      store_id: storeId,
      bank_account_id: selectedBankId,
      is_primary: linkedBanks.length === 0,
    });
    setSaving(false);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Banco vinculado à loja' });
      setSelectedBankId('');
      setLinkForm({ account_number: '', routing_number: '', iban: '', currency: 'USD' });
      setShowLinkForm(false);
      fetchLinkedBanks();
      fetchAvailableBanks();
    }
  };

  const handleUnlink = async (linkId: string) => {
    const { error } = await supabase.from('store_bank_accounts').delete().eq('id', linkId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Removido', description: 'Banco desvinculado da loja' });
      fetchLinkedBanks();
    }
  };

  const handleSetPrimary = async (linkId: string) => {
    await supabase.from('store_bank_accounts').update({ is_primary: false }).eq('store_id', storeId);
    const { error } = await supabase.from('store_bank_accounts').update({ is_primary: true }).eq('id', linkId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atualizado', description: 'Banco principal definido' });
      fetchLinkedBanks();
    }
  };

  const startEdit = (bank: LinkedBank['bank_accounts']) => {
    setEditingId(bank.id);
    setEditForm({
      account_number: bank.account_number || '',
      routing_number: bank.routing_number || '',
      iban: bank.iban || '',
      currency: bank.currency || 'USD',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ account_number: '', routing_number: '', iban: '', currency: '' });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const { error } = await supabase
      .from('bank_accounts')
      .update({
        account_number: editForm.account_number || '',
        routing_number: editForm.routing_number || null,
        iban: editForm.iban || null,
        currency: editForm.currency || 'USD',
      })
      .eq('id', editingId);
    setSaving(false);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atualizado', description: 'Dados bancários atualizados' });
      cancelEdit();
      fetchLinkedBanks();
    }
  };

  const unlinkedBanks = getUnlinkedBanks();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Bancos Vinculados - {storeName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {linkedBanks.length > 0 && (
              <div className="space-y-3">
                {linkedBanks.map((link) => {
                  const bank = link.bank_accounts;
                  const isEditing = editingId === bank.id;

                  return (
                    <Card key={link.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                              <CreditCard className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{bank.account_holder} - {bank.bank_name}</span>
                                {link.is_primary && (
                                  <Badge variant="default" className="text-xs">
                                    <Star className="w-3 h-3 mr-1" />
                                    Principal
                                  </Badge>
                                )}
                              </div>

                              {isEditing ? (
                                <div className="mt-3 space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Moeda</Label>
                                      <Select value={editForm.currency} onValueChange={(v) => setEditForm(f => ({ ...f, currency: v }))}>
                                        <SelectTrigger className="h-9">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {CURRENCIES.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Account Number</Label>
                                      <Input
                                        className="h-9"
                                        value={editForm.account_number}
                                        onChange={(e) => setEditForm(f => ({ ...f, account_number: e.target.value }))}
                                        placeholder="Opcional"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Routing Number</Label>
                                      <Input
                                        className="h-9"
                                        value={editForm.routing_number}
                                        onChange={(e) => setEditForm(f => ({ ...f, routing_number: e.target.value }))}
                                        placeholder="Opcional"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">IBAN</Label>
                                      <Input
                                        className="h-9"
                                        value={editForm.iban}
                                        onChange={(e) => setEditForm(f => ({ ...f, iban: e.target.value }))}
                                        placeholder="Opcional"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                                      <X className="w-4 h-4 mr-1" />Cancelar
                                    </Button>
                                    <Button size="sm" onClick={saveEdit} disabled={saving}>
                                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                                      Salvar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 text-sm space-y-0.5">
                                  {bank.account_number && (
                                    <p><span className="text-muted-foreground">Conta:</span> {bank.account_number}</p>
                                  )}
                                  {bank.routing_number && (
                                    <p><span className="text-muted-foreground">Routing:</span> {bank.routing_number}</p>
                                  )}
                                  {bank.iban && (
                                    <p><span className="text-muted-foreground">IBAN:</span> {bank.iban}</p>
                                  )}
                                  {!bank.account_number && !bank.routing_number && !bank.iban && (
                                    <p className="text-muted-foreground italic">Nenhum dado bancário cadastrado</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {!isEditing && (
                            <div className="flex gap-2 shrink-0">
                              <Button variant="outline" size="sm" onClick={() => startEdit(bank)} title="Editar dados">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {!link.is_primary && (
                                <Button variant="outline" size="sm" onClick={() => handleSetPrimary(link.id)} title="Definir como principal">
                                  <Star className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => handleUnlink(link.id)} className="text-destructive hover:text-destructive" title="Desvincular">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {!showLinkForm ? (
              <Button variant="outline" className="w-full" onClick={() => setShowLinkForm(true)} disabled={unlinkedBanks.length === 0}>
                <Link2 className="w-4 h-4 mr-2" />
                {unlinkedBanks.length === 0 ? 'Todos os bancos já estão vinculados' : 'Vincular Banco Existente'}
              </Button>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione o banco para vincular</Label>
                    <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um banco cadastrado" />
                      </SelectTrigger>
                      <SelectContent>
                        {unlinkedBanks.map((bank) => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.account_holder} - {bank.bank_name} ({bank.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedBankId && (
                    <div className="space-y-3 border-t pt-3">
                      <p className="text-sm font-medium">Dados da conta bancária <span className="text-muted-foreground font-normal">(todos opcionais)</span></p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Moeda</Label>
                          <Select value={linkForm.currency} onValueChange={(v) => setLinkForm(f => ({ ...f, currency: v }))}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCIES.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Account Number</Label>
                          <Input
                            className="h-9"
                            value={linkForm.account_number}
                            onChange={(e) => setLinkForm(f => ({ ...f, account_number: e.target.value }))}
                            placeholder="Opcional"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Routing Number</Label>
                          <Input
                            className="h-9"
                            value={linkForm.routing_number}
                            onChange={(e) => setLinkForm(f => ({ ...f, routing_number: e.target.value }))}
                            placeholder="Opcional"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">IBAN</Label>
                          <Input
                            className="h-9"
                            value={linkForm.iban}
                            onChange={(e) => setLinkForm(f => ({ ...f, iban: e.target.value }))}
                            placeholder="Opcional"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Para cadastrar um novo banco, acesse a página de <strong>Bancos</strong> primeiro.
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => { setShowLinkForm(false); setSelectedBankId(''); setLinkForm({ account_number: '', routing_number: '', iban: '', currency: 'USD' }); }}>
                      Cancelar
                    </Button>
                    <Button onClick={handleLink} disabled={saving || !selectedBankId}>
                      {saving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vinculando...</>
                      ) : (
                        <><Link2 className="w-4 h-4 mr-2" />Vincular</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {linkedBanks.length === 0 && !showLinkForm && (
              <p className="text-center text-muted-foreground py-4">
                Nenhum banco vinculado a esta loja
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}