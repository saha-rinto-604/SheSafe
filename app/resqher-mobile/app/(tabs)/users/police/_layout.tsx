import { Stack } from 'expo-router';

export default function PoliceLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="sos_screen" />
        </Stack>
    );
}
