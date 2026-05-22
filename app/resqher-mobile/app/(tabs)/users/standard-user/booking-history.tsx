/**
 * booking-history.tsx — Medical appointment booking history
 * Reads bookings saved by BookingModal from SecureStore.
 */

import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';

const BOOKINGS_KEY = 'shesafe_bookings_v1';

type Booking = {
    id: string;
    providerName: string;
    providerType: string;
    affiliation: string;
    patientName: string;
    phone: string;
    date: string;
    time: string;
    reason: string;
    bookedAt: string;
};

function providerIcon(type: string): keyof typeof Ionicons.glyphMap {
    switch ((type || '').toLowerCase()) {
        case 'hospital':    return 'business-outline';
        case 'ambulance':   return 'car-outline';
        case 'pharmacy':    return 'bandage-outline';
        case 'diagnostics': return 'flask-outline';
        default:            return 'medkit-outline';
    }
}

function BookingCard({ booking, onDelete }: { booking: Booking; onDelete: () => void }) {
    const date = new Date(booking.bookedAt);
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return (
        <View style={s.card}>
            <View style={s.cardHeader}>
                <View style={s.cardIcon}>
                    <Ionicons name={providerIcon(booking.providerType)} size={18} color={T.violet} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.cardProvider} numberOfLines={1}>{booking.providerName}</Text>
                    <Text style={s.cardAffiliation} numberOfLines={1}>{booking.affiliation}</Text>
                </View>
                <View style={s.statusPill}>
                    <Text style={s.statusPillTxt}>Confirmed</Text>
                </View>
            </View>

            <View style={s.cardBody}>
                <View style={s.cardRow}>
                    <Feather name="user" size={13} color={T.ink4} style={s.rowIcon} />
                    <Text style={s.rowTxt}>{booking.patientName}</Text>
                </View>
                <View style={s.cardRow}>
                    <Feather name="calendar" size={13} color={T.ink4} style={s.rowIcon} />
                    <Text style={s.rowTxt}>{booking.date} at {booking.time}</Text>
                </View>
                {booking.reason ? (
                    <View style={s.cardRow}>
                        <Feather name="file-text" size={13} color={T.ink4} style={s.rowIcon} />
                        <Text style={s.rowTxt} numberOfLines={2}>{booking.reason}</Text>
                    </View>
                ) : null}
            </View>

            <View style={s.cardFooter}>
                <Text style={s.bookedAt}>Booked on {dateStr}</Text>
                <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="trash-2" size={15} color={T.danger} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function BookingHistoryScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);

    const load = useCallback(() => {
        SecureStore.getItemAsync(BOOKINGS_KEY).then(raw => {
            setBookings(raw ? JSON.parse(raw) : []);
        }).catch(() => setBookings([]));
    }, []);

    useFocusEffect(load);

    const handleDelete = (id: string) => {
        Alert.alert('Delete Booking', 'Remove this booking from history?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    const updated = bookings.filter(b => b.id !== id);
                    await SecureStore.setItemAsync(BOOKINGS_KEY, JSON.stringify(updated));
                    setBookings(updated);
                },
            },
        ]);
    };

    const handleClearAll = () => {
        if (bookings.length === 0) return;
        Alert.alert('Clear All Bookings', 'This will remove all booking history.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear All', style: 'destructive', onPress: async () => {
                    await SecureStore.deleteItemAsync(BOOKINGS_KEY);
                    setBookings([]);
                },
            },
        ]);
    };

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Booking History</Text>
                    <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.clearAll}>Clear All</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {bookings.length === 0 ? (
                        <View style={s.empty}>
                            <Ionicons name="calendar-outline" size={48} color={T.ink4} />
                            <Text style={s.emptyTxt}>No bookings yet</Text>
                            <Text style={s.emptySub}>Your appointment history will appear here</Text>
                        </View>
                    ) : (
                        bookings.map(b => (
                            <BookingCard key={b.id} booking={b} onDelete={() => handleDelete(b.id)} />
                        ))
                    )}
                </ScrollView>
            </View>
        </AtmosphericShell>
    );
}

const s = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: T.lineMid, backgroundColor: T.surfaceGlass,
    },
    headerBtn: { width: 36, height: 36, borderRadius: R.hBtn, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: T.surfaceBulky, borderColor: 'rgba(255,255,255,0.1)' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: T.ink, marginHorizontal: 10 },
    clearAll: { fontSize: 13, fontWeight: '600', color: T.danger },
    scroll: { paddingHorizontal: 14, paddingTop: 20 },
    card: { backgroundColor: T.surfaceBulky, borderRadius: R.lg, borderWidth: 1, borderColor: T.lineMid, marginBottom: 14, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: T.lineMid },
    cardIcon: { width: 38, height: 38, borderRadius: R.sm, backgroundColor: T.violetDim, borderWidth: 1, borderColor: `${T.violet}35`, alignItems: 'center', justifyContent: 'center' },
    cardProvider: { fontSize: 15, fontWeight: '700', color: T.ink },
    cardAffiliation: { fontSize: 12, color: T.ink4, marginTop: 2 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)' },
    statusPillTxt: { fontSize: 10, fontWeight: '700', color: '#10B981', letterSpacing: 0.5 },
    cardBody: { padding: 14, gap: 8 },
    cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    rowIcon: { marginTop: 1 },
    rowTxt: { flex: 1, fontSize: 13, fontWeight: '500', color: T.ink3, lineHeight: 18 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.lineMid },
    bookedAt: { fontSize: 11, color: T.ink4 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyTxt: { fontSize: 16, fontWeight: '700', color: T.ink },
    emptySub: { fontSize: 13, color: T.ink4, textAlign: 'center' },
});
