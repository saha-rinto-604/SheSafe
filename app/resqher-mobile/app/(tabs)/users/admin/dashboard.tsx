import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { T, Ty, R, S } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/AuthContext';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import { useRouter } from 'expo-router';

export default function AdminDashboard() {
    const router = useRouter();
    const { identityCache } = useAuth();

    return (
        <SafeAreaView style={st.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <View style={st.header}>
                <Text style={st.title}>Admin Control Center</Text>
                <TouchableOpacity style={st.profileBtn}>
                    <UserAvatar uri={identityCache?.photoUri} size={36} style={st.profileAvatar} />
                </TouchableOpacity>
            </View>

            <View style={st.content}>
                <View style={st.card}>
                    <Text style={st.cardTitle}>System Overview</Text>
                    <Text style={st.cardText}>Manage users, roles, and system-wide settings.</Text>
                </View>

                <TouchableOpacity
                    style={st.sosBtn}
                    onPress={() => router.push('/(tabs)/users/standard-user/sos_screen')}
                >
                    <Feather name="alert-triangle" size={24} color={T.onPrimary} />
                    <Text style={st.sosBtnText}>Admin SOS</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const st = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: T.bg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: S.s4,
        borderBottomWidth: 1,
        borderBottomColor: T.lineMid,
        backgroundColor: T.surfaceBulky,
    },
    title: {
        ...Ty.h2,
        color: T.ink,
    },
    profileBtn: {
        width: 36, height: 36, borderRadius: 18,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    profileAvatar: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    content: {
        padding: S.s4,
        gap: S.s4,
    },
    card: {
        backgroundColor: T.surfaceBulky,
        padding: S.s5,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
    },
    cardTitle: {
        ...Ty.h3,
        color: T.ink,
        marginBottom: S.s2,
    },
    cardText: {
        ...Ty.body,
        color: T.ink2,
    },
    sosBtn: {
        backgroundColor: T.violet,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: S.s4,
        borderRadius: R.md,
        gap: S.s2,
    },
    sosBtnText: {
        ...Ty.btn,
        color: T.onPrimary,
    },
});
