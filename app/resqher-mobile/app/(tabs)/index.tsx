import { Redirect } from 'expo-router';

// 🔧 TRIAL MODE — bypasses auth, goes straight to SOS screen
// Restore auth check after testing!
export default function Index() {
  return <Redirect href="/login" />;
}