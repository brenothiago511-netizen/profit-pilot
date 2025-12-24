import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  Bell, 
  BellOff, 
  Settings, 
  TrendingDown, 
  CheckCircle2,
  Store,
  Percent,
  Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface StoreROIData {
  storeId: string;
  storeName: string;
  roi: number;
  threshold: number;
  isActive: boolean;
  alertId: string | null;
  capitalInvested: number;
  partnerShare: number;
}

interface ROIAlertsProps {
  storePerformance: Array<{
    storeId: string;
    storeName: string;
    revenue: number;
    expenses: number;
    profit: number;
    partnerShare: number;
    percentage: number;
  }>;
  partnerships: Array<{
    id: string;
    store_id: string;
    capital_amount: number;
    capital_percentage: number;
  }>;
  onRefresh?: () => void;
}

export default function ROIAlerts({ storePerformance, partnerships, onRefresh }: ROIAlertsProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alertConfigs, setAlertConfigs] = useState<Map<string, { threshold: number; isActive: boolean; id: string }>>(new Map());
  const [editingStore, setEditingStore] = useState<StoreROIData | null>(null);
  const [newThreshold, setNewThreshold] = useState<string>('5');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchAlertConfigs();
  }, [user?.id]);

  const fetchAlertConfigs = async () => {
    if (!user?.id) return;
    
    try {
      const storeIds = partnerships.map(p => p.store_id);
      
      const { data, error } = await supabase
        .from('store_roi_alerts')
        .select('*')
        .in('store_id', storeIds);

      if (error) throw error;

      const configMap = new Map<string, { threshold: number; isActive: boolean; id: string }>();
      data?.forEach(alert => {
        configMap.set(alert.store_id, {
          threshold: Number(alert.roi_threshold),
          isActive: alert.is_active,
          id: alert.id,
        });
      });

      setAlertConfigs(configMap);
    } catch (error) {
      console.error('Error fetching alert configs:', error);
    }
    setLoading(false);
  };

  // Calculate ROI data for each store
  const storeROIData: StoreROIData[] = storePerformance.map(store => {
    const partnership = partnerships.find(p => p.store_id === store.storeId);
    const capitalInvested = partnership?.capital_amount || 0;
    const roi = capitalInvested > 0 ? (store.partnerShare / capitalInvested) * 100 : 0;
    const config = alertConfigs.get(store.storeId);

    return {
      storeId: store.storeId,
      storeName: store.storeName,
      roi,
      threshold: config?.threshold ?? 5,
      isActive: config?.isActive ?? true,
      alertId: config?.id ?? null,
      capitalInvested,
      partnerShare: store.partnerShare,
    };
  });

  // Get stores with ROI below threshold (only active alerts)
  const alertedStores = storeROIData.filter(store => 
    store.isActive && store.roi < store.threshold
  );

  const handleEditAlert = (store: StoreROIData) => {
    setEditingStore(store);
    setNewThreshold(store.threshold.toString());
    setIsActive(store.isActive);
    setDialogOpen(true);
  };

  const handleSaveAlert = async () => {
    if (!editingStore || !user?.id) return;
    
    setSaving(true);
    try {
      const threshold = parseFloat(newThreshold);
      if (isNaN(threshold)) {
        toast({
          title: 'Erro',
          description: 'Digite um valor válido para o limite de ROI',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      if (editingStore.alertId) {
        // Update existing
        const { error } = await supabase
          .from('store_roi_alerts')
          .update({
            roi_threshold: threshold,
            is_active: isActive,
          })
          .eq('id', editingStore.alertId);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('store_roi_alerts')
          .insert({
            store_id: editingStore.storeId,
            roi_threshold: threshold,
            is_active: isActive,
            created_by: user.id,
          });

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Configuração de alerta salva com sucesso',
      });

      setDialogOpen(false);
      fetchAlertConfigs();
      onRefresh?.();
    } catch (error) {
      console.error('Error saving alert:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a configuração',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Alerts Banner */}
      {alertedStores.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <CardTitle className="text-base text-destructive">
                {alertedStores.length} {alertedStores.length === 1 ? 'Alerta Ativo' : 'Alertas Ativos'}
              </CardTitle>
            </div>
            <CardDescription>
              Lojas com ROI abaixo do limite configurado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertedStores.map((store) => (
                <div 
                  key={store.storeId}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium">{store.storeName}</p>
                      <p className="text-sm text-muted-foreground">
                        Limite: {store.threshold.toFixed(1)}% | Atual: {store.roi.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="mb-1">
                      ROI {store.roi.toFixed(1)}%
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Lucro: {formatCurrency(store.partnerShare)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert Configuration */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Configuração de Alertas de ROI</CardTitle>
              </div>
            </div>
            <CardDescription>
              Configure limites de ROI por loja para receber alertas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {storeROIData.map((store) => (
                <div 
                  key={store.storeId}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      store.isActive 
                        ? store.roi >= store.threshold 
                          ? 'bg-success/10' 
                          : 'bg-destructive/10'
                        : 'bg-muted'
                    }`}>
                      {store.isActive ? (
                        store.roi >= store.threshold ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                        )
                      ) : (
                        <BellOff className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{store.storeName}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Limite: {store.threshold.toFixed(1)}%
                        </span>
                        <span className={`font-medium ${
                          store.roi >= store.threshold ? 'text-success' : 'text-destructive'
                        }`}>
                          ROI: {store.roi.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={store.isActive ? 'default' : 'secondary'}>
                      {store.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditAlert(store)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Summary for non-admin */}
      {!isAdmin && alertedStores.length === 0 && storeROIData.length > 0 && (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="w-6 h-6 text-success" />
            <div>
              <p className="font-medium text-success">Todas as lojas dentro do esperado</p>
              <p className="text-sm text-muted-foreground">
                Nenhuma loja com ROI abaixo do limite configurado
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Configurar Alerta - {editingStore?.storeName}
            </DialogTitle>
            <DialogDescription>
              Defina o limite de ROI para receber alertas quando o retorno estiver abaixo do esperado
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="threshold">Limite de ROI (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="threshold"
                  type="number"
                  step="0.1"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="w-32"
                />
                <Percent className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Você será alertado quando o ROI ficar abaixo deste valor
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alerta ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Receber notificações para esta loja
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {editingStore && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">ROI atual desta loja:</p>
                <p className={`text-xl font-bold ${
                  editingStore.roi >= parseFloat(newThreshold || '0') ? 'text-success' : 'text-destructive'
                }`}>
                  {editingStore.roi.toFixed(2)}%
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAlert} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
