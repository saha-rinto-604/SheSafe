import { Stack } from 'expo-router';

export default function StandardUserLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#090514' }, animation: 'fade' }}>
            <Stack.Screen name="sos_screen" />
            <Stack.Screen name="ExploreScreen" />
            <Stack.Screen name="profile-menu" />
            <Stack.Screen name="chat_home" />
            <Stack.Screen name="chat_room" />
        </Stack>
    );
}
