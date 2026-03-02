import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function UsersLayout() {
    return (
        <>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="sos_screen" />
            </Stack>
        </>
    );
}
