/**
 * change-password.tsx — Change Password screen (Standard User)
 * ─────────────────────────────────────────────────────────────
 * Full UI form that validates locally and calls privacySecurity.changePassword().
 * Swap the service stub for a real API call once backend is ready.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { changePassword } from '../../../../src/services/privacySecurity';

// ── Validation ────────────────────────────────────────────────────────────────
const MIN_PASSWORD_LENGTH = 8;

function validate(current: string, next: string, confirm: string): string | null {
    if (!current) return 'Current password is required.';
    if (next.length < MIN_PASSWORD_LENGTH)
        return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (next !== confirm) return 'New password and confirm password do not match.';
    return null;
}

// ── Password input ────────────────────────────────────────────────────────────
function PasswordInput({
    label,
    value,
    onChangeText,
    placeholder,
    error,
}: {
    label: string;
    value: string;
    onChangeText: (t: string) => void;
    placeholder?: string;
    error?: boolean;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <View style={pi.wrap}>
            <Text style={pi.label}>{label}</Text>
            <View style={[pi.row, error && pi.rowError]}>
                <TextInput
                    style={pi.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder ?? label}
                    placeholderTextColor={T.ink5}
                    secureTextEntry={!visible}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TouchableOpacity
                    onPress={() => setVisible(v => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={pi.eyeBtn}
                >
                    <Feather name={visible ? 'eye-off' : 'eye'} size={16} color={T.ink4} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const pi = StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: T.ink3,
        marginBottom: 6,
        marginLeft: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.surfaceCard,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: 14,
        height: 48,
    },
    rowError: { borderColor: T.dangerBorder },
    input: {
        flex: 1,
        fontSize: 15,
        color: T.ink,
        paddingVertical: 0,
    },
    eyeBtn: { paddingLeft: 10 },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ChangePasswordScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        const err = validate(current, next, confirm);
        if (err) { setErrorMsg(err); return; }
        setErrorMsg(null);
        setLoading(true);
        try {
            await changePassword(current, next);
            Alert.alert('Password Updated', 'Your password has been changed successfully.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (e: any) {
            setErrorMsg(e?.message ?? 'Failed to update password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = current.length > 0 && next.length > 0 && confirm.length > 0 && !loading;

    return (
        <AtmosphericShell>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={s.root}>
                    <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                    {/* ── Header ── */}
                    <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                        <TouchableOpacity
                            style={s.headerBtn}
                            onPress={() => router.back()}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="arrow-back" size={20} color={T.ink2} />
                        </TouchableOpacity>
                        <Text style={s.headerTitle}>Change Password</Text>
                        <View style={s.headerSpacer} />
                    </View>

                    <ScrollView
                        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 36 }]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Intro */}
                        <View style={s.intro}>
                            <Text style={s.introTitle}>Update your password</Text>
                            <Text style={s.introSub}>
                                Enter your current password, then choose a new one.
                                Minimum {MIN_PASSWORD_LENGTH} characters.
                            </Text>
                        </View>

                        {/* Form section */}
                        <View style={s.section}>
                            <Text style={s.sectionLabel}>Password</Text>
                            <View style={s.sectionCard}>
                                <PasswordInput
                                    label="Current Password"
                                    value={current}
                                    onChangeText={v => { setCurrent(v); setErrorMsg(null); }}
                                    placeholder="Enter current password"
                                    error={!!errorMsg && !current}
                                />
                                <View style={s.inputDivider} />
                                <PasswordInput
                                    label="New Password"
                                    value={next}
                                    onChangeText={v => { setNext(v); setErrorMsg(null); }}
                                    placeholder={`Min ${MIN_PASSWORD_LENGTH} characters`}
                                    error={!!errorMsg && next.length < MIN_PASSWORD_LENGTH}
                                />
                                <View style={s.inputDivider} />
                                <PasswordInput
                                    label="Confirm New Password"
                                    value={confirm}
                                    onChangeText={v => { setConfirm(v); setErrorMsg(null); }}
                                    placeholder="Re-enter new password"
                                    error={!!errorMsg && next !== confirm}
                                />
                            </View>
                        </View>

                        {/* Error */}
                        {errorMsg && (
                            <View style={s.errorCard}>
                                <Feather name="alert-circle" size={14} color={T.danger} />
                                <Text style={s.errorText}>{errorMsg}</Text>
                            </View>
                        )}

                        {/* Submit */}
                        <TouchableOpacity
                            style={[s.primaryBtn, !canSubmit && s.primaryBtnDisabled]}
                            onPress={canSubmit ? handleSubmit : undefined}
                            activeOpacity={canSubmit ? 0.8 : 1}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={T.onPrimary} />
                            ) : (
                                <>
                                    <Feather name="check" size={17} color={canSubmit ? T.onPrimary : T.disabledText} />
                                    <Text style={[s.primaryBtnText, !canSubmit && s.primaryBtnTextDisabled]}>
                                        Update Password
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </AtmosphericShell>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: T.lineMid,
        backgroundColor: T.surfaceGlass,
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: T.lineMid,
        backgroundColor: T.surfaceCard,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: T.ink,
        marginHorizontal: 10,
    },
    headerSpacer: { width: 36, height: 36 },

    scroll: { paddingHorizontal: 14, paddingTop: 24 },

    intro: { marginBottom: 24 },
    introTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: T.ink,
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    introSub: {
        fontSize: 13,
        fontWeight: '400',
        color: T.ink4,
        lineHeight: 19,
    },

    section: { marginBottom: 20 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 10,
        marginLeft: 4,
    },
    sectionCard: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: S.s4,
        paddingTop: 14,
        paddingBottom: 6,
    },
    inputDivider: { height: 2 },

    errorCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: T.dangerLight,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: T.dangerBorder,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 20,
    },
    errorText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: T.dangerText,
        lineHeight: 18,
    },

    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: T.violet,
        borderRadius: R.md,
        paddingVertical: 15,
    },
    primaryBtnDisabled: { backgroundColor: T.disabled },
    primaryBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: T.onPrimary,
        letterSpacing: 0.2,
    },
    primaryBtnTextDisabled: { color: T.disabledText },
});
