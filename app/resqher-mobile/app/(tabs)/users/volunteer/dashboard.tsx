import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { T, Ty, R, S } from '../../../../src/constants/theme';
import { useRouter } from 'expo-router';

export default function VolunteerDashboard() {
    const router = useRouter();

    return (
        <SafeAreaView style={st.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <View style={st.header}>
                <Text style={st.title}>Volunteer Portal</Text>
                <TouchableOpacity style={st.profileBtn}>
                    <Feather name="user" size={24} color={T.onPrimary} />
                </TouchableOpacity>
            </View>

            <View style={st.content}>
                <View style={st.card}>
                    <Text style={st.cardTitle}>Active Support</Text>
                    <Text style={st.cardText}>Checking for nearby incidents where you can help.</Text>
                </View>

                <TouchableOpacity
                    style={st.sosBtn}
                    onPress={() => router.push('/(tabs)/users/sos_screen')}
                >
                    <Feather name="alert-triangle" size={24} color={T.onPrimary} />
                    <Text style={st.sosBtnText}>Emergency SOS</Text>
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
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: T.gold,
        justifyContent: 'center',
        alignItems: 'center',
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
        backgroundColor: T.danger,
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
