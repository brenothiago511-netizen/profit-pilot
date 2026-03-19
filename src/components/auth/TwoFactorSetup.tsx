import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';

interface TwoFactorSetupProps {
  isEnabled: boolean;
  onStatusChange: (enabled: boolean) => void;
}

export default function TwoFactorSetup({ isEnabled, onStatusChange }: TwoFactorSetupProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'idle' | 'qr' | 'verify' | 'disable'>('idle');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep('qr');
    } catch (err: any) {
      toast({ title: 'Erro ao ativar 2FA', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast({ title: 'Código inválido', description: 'Digite os 6 dígitos do autenticador', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      toast({ title: '2FA ativado!', description: 'Sua conta agora está protegida com autenticação em dois fatores.' });
      setStep('idle');
      setCode('');
      onStatusChange(true);
    } catch (err: any) {
      toast({ title: 'Código incorreto', description: 'Verifique o código e tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) throw new Error('Nenhum fator 2FA encontrado');

      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;

      toast({ title: '2FA desativado', description: 'A verificação em dois fatores foi removida da sua conta.' });
      setStep('idle');
      onStatusChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao desativar 2FA', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'qr') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
            Configurar Autenticador
          </CardTitle>
          <CardDescription>
            Escaneie o QR code com o Google Authenticator, Authy ou similar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrCode && (
            <div className="flex justify-center">
              <img src={qrCode} alt="QR Code para 2FA" className="h-48 w-48 rounded-lg border bg-white p-2" />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Ou insira a chave manualmente:</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">{secret}</code>
              <Button variant="ghost" size="icon" onClick={copySecret} aria-label="Copiar chave">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="totp-code">Código de verificação (6 dígitos)</Label>
            <Input
              id="totp-code"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="font-mono text-center text-lg tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep('idle'); setCode(''); }} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleVerify} disabled={loading || code.length !== 6} className="flex-1">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEnabled
            ? <ShieldCheck className="h-5 w-5 text-green-500" aria-hidden="true" />
            : <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
          Autenticação em Dois Fatores (2FA)
        </CardTitle>
        <CardDescription>
          {isEnabled
            ? 'Sua conta está protegida com 2FA. Um código será solicitado no login.'
            : 'Adicione uma camada extra de segurança exigindo um código no login.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEnabled ? (
          <Button variant="destructive" onClick={handleDisable} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
            Desativar 2FA
          </Button>
        ) : (
          <Button onClick={handleEnroll} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
            Ativar 2FA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
