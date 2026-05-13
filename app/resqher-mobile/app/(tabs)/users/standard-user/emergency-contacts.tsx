/**
 * emergency-contacts.tsx — Emergency Contacts Screen (Standard User)
 * ─────────────────────────────────────────────────────────────────────────
 * Sections: Contact List · Add Emergency Contact (floating blur-card form)
 * Persistence: expo-secure-store (key: resqher_emergency_contacts_v1)
 * Rules: Max 5 contacts · One Primary contact at a time
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    Alert,
    ScrollView,
    StatusBar,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Linking,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { T, R } from '../../../../src/constants/theme';
import AtmosphericShell from '../../../../src/components/AtmosphericShell';

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'resqher_emergency_contacts_v1';
const MAX_CONTACTS = 5;
const PRIORITY_OPTIONS: ContactPriority[] = ['Primary', 'Secondary'];

// ── Types ─────────────────────────────────────────────────────────────────────
type ContactPriority = 'Primary' | 'Secondary';

type EmergencyContact = {
    id: string;
    name: string;
    phone: string;
    relationship: string;
    priority: ContactPriority;
};

type DraftContact = Omit<EmergencyContact, 'id'>;

const EMPTY_DRAFT: DraftContact = {
    name: '',
    phone: '',
    relationship: '',
    priority: 'Secondary',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function isValidPhone(phone: string): boolean {
    // Must contain exactly 11 digits (ignoring spaces, dashes, parentheses, leading +)
    return phone.replace(/\D/g, '').length === 11;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function EmergencyContactsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [contacts, setContacts] = useState<EmergencyContact[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<DraftContact>(EMPTY_DRAFT);
    const [isSaving, setIsSaving] = useState(false);

    // ── Load persisted contacts on mount ──────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const raw = await SecureStore.getItemAsync(STORAGE_KEY);
                if (raw) {
                    const parsed: EmergencyContact[] = JSON.parse(raw);
                    if (Array.isArray(parsed)) setContacts(parsed);
                }
            } catch {
                // Corrupted data — silently start fresh
            }
        })();
    }, []);

    // ── Persist contacts to SecureStore ───────────────────────────────────
    const persist = useCallback(async (updated: EmergencyContact[]) => {
        try {
            await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updated));
        } catch {
            // Best-effort save; in-memory state is still updated
        }
    }, []);

    // ── Open add form (empty draft) ───────────────────────────────────────
    const openAdd = () => {
        setEditingId(null);
        setDraft(EMPTY_DRAFT);
        setIsFormOpen(true);
    };

    // ── Open edit form (prefilled draft) ──────────────────────────────────
    const openEdit = (contact: EmergencyContact) => {
        setEditingId(contact.id);
        setDraft({
            name: contact.name,
            phone: contact.phone,
            relationship: contact.relationship,
            priority: contact.priority,
        });
        setIsFormOpen(true);
    };

    // ── Close and reset form ──────────────────────────────────────────────
    const closeForm = () => {
        setIsFormOpen(false);
        setEditingId(null);
        setDraft(EMPTY_DRAFT);
    };

    // ── Save (Add or Edit) ────────────────────────────────────────────────
    const handleSave = async () => {
        const name = draft.name.trim();
        const phone = draft.phone.trim();
        const relationship = draft.relationship.trim();

        if (!name) {
            Alert.alert('Name required', "Please enter the contact's name.");
            return;
        }
        if (!phone || !isValidPhone(phone)) {
            Alert.alert(
                'Invalid phone number',
                'Phone number must be exactly 11 digits (e.g. 01712345678).',
            );
            return;
        }

        // Duplicate phone check
        const duplicate = contacts.find(c => c.phone === phone && c.id !== editingId);
        if (duplicate) {
            Alert.alert('Duplicate', `${duplicate.name} already has this phone number.`);
            return;
        }

        // ── Primary conflict check — ask before demoting ──────────────────
        const existingPrimary = contacts.find(
            c => c.priority === 'Primary' && c.id !== editingId,
        );
        if (draft.priority === 'Primary' && existingPrimary) {
            Alert.alert(
                'Only one Primary contact allowed',
                `"${existingPrimary.name}" is already your Primary contact. Making "${name}" Primary will change "${existingPrimary.name}" to Secondary. Continue?`,
                [
                    { text: 'No', style: 'cancel' },
                    {
                        text: 'Yes, make Primary',
                        style: 'destructive',
                        onPress: () => void commitSave({ name, phone, relationship }),
                    },
                ],
            );
            return;
        }

        void commitSave({ name, phone, relationship });
    };

    // ── Commit save after all validation + confirmations pass ─────────────
    const commitSave = async ({
        name,
        phone,
        relationship,
    }: {
        name: string;
        phone: string;
        relationship: string;
    }) => {
        setIsSaving(true);
        let updated: EmergencyContact[];

        if (editingId) {
            // Edit mode — update the matching contact, demote any other Primary if needed
            updated = contacts.map(c => {
                if (c.id === editingId) {
                    return { ...c, name, phone, relationship, priority: draft.priority };
                }
                if (draft.priority === 'Primary' && c.priority === 'Primary') {
                    return { ...c, priority: 'Secondary' as ContactPriority };
                }
                return c;
            });
        } else {
            // Add mode — enforce max contacts
            if (contacts.length >= MAX_CONTACTS) {
                Alert.alert(
                    'Contact limit reached',
                    `You can add up to ${MAX_CONTACTS} emergency contacts.`,
                );
                setIsSaving(false);
                return;
            }
            const newContact: EmergencyContact = {
                id: generateId(),
                name,
                phone,
                relationship,
                priority: draft.priority,
            };
            if (draft.priority === 'Primary') {
                updated = [
                    ...contacts.map(c =>
                        c.priority === 'Primary' ? { ...c, priority: 'Secondary' as ContactPriority } : c,
                    ),
                    newContact,
                ];
            } else {
                updated = [...contacts, newContact];
            }
        }

        setContacts(updated);
        await persist(updated);
        setIsSaving(false);
        closeForm();
    };

    // ── Call a contact ────────────────────────────────────────────────────
    const handleCall = (phone: string) => {
        const url = `tel:${phone.replace(/\s/g, '')}`;
        Linking.canOpenURL(url).then(supported => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert('Cannot call', 'Unable to open the dialer on this device.');
            }
        });
    };

    // ── Delete a contact ──────────────────────────────────────────────────
    const handleDelete = (contact: EmergencyContact) => {
        Alert.alert(
            'Delete Contact',
            `Remove ${contact.name} from your emergency contacts?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = contacts.filter(c => c.id !== contact.id);
                        setContacts(updated);
                        await persist(updated);
                    },
                },
            ],
        );
    };

    const atMax = contacts.length >= MAX_CONTACTS;
    const isEditing = editingId !== null;

    return (
        <AtmosphericShell>
            <View style={s.root}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Header ────────────────────────────────────────────── */}
                <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Feather name="chevron-left" size={22} color={T.ink} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Emergency Contacts</Text>
                    <View style={s.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ── Contact List section ─────────────────────────── */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Contact List</Text>

                        {contacts.length === 0 ? (
                            <View style={s.emptyCard}>
                                <Feather name="users" size={32} color={T.ink5} />
                                <Text style={s.emptyTitle}>No emergency contacts yet</Text>
                                <Text style={s.emptySubtitle}>
                                    Add trusted people who can be contacted in an emergency.
                                </Text>
                            </View>
                        ) : (
                            contacts.map((contact, index) => (
                                <View
                                    key={contact.id}
                                    style={[
                                        s.contactCard,
                                        index < contacts.length - 1 && s.contactCardGap,
                                    ]}
                                >
                                    {/* Contact info */}
                                    <View style={s.contactInfo}>
                                        <View style={s.contactNameRow}>
                                            {contact.priority === 'Primary' && (
                                                <View style={s.primaryBadge}>
                                                    <Ionicons name="star" size={10} color={T.accent} />
                                                    <Text style={s.primaryBadgeText}>Primary</Text>
                                                </View>
                                            )}
                                            <Text style={s.contactName}>{contact.name}</Text>
                                        </View>
                                        <Text style={s.contactPhone}>{contact.phone}</Text>
                                        {contact.relationship ? (
                                            <Text style={s.contactRelationship}>{contact.relationship}</Text>
                                        ) : null}
                                    </View>

                                    {/* Actions row */}
                                    <View style={s.actionRow}>
                                        <TouchableOpacity
                                            style={s.callBtn}
                                            onPress={() => handleCall(contact.phone)}
                                            activeOpacity={0.75}
                                        >
                                            <Feather name="phone-call" size={14} color={T.onPrimary} />
                                            <Text style={s.callBtnText}>Call</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={s.editContactBtn}
                                            onPress={() => openEdit(contact)}
                                            activeOpacity={0.75}
                                        >
                                            <Feather name="edit-2" size={14} color={T.violet} />
                                            <Text style={s.editContactBtnText}>Edit</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={s.deleteBtn}
                                            onPress={() => handleDelete(contact)}
                                            activeOpacity={0.75}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Feather name="trash-2" size={16} color={T.danger} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                    {/* ── Add Contact section ──────────────────────────── */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Add Contact</Text>

                        <TouchableOpacity
                            style={[s.addBtn, atMax && s.addBtnDisabled]}
                            onPress={atMax ? undefined : openAdd}
                            activeOpacity={atMax ? 1 : 0.75}
                        >
                            <Feather
                                name="plus-circle"
                                size={18}
                                color={atMax ? T.disabledText : T.violet}
                            />
                            <Text style={[s.addBtnText, atMax && s.addBtnTextDisabled]}>
                                + Add Emergency Contact
                            </Text>
                        </TouchableOpacity>

                        {atMax && (
                            <Text style={s.maxHint}>
                                You've reached the maximum of {MAX_CONTACTS} contacts.
                            </Text>
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* ── Floating Add / Edit Modal ──────────────────────────────── */}
            <Modal
                visible={isFormOpen}
                transparent
                animationType="fade"
                onRequestClose={closeForm}
                statusBarTranslucent
            >
                <KeyboardAvoidingView
                    style={s.modalOuter}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Blurred + dimmed backdrop — tap to dismiss */}
                    <TouchableWithoutFeedback onPress={closeForm}>
                        <View style={StyleSheet.absoluteFill}>
                            <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={[StyleSheet.absoluteFill, s.backdropDim]} />
                        </View>
                    </TouchableWithoutFeedback>

                    {/* Floating card */}
                    <View style={[s.floatingCard, { marginBottom: insets.bottom + 20 }]}>
                        <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, s.cardTint]} pointerEvents="none" />

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={s.cardScroll}
                        >
                            {/* Card header */}
                            <View style={s.cardHeader}>
                                <Text style={s.cardTitle}>
                                    {isEditing ? 'Edit Contact' : 'Add Emergency Contact'}
                                </Text>
                                <TouchableOpacity
                                    style={s.cardCloseBtn}
                                    onPress={closeForm}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="close" size={20} color={T.ink3} />
                                </TouchableOpacity>
                            </View>

                            <View style={s.cardDivider} />

                            {/* Name */}
                            <View style={s.formFieldWrap}>
                                <Text style={s.formLabel}>Name</Text>
                                <View style={s.formInputRow}>
                                    <TextInput
                                        style={s.formInput}
                                        value={draft.name}
                                        onChangeText={v => setDraft(d => ({ ...d, name: v }))}
                                        placeholder="Contact's full name"
                                        placeholderTextColor={T.ink4}
                                        selectionColor={T.violet}
                                        autoCapitalize="words"
                                    />
                                </View>
                            </View>

                            {/* Phone Number */}
                            <View style={s.formFieldWrap}>
                                <Text style={s.formLabel}>Phone Number</Text>
                                <View style={s.formInputRow}>
                                    <TextInput
                                        style={s.formInput}
                                        value={draft.phone}
                                        onChangeText={v => setDraft(d => ({ ...d, phone: v }))}
                                        placeholder="+880 1XXX-XXXXXX"
                                        placeholderTextColor={T.ink4}
                                        keyboardType="phone-pad"
                                        selectionColor={T.violet}
                                    />
                                </View>
                            </View>

                            {/* Relationship */}
                            <View style={s.formFieldWrap}>
                                <Text style={s.formLabel}>Relationship</Text>
                                <View style={s.formInputRow}>
                                    <TextInput
                                        style={s.formInput}
                                        value={draft.relationship}
                                        onChangeText={v => setDraft(d => ({ ...d, relationship: v }))}
                                        placeholder="e.g. Mother, Best Friend"
                                        placeholderTextColor={T.ink4}
                                        selectionColor={T.violet}
                                        autoCapitalize="words"
                                    />
                                </View>
                            </View>

                            {/* Priority */}
                            <View style={s.formFieldWrap}>
                                <Text style={s.formLabel}>Priority</Text>
                                <View style={s.priorityRow}>
                                    {PRIORITY_OPTIONS.map(opt => (
                                        <TouchableOpacity
                                            key={opt}
                                            style={[
                                                s.priorityPill,
                                                draft.priority === opt && s.priorityPillActive,
                                            ]}
                                            onPress={() => setDraft(d => ({ ...d, priority: opt }))}
                                            activeOpacity={0.75}
                                        >
                                            {opt === 'Primary' && (
                                                <Ionicons
                                                    name="star"
                                                    size={12}
                                                    color={draft.priority === 'Primary' ? T.accent : T.ink4}
                                                    style={{ marginRight: 4 }}
                                                />
                                            )}
                                            <Text
                                                style={[
                                                    s.priorityPillText,
                                                    draft.priority === opt && s.priorityPillTextActive,
                                                ]}
                                            >
                                                {opt}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={s.priorityHint}>
                                    Only one contact can be Primary at a time.
                                </Text>
                            </View>

                            {/* Submit */}
                            <TouchableOpacity
                                style={[s.submitBtn, isSaving && s.submitBtnDisabled]}
                                onPress={isSaving ? undefined : handleSave}
                                activeOpacity={0.8}
                            >
                                <Text style={s.submitBtnText}>
                                    {isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Contact'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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

    // ── Header ────────────────────────────────────────────────────────────────
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
    headerSpacer: {
        width: 36,
        height: 36,
    },

    // ── Scroll ────────────────────────────────────────────────────────────────
    scroll: {
        paddingHorizontal: 14,
        paddingTop: 20,
    },

    // ── Section ───────────────────────────────────────────────────────────────
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 10,
        marginLeft: 4,
    },

    // ── Empty state ───────────────────────────────────────────────────────────
    emptyCard: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingVertical: 36,
        paddingHorizontal: 20,
        alignItems: 'center',
        gap: 8,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: T.ink3,
        marginTop: 8,
    },
    emptySubtitle: {
        fontSize: 13,
        fontWeight: '400',
        color: T.ink4,
        textAlign: 'center',
        lineHeight: 18,
    },

    // ── Contact Card ──────────────────────────────────────────────────────────
    contactCard: {
        backgroundColor: T.surfaceBulky,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.lineMid,
        paddingHorizontal: 14,
        paddingVertical: 14,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOpacity: 0.10,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
            },
            android: { elevation: 3 },
        }),
    },
    contactCardGap: {
        marginBottom: 10,
    },
    contactInfo: {
        marginBottom: 12,
        gap: 3,
    },
    contactNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 2,
    },
    contactName: {
        fontSize: 15,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: -0.2,
    },
    contactPhone: {
        fontSize: 13,
        fontWeight: '500',
        color: T.ink3,
        letterSpacing: 0.2,
    },
    contactRelationship: {
        fontSize: 12,
        fontWeight: '400',
        color: T.ink4,
        letterSpacing: 0.1,
    },

    // ── Primary badge ─────────────────────────────────────────────────────────
    primaryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: R.xs,
        backgroundColor: T.accentLight,
        borderWidth: 1,
        borderColor: `${T.accent}40`,
    },
    primaryBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: T.accent,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    // ── Action row ────────────────────────────────────────────────────────────
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: T.lineMid,
        paddingTop: 12,
    },
    callBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: T.violet,
        borderRadius: R.sm,
        paddingVertical: 9,
    },
    callBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: T.onPrimary,
        letterSpacing: 0.2,
    },
    editContactBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: T.violetDim,
        borderRadius: R.sm,
        borderWidth: 1,
        borderColor: `${T.violet}30`,
        paddingVertical: 9,
    },
    editContactBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: T.violet,
        letterSpacing: 0.2,
    },
    deleteBtn: {
        width: 38,
        height: 38,
        borderRadius: R.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.dangerLight,
        borderWidth: 1,
        borderColor: T.dangerBorder,
    },

    // ── Add Contact button ────────────────────────────────────────────────────
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: T.violetDim,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: `${T.violet}30`,
        paddingVertical: 16,
    },
    addBtnDisabled: {
        backgroundColor: T.disabledBg,
        borderColor: T.lineMid,
    },
    addBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: T.violet,
        letterSpacing: 0.2,
    },
    addBtnTextDisabled: {
        color: T.disabledText,
    },
    maxHint: {
        fontSize: 12,
        fontWeight: '400',
        color: T.ink4,
        textAlign: 'center',
        marginTop: 8,
    },

    // ── Modal outer — positions card at bottom ────────────────────────────────
    modalOuter: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: 14,
    },
    backdropDim: {
        backgroundColor: 'rgba(3,3,8,0.50)',
    },

    // ── Floating card ─────────────────────────────────────────────────────────
    floatingCard: {
        borderRadius: R.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: `${T.violet}30`,
        maxHeight: '90%',
        ...Platform.select({
            ios: {
                shadowColor: '#8A38F6',
                shadowOpacity: 0.30,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: -8 },
            },
            android: { elevation: 16 },
        }),
    },
    cardTint: {
        backgroundColor: 'rgba(18,11,41,0.85)',
    },
    cardScroll: {
        padding: 20,
        paddingBottom: 8,
    },

    // ── Card header ───────────────────────────────────────────────────────────
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: T.ink,
        letterSpacing: -0.3,
    },
    cardCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: R.hBtn,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.surfaceCard,
        borderWidth: 1,
        borderColor: T.lineMid,
    },
    cardDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
        marginBottom: 20,
    },

    // ── Form fields ───────────────────────────────────────────────────────────
    formFieldWrap: {
        marginBottom: 16,
    },
    formLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: T.ink3,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    formInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.surfaceBulky,
        borderRadius: R.sm,
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        paddingHorizontal: 12,
        minHeight: 44,
    },
    formInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: T.ink,
        paddingVertical: Platform.OS === 'ios' ? 0 : 2,
    },

    // ── Priority pills ────────────────────────────────────────────────────────
    priorityRow: {
        flexDirection: 'row',
        gap: 10,
    },
    priorityPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: R.sm,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: T.hairlineMicro,
    },
    priorityPillActive: {
        backgroundColor: T.violetDim,
        borderColor: `${T.violet}50`,
    },
    priorityPillText: {
        fontSize: 13,
        fontWeight: '600',
        color: T.ink4,
    },
    priorityPillTextActive: {
        color: T.violet,
    },
    priorityHint: {
        fontSize: 11,
        fontWeight: '400',
        color: T.ink4,
        marginTop: 6,
    },

    // ── Submit button ─────────────────────────────────────────────────────────
    submitBtn: {
        backgroundColor: T.violet,
        borderRadius: R.md,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        marginBottom: 12,
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    submitBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: T.onPrimary,
        letterSpacing: 0.2,
    },
});

