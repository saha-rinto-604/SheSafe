import { Stack } from 'expo-router';

export default function VolunteerLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="messages" />
            <Stack.Screen name="chat_room" />
            <Stack.Screen name="incidents" />
            <Stack.Screen name="activity" />
            <Stack.Screen name="medical" />
            <Stack.Screen name="MedicalMapView" />
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="profile-menu" />
            <Stack.Screen name="profile-information" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="emergency-contacts" />
            <Stack.Screen name="safety-settings" />
            <Stack.Screen name="privacy-security" />
            <Stack.Screen name="change-password" />
            <Stack.Screen name="two-factor-auth" />
            <Stack.Screen name="blocked-users" />
        </Stack>
    );
}
