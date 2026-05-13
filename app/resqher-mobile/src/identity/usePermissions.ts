/**
 * usePermissions.ts — Role-based permission gate
 * ─────────────────────────────────────────────────
 * Usage:
 *   const { can } = usePermissions();
 *   if (can('accept_sos')) { … }
 *
 * Safety-critical rule: can() returns false when role is null or the
 * permission lookup fails. A volunteer without a loaded identity is
 * treated as a standard user, not as someone who can accept SOS.
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS, type Permission } from './identity.types';

export function usePermissions() {
  const { role } = useAuth();

  const permissions = useMemo<ReadonlySet<Permission>>(() => {
    if (!role) return new Set<Permission>();
    return new Set(ROLE_PERMISSIONS[role] ?? []);
  }, [role]);

  const can = useCallback(
    (action: Permission): boolean => permissions.has(action),
    [permissions],
  );

  return { can, role, permissions } as const;
}
