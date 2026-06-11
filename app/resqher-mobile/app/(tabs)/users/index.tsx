import { Redirect, useRootNavigationState } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { routeForRoleStatus } from '../../../src/constants/routes';

export default function UsersIndex() {
  const { role, isLoading, isSignedIn } = useAuth();
  const rootNavigationState = useRootNavigationState();
  
  if (isLoading || !rootNavigationState?.key) return null;
  
  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!role) return null;

  const target = routeForRoleStatus(role);
  return <Redirect href={target as any} />;
}
