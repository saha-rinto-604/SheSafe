import { Stack } from 'expo-router';

export default function StandardUserLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#090514' }, animation: 'fade' }}>
            <Stack.Screen name="sos_screen" />
            <Stack.Screen name="ExploreScreen" />
            <Stack.Screen name="profile-menu" />
            <Stack.Screen name="chat_home" />
            <Stack.Screen name="chat_room" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="emergency-contacts" />
            <Stack.Screen name="safety-settings" />
            <Stack.Screen name="volunteer-verification" />
            <Stack.Screen name="incident-history" />
            <Stack.Screen name="privacy-security" />
            <Stack.Screen name="change-password" />
            <Stack.Screen name="two-factor-auth" />
            <Stack.Screen name="blocked-users" />
            <Stack.Screen name="profile-information" />
        </Stack>
    );
}
