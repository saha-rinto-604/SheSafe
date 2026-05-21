/**
 * volunteer/chat_room.tsx â€” Tactical Group Chat (Volunteer)
 * Mirrors standard-user chat room UI for consistency.
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
    Platform, StatusBar, KeyboardAvoidingView, Keyboard, Image,
    Modal, Pressable, Alert, Dimensions, ScrollView
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { type IncidentCategory } from '../../../../src/types/chat';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import UserAvatar from '../../../../src/components/shared/UserAvatar';


import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import RespondersList from '../../../../src/components/RespondersList';
import { T, R, S, Ty } from '../../../../src/constants/theme';
import { DEFAULT_GROUP_CHAT_NAME, type Incident, type Message, type Role } from '../../../../src/types/chat';
import { incidentService } from '../../../../src/services/incidentService';
import { getStoredIdentity } from '../../../../src/services/api';
import { useChatSocket } from '../../../../src/hooks/useChatSocket';

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MAP_STRIP_HEIGHT = 180;
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

type Responder = {
    id: string;
    name: string;
    avatarUri: string | null;
    location?: { latitude: number; longitude: number };
    fallbackDistance?: string;
    fallbackDuration?: string;
};

type ResponderDirectory = {
    sosUser: { id: string; name: string; photoUri?: string | null; role?: string } | null;
    volunteers: Responder[];
    responderCount: number;
    maxResponders: number;
};

type CaseDetailsForm = {
    notes: string;
    condition: string;
    actionsTaken: string;
};

function isActiveStatus(status?: string): boolean {
    return status === 'ACTIVE' || status === 'LIVE';
}

function normalizeIncident(raw: any): Incident {
    const createdAt = raw?.createdAt ?? raw?.created_at ?? new Date().toISOString();
    return {
        id: String(raw?.id ?? ''),
        type: raw?.type ?? 'SOS Alert',
        status: raw?.status ?? 'ACTIVE',
        location: raw?.location ?? {
            latitude: Number(raw?.latitude) || 0,
            longitude: Number(raw?.longitude) || 0,
            updatedAt: raw?.accepted_at ?? createdAt,
        },
        address: raw?.address ?? null,
        reporter: raw?.reporter ?? [raw?.first_name, raw?.last_name].filter(Boolean).join(' '),
        reporterPhotoUrl: raw?.reporterPhotoUrl ?? raw?.photo_url ?? null,
        latestMessage: typeof raw?.latestMessage === 'object' ? raw.latestMessage : null,
        participantCount: Number(raw?.participantCount ?? 0),
        acceptedAt: raw?.acceptedAt ?? raw?.accepted_at ?? null,
        createdAt,
    };
}
// â”€â”€â”€ Role badge config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ROLE_META: Record<Role, {
    label: string; color: string; bg: string; border: string;
    icon: keyof typeof Feather.glyphMap;
    gradientFrom: string; gradientTo: string;
}> = {
    USER: {
        label: 'VICTIM', color: T.dangerText, bg: T.dangerBg,
        border: T.dangerBorder, icon: 'alert-circle',
        gradientFrom: T.danger, gradientTo: '#991B1B',
    },
    VOLUNTEER: {
        label: 'VOLUNTEER', color: '#C4B5FD', bg: T.violetDim,
        border: 'rgba(138,56,246,0.25)', icon: 'heart',
        gradientFrom: T.violet, gradientTo: T.violetDark,
    },
    POLICE: {
        label: 'POLICE', color: '#6EE7B7', bg: T.safeLight,
        border: 'rgba(16,185,129,0.25)', icon: 'shield',
        gradientFrom: T.success, gradientTo: '#047857',
    },
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
}

function caseLabel(id: string, createdAt: string): string {
    const year = new Date(createdAt).getFullYear();
    const num = id.replace(/\D/g, '').padStart(3, '0');
    return `CASE #${year}-${num}`;
}

// â”€â”€â”€ RoleBadge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RoleBadge = memo(function RoleBadge({ role }: { role: Role }) {
    const meta = ROLE_META[role];
    return (
        <View style={st.roleBadge}>
            <Text style={[st.roleBadgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
        </View>
    );
});

const SystemBubble = memo(function SystemBubble({ msg }: { msg: Message }) {
    const isEvidence = !!msg.evidenceId;
    return (
        <View style={st.systemWrap}>
            <View style={st.systemLine} />
            <View style={st.systemPill}>
                {isEvidence && <Feather name="paperclip" size={10} color={T.violet} style={{ marginRight: 3 }} />}
                <Text style={[st.systemText, isEvidence && st.systemTextEvidence]}>
                    {msg.content}
                </Text>
            </View>
            <View style={st.systemLine} />
        </View>
    );
});

// â”€â”€â”€ PillBubble â€” Directional tail (R.pill 3 corners, 0 near avatar) â”€â”€â”€â”€â”€â”€â”€
const PillBubble = memo(function PillBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
    if (msg.type === 'SYSTEM') return <SystemBubble msg={msg} />;

    const role = msg.sender.role;
    const alignRight = isOwn;

    const tailStyle = alignRight
        ? {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomRightRadius: 2,
            borderBottomLeftRadius: 16,
        }
        : {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomRightRadius: 16,
            borderBottomLeftRadius: 2,
        };

    return (
        <View style={[st.bubbleRow, alignRight ? st.bubbleRowOwn : st.bubbleRowOther]}>
            {!alignRight && (
                <UserAvatar
                    uri={msg.sender.avatarUrl ?? null}
                    size={32}
                    style={st.avatar}
                />
            )}

            <View style={st.bubbleCol}>
                {!alignRight && (
                    <View style={st.senderRow}>
                        <Text style={st.senderName}>
                            {msg.sender.name}
                        </Text>
                        <RoleBadge role={role} />
                    </View>
                )}

                <View style={[
                    st.bubble,
                    alignRight ? st.bubbleOwn : st.bubbleOther,
                    tailStyle,
                ]}>
                    {!alignRight && <View style={[StyleSheet.absoluteFill, st.bubbleOtherBg, tailStyle]} />}
                    {msg.type === 'AUDIO' ? (
                        <View style={st.audioWrap}>
                            <TouchableOpacity style={st.audioPlayBtn}>
                                <Feather name="play" size={13} color={T.onPrimary} />
                            </TouchableOpacity>
                            <View style={st.audioWaveform}>
                                {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.3, 0.65, 0.5, 0.85, 0.4, 0.55, 0.7, 0.3].map((h, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            st.waveBar,
                                            {
                                                height: h * 18,
                                                backgroundColor: alignRight ? 'rgba(255,255,255,0.5)' : T.ink4,
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                            <Text style={st.audioDur}>0:22</Text>
                        </View>
                    ) : msg.type === 'IMAGE' ? (
                        <View style={st.imageWrap}>
                            <Feather name="image" size={22} color={T.ink4} />
                            <Text style={st.imageLabel}>Photo attached</Text>
                        </View>
                    ) : (
                        <Text style={[
                            st.msgText,
                            alignRight && st.msgTextOwn
                        ]}>
                            {msg.content}
                        </Text>
                    )}
                </View>

                <Text style={[st.msgTime, alignRight && st.msgTimeOwn]}>
                    {formatTime(msg.timestamp)}
                </Text>
            </View>
        </View>
    );
});

// â”€â”€â”€ Floating Glass Pill Input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ Tactical Map Style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TACTICAL_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#0A0A0C' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6B7A8D' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0C' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d1a0d' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1C2333' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0A0A0C' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5a6a7a' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e2530' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2C3E58' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1f2a' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8090a8' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07070A' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a4060' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0a0f1a' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a1f2a' }] },
    { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#4a5a70' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#6a7a90' }] },
];

const { width, height } = Dimensions.get('window');

function FloatingInput({ onSend, bottomInset, onImagePicked }: { onSend: (text: string) => void; bottomInset: number; onImagePicked: (uri: string) => void }) {
    const [text, setText] = useState('');
    const [isAttachMenuVisible, setAttachMenuVisible] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const hasText = text.trim().length > 0;

    const handleSend = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        Haptics.selectionAsync();
        onSend(trimmed);
        setText('');
    };

    return (
        <View style={[st.inputOuter, { paddingBottom: Math.max(bottomInset, 14) }]}>
            {isAttachMenuVisible && (
                <Modal transparent visible animationType="fade">
                    <Pressable style={st.attachModalBackdrop} onPress={() => setAttachMenuVisible(false)}>
                        <View style={st.attachMenuOuterModal}>
                            <TouchableOpacity
                                style={[st.attachOptionRow, { paddingBottom: 12 }]}
                                activeOpacity={0.7}
                                onPress={async () => {
                                    Haptics.selectionAsync();
                                    try {
                                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                        if (status !== 'granted') {
                                            Alert.alert('Permission required', 'Permission to access media library is required.');
                                            return;
                                        }

                                        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
                                        if (!res.canceled && res.assets && res.assets.length > 0) {
                                            const uri = res.assets[0].uri;
                                            onImagePicked(uri);
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        setAttachMenuVisible(false);
                                    }
                                }}
                            >
                                <Feather name="image" size={20} color="#FFFFFF" />
                                <Text style={st.attachOptionText}>Photo</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>
            )}

            <View style={st.inputPillContainer}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
                    <View style={[StyleSheet.absoluteFill, st.inputPillBg]} />
                </BlurView>

                <View style={st.inputPill}>
                    <TouchableOpacity
                        style={st.inputAction}
                        onPress={() => {
                            Haptics.selectionAsync();
                            setAttachMenuVisible(!isAttachMenuVisible);
                        }}
                        activeOpacity={0.7}
                    >
                        <Feather name="paperclip" size={20} color={isAttachMenuVisible ? T.violet : "#FFFFFF"} />
                    </TouchableOpacity>

                    <TextInput
                        ref={inputRef}
                        style={st.input}
                        placeholder="Type a message..."
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={text}
                        onChangeText={setText}
                        multiline
                        maxLength={2000}
                        onFocus={() => setAttachMenuVisible(false)}
                    />

                    <TouchableOpacity
                        style={[st.sendBtn, !hasText && st.sendBtnOff]}
                        onPress={handleSend}
                        disabled={!hasText}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

function ArchivePill({ bottomInset }: { bottomInset: number }) {
    return (
        <View style={[st.archiveOuter, { paddingBottom: Math.max(bottomInset, S.s4) }]}>
            <BlurView intensity={30} tint="dark" style={st.archiveBlur}>
                <View style={st.archiveInner}>
                    <Feather name="lock" size={13} color={T.ink4} />
                    <Text style={st.archiveText}>Incident Archived â€” Case Read-Only</Text>
                </View>
            </BlurView>
        </View>
    );
}

const decodePolyline = (t: string, e?: number) => {
    let n = 0, o = 0, r = 0, l = 0, i = 0, a = null;
    const d: { latitude: number; longitude: number }[] = [];
    for (e = e || 5; n < t.length;) {
        a = null, r = 0, l = 0;
        do a = t.charCodeAt(n++) - 63, l |= (31 & a) << r, r += 5; while (a >= 32);
        i = 1 & l ? ~(l >> 1) : l >> 1, r = l = 0, o += i;
        do a = t.charCodeAt(n++) - 63, l |= (31 & a) << r, r += 5; while (a >= 32);
        i = 1 & l ? ~(l >> 1) : l >> 1, d.push({ latitude: o / 10 ** e, longitude: (r += i) / 10 ** e });
    }
    return d.map(p => ({ latitude: p.latitude, longitude: p.longitude - r / 10 ** e + p.longitude })); // quick fix
};

// Real polyline decode from google
function polylineDecode(str: string, precision = 5) {
    let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
    while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; lng += longitude_change;
        coordinates.push({ latitude: lat / factor, longitude: lng / factor });
    }
    return coordinates;
}

// â”€â”€â”€ Main â€” Chat Room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PremiumBar & Nav Helpers
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const PremiumBar = memo(function PremiumBar({
    style, contentStyle, children,
}: { style?: any; contentStyle?: any; children: React.ReactNode }) {
    return (
        <View style={[pb.bar, style]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={pb.tint} pointerEvents="none" />
            <View style={[pb.content, contentStyle]}>{children}</View>
        </View>
    );
});
const pb = StyleSheet.create({
    bar: { backgroundColor: 'rgba(30,21,58,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', borderRadius: 16 },
    tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,18,0.4)' },
    content: { flexDirection: 'row', alignItems: 'center' },
});

function getManeuverIcon(maneuver?: string): React.ComponentProps<typeof Ionicons>['name'] {
    if (!maneuver) return 'arrow-up';
    const m = maneuver.toLowerCase();
    if (m.includes('uturn')) return 'return-up-back';
    if (m.includes('left')) return 'arrow-back';
    if (m.includes('right')) return 'arrow-forward';
    if (m.includes('merge')) return 'git-merge';
    if (m.includes('roundabout')) return 'sync';
    if (m.includes('fork')) return 'git-branch';
    return 'arrow-up';
}

function haversineDistance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusM = 6_371_000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

export default function ChatRoom() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { incidentId, category } = useLocalSearchParams<{ incidentId: string; category?: string }>();
    const liveIncidentId = String(incidentId || '');
    const [selfId, setSelfId] = useState<string | undefined>();
    const { messages, participants, sendMessage } = useChatSocket(liveIncidentId, selfId, 'VOLUNTEER');
    const [incident, setIncident] = useState<Incident | null>(null);

    const resolvedCategory: IncidentCategory =
        (category === 'MY_EMERGENCY' ? 'MY_EMERGENCY' : 'ASSISTED') as IncidentCategory;
    const isMyEmergency = resolvedCategory === 'MY_EMERGENCY';

    const flatRef = useRef<FlatList>(null);
    const isLive = isActiveStatus(incident?.status);
    const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);

    // Map Overlay State
    const [isMapOverlayOpen, setIsMapOverlayOpen] = useState(false);
    const [mapRouteCoords, setMapRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [mapDistance, setMapDistance] = useState('');
    const [mapDuration, setMapDuration] = useState('');
    const [isLiveNavMode, setIsLiveNavMode] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [selectedResponderId, setSelectedResponderId] = useState('');
    const mapRef = useRef<MapView>(null);

    // Travel Mode
    const [travelMode, setTravelMode] = useState<'walking' | 'driving' | 'motorcycle' | 'transit'>('walking');
    const [travelModeDropdownOpen, setTravelModeDropdownOpen] = useState(false);

    // Nav Instructions (for live/review mode)
    type NavStep = { instruction: string; distance: string; maneuver?: string; endLocation?: { latitude: number; longitude: number } };
    const [navInstructions, setNavInstructions] = useState<NavStep[]>([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);

    // Route Progress (completed portion turns green)
    const [completedRouteCoords, setCompletedRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [remainingRouteCoords, setRemainingRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

    // Responders list modal state (local mock list of 5)
    const [isRespondersOpen, setRespondersOpen] = useState(false);
    const [isResponderRemovedOpen, setResponderRemovedOpen] = useState(false);
    const [respondersList, setRespondersList] = useState<Responder[]>([]);
    const [responderDirectory, setResponderDirectory] = useState<ResponderDirectory>({
        sosUser: null,
        volunteers: [],
        responderCount: 0,
        maxResponders: 3,
    });

    const handleRemoveResponder = useCallback((id: string) => {
        setRespondersList(prev => prev.filter(r => r.id !== id));
        if (id === selectedResponderId) {
            setSelectedResponderId(respondersList[0]?.id ?? '');
        }
        setResponderRemovedOpen(true);
        setTimeout(() => setResponderRemovedOpen(false), 2000);
    }, [selectedResponderId, respondersList]);

    // Edit Case Details modal state
    const [isEditCaseOpen, setEditCaseOpen] = useState(false);
    const [caseDetails, setCaseDetails] = useState<CaseDetailsForm>({
        notes: '',
        condition: '',
        actionsTaken: '',
    });
    const [caseError, setCaseError] = useState<string | null>(null);
    const [savingCaseDetails, setSavingCaseDetails] = useState(false);

    const [isSaveConfirmationOpen, setSaveConfirmationOpen] = useState(false);

    const handleSaveCaseDetails = useCallback(async () => {
        setSavingCaseDetails(true);
        setCaseError(null);
        try {
            const updated = await incidentService.updateVolunteerCaseDetails(liveIncidentId, caseDetails);
            setCaseDetails({
                notes: updated.notes ?? '',
                condition: updated.condition ?? '',
                actionsTaken: updated.actionsTaken ?? '',
            });
            setEditCaseOpen(false);
            setSaveConfirmationOpen(true);
            setTimeout(() => setSaveConfirmationOpen(false), 2200);
        } catch (error: any) {
            setCaseError(error?.message || 'Unable to save case details.');
        } finally {
            setSavingCaseDetails(false);
        }
    }, [caseDetails, liveIncidentId]);

    // Leave Dispatch confirmation
    const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
    const handleConfirmLeave = useCallback(() => {
        Haptics.selectionAsync();
        setHeaderMenuOpen(false);
        setLeaveConfirmOpen(false);
        // navigate back to previous screen
        router.back();
    }, [router]);

    useEffect(() => {
        getStoredIdentity().then(identity => setSelfId(identity?.userId));
    }, []);

    useEffect(() => {
        if (!liveIncidentId) return;
        let mounted = true;
        incidentService.getOne(liveIncidentId)
            .then(raw => {
                if (!mounted) return;
                const nextIncident = normalizeIncident(raw);
                setIncident(nextIncident);
            })
            .catch(error => Alert.alert('Incident unavailable', error?.message || 'Unable to load this incident.'));
        return () => { mounted = false; };
    }, [liveIncidentId]);

    const loadResponders = useCallback(async () => {
        if (!liveIncidentId) return;
        const response = await incidentService.getIncidentResponders(liveIncidentId);
        const volunteers = (response.volunteers || []).map(volunteer => ({
            id: volunteer.id,
            name: volunteer.name,
            avatarUri: volunteer.photoUri ?? null,
        }));
        setResponderDirectory({
            sosUser: response.sosUser ? {
                id: response.sosUser.id,
                name: response.sosUser.name,
                photoUri: response.sosUser.photoUri ?? null,
                role: response.sosUser.role,
            } : null,
            volunteers,
            responderCount: volunteers.length,
            maxResponders: response.maxVolunteerResponders ?? 3,
        });
        setRespondersList(volunteers);
        setSelectedResponderId(prev => prev || volunteers[0]?.id || '');
    }, [liveIncidentId]);

    useEffect(() => {
        if (!liveIncidentId) return;
        let mounted = true;
        loadResponders().catch(error => {
            if (mounted) console.warn('[VolunteerChatRoom] responders unavailable:', error?.message || error);
        });
        incidentService.getVolunteerCaseDetails(liveIncidentId)
            .then(details => {
                if (!mounted) return;
                setCaseDetails({
                    notes: details.notes ?? '',
                    condition: details.condition ?? '',
                    actionsTaken: details.actionsTaken ?? '',
                });
            })
            .catch(error => {
                if (mounted) console.warn('[VolunteerChatRoom] case details unavailable:', error?.message || error);
            });
        const interval = setInterval(() => {
            loadResponders().catch(() => undefined);
        }, 7000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [liveIncidentId, loadResponders]);

    useEffect(() => {
        if (responderDirectory.volunteers.length > 0) return;
        const nextResponders = participants
            .filter(participant => participant.role !== 'USER')
            .map(participant => ({
                id: participant.id,
                name: participant.name,
                avatarUri: participant.avatarUrl ?? null,
            }));
        setRespondersList(nextResponders);
        setSelectedResponderId(prev => prev || nextResponders[0]?.id || '');
    }, [participants, responderDirectory.volunteers.length]);

    const selectedResponder = React.useMemo(
        () => respondersList.find(responder => responder.id === selectedResponderId) ?? respondersList[0] ?? null,
        [respondersList, selectedResponderId]
    );

    const loadRouteForResponder = useCallback(async (responder: Responder) => {
        if (!incident) return;
        const originLocation = responder.location ?? userLoc ?? incident.location;
        const origin = `${originLocation.latitude},${originLocation.longitude}`;
        const destination = `${incident.location.latitude},${incident.location.longitude}`;
        const apiMode = travelMode === 'motorcycle' ? 'two_wheeler' : travelMode;
        const modeLabel = travelMode === 'motorcycle' ? 'ride' : travelMode === 'driving' ? 'drive' : travelMode === 'transit' ? 'transit' : 'walk';

        if (!GOOGLE_MAPS_API_KEY) {
            let mockMins = 23;
            if (travelMode === 'walking') mockMins = 75;
            else if (travelMode === 'motorcycle') mockMins = 18;
            else if (travelMode === 'transit') mockMins = 35;

            setMapRouteCoords([originLocation, { latitude: incident.location.latitude, longitude: incident.location.longitude }]);
            setMapDistance(responder.fallbackDistance ?? '');
            setMapDuration(`~${mockMins} mins ${modeLabel}`);
            setNavInstructions([]);
            setCompletedRouteCoords([]);
            setRemainingRouteCoords([originLocation, { latitude: incident.location.latitude, longitude: incident.location.longitude }]);
            return;
        }

        try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${apiMode}&key=${GOOGLE_MAPS_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data?.routes?.length > 0) {
                const points = data.routes[0].overview_polyline.points;
                const coords = polylineDecode(points);
                const leg = data.routes[0].legs?.[0];
                setMapRouteCoords(coords);
                setMapDistance(leg?.distance?.text ?? responder.fallbackDistance);
                setMapDuration(`~${leg?.duration?.text ?? responder.fallbackDuration ?? ''} ${modeLabel}`);
                setCompletedRouteCoords([]);
                setRemainingRouteCoords(coords);

                // Extract turn-by-turn instructions
                const steps = leg?.steps ?? [];
                const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
                const instructions: NavStep[] = steps.map((step: any) => ({
                    instruction: stripHtml(step.html_instructions ?? ''),
                    distance: step.distance?.text ?? '',
                    maneuver: step.maneuver,
                    endLocation: step.end_location ? { latitude: step.end_location.lat, longitude: step.end_location.lng } : undefined,
                }));
                setNavInstructions(instructions);
                setCurrentStepIdx(0);

                setTimeout(() => {
                    mapRef.current?.fitToCoordinates(coords, {
                        edgePadding: { top: 140, right: 60, bottom: 280, left: 60 },
                        animated: true,
                    });
                }, 400);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load route');
        }
    }, [incident, travelMode, userLoc]);

    const handleSelectResponder = useCallback(async (responderId: string) => {
        if (responderId === selectedResponderId) return;
        Haptics.selectionAsync();
        setSelectedResponderId(responderId);
        const responder = respondersList.find(item => item.id === responderId);
        if (responder) {
            await loadRouteForResponder(responder);
        }
    }, [loadRouteForResponder, respondersList, selectedResponderId]);


    useEffect(() => {
        if (isMapOverlayOpen && selectedResponder) {
            loadRouteForResponder(selectedResponder);
        }
    }, [travelMode, isMapOverlayOpen, loadRouteForResponder, selectedResponder]);

    const openMapOverlay = useCallback(async () => {
        setIsMapOverlayOpen(true);
        setIsLiveNavMode(false);
        setIsReviewMode(false);
        setTravelModeDropdownOpen(false);
        Haptics.selectionAsync();
        if (selectedResponder) await loadRouteForResponder(selectedResponder);
    }, [loadRouteForResponder, selectedResponder]);

    useEffect(() => {
        if (!isLiveNavMode) {
            if (locationSubRef.current) {
                locationSubRef.current.remove();
                locationSubRef.current = null;
            }
            return;
        }

        let mounted = true;
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            locationSubRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 2000,
                    distanceInterval: 5,
                },
                (loc) => {
                    if (mounted) {
                        setUserLoc({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            heading: loc.coords.heading ?? undefined,
                        });
                    }
                }
            );
        })();

        return () => {
            mounted = false;
            if (locationSubRef.current) {
                locationSubRef.current.remove();
                locationSubRef.current = null;
            }
        };
    }, [isLiveNavMode]);

    useEffect(() => {
        if (!isLiveNavMode || !userLoc) return;

        mapRef.current?.animateCamera({
            center: { latitude: userLoc.latitude, longitude: userLoc.longitude },
            pitch: 45,
            heading: userLoc.heading ?? 0,
            zoom: 19,
        }, { duration: 1000 });

        if (navInstructions.length > 0 && currentStepIdx < navInstructions.length - 1) {
            const currentStep = navInstructions[currentStepIdx];
            if (currentStep.endLocation) {
                const dist = haversineDistance(userLoc, currentStep.endLocation);
                if (dist <= 25) {
                    setCurrentStepIdx(prev => prev + 1);
                }
            }
        }

        // Progress polyline split
        if (mapRouteCoords && mapRouteCoords.length > 0) {
            let closestIdx = 0;
            let minD = Infinity;
            mapRouteCoords.forEach((pt, i) => {
                const d = haversineDistance(userLoc, pt);
                if (d < minD) { minD = d; closestIdx = i; }
            });
            setCompletedRouteCoords(mapRouteCoords.slice(0, closestIdx + 1));
            setRemainingRouteCoords(mapRouteCoords.slice(closestIdx));
        }
    }, [isLiveNavMode, userLoc, currentStepIdx, navInstructions, mapRouteCoords]);

    useEffect(() => {
        if (isLiveNavMode && audioEnabled && navInstructions.length > 0 && currentStepIdx < navInstructions.length) {
            Speech.speak(navInstructions[currentStepIdx].instruction);
        }
    }, [isLiveNavMode, audioEnabled, currentStepIdx, navInstructions]);


    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
        }
    }, [messages.length]);

    const handleSend = useCallback(async (text: string) => {
        await sendMessage(text, 'TEXT');
    }, [sendMessage]);

    const renderMessage = useCallback(({ item }: { item: Message }) => (
        <PillBubble msg={item} isOwn={item.sender.id === selfId} />
    ), [selfId]);

    if (!incident) {
        return (
            <AtmosphericShell>
                <View style={[st.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={st.emptyChatText}>Loading incident...</Text>
                </View>
            </AtmosphericShell>
        );
    }

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}
            >
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={st.headerOuter}>
                    <BlurView intensity={50} tint="dark" style={st.headerBlur}>
                        <View style={st.headerInner}>
                            <View style={st.headerLeft}>
                                <TouchableOpacity
                                    onPress={() => { Haptics.selectionAsync(); router.back(); }}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    style={st.headerBtn}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="chevron-left" size={22} color={T.ink} />
                                </TouchableOpacity>

                                <View style={st.headerTitleBlock}>
                                    <Text style={st.headerTitle} numberOfLines={1}>
                                        {DEFAULT_GROUP_CHAT_NAME}
                                    </Text>
                                    <View style={st.headerMeta}>
                                        <View style={[
                                            st.headerStatusPill,
                                            isLive ? st.headerStatusPillLive : st.headerStatusPillArchived,
                                        ]}>
                                            <Text style={isLive ? st.headerStatusTextLive : st.headerStatusTextArchived}>
                                                {isLive ? 'ACTIVE' : 'ARCHIVED'}
                                            </Text>
                                        </View>
                                        {/* Category context pill */}
                                        <View style={[
                                            st.headerStatusPill,
                                            isMyEmergency ? st.headerCategoryPillEmergency : st.headerCategoryPillAssisting,
                                        ]}>
                                            <Text style={isMyEmergency ? st.headerCategoryTextEmergency : st.headerCategoryTextAssisting}>
                                                {isMyEmergency ? 'MY EMERGENCY' : 'ASSISTED'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            <View style={st.headerRight}>
                                <TouchableOpacity
                                    style={st.liveMapCircularBtn}
                                    activeOpacity={0.7}
                                    onPress={openMapOverlay}
                                >
                                    <View style={[StyleSheet.absoluteFill, st.liveMapCircularBg]} />
                                    <Feather name="map" size={18} color="#FFFFFF" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={st.headerMenuBtn}
                                    activeOpacity={0.7}
                                    onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(true); }}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                >
                                    <Feather name="more-vertical" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>

                        </View>
                    </BlurView>
                </View>

                <View style={{ marginTop: 12 }} />

                <KeyboardAvoidingView
                    style={st.chatArea}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
                >
                    <FlatList
                        ref={flatRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item.id}
                        contentContainerStyle={st.messageList}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={Keyboard.dismiss}
                        ListEmptyComponent={
                            <View style={st.emptyChat}>
                                <View style={st.emptyChatCircle}>
                                    <Feather name="message-circle" size={24} color={T.ink5} />
                                </View>
                                <Text style={st.emptyChatText}>No messages yet</Text>
                            </View>
                        }
                    />

                    {isLive ? (
                        <FloatingInput onSend={handleSend} bottomInset={insets.bottom} onImagePicked={(uri) => {
                            sendMessage(uri, 'IMAGE');
                        }} />
                    ) : (
                        <ArchivePill bottomInset={insets.bottom} />
                    )}
                </KeyboardAvoidingView>

                <Modal transparent={true} visible={isHeaderMenuOpen} animationType="fade">
                    <Pressable style={st.headerMenuBackdrop} onPress={() => setHeaderMenuOpen(false)}>
                        <View style={st.headerMenuPanel}>
                            <TouchableOpacity
                                style={st.headerMenuRow}
                                activeOpacity={0.7}
                                onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); setRespondersOpen(true); }}
                            >
                                <Feather name="users" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>View Responders</Text>
                            </TouchableOpacity>

                            <View style={st.headerMenuDivider} />

                            <TouchableOpacity
                                style={st.headerMenuRow}
                                activeOpacity={0.7}
                                onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); setEditCaseOpen(true); }}
                            >
                                <Feather name="edit-2" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>Edit Case Details</Text>
                            </TouchableOpacity>

                            <View style={st.headerMenuDivider} />

                            <TouchableOpacity
                                style={st.headerMenuRow}
                                activeOpacity={0.7}
                                onPress={() => { Haptics.selectionAsync(); setLeaveConfirmOpen(true); setHeaderMenuOpen(false); }}
                            >
                                <Feather name="x-circle" size={16} color="#FF453A" />
                                <Text style={[st.headerMenuText, st.headerMenuTextDanger]}>Leave Dispatch</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>

                {/* Edit Case Details Modal */}
                <Modal transparent={true} visible={isEditCaseOpen} animationType="slide">
                    <Pressable style={st.caseModalBackdrop} onPress={() => setEditCaseOpen(false)}>
                        <View style={st.caseModalSheet}>
                            <Text style={st.caseModalTitle}>Edit Case Details</Text>
                            <Text style={st.caseModalHint}>Add your notes, victim condition, and actions taken.</Text>
                            <TextInput
                                style={st.caseModalInput}
                                multiline
                                value={caseDetails.notes}
                                onChangeText={(notes) => setCaseDetails(prev => ({ ...prev, notes }))}
                                placeholder="Notes..."
                                placeholderTextColor="rgba(255,255,255,0.35)"
                            />
                            <TextInput
                                style={st.caseModalInputCompact}
                                value={caseDetails.condition}
                                onChangeText={(condition) => setCaseDetails(prev => ({ ...prev, condition }))}
                                placeholder="Condition..."
                                placeholderTextColor="rgba(255,255,255,0.35)"
                            />
                            <TextInput
                                style={st.caseModalInput}
                                multiline
                                value={caseDetails.actionsTaken}
                                onChangeText={(actionsTaken) => setCaseDetails(prev => ({ ...prev, actionsTaken }))}
                                placeholder="Actions taken..."
                                placeholderTextColor="rgba(255,255,255,0.35)"
                            />
                            {caseError && <Text style={st.caseModalError}>{caseError}</Text>}

                            <View style={st.caseModalFooter}>
                                <TouchableOpacity style={st.caseModalCancel} onPress={() => setEditCaseOpen(false)}>
                                    <Text style={st.caseModalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[st.caseModalSave, savingCaseDetails && { opacity: 0.65 }]} onPress={handleSaveCaseDetails} disabled={savingCaseDetails}>
                                    <Text style={st.caseModalSaveText}>{savingCaseDetails ? 'Saving...' : 'Save'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Modal>

                {/* Save Confirmation Modal (styled) */}
                <Modal transparent={true} visible={isSaveConfirmationOpen} animationType="fade">
                    <View style={st.saveBackdropCentered}>
                        <View style={st.saveCardColored}>
                            <Text style={st.saveTitleColored}>Saved</Text>
                            <Text style={st.saveMessageColored}>Case details saved.</Text>
                        </View>
                    </View>
                </Modal>

                {/* Leave Dispatch Confirmation Modal */}
                <Modal transparent={true} visible={isLeaveConfirmOpen} animationType="fade">
                    <View style={st.leaveBackdropCentered}>
                        <View style={st.leaveCard}>
                            <Text style={st.leaveTitle}>Are you sure?</Text>
                            <Text style={st.leaveMessage}>Do you want to leave this dispatch? You will no longer receive updates for this case.</Text>

                            <View style={st.leaveActions}>
                                <TouchableOpacity style={st.leaveCancel} onPress={() => setLeaveConfirmOpen(false)}>
                                    <Text style={st.leaveCancelText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={st.leaveYes} onPress={handleConfirmLeave}>
                                    <Text style={st.leaveYesText}>Yes</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <RespondersList
                    visible={isRespondersOpen}
                    onClose={() => setRespondersOpen(false)}
                    data={respondersList}
                    sosUser={responderDirectory.sosUser ? {
                        id: responderDirectory.sosUser.id,
                        name: responderDirectory.sosUser.name,
                        avatarUri: responderDirectory.sosUser.photoUri ?? null,
                        role: 'USER',
                    } : null}
                    responderCount={responderDirectory.responderCount}
                    maxResponders={responderDirectory.maxResponders}
                />

                {/* Responder Removed confirmation (styled) */}
                <Modal transparent={true} visible={isResponderRemovedOpen} animationType="fade">
                    <View style={st.saveBackdropCentered}>
                        <View style={st.saveCardColored}>
                            <Text style={st.saveTitleColored}>Responder removed</Text>
                            <Text style={st.saveMessageColored}>The responder was removed from the chat room.</Text>
                        </View>
                    </View>
                </Modal>

                {/* â”€â”€ Map Overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {isMapOverlayOpen && (
                    <View style={StyleSheet.absoluteFill}>
                        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                        <MapView
                            ref={mapRef}
                            style={StyleSheet.absoluteFill}
                            userInterfaceStyle="dark"
                            customMapStyle={TACTICAL_MAP_STYLE}
                            pitchEnabled={true}
                            showsUserLocation={true}
                            showsMyLocationButton={false}
                            initialRegion={{
                                latitude: 23.8293,
                                longitude: 90.4182,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            }}
                        >
                            {/* Completed route (green) */}
                            {completedRouteCoords.length > 1 && (
                                <Polyline
                                    coordinates={completedRouteCoords}
                                    strokeColor="#3B82F6"
                                    strokeWidth={5}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            )}
                            {/* Remaining route (violet) */}
                            {remainingRouteCoords.length > 1 && (
                                <Polyline
                                    coordinates={remainingRouteCoords}
                                    strokeColor={T.violet}
                                    strokeWidth={4}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            )}
                            {/* Fallback: full route if no progress split yet */}
                            {completedRouteCoords.length === 0 && mapRouteCoords.length > 1 && (
                                <Polyline
                                    coordinates={mapRouteCoords}
                                    strokeColor={T.violet}
                                    strokeWidth={4}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            )}
                            {mapRouteCoords.length > 0 && (
                                <>
                                    {/* Volunteer Marker (origin) */}
                                    <Marker
                                        coordinate={isLiveNavMode && userLoc ? { latitude: userLoc.latitude, longitude: userLoc.longitude } : mapRouteCoords[0]}
                                        anchor={{ x: 0.5, y: 0.5 }}
                                        zIndex={1000}
                                    >
                                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: T.violet, borderWidth: 2, borderColor: '#fff' }} />
                                    </Marker>
                                    {/* Victim Marker (destination) */}
                                    <Marker
                                        coordinate={mapRouteCoords[mapRouteCoords.length - 1]}
                                        anchor={{ x: 0.5, y: 0.5 }}
                                        zIndex={999}
                                    >
                                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: T.danger, borderWidth: 2, borderColor: '#fff' }} />
                                    </Marker>
                                </>
                            )}
                        </MapView>

                        {/* Top Header â€” Live mode shows current instruction */}
                        {isLiveNavMode && navInstructions.length > 0 && currentStepIdx < navInstructions.length && (
                            <PremiumBar
                                style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 100, borderRadius: 16 }}
                                contentStyle={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}
                            >
                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(138,56,246,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                    <Ionicons
                                        name={getManeuverIcon(navInstructions[currentStepIdx]?.maneuver) as any}
                                        size={24}
                                        color={T.violet}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: T.violet, fontSize: 14, fontWeight: '800', marginBottom: 2 }}>
                                        {navInstructions[currentStepIdx].distance}
                                    </Text>
                                    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }} numberOfLines={2}>
                                        {navInstructions[currentStepIdx].instruction}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                                    onPress={() => {
                                        setAudioEnabled(prev => {
                                            if (prev) Speech.stop();
                                            return !prev;
                                        });
                                    }}
                                    activeOpacity={0.7}
                                    accessibilityLabel="Toggle audio guidance"
                                >
                                    <Ionicons name={audioEnabled ? "volume-high" : "volume-mute"} size={20} color={audioEnabled ? T.violet : T.ink4} />
                                </TouchableOpacity>
                            </PremiumBar>
                        )}

                        {/* Standard header for non-live mode */}
                        {!isLiveNavMode && (
                            <View style={[st.overlayHeader, { top: insets.top + 8 }]}>
                                <TouchableOpacity
                                    style={st.headerBtn}
                                    onPress={() => { setIsMapOverlayOpen(false); setIsLiveNavMode(false); setIsReviewMode(false); }}
                                >
                                    <Feather name="x" size={22} color={T.ink} />
                                </TouchableOpacity>
                                <View style={st.overlayTitleWrap}>
                                    <Text style={st.overlayTitle}>
                                        {isReviewMode ? 'Route Review' : 'Route Overview'}
                                    </Text>
                                </View>
                                <View style={{ width: 36 }} />
                            </View>
                        )}

                        {/* Bottom Card */}
                        <View style={[st.overlayBottomCard, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
                            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={st.overlayCardTint} pointerEvents="none" />

                            {/* Responder avatars (for MY_EMERGENCY) */}
                            {isMyEmergency && !isLiveNavMode && !isReviewMode && (
                                <View style={st.responderRow}>
                                    {respondersList.map(responder => {
                                        const isSelected = responder.id === selectedResponderId;
                                        return (
                                            <TouchableOpacity
                                                key={responder.id}
                                                style={st.responderAvatarWrap}
                                                onPress={() => handleSelectResponder(responder.id)}
                                                activeOpacity={0.75}
                                            >
                                                <View style={[st.responderAvatarRing, isSelected && st.responderAvatarRingActive]}>
                                                    <UserAvatar uri={responder.avatarUri} size={32} style={st.responderAvatar} />
                                                </View>
                                                <Text style={[st.responderAvatarName, isSelected && st.responderAvatarNameActive]} numberOfLines={1}>
                                                    {responder.name.split(' ')[0]}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            {/* â”€â”€ LIVE MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                            {isLiveNavMode ? (
                                <View>
                                    {navInstructions.length > 0 && currentStepIdx < navInstructions.length && (
                                        <View style={st.navInstRow}>
                                            <View style={st.navInstIconWrap}>
                                                <Feather name="arrow-up" size={28} color={T.violet} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={st.navInstPrimary}>{navInstructions[currentStepIdx].instruction}</Text>
                                                <Text style={st.navInstSecondary}>{navInstructions[currentStepIdx].distance}</Text>
                                            </View>
                                        </View>
                                    )}
                                    <View style={st.liveBottomRow}>
                                        <Text style={st.liveStepCounter}>Step {currentStepIdx + 1} of {navInstructions.length}</Text>
                                        <TouchableOpacity
                                            style={st.exitNavBtn}
                                            onPress={() => {
                                                Haptics.selectionAsync();
                                                setIsLiveNavMode(false);
                                                mapRef.current?.animateCamera({ pitch: 0, heading: 0, zoom: 14 });
                                                mapRef.current?.fitToCoordinates(mapRouteCoords, {
                                                    edgePadding: { top: 140, right: 60, bottom: 280, left: 60 },
                                                    animated: true,
                                                });
                                            }}
                                        >
                                            <Text style={st.exitNavBtnText}>Exit Live Mode</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                /* â”€â”€ REVIEW MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
                            ) : isReviewMode ? (
                                <View>
                                    <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                                        {navInstructions.map((step, idx) => (
                                            <View key={idx} style={[st.reviewStepRow, idx === 0 && { borderTopWidth: 0 }]}>
                                                <View style={st.reviewStepNum}>
                                                    <Text style={st.reviewStepNumText}>{idx + 1}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={st.reviewStepInst}>{step.instruction}</Text>
                                                    <Text style={st.reviewStepDist}>{step.distance}</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </ScrollView>
                                    <TouchableOpacity
                                        style={st.exitNavBtn}
                                        onPress={() => { setIsReviewMode(false); }}
                                    >
                                        <Text style={st.exitNavBtnText}>Back to Overview</Text>
                                    </TouchableOpacity>
                                </View>

                                /* â”€â”€ ROUTE OVERVIEW (default) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
                            ) : (
                                <View>
                                    {/* Travel Mode Selector */}
                                    <View style={st.travelModeRow}>
                                        {(['walking', 'driving', 'motorcycle', 'transit'] as const).map((mode) => (
                                            <TouchableOpacity
                                                key={mode}
                                                style={[st.travelModeBtn, travelMode === mode && st.travelModeBtnActive]}
                                                onPress={() => {
                                                    setTravelMode(mode);
                                                    // Reload route with new mode

                                                }}
                                            >
                                                <Ionicons
                                                    name={mode === 'driving' ? 'car' : mode === 'walking' ? 'walk' : mode === 'motorcycle' ? 'bicycle' : 'bus'}
                                                    size={16}
                                                    color={travelMode === mode ? T.onPrimary : T.ink3}
                                                />
                                                <Text style={[st.travelModeText, travelMode === mode && st.travelModeTextActive]}>
                                                    {mode === 'motorcycle' ? 'Bike' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View style={st.overviewRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={st.overviewDist}>{mapDistance}</Text>
                                            <Text style={st.overviewEta}>{mapDuration}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {/* Review button */}
                                            <TouchableOpacity
                                                style={st.reviewBtn}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    setIsReviewMode(true);
                                                }}
                                            >
                                                <Feather name="list" size={16} color={T.violet} />
                                                <Text style={st.reviewBtnText}>Review</Text>
                                            </TouchableOpacity>
                                            {/* Live Mode button */}
                                            <TouchableOpacity
                                                style={st.startNavBtn}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    setIsLiveNavMode(true);
                                                    if (mapRouteCoords.length > 0) {
                                                        mapRef.current?.animateCamera({
                                                            center: mapRouteCoords[0],
                                                            pitch: 60,
                                                            heading: 145,
                                                            zoom: 18,
                                                        }, { duration: 1000 });
                                                    }
                                                }}
                                            >
                                                <Ionicons name="navigate" size={16} color={T.onPrimary} />
                                                <Text style={st.startNavBtnText}>Live Mode</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </View>
        </AtmosphericShell>
    );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const st = StyleSheet.create({
    root: { flex: 1 },

    headerOuter: {
        paddingHorizontal: S.s3,
        paddingTop: S.s2,
        paddingBottom: S.s2,
        marginBottom: 12,
    },
    headerBlur: {
        borderRadius: R.pill,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        backgroundColor: T.surfaceBulky,
    },
    headerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: S.s3,
        paddingVertical: 8,
        minHeight: 58,
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: R.hBtn,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveMapCircularBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    liveMapCircularBg: {
        backgroundColor: '#1E153A',
        opacity: 0.60,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitleBlock: {
        justifyContent: 'center',
        marginLeft: 8,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerMenuBtn: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    headerMenuBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    headerMenuPanel: {
        position: 'absolute',
        top: 60,
        right: 20,
        backgroundColor: '#1E153A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        minWidth: 220,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: { elevation: 5 },
        }),
    },
    headerMenuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    headerMenuText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    headerMenuTextDanger: {
        color: '#FF453A',
        fontWeight: 'bold',
    },
    headerMenuDivider: {
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 16,
    },

    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 2,
    },
    headerStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
    },
    headerStatusPillLive: {
        backgroundColor: T.violetDim,
        borderColor: `${T.violet}55`,
    },
    headerStatusPillArchived: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.12)',
    },
    headerStatusTextLive: {
        fontSize: 10,
        fontWeight: '700',
        color: T.violet,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    headerStatusTextArchived: {
        fontSize: 10,
        fontWeight: '700',
        color: T.ink4,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    // Category context pills
    headerCategoryPillAssisting: {
        backgroundColor: T.violetDim,
        borderColor: `${T.violet}40`,
    },
    headerCategoryPillEmergency: {
        backgroundColor: T.dangerLight,
        borderColor: T.dangerBorder,
    },
    headerCategoryTextAssisting: {
        fontSize: 10,
        fontWeight: '700',
        color: T.violet,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    headerCategoryTextEmergency: {
        fontSize: 10,
        fontWeight: '700',
        color: T.danger,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },

    chatArea: { flex: 1 },
    messageList: {
        paddingHorizontal: S.s4,
        paddingTop: S.s3,
        paddingBottom: S.s2,
    },

    bubbleRow: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: S.s2,
    },
    bubbleRowOwn: {
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
    },
    bubbleRowOther: {
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },

    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignSelf: 'flex-start',
        flexShrink: 0,
    },

    bubbleCol: {
        maxWidth: '75%',
    },

    senderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s1 + 2,
        marginBottom: S.s1,
        paddingHorizontal: S.s2,
    },
    senderName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#C4C1D4',
        marginBottom: 2,
    },

    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    roleBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

    bubble: {
        paddingVertical: S.s3,
        paddingHorizontal: S.s4,
    },
    bubbleOther: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    bubbleOtherBg: {
        backgroundColor: '#1E153A',
        opacity: 0.70,
    },
    bubbleOwn: {
        backgroundColor: T.violetDim,
        borderWidth: 1,
        borderColor: `${T.violet}35`,
    },
    bubbleVictim: {
    },

    msgText: {
        fontSize: 14,
        color: '#FFFFFF',
        lineHeight: 20,
    },
    msgTextOwn: {
        color: T.ink,
    },
    msgTextVictim: {
        color: '#FFFFFF',
    },
    msgTime: {
        fontSize: 10,
        color: T.ink5,
        marginTop: S.s1,
        paddingHorizontal: S.s2,
        alignSelf: 'flex-start',
    },
    msgTimeOwn: {
        alignSelf: 'flex-end',
        textAlign: 'right',
    },

    systemWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s2,
        marginVertical: S.s3,
    },
    systemLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: T.lineMid,
    },
    systemPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: S.s3,
        paddingVertical: S.s1,
    },
    systemText: {
        fontSize: 11,
        color: T.ink4,
        fontStyle: 'italic',
    },
    systemTextEvidence: {
        color: T.violet,
        fontWeight: '600',
        fontStyle: 'normal',
    },

    audioWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s2,
    },
    audioPlayBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: T.violet,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioWaveform: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 22,
    },
    waveBar: {
        width: 3,
        borderRadius: 1.5,
    },
    audioDur: {
        fontSize: 10,
        color: T.ink4,
        fontWeight: '600',
    },

    imageWrap: {
        width: '100%',
        height: 100,
        borderRadius: R.lg,
        backgroundColor: T.surfaceMid,
        alignItems: 'center',
        justifyContent: 'center',
        gap: S.s2,
    },
    imageLabel: {
        fontSize: 11,
        color: T.ink4,
        fontWeight: '500',
    },

    inputOuter: {
        width: '90%',
        alignSelf: 'center',
        paddingTop: S.s2,
    },
    inputPillContainer: {
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: -3 },
            },
            android: { elevation: 8 },
        }),
    },
    inputPillBg: {
        backgroundColor: '#1E153A',
        opacity: 0.45,
    },
    inputPill: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12,
    },
    inputAction: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        minHeight: 36,
        fontSize: 15,
        lineHeight: 20,
        color: '#FFFFFF',
        maxHeight: 100,
        paddingTop: 0,
        paddingBottom: 0,
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#8A38F6',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#8A38F6',
                shadowOpacity: 0.8,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 0 },
            },
            android: { elevation: 8 },
        }),
    },
    sendBtnOff: {
        opacity: 0.5,
    },

    attachMenuOuter: {
        position: 'absolute',
        bottom: 70,
        left: 20,
        backgroundColor: '#1E153A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingTop: 8,
        paddingHorizontal: 8,
        minWidth: 180,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: { elevation: 5 },
        }),
        zIndex: 10,
    },
    attachModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    attachMenuOuterModal: {
        position: 'absolute',
        bottom: 70,
        left: 20,
        backgroundColor: '#1E153A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingTop: 8,
        paddingHorizontal: 8,
        minWidth: 180,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: { elevation: 5 },
        }),
        zIndex: 10,
    },
    attachOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 10,
    },
    attachOptionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    attachOptionDivider: {
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 8,
    },

    archiveOuter: {
        paddingHorizontal: S.s4,
        paddingTop: S.s2,
        alignItems: 'center',
    },
    archiveBlur: {
        borderRadius: R.pill,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        backgroundColor: T.surfaceBulky,
    },
    archiveInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.s2,
        paddingHorizontal: S.s5,
        paddingVertical: S.s3,
    },
    archiveText: {
        fontSize: 13,
        fontWeight: '600',
        color: T.ink4,
        letterSpacing: 0.2,
    },

    emptyChat: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: S.s8,
        gap: S.s2,
    },
    emptyChatCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: T.surfaceBulky,
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: S.s1,
    },
    emptyChatText: {
        ...Ty.bodySm,
        color: T.ink4,
    },
    overlayHeader: {
        position: 'absolute',
        left: S.s3,
        right: S.s3,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    overlayTitleWrap: {
        backgroundColor: 'rgba(30, 21, 58, 0.85)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    overlayTitle: {
        color: T.ink,
        fontSize: 13,
        fontWeight: '700',
    },
    overlayBottomCard: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(10, 5, 20, 0.5)',
        paddingTop: 20,
        paddingHorizontal: S.s4,
        zIndex: 10,
    },
    overlayCardTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: `${T.violet}08`,
    },
    responderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 14,
        marginBottom: 16,
    },
    responderAvatarWrap: {
        flex: 1,
        alignItems: 'center',
    },
    responderAvatarRing: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    responderAvatarRingActive: {
        borderColor: T.violet,
        backgroundColor: 'rgba(138,56,246,0.18)',
    },
    responderAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    responderAvatarName: {
        marginTop: 8,
        color: T.ink3,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    responderAvatarNameActive: {
        color: T.violet,
    },
    responderSimpleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    responderSimpleLabel: { color: T.ink4, marginRight: 6, fontWeight: '700' },
    responderSimpleList: { flexDirection: 'row', gap: 8 },
    responderSimpleName: { color: T.onPrimary, backgroundColor: T.violetDim, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, fontSize: 12, marginRight: 6 },
    overviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    overviewDist: {
        color: T.violet,
        fontSize: 24,
        fontWeight: '900',
    },
    overviewEta: {
        color: T.ink3,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 2,
    },
    startNavBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.violet,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 999,
        gap: 8,
    },
    startNavBtnText: {
        color: T.onPrimary,
        fontSize: 15,
        fontWeight: '700',
    },
    navInstRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    navInstIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(138,56,246,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(138,56,246,0.3)',
    },
    navInstPrimary: {
        color: T.ink,
        fontSize: 16,
        fontWeight: '800',
    },
    navInstSecondary: {
        color: T.ink3,
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
    },
    exitNavBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    exitNavBtnText: {
        color: T.ink2,
        fontSize: 13,
        fontWeight: '700',
    },
    sosMarkerInnerA: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2.5,
        borderColor: T.violet,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    sosMarkerInnerB: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2.5,
        borderColor: T.danger,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 6 },
        }),
    },
    sosMarkerAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        overflow: 'hidden',
    },
    caseModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    caseModalSheet: {
        backgroundColor: '#1E153A',
        borderRadius: 12,
        padding: 16,
        maxHeight: '80%'
    },
    caseModalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 6 },
    caseModalHint: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12 },
    caseModalInput: {
        minHeight: 100,
        maxHeight: 300,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 12,
        color: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.02)',
        marginBottom: 12,
        textAlignVertical: 'top'
    },
    caseModalInputCompact: {
        minHeight: 48,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        padding: 12,
        color: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.02)',
        marginBottom: 12,
    },
    caseModalError: {
        color: '#FCA5A5',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 12,
    },
    caseModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    caseModalCancel: { paddingHorizontal: 14, paddingVertical: 10 },
    caseModalCancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
    caseModalSave: { backgroundColor: T.violet, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    caseModalSaveText: { color: T.onPrimary, fontWeight: '800' },
    saveBackdropCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    saveCardColored: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#1E153A',
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 18,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 6 },
        }),
    },
    saveTitleColored: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
    saveMessageColored: { color: 'rgba(255,255,255,0.72)', fontSize: 14, marginBottom: 4 },
    leaveBackdropCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    leaveCard: { width: '100%', maxWidth: 420, backgroundColor: '#1E153A', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    leaveTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 8 },
    leaveMessage: { color: 'rgba(255,255,255,0.72)', fontSize: 14, marginBottom: 16 },
    leaveActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    leaveCancel: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: 'transparent' },
    leaveCancelText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
    leaveYes: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: T.danger },
    leaveYesText: { color: T.onPrimary, fontWeight: '900' },

    // â”€â”€ Live Mode Top Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    liveTopBanner: {
        position: 'absolute', left: 0, right: 0, zIndex: 10,
    },
    liveTopBannerGrad: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14,
        borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    },
    liveTopIconWrap: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    liveTopDist: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', opacity: 0.85 },
    liveTopInst: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
    liveBottomRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14,
    },
    liveStepCounter: { color: T.ink3, fontSize: 13, fontWeight: '600' },

    // â”€â”€ Travel Mode Selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    travelModeRow: {
        flexDirection: 'row', gap: 6, marginBottom: 14,
    },
    travelModeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingVertical: 8, borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    travelModeBtnActive: {
        backgroundColor: T.violet, borderColor: T.violet,
    },
    travelModeText: { color: T.ink3, fontSize: 11, fontWeight: '700' },
    travelModeTextActive: { color: T.onPrimary },

    // â”€â”€ Review Mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    reviewBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999,
        backgroundColor: 'rgba(138,56,246,0.15)',
        borderWidth: 1, borderColor: 'rgba(138,56,246,0.3)',
    },
    reviewBtnText: { color: T.violet, fontSize: 14, fontWeight: '700' },
    reviewStepRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    },
    reviewStepNum: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(138,56,246,0.2)',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    reviewStepNumText: { color: T.violet, fontSize: 12, fontWeight: '800' },
    reviewStepInst: { color: T.ink, fontSize: 14, fontWeight: '700' },
    reviewStepDist: { color: T.ink3, fontSize: 12, fontWeight: '500', marginTop: 2 },
});
