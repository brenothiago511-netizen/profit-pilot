import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Permission {
  id: string;
  key: string;
  description: string;
  category: string;
}

interface UserPermission {
  permission_key: string;
  allowed: boolean;
}

// Default permissions per role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'], // All permissions
  financeiro: [
    'create_revenue',
    'edit_revenue',
    'view_revenues',
    'create_expense',
    'edit_expense',
    'view_expenses',
  ],
  socio: [
    'view_dashboard',
    'view_dashboard_socios',
    'view_partner_results',
    'view_reports',
    'view_revenues',
    'view_expenses',
    'view_goals',
    'view_commissions',
    'view_profits',
    'create_revenue',
    'edit_revenue',
    'create_expense',
    'edit_expense',
    'register_profits',
    'manage_partners',
  ],
};

export function usePermissions() {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (profile?.id) {
      fetchUserPermissions(profile.id);
    }
  }, [profile?.id]);

  const fetchPermissions = async () => {
    const { data } = await supabase
      .from('permissions')
      .select('*')
      .order('category, key');
    setPermissions((data as Permission[]) || []);
  };

  const fetchUserPermissions = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('user_permissions')
      .select('permission_key, allowed')
      .eq('user_id', userId);
    setUserPermissions((data as UserPermission[]) || []);
    setLoading(false);
  };

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      if (!profile) return false;

      // Check if user has custom permissions
      const isCustom = (profile as any).is_custom_permissions;

      if (isCustom) {
        const customPerm = userPermissions.find((p) => p.permission_key === permissionKey);
        if (customPerm !== undefined) {
          return customPerm.allowed;
        }
      }

      // Fall back to role-based permissions
      const role = profile.role;
      const rolePerms = ROLE_PERMISSIONS[role] || [];

      if (rolePerms.includes('*')) return true;
      return rolePerms.includes(permissionKey);
    },
    [profile, userPermissions]
  );

  const can = hasPermission;

  return {
    permissions,
    userPermissions,
    loading,
    hasPermission,
    can,
    refetch: () => profile?.id && fetchUserPermissions(profile.id),
  };
}

// Hook to get permissions for a specific user (admin use)
export function useUserPermissions(userId: string | null) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllPermissions();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchUserData(userId);
    }
  }, [userId]);

  const fetchAllPermissions = async () => {
    const { data } = await supabase
      .from('permissions')
      .select('*')
      .order('category, key');
    setPermissions((data as Permission[]) || []);
  };

  const fetchUserData = async (uid: string) => {
    setLoading(true);

    const [profileRes, permRes] = await Promise.all([
      supabase.from('profiles').select('is_custom_permissions').eq('id', uid).single(),
      supabase.from('user_permissions').select('permission_key, allowed').eq('user_id', uid),
    ]);

    setIsCustom(profileRes.data?.is_custom_permissions || false);
    setUserPermissions((permRes.data as UserPermission[]) || []);
    setLoading(false);
  };

  const updatePermission = async (permissionKey: string, allowed: boolean) => {
    if (!userId) return;

    // Check if permission exists
    const existing = userPermissions.find((p) => p.permission_key === permissionKey);

    if (existing) {
      await supabase
        .from('user_permissions')
        .update({ allowed })
        .eq('user_id', userId)
        .eq('permission_key', permissionKey);
    } else {
      await supabase.from('user_permissions').insert({
        user_id: userId,
        permission_key: permissionKey,
        allowed,
      });
    }

    // Update local state
    setUserPermissions((prev) => {
      const idx = prev.findIndex((p) => p.permission_key === permissionKey);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], allowed };
        return updated;
      }
      return [...prev, { permission_key: permissionKey, allowed }];
    });
  };

  const setCustomPermissions = async (enabled: boolean) => {
    if (!userId) return;

    await supabase
      .from('profiles')
      .update({ is_custom_permissions: enabled })
      .eq('id', userId);

    setIsCustom(enabled);
  };

  const getPermissionValue = (permissionKey: string): boolean | null => {
    const perm = userPermissions.find((p) => p.permission_key === permissionKey);
    return perm ? perm.allowed : null;
  };

  return {
    permissions,
    userPermissions,
    isCustom,
    loading,
    updatePermission,
    setCustomPermissions,
    getPermissionValue,
    refetch: () => userId && fetchUserData(userId),
  };
}
