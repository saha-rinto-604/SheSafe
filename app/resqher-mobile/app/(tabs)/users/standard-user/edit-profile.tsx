/**
 * edit-profile.tsx — Edit Profile Screen (Standard User)
 * ─────────────────────────────────────────────────────────────────────────
 * Sections: Profile Photo · Basic Info · Personal Info · Medical Info · Address
 * UI: Matches AtmosphericShell + existing theme tokens throughout.
 * Data: Placeholder values — wire to AuthContext / API when backend is ready.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    StatusBar,
    Image,
    TextInput,
    Platform,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import { T, R, S } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import { getUserProfile, saveUserProfile, uploadProfilePhoto } from '../../../../src/services/profile';

// ─── Blood group & gender options ────────────────────────────────────────────
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDER_OPTIONS = ['Male', 'Female'];

// ─── Simple inline picker row ─────────────────────────────────────────────────
function OptionPicker({
    label,
    options,
    selected,
    onSelect,
}: {
    label: string;
    options: string[];
    selected: string;
    onSelect: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <View>
            <TouchableOpacity
                style={s.inputRow}
                onPress={() => setOpen(o => !o)}
                activeOpacity={0.75}
            >
                <Text style={[s.inputValue, !selected && s.inputPlaceholder]}>
                    {selected || `Select ${label}`}
                </Text>
                <Feather
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={T.ink3}
                />
            </TouchableOpacity>
            {open && (
                <View style={s.dropdownBox}>
                    {options.map(opt => (
                        <TouchableOpacity
                            key={opt}
                            style={[
                                s.dropdownItem,
                                selected === opt && s.dropdownItemActive,
                            ]}
                            onPress={() => { onSelect(opt); setOpen(false); }}
                            activeOpacity={0.75}
                        >
                            <Text
                                style={[
                                    s.dropdownItemText,
                                    selected === opt && s.dropdownItemTextActive,
                                ]}
                            >
                                {opt}
                            </Text>
                            {selected === opt && (
                                <Feather name="check" size={14} color={T.violet} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={s.section}>
            <Text style={s.sectionTitle}>{title}</Text>
            <View style={s.sectionCard}>{children}</View>
        </View>
    );
}

// ─── Labelled text field ──────────────────────────────────────────────────────
function Field({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    multiline = false,
    editable = true,
    rightElement,
}: {
    label: string;
    value: string;
    onChangeText?: (v: string) => void;
    placeholder?: string;
    keyboardType?: 'default' | 'phone-pad' | 'email-address';
    multiline?: boolean;
    editable?: boolean;
    rightElement?: React.ReactNode;
}) {
    return (
        <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>{label}</Text>
            <View style={[s.inputRow, multiline && s.inputRowMulti, !editable && s.inputRowDisabled]}>
                <TextInput
                    style={[s.input, multiline && s.inputMulti]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder ?? label}
                    placeholderTextColor={T.ink4}
                    keyboardType={keyboardType}
                    multiline={multiline}
                    numberOfLines={multiline ? 3 : 1}
                    editable={editable}
                    selectionColor={T.violet}
                />
                {rightElement}
            </View>
        </View>
    );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
    return <View style={s.divider} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // ── Form state — loaded from local profile service on mount ────────────────
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('+880 1XXX-XXXXXX');
    /** ISO date string, e.g. "1995-06-15" */
    const [dobISO, setDobISO] = useState('');
    const [gender, setGender] = useState('');
    const [bloodGroup, setBloodGroup] = useState('');
    const [medicalInfo, setMedicalInfo] = useState<string[]>([]);
    const [medicalInput, setMedicalInput] = useState('');
    const [homeAddress, setHomeAddress] = useState('');
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    /** Controls the date picker visibility */
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Derived display value for DOB
    const dobDisplay = dobISO
        ? new Date(dobISO).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';

    // Load saved profile on mount
    useEffect(() => {
        getUserProfile().then(p => {
            setFirstName(p.firstName);
            setLastName(p.lastName);
            setPhone(p.phone);
            setDobISO(p.dobISO);
            setGender(p.gender);
            setBloodGroup(p.bloodGroup);
            setMedicalInfo(p.medicalInfo);
            setHomeAddress(p.homeAddress);
            setPhotoUri(p.photoUri);
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveUserProfile({
                firstName, lastName, phone, dobISO, gender, bloodGroup, medicalInfo, homeAddress, photoUri,
            });
            Alert.alert('Saved', 'Your profile has been updated.');
            router.back();
        } catch {
            Alert.alert('Error', 'Could not save your profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Permission needed',
                'Please grant photo library access to update your profile photo.',
            );
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            const localUri = result.assets[0].uri;
            setPhotoUri(localUri);
            // Upload to backend in the background
            try {
                const updated = await uploadProfilePhoto(localUri);
                if (updated.photoUri) setPhotoUri(updated.photoUri);
            } catch (err) {
                console.log('[EDIT_PROFILE] Photo upload failed, keeping local URI');
            }
        }
    };

    const handleDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
        // On Android the picker closes itself after selection
        if (Platform.OS !== 'ios') setShowDatePicker(false);
        if (selectedDate) {
            // Store as YYYY-MM-DD ISO date
            const iso = selectedDate.toISOString().split('T')[0];
            setDobISO(iso);
        }
    };

    const handleAddMedicalInfo = () => {
        const trimmed = medicalInput.trim();
        if (!trimmed) return;
        setMedicalInfo(prev => [...prev, trimmed]);
        setMedicalInput('');
    };

    const handleRemoveMedicalInfo = (index: number) => {
        setMedicalInfo(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Header ───────────────────────────────────────────────── */}
                <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Edit Profile</Text>
                    <TouchableOpacity
                        style={[s.headerBtn, s.saveBtn]}
                        onPress={handleSave}
                        disabled={saving}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {saving
                            ? <ActivityIndicator size="small" color={T.onPrimary} />
                            : <Text style={s.saveBtnText}>Save</Text>
                        }
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ── Profile Photo ─────────────────────────────────────── */}
                    <View style={s.photoSection}>
                        <View style={s.avatarWrap}>
                            <UserAvatar
                                uri={photoUri}
                                size={88}
                                style={s.avatar}
                            />
                            <TouchableOpacity
                                style={s.cameraBtn}
                                onPress={handleChangePhoto}
                                activeOpacity={0.8}
                            >
                                <Feather name="camera" size={14} color={T.onPrimary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={s.photoHint}>Tap to change profile photo</Text>
                    </View>

                    {/* ── Basic Info ────────────────────────────────────────── */}
                    <Section title="Basic Info">
                        {/* First + Last name side by side */}
                        <View style={s.rowTwoCol}>
                            <View style={s.colHalf}>
                                <Text style={s.fieldLabel}>First Name</Text>
                                <View style={s.inputRow}>
                                    <TextInput
                                        style={s.input}
                                        value={firstName}
                                        onChangeText={setFirstName}
                                        placeholder="First name"
                                        placeholderTextColor={T.ink4}
                                        selectionColor={T.violet}
                                    />
                                </View>
                            </View>
                            <View style={s.colHalf}>
                                <Text style={s.fieldLabel}>Last Name</Text>
                                <View style={s.inputRow}>
                                    <TextInput
                                        style={s.input}
                                        value={lastName}
                                        onChangeText={setLastName}
                                        placeholder="Last name"
                                        placeholderTextColor={T.ink4}
                                        selectionColor={T.violet}
                                    />
                                </View>
                            </View>
                        </View>

                        <Divider />

                        {/* Phone number — directly editable; OTP verification coming later */}
                        <View style={s.fieldWrap}>
                            <Text style={s.fieldLabel}>Phone Number</Text>
                            <View style={s.inputRow}>
                                <TextInput
                                    style={[s.input, s.inputFlex]}
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="+880 1XXX-XXXXXX"
                                    placeholderTextColor={T.ink4}
                                    keyboardType="phone-pad"
                                    selectionColor={T.violet}
                                />
                            </View>
                            <Text style={s.fieldHint}>OTP verification will be added in a future update</Text>
                        </View>
                    </Section>

                    {/* ── Personal Info ─────────────────────────────────────── */}
                    <Section title="Personal Info">
                        {/* ── Date of Birth — tapping opens native date picker ────────── */}
                        <View style={s.fieldWrap}>
                            <Text style={s.fieldLabel}>Date of Birth</Text>
                            <TouchableOpacity
                                style={s.inputRow}
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.75}
                            >
                                <Text style={[s.inputValue, !dobISO && s.inputPlaceholder]}>
                                    {dobDisplay || 'DD / MM / YYYY'}
                                </Text>
                                <Feather name="calendar" size={16} color={T.ink4} style={s.inputIcon} />
                            </TouchableOpacity>

                            {/* Android: picker shows as dialog automatically */}
                            {showDatePicker && Platform.OS === 'android' && (
                                <DateTimePicker
                                    value={dobISO ? new Date(dobISO) : new Date(2000, 0, 1)}
                                    mode="date"
                                    display="default"
                                    maximumDate={new Date()}
                                    onChange={handleDateChange}
                                />
                            )}

                            {/* iOS: render picker inline inside a small modal overlay */}
                            <Modal
                                visible={showDatePicker && Platform.OS === 'ios'}
                                transparent
                                animationType="slide"
                                onRequestClose={() => setShowDatePicker(false)}
                            >
                                <View style={s.dateModalBackdrop}>
                                    <View style={s.dateModalCard}>
                                        <View style={s.dateModalHeader}>
                                            <Text style={s.dateModalTitle}>Select Date of Birth</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowDatePicker(false)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Text style={s.dateModalDone}>Done</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <DateTimePicker
                                            value={dobISO ? new Date(dobISO) : new Date(2000, 0, 1)}
                                            mode="date"
                                            display="spinner"
                                            maximumDate={new Date()}
                                            onChange={handleDateChange}
                                            style={s.datePickerIOS}
                                            themeVariant="dark"
                                        />
                                    </View>
                                </View>
                            </Modal>
                        </View>

                        <Divider />

                        <View style={s.fieldWrap}>
                            <Text style={s.fieldLabel}>Gender</Text>
                            <OptionPicker
                                label="Gender"
                                options={GENDER_OPTIONS}
                                selected={gender}
                                onSelect={setGender}
                            />
                        </View>

                        <Divider />

                        <View style={s.fieldWrap}>
                            <Text style={s.fieldLabel}>Blood Group</Text>
                            <OptionPicker
                                label="Blood Group"
                                options={BLOOD_GROUPS}
                                selected={bloodGroup}
                                onSelect={setBloodGroup}
                            />
                        </View>
                    </Section>

                    {/* ── Medical Info ──────────────────────────────────────── */}
                    <Section title="Medical Info">
                        {medicalInfo.length === 0 && (
                            <Text style={s.emptyHint}>No medical information added yet.</Text>
                        )}
                        {medicalInfo.map((info, i) => (
                            <View key={i} style={s.medicalItemRow}>
                                <Text style={s.medicalItem}>{info}</Text>
                                <TouchableOpacity
                                    onPress={() => handleRemoveMedicalInfo(i)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Feather name="x" size={15} color={T.danger} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {/* Input row for adding a new entry */}
                        <View style={s.medicalAddRow}>
                            <TextInput
                                style={s.medicalInput}
                                value={medicalInput}
                                onChangeText={setMedicalInput}
                                placeholder="e.g. Diabetic, Hypertensive…"
                                placeholderTextColor={T.ink4}
                                selectionColor={T.violet}
                                returnKeyType="done"
                                onSubmitEditing={handleAddMedicalInfo}
                            />
                            <TouchableOpacity
                                style={s.medicalAddBtn}
                                onPress={handleAddMedicalInfo}
                                activeOpacity={0.75}
                            >
                                <Feather name="plus" size={18} color={T.violet} />
                            </TouchableOpacity>
                        </View>
                    </Section>

                    {/* ── Address ───────────────────────────────────────────── */}
                    <Section title="Address">
                        <Field
                            label="Home Address"
                            value={homeAddress}
                            onChangeText={setHomeAddress}
                            placeholder="Enter your home address"
                            multiline
                            rightElement={
                                <Feather name="map-pin" size={16} color={T.ink4} style={[s.inputIcon, { alignSelf: 'flex-start', marginTop: 2 }]} />
                            }
                        />
                    </Section>
                </ScrollView>
            </View>
        </AtmosphericShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1,
    },

    // ── Header ───────────────────────────────────────────────────────────────
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
        backgroundColor: T.surfaceBulky,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: T.ink,
        marginHorizontal: 10,
    },
    saveBtn: {
        backgroundColor: T.violet,
        borderColor: T.violet,
        paddingHorizontal: 14,
        width: 'auto',
    },
    saveBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: T.onPrimary,
        letterSpacing: 0.2,
    },

    // ── Scroll ───────────────────────────────────────────────────────────────
    scroll: {
        paddingHorizontal: 14,
        paddingTop: 20,
    },

    // ── Profile Photo ─────────────────────────────────────────────────────────
    photoSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 2,
        borderColor: `${T.violet}50`,
        overflow: 'visible',
        backgroundColor: T.violetDim,
        marginBottom: 10,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
    },
    cameraBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: T.violet,
        borderWidth: 2,
        borderColor: '#090514',
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoHint: {
        fontSize: 12,
        fontWeight: '500',
        color: T.ink3,
        letterSpacing: 0.1,
    },

    // ── Section ───────────────────────────────────────────────────────────────
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
    },
    sectionCard: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: 14,
        paddingVertical: 6,
        overflow: 'visible',
    },

    // ── Two-col name row ──────────────────────────────────────────────────────
    rowTwoCol: {
        flexDirection: 'row',
        gap: 10,
    },
    colHalf: {
        flex: 1,
    },

    // ── Field & Input ──────────────────────────────────────────────────────────
    fieldWrap: {
        paddingVertical: 8,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    fieldHint: {
        fontSize: 11,
        fontWeight: '400',
        color: T.ink4,
        marginTop: 5,
        letterSpacing: 0.1,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.surfaceBulky,
        borderRadius: R.sm,
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        paddingHorizontal: 12,
        minHeight: 44,
    },
    inputRowMulti: {
        alignItems: 'flex-start',
        paddingVertical: 10,
        minHeight: 80,
    },
    inputRowDisabled: {
        opacity: 0.5,
    },
    input: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: T.ink,
        paddingVertical: Platform.OS === 'ios' ? 0 : 2,
    },
    inputFlex: {
        flex: 1,
    },
    inputMulti: {
        textAlignVertical: 'top',
    },
    inputValue: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: T.ink,
    },
    inputPlaceholder: {
        color: T.ink4,
    },
    inputIcon: {
        marginLeft: 8,
    },

    // ── Phone change button ───────────────────────────────────────────────────
    changePhoneBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: R.xs,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}30`,
        marginLeft: 8,
    },
    changePhoneText: {
        fontSize: 12,
        fontWeight: '600',
        color: T.violet,
    },

    // ── Divider ───────────────────────────────────────────────────────────────
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
        marginVertical: 2,
    },

    // ── Dropdown ──────────────────────────────────────────────────────────────
    dropdownBox: {
        marginTop: 4,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.sm,
        borderWidth: 1,
        borderColor: `${T.violet}30`,
        overflow: 'hidden',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: T.lineMid,
    },
    dropdownItemActive: {
        backgroundColor: T.violetDim,
    },
    dropdownItemText: {
        fontSize: 14,
        fontWeight: '500',
        color: T.ink,
    },
    dropdownItemTextActive: {
        color: T.violet,
        fontWeight: '600',
    },

    // ── Medical Info ──────────────────────────────────────────────────────────
    emptyHint: {
        fontSize: 13,
        fontWeight: '400',
        color: T.ink4,
        paddingVertical: 10,
        paddingHorizontal: 2,
    },
    medicalItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: T.lineMid,
    },
    medicalItem: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: T.ink2,
        marginRight: 8,
    },
    medicalAddRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 8,
    },
    medicalInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: T.ink,
        backgroundColor: T.surfaceBulky,
        borderRadius: R.sm,
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    medicalAddBtn: {
        width: 38,
        height: 38,
        borderRadius: R.sm,
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}30`,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Date picker modal (iOS) ────────────────────────────────────────────────
    dateModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    dateModalCard: {
        backgroundColor: T.surfaceCard,
        borderTopLeftRadius: R.xl,
        borderTopRightRadius: R.xl,
        paddingHorizontal: 14,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderColor: T.lineMid,
    },
    dateModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    dateModalTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: T.ink,
    },
    dateModalDone: {
        fontSize: 14,
        fontWeight: '700',
        color: T.violet,
    },
    datePickerIOS: {
        width: '100%',
        height: 180,
    },
});

