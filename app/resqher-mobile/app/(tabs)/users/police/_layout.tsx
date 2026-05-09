import { Stack } from 'expo-router';

export default function PoliceLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'fade' }}>
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="sos_screen" />
        </Stack>
    );
}
