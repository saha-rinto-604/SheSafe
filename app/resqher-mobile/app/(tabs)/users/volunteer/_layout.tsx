import { Stack } from 'expo-router';

export default function VolunteerLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="messages" />
            <Stack.Screen name="chat_room" />
            <Stack.Screen name="incidents" />
            <Stack.Screen name="activity" />
            <Stack.Screen name="dashboard" />
        </Stack>
    );
}
