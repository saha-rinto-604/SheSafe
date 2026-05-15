import { Redirect } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { ROLE_DEFAULT_ROUTE } from '../../../src/constants/routes';

export default function UsersIndex() {
  const { role } = useAuth();
  const target = ROLE_DEFAULT_ROUTE[role ?? 'USER'];
  return <Redirect href={target as any} />;
}
