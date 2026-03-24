import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'financeiro' | 'gestor' | 'socio' | 'captador';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isFinanceiro: boolean;
  isSocio: boolean;
  isGestor: boolean;
  isCaptador: boolean;
  mfaPending: boolean;
  verifyMFA: (code: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);
  const lastFetchedUserId = useRef<string | null>(null);

  const fetchProfile = async (userId: string, accessToken?: string): Promise<Profile | null> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      // Usa o JWT do usuário explicitamente para garantir autenticação correta no F5
      const bearer = accessToken ?? supabaseKey;

      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/get_profile_by_id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${bearer}`,
        },
        body: JSON.stringify({ p_user_id: userId }),
      });

      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data) return null;
      return data as Profile;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Failsafe: força loading=false após 10s para evitar tela infinita
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 10000);

    // Usa apenas onAuthStateChange (inclui INITIAL_SESSION) para garantir
    // que o token já está válido/renovado antes de buscar o perfil.
    // Evita o problema do F5 onde getSession() retorna token expirado.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          if (session.user.id !== lastFetchedUserId.current) {
            lastFetchedUserId.current = session.user.id;
            if (mounted) setLoading(true);
            const p = await fetchProfile(session.user.id, session.access_token);
            if (mounted) {
              setProfile(p);
              setLoading(false);
            }
          } else {
            // Mesmo usuário (ex: TOKEN_REFRESHED), perfil já carregado
            if (mounted) setLoading(false);
          }
        } else {
          lastFetchedUserId.current = null;
          if (mounted) {
            setProfile(null);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error };

    // Verificar se MFA é necessário
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
      setMfaPending(true);
    }
    return { error: null };
  };

  const verifyMFA = async (code: string) => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) throw new Error('Fator não encontrado');

      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (cErr) throw cErr;

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      });
      if (vErr) throw vErr;

      setMfaPending(false);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin';
  const isFinanceiro = profile?.role === 'financeiro';
  const isSocio = profile?.role === 'socio';
  const isGestor = profile?.role === 'gestor';
  const isCaptador = profile?.role === 'captador';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
        isFinanceiro,
        isSocio,
        isGestor,
        isCaptador,
        mfaPending,
        verifyMFA,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
