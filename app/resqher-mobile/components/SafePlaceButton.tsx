import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SafePlacePinIcon } from './Icons';
import { T } from '../src/constants/theme';

export default function SafePlaceButton({ onPress, isActive, distance }: { onPress: () => void; isActive: boolean; distance?: number | null }) {
    return (
        <View style={styles.wrap} pointerEvents="box-none">
            <TouchableOpacity style={[styles.btn, isActive ? styles.active : null]} onPress={onPress} accessibilityRole="button" accessibilityLabel="Show nearest safe place">
                <SafePlacePinIcon size={20} color={T.violet} />
            </TouchableOpacity>
            {isActive && typeof distance === 'number' && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{distance.toFixed(1)} km</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center' },
    btn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: T.surfaceBulky,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    active: {
        backgroundColor: T.surfaceBulky,
        borderColor: T.violet,
    },
    badge: {
        marginTop: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    badgeText: { color: T.onPrimary, fontSize: 11, fontWeight: '700' },
});
