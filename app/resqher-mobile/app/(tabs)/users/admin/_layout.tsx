import { Stack } from 'expo-router';

export default function AdminLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'fade' }}>
            <Stack.Screen name="dashboard" />
        </Stack>
    );
}
