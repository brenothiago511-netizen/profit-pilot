import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, User, Bell } from 'lucide-react';
import TwoFactorSetup from '@/components/auth/TwoFactorSetup';

export default function Settings() {
  const { user, profile } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loadingMfa, setLoadingMfa] = useState(true);

  useEffect(() => {
    async function checkMFA() {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        const hasVerified = data?.totp?.some(f => f.status === 'verified') ?? false;
        setMfaEnabled(hasVerified);
      } catch (_) {
        setMfaEnabled(false);
      } finally {
        setLoadingMfa(false);
      }
    }
    checkMFA();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-6 w-6 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" aria-hidden="true" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-medium">{profile?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">E-mail</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Perfil</span>
            <span className="font-medium capitalize">{profile?.role}</span>
          </div>
        </CardContent>
      </Card>

      {/* 2FA */}
      {!loadingMfa && (
        <TwoFactorSetup
          isEnabled={mfaEnabled}
          onStatusChange={setMfaEnabled}
        />
      )}
    </div>
  );
}
