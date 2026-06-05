import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import { ToastProvider } from "../src/components/Toast";
import { NotificationBannerProvider } from "../src/components/NotificationBannerProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <NotificationBannerProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'fade' }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </NotificationBannerProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
