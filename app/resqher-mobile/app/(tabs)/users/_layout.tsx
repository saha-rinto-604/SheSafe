import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function UsersLayout() {
    return (
        <>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'fade' }}>
                <Stack.Screen name="standard-user" />
                <Stack.Screen name="volunteer" />
                <Stack.Screen name="police" />
                <Stack.Screen name="admin" />
            </Stack>
        </>
    );
}
