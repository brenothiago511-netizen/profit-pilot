import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'financeiro' | 'gestor' | 'socio')[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Não foi possível carregar seu perfil</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Para continuar, saia e entre novamente.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recarregar
            </Button>
            <Button
              onClick={async () => {
                await signOut();
                window.location.href = '/auth';
              }}
            >
              Sair e entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    if (profile.role === 'gestor') return <Navigate to="/gestor-dashboard" replace />;
    if (profile.role === 'financeiro') return <Navigate to="/revenues" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
