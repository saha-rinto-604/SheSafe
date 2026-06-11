import { Redirect } from 'expo-router';

import { useAuth } from '../src/context/AuthContext';

export default function AdminDashboardEntry() {
  const { isLoading, isSignedIn, role } = useAuth();

  if (isLoading) return null;
  if (!isSignedIn || role !== 'ADMIN') {
    return <Redirect href="/(auth)/admin-login" />;
  }
  return <Redirect href="/(tabs)/users/admin/dashboard" />;
}
