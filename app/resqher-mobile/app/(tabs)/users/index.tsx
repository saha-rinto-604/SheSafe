import { Redirect } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { ROLE_DEFAULT_ROUTE } from '../../../src/constants/routes';

export default function UsersIndex() {
  const { role, isLoading, isSignedIn } = useAuth();
  
  if (isLoading) return null;
  
  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  const target = ROLE_DEFAULT_ROUTE[role ?? 'USER'];
  return <Redirect href={target as any} />;
}
