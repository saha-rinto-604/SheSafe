import { Stack } from 'expo-router';

export default function StandardUserLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="sos_screen" />
        </Stack>
    );
}
