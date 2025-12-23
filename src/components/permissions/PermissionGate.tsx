import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGateProps {
  permission: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean; // If true, all permissions must be granted
}

/**
 * Component that conditionally renders children based on user permissions.
 * 
 * @param permission - Single permission key or array of permission keys
 * @param children - Content to render if permission is granted
 * @param fallback - Optional content to render if permission is denied
 * @param requireAll - If true and multiple permissions provided, all must be granted
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
  requireAll = false,
}: PermissionGateProps) {
  const { hasPermission } = usePermissions();

  const permissions = Array.isArray(permission) ? permission : [permission];

  const hasAccess = requireAll
    ? permissions.every((p) => hasPermission(p))
    : permissions.some((p) => hasPermission(p));

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook-based permission check for more complex logic
 */
export function useCanAccess(permission: string | string[], requireAll = false): boolean {
  const { hasPermission } = usePermissions();

  const permissions = Array.isArray(permission) ? permission : [permission];

  return requireAll
    ? permissions.every((p) => hasPermission(p))
    : permissions.some((p) => hasPermission(p));
}
