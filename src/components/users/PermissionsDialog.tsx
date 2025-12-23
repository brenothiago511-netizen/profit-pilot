import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import { useUserPermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';

interface PermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
  userRole: string;
}

const CATEGORY_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  receitas: 'Receitas',
  despesas: 'Despesas',
  relatorios: 'Relatórios',
  administracao: 'Administração',
  metas: 'Metas',
  financeiro: 'Financeiro',
  comissoes: 'Comissões',
  socios: 'Sócios',
};

// Role default permissions for visual reference
const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: ['*'],
  financeiro: [
    'view_dashboard',
    'create_revenue',
    'edit_revenue',
    'create_expense',
    'edit_expense',
    'view_reports',
    'export_reports',
    'view_commissions',
    'manage_goals',
    'manage_bank_accounts',
  ],
  gestor: ['view_dashboard', 'view_commissions'],
  socio: ['view_dashboard_socios', 'view_partner_results', 'view_reports'],
};

export function PermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userRole,
}: PermissionsDialogProps) {
  const { toast } = useToast();
  const {
    permissions,
    isCustom,
    loading,
    updatePermission,
    setCustomPermissions,
    getPermissionValue,
    refetch,
  } = useUserPermissions(userId);

  useEffect(() => {
    if (open && userId) {
      refetch();
    }
  }, [open, userId]);

  const getRoleDefault = (permKey: string): boolean => {
    const defaults = ROLE_DEFAULTS[userRole] || [];
    if (defaults.includes('*')) return true;
    return defaults.includes(permKey);
  };

  const getEffectiveValue = (permKey: string): boolean => {
    if (isCustom) {
      const customValue = getPermissionValue(permKey);
      if (customValue !== null) return customValue;
    }
    return getRoleDefault(permKey);
  };

  const handleToggleCustom = async () => {
    await setCustomPermissions(!isCustom);
    toast({
      title: isCustom ? 'Permissões por papel' : 'Permissões customizadas',
      description: isCustom
        ? 'Usuário usará permissões padrão do papel'
        : 'Permissões individuais habilitadas',
    });
  };

  const handlePermissionChange = async (permKey: string, value: boolean) => {
    await updatePermission(permKey, value);
  };

  // Group permissions by category
  const groupedPermissions = permissions.reduce(
    (acc, perm) => {
      const cat = perm.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    },
    {} as Record<string, typeof permissions>
  );

  const isAdmin = userRole === 'admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Permissões - {userName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Admin notice */}
            {isAdmin && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
                <ShieldCheck className="w-4 h-4 inline mr-2" />
                Administradores têm acesso total. Permissões customizadas não se aplicam.
              </div>
            )}

            {/* Custom permissions toggle */}
            {!isAdmin && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base font-medium">Permissões Customizadas</Label>
                  <p className="text-sm text-muted-foreground">
                    {isCustom
                      ? 'Permissões individuais ativas'
                      : `Usando permissões padrão do papel (${userRole})`}
                  </p>
                </div>
                <Switch checked={isCustom} onCheckedChange={handleToggleCustom} />
              </div>
            )}

            {/* Permissions list */}
            {!isAdmin && (
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      {CATEGORY_NAMES[category] || category}
                    </h3>
                    <div className="space-y-2">
                      {perms.map((perm) => {
                        const effectiveValue = getEffectiveValue(perm.key);
                        const customValue = getPermissionValue(perm.key);
                        const roleDefault = getRoleDefault(perm.key);
                        const isOverridden = isCustom && customValue !== null && customValue !== roleDefault;

                        return (
                          <div
                            key={perm.key}
                            className="flex items-center justify-between py-2 px-3 rounded-lg border"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{perm.description}</span>
                                {isOverridden && (
                                  <Badge variant="outline" className="text-xs">
                                    Customizado
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{perm.key}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {!isCustom && (
                                <span className="text-xs text-muted-foreground">
                                  {roleDefault ? (
                                    <ShieldCheck className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <ShieldOff className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </span>
                              )}
                              {isCustom && (
                                <Switch
                                  checked={effectiveValue}
                                  onCheckedChange={(v) => handlePermissionChange(perm.key, v)}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
