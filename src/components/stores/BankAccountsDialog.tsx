import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, CreditCard, Star, Building, Link2 } from 'lucide-react';

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

    if (data) {
      setAvailableBanks(data);
    }
  };

  const getUnlinkedBanks = () => {
    const linkedIds = new Set(linkedBanks.map(lb => lb.bank_account_id));
    return availableBanks.filter(b => !linkedIds.has(b.id));
  };

  const handleLink = async () => {
    if (!selectedBankId) return;
    
    setSaving(true);
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
      setShowLinkForm(false);
      fetchLinkedBanks();
      fetchAvailableBanks();
    }
  };

  const handleUnlink = async (linkId: string) => {
    const { error } = await supabase
      .from('store_bank_accounts')
      .delete()
      .eq('id', linkId);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Removido', description: 'Banco desvinculado da loja' });
      fetchLinkedBanks();
    }
  };

  const handleSetPrimary = async (linkId: string) => {
    // Unset all primary first
    await supabase
      .from('store_bank_accounts')
      .update({ is_primary: false })
      .eq('store_id', storeId);

    const { error } = await supabase
      .from('store_bank_accounts')
      .update({ is_primary: true })
      .eq('id', linkId);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atualizado', description: 'Banco principal definido' });
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
            {/* Linked banks */}
            {linkedBanks.length > 0 && (
              <div className="space-y-3">
                {linkedBanks.map((link) => {
                  const bank = link.bank_accounts;
                  return (
                    <Card key={link.id} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                              <CreditCard className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{bank.account_holder} - {bank.bank_name}</span>
                                {link.is_primary && (
                                  <Badge variant="default" className="text-xs">
                                    <Star className="w-3 h-3 mr-1" />
                                    Principal
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 text-sm space-y-0.5">
                                <p className="text-muted-foreground">
                                  {bank.currency} • Saldo: {formatCurrency(Number(bank.balance), bank.currency)}
                                </p>
                                {bank.routing_number && (
                                  <p><span className="text-muted-foreground">Routing:</span> {bank.routing_number}</p>
                                )}
                                {bank.account_number && (
                                  <p><span className="text-muted-foreground">Conta:</span> {bank.account_number}</p>
                                )}
                                {bank.swift_code && (
                                  <p><span className="text-muted-foreground">SWIFT:</span> {bank.swift_code}</p>
                                )}
                                {bank.iban && (
                                  <p><span className="text-muted-foreground">IBAN:</span> {bank.iban}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!link.is_primary && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetPrimary(link.id)}
                                title="Definir como principal"
                              >
                                <Star className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlink(link.id)}
                              className="text-destructive hover:text-destructive"
                              title="Desvincular"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Link bank form */}
            {!showLinkForm ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowLinkForm(true)}
                disabled={unlinkedBanks.length === 0}
              >
                <Link2 className="w-4 h-4 mr-2" />
                {unlinkedBanks.length === 0 
                  ? 'Todos os bancos já estão vinculados' 
                  : 'Vincular Banco Existente'}
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
                  <p className="text-xs text-muted-foreground">
                    Para cadastrar um novo banco, acesse a página de <strong>Bancos</strong> primeiro.
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => { setShowLinkForm(false); setSelectedBankId(''); }}>
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
