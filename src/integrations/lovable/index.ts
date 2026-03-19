// Lovable integration removed - using Supabase native auth
export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: string, _opts?: any) => {
      return { error: new Error('Use supabase.auth.signInWithOAuth instead') };
    },
  },
};
