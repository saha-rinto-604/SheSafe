import { Redirect } from 'expo-router';

export default function AdminEntry() {
  return <Redirect href="/(auth)/admin-login" />;
}
