import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function UsersLayout() {
    return (
        <>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="sos_screen" />
                <Stack.Screen name="standard-user" />
                <Stack.Screen name="volunteer" />
                <Stack.Screen name="police" />
                <Stack.Screen name="admin" />
            </Stack>
        </>
    );
}
