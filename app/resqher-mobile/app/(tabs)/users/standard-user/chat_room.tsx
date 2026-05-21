/**
 * chat_room.tsx â€” Tactical Group Chat (Standard User)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Integrated: Standard User UI/Socket + Volunteer Attach Modal & 3-Dot Menu.
 * Removed: Mark as Resolved and Close Incident functionalities.
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
    Platform, StatusBar, KeyboardAvoidingView, Keyboard,
    Modal, Pressable, Alert, ScrollView
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import RespondersList from '../../../../src/components/RespondersList';
import UserAvatar from '../../../../src/components/shared/UserAvatar';
import { T, R, S, Ty } from '../../../../src/constants/theme';
import { type Incident, type Message, type Role } from '../../../../src/types/chat';
import { useChatSocket } from '../../../../src/hooks/useChatSocket';
import { incidentService } from '../../../../src/services/incidentService';
import { incidentHistory } from '../../../../src/services/incidentHistory';
import { useAuth } from '../../../../src/context/AuthContext';

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

type Responder = {
    id: string;
    name: string;
    avatarUri: string | null;
    location?: { latitude: number; longitude: number };
    fallbackDistance?: string;
    fallbackDuration?: string;
};

type RoutePoint = { latitude: number; longitude: number; heading?: number };
type TravelMode = 'walking' | 'driving' | 'motorcycle' | 'transit';
type NavStep = {
    instruction: string;
    distance: string;
    maneuver?: string;
    endLocation?: { latitude: number; longitude: number };
};

type UserCaseDetailsForm = {
    notes: string;
    condition: string;
    additionalInfo: string;
};

// â”€â”€â”€ Mock Incidents (lookup) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MOCK_INCIDENTS: Record<string, Incident> = {
    'inc-001': {
        id: 'inc-001', type: 'SOS Alert', status: 'LIVE',
        location: { latitude: 23.7956, longitude: 90.3657, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'I need help', sender: { id: 'u1', name: 'Fatima Rahman', role: 'USER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 3, createdAt: new Date(Date.now() - 300000).toISOString(),
    },
    'inc-002': {
        id: 'inc-002', type: 'Medical Emergency', status: 'RESOLVED',
        location: { latitude: 23.7461, longitude: 90.3742, updatedAt: new Date().toISOString() },
        latestMessage: {
            content: 'Patient stabilized. Ambulance arrived.', sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
            timestamp: new Date().toISOString(), type: 'TEXT',
        },
        participantCount: 2, createdAt: new Date(Date.now() - 600000).toISOString(),
    },
};

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

// â”€â”€â”€ Tactical Map Style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
}

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

function sanitizeCoordinate(lat: number, lng: number): RoutePoint | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { latitude: lat, longitude: lng };
}

function routeModeForApi(mode: TravelMode): string {
    return mode === 'motorcycle' ? 'two_wheeler' : mode;
}

function routeModeLabel(mode: TravelMode): string {
    if (mode === 'motorcycle') return 'bike';
    if (mode === 'driving') return 'drive';
    if (mode === 'transit') return 'transit';
    return 'walk';
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// â”€â”€â”€ Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PremiumBar = memo(function PremiumBar({ style, contentStyle, children }: { style?: any; contentStyle?: any; children: React.ReactNode }) {
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
                <Text style={[st.systemText, isEvidence && st.systemTextEvidence]}>{msg.content}</Text>
            </View>
            <View style={st.systemLine} />
        </View>
    );
});

const PillBubble = memo(function PillBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
    if (msg.type === 'SYSTEM') return <SystemBubble msg={msg} />;

    const role = msg.sender.role;
    const alignRight = isOwn;

    const tailStyle = alignRight
        ? { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 2, borderBottomLeftRadius: 16 }
        : { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 2 };

    return (
        <View style={[st.bubbleRow, alignRight ? st.bubbleRowOwn : st.bubbleRowOther]}>
            {!alignRight && (
                <UserAvatar uri={msg.sender.avatarUrl ?? null} size={32} style={st.avatar} />
            )}
            <View style={st.bubbleCol}>
                {!alignRight && (
                    <View style={st.senderRow}>
                        <Text style={st.senderName}>{msg.sender.name}</Text>
                        <RoleBadge role={role} />
                    </View>
                )}
                <View style={[st.bubble, alignRight ? st.bubbleOwn : st.bubbleOther, tailStyle]}>
                    {!alignRight && <View style={[StyleSheet.absoluteFill, st.bubbleOtherBg, tailStyle]} />}
                    {msg.type === 'AUDIO' ? (
                        <View style={st.audioWrap}>
                            <TouchableOpacity style={st.audioPlayBtn}>
                                <Feather name="play" size={13} color={T.onPrimary} />
                            </TouchableOpacity>
                            <View style={st.audioWaveform}>
                                {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.3, 0.65, 0.5, 0.85, 0.4, 0.55, 0.7, 0.3].map((h, i) => (
                                    <View key={i} style={[st.waveBar, { height: h * 18, backgroundColor: alignRight ? 'rgba(255,255,255,0.5)' : T.ink4 }]} />
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
                        <Text style={[st.msgText, alignRight && st.msgTextOwn]}>{msg.content}</Text>
                    )}
                </View>
                <Text style={[st.msgTime, alignRight && st.msgTimeOwn]}>{formatTime(msg.timestamp)}</Text>
            </View>
        </View>
    );
});

// â”€â”€â”€ Floating Input (Modal-based Attach Menu equivalent to Volunteer UI) â”€â”€â”€
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
                                            onImagePicked(res.assets[0].uri);
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
                    <TouchableOpacity style={st.inputAction} onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(!isAttachMenuVisible); }} activeOpacity={0.7}>
                        <Feather name="paperclip" size={20} color={isAttachMenuVisible ? T.violet : "#FFFFFF"} />
                    </TouchableOpacity>
                    <TextInput ref={inputRef} style={st.input} placeholder="Type a messageâ€¦" placeholderTextColor="rgba(255, 255, 255, 0.5)" value={text} onChangeText={setText} multiline maxLength={2000} onFocus={() => setAttachMenuVisible(false)} />
                    <TouchableOpacity style={[st.sendBtn, !hasText && st.sendBtnOff]} onPress={handleSend} disabled={!hasText} activeOpacity={0.7}>
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

function ArchivePill({ bottomInset, onDelete, message }: { bottomInset: number; onDelete: () => void; message: string }) {
    return (
        <View style={[st.archiveOuter, { paddingBottom: Math.max(bottomInset, S.s4) }]}>
            <BlurView intensity={30} tint="dark" style={st.archiveBlur}>
                <View style={st.archiveInner}>
                    <Feather name="lock" size={13} color={T.ink4} />
                    <Text style={st.archiveText}>{message}</Text>
                </View>
            </BlurView>
            <TouchableOpacity style={st.archiveDeleteBtn} onPress={onDelete} activeOpacity={0.75}>
                <Feather name="trash-2" size={14} color="#FF453A" />
                <Text style={st.archiveDeleteText}>Delete Incident</Text>
            </TouchableOpacity>
        </View>
    );
}

// â”€â”€â”€ Main â€” Chat Room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function ChatRoom() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { userId } = useAuth();
    const { incidentId: rawIncidentId } = useLocalSearchParams<{ incidentId: string }>();

    const incidentId = rawIncidentId || 'inc-001';

    // Socket
    const { messages, sendMessage, isConnected } = useChatSocket(incidentId, userId ?? undefined, 'USER');
    const [localMessages, setLocalMessages] = useState<Message[]>([]);
    const [incident, setIncident] = useState<Incident | null>(null);
    const flatRef = useRef<FlatList>(null);
    const incidentStatus = String(incident?.status ?? 'ACTIVE').toUpperCase();
    const isLive = incidentStatus === 'LIVE' || incidentStatus === 'ACTIVE';
    const isReadOnly = incidentStatus === 'RESOLVED' || incidentStatus === 'CANCELLED';

    // Map & Navigation States
    const [isMapOverlayOpen, setIsMapOverlayOpen] = useState(false);
    const [mapRouteCoords, setMapRouteCoords] = useState<RoutePoint[]>([]);
    const [mapDistance, setMapDistance] = useState('');
    const [mapDuration, setMapDuration] = useState('');
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeError, setRouteError] = useState<string | null>(null);
    const [isLiveNavMode, setIsLiveNavMode] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [userLoc, setUserLoc] = useState<RoutePoint | null>(null);
    const [victimName, setVictimName] = useState('Victim');
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [selectedResponderId, setSelectedResponderId] = useState('');
    const mapRef = useRef<MapView>(null);
    const routeRequestIdRef = useRef(0);
    const routePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastRouteRefreshRef = useRef(0);
    const [travelMode, setTravelMode] = useState<TravelMode>('walking');
    const [navInstructions, setNavInstructions] = useState<NavStep[]>([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [completedRouteCoords, setCompletedRouteCoords] = useState<RoutePoint[]>([]);
    const [remainingRouteCoords, setRemainingRouteCoords] = useState<RoutePoint[]>([]);

    // Menu / Modals
    const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);
    const [isRespondersOpen, setRespondersOpen] = useState(false);
    const [isResponderRemovedOpen] = useState(false);
    const [respondersList, setRespondersList] = useState<Responder[]>([]);
    const [sosUser, setSosUser] = useState<{ id: string; name: string; photoUri?: string | null } | null>(null);
    const [maxResponders, setMaxResponders] = useState(3);
    const [isEditCaseOpen, setEditCaseOpen] = useState(false);
    const [caseDetails, setCaseDetails] = useState<UserCaseDetailsForm>({ notes: '', condition: '', additionalInfo: '' });
    const [caseError, setCaseError] = useState<string | null>(null);
    const [savingCaseDetails, setSavingCaseDetails] = useState(false);
    const [isSaveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
    const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

    const isRealIncident = !!incidentId && !incidentId.startsWith('temp-') && incidentId !== 'sos-new';

    useEffect(() => {
        incidentService.getOne(incidentId)
            .then((raw) => {
                const status = raw.status === 'ACTIVE' || raw.status === 'IN_PROGRESS' ? 'ACTIVE' : raw.status;
                setIncident({
                    id: String(raw.id),
                    type: 'SOS Alert',
                    status: status as any,
                    location: { latitude: Number(raw.latitude), longitude: Number(raw.longitude), updatedAt: raw.updated_at ?? raw.created_at },
                    participantCount: 1,
                    createdAt: raw.created_at ?? raw.createdAt,
                });
            })
            .catch(() => setIncident(MOCK_INCIDENTS[incidentId] ?? MOCK_INCIDENTS['inc-001']));
    }, [incidentId]);

    useEffect(() => {
        if (!isRealIncident) return;
        let mounted = true;
        const loadMembers = async () => {
            const response = await incidentService.getIncidentResponders(incidentId);
            if (!mounted) return;
            const volunteers = (response.volunteers ?? []).map((volunteer) => ({
                id: volunteer.id,
                name: volunteer.name,
                avatarUri: volunteer.photoUri ?? null,
            }));
            setRespondersList(prev => volunteers.map(volunteer => ({
                ...volunteer,
                location: prev.find(existing => existing.id === volunteer.id)?.location,
            })));
            setSosUser(response.sosUser ? {
                id: response.sosUser.id,
                name: response.sosUser.name,
                photoUri: response.sosUser.photoUri ?? null,
            } : null);
            setMaxResponders(response.maxVolunteerResponders ?? 3);
            setSelectedResponderId((prev) => prev || volunteers[0]?.id || '');
        };

        loadMembers().catch(error => console.warn('[StandardChatRoom] responders unavailable:', error?.message || error));
        const interval = setInterval(() => {
            loadMembers().catch(() => undefined);
        }, 7000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [incidentId, isRealIncident]);

    useEffect(() => {
        if (!isRealIncident) return;
        let mounted = true;
        incidentService.getUserCaseDetails(incidentId)
            .then((details) => {
                if (!mounted) return;
                setCaseDetails({
                    notes: details.notes ?? '',
                    condition: details.condition ?? '',
                    additionalInfo: details.additionalInfo ?? '',
                });
            })
            .catch(error => console.warn('[StandardChatRoom] case details unavailable:', error?.message || error));
        return () => { mounted = false; };
    }, [incidentId, isRealIncident]);

    const activeMessages = isRealIncident ? messages : localMessages;

    useEffect(() => {
        if (activeMessages.length > 0) setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
    }, [activeMessages.length]);

    // â”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleSend = useCallback((text: string) => {
        if (isReadOnly) return;
        if (isRealIncident) {
            sendMessage(text, 'TEXT');
        } else {
            const newMsg: Message = { id: `m-${Date.now()}`, incidentId, sender: { id: userId ?? 'self', name: 'You', role: 'USER' }, content: text, type: 'TEXT', timestamp: new Date().toISOString() };
            setLocalMessages(p => [...p, newMsg]);
        }
    }, [isReadOnly, isRealIncident, sendMessage, incidentId, userId]);

    const handleSendPhoto = useCallback((uri: string) => {
        if (isReadOnly) return;
        if (isRealIncident) {
            sendMessage(uri, 'IMAGE');
        } else {
            const newMsg: Message = { id: `m-img-${Date.now()}`, incidentId, sender: { id: userId ?? 'self', name: 'You', role: 'USER' }, content: 'Photo', type: 'IMAGE', timestamp: new Date().toISOString(), mediaUrl: uri };
            setLocalMessages(p => [...p, newMsg]);
        }
    }, [isReadOnly, isRealIncident, sendMessage, incidentId, userId]);

    const handleDeleteIncident = useCallback(() => {
        Alert.alert('Delete Incident', 'This will permanently remove this chat from your history.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await incidentHistory.remove(incidentId); router.back(); } },
        ]);
    }, [incidentId, router]);

    const handleConfirmLeave = useCallback(() => {
        Haptics.selectionAsync();
        setLeaveConfirmOpen(false);
        router.back();
    }, [router]);

    const handleSaveCaseDetails = useCallback(async () => {
        setSavingCaseDetails(true);
        setCaseError(null);
        try {
            const updated = await incidentService.updateUserCaseDetails(incidentId, caseDetails);
            setCaseDetails({
                notes: updated.notes ?? '',
                condition: updated.condition ?? '',
                additionalInfo: updated.additionalInfo ?? '',
            });
            setEditCaseOpen(false);
            setSaveConfirmationOpen(true);
            setTimeout(() => setSaveConfirmationOpen(false), 2200);
        } catch (error: any) {
            setCaseError(error?.message || 'Unable to save case details.');
        } finally {
            setSavingCaseDetails(false);
        }
    }, [caseDetails, incidentId]);

    // â”€â”€â”€ Tactical Map Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const selectedResponder = React.useMemo(
        () => respondersList.find(r => r.id === selectedResponderId) ?? respondersList[0] ?? null,
        [respondersList, selectedResponderId]
    );

    const clearRouteOverview = useCallback(() => {
        routeRequestIdRef.current += 1;
        locationSubRef.current?.remove();
        locationSubRef.current = null;
        if (routePollRef.current) {
            clearInterval(routePollRef.current);
            routePollRef.current = null;
        }
        setMapRouteCoords([]);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        setIsLiveNavMode(false);
        setIsReviewMode(false);
        setMapDistance('');
        setMapDuration('');
        setRouteLoading(false);
        setRouteError(null);
    }, []);

    const fitRouteToMap = useCallback((coords: RoutePoint[]) => {
        if (coords.length <= 1) return;
        setTimeout(() => {
            mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 140, right: 60, bottom: 300, left: 60 },
                animated: true,
            });
        }, 250);
    }, []);

    const loadRouteForResponder = useCallback(async (
        victimLocation: RoutePoint,
        responder: Responder,
        mode: TravelMode,
        options: { fit?: boolean } = {},
    ) => {
        const originLocation = sanitizeCoordinate(victimLocation.latitude, victimLocation.longitude);
        const responderLocation = responder.location
            ? sanitizeCoordinate(responder.location.latitude, responder.location.longitude)
            : null;
        if (!originLocation || !responderLocation) {
            setRouteLoading(false);
            setRouteError('Selected responder location is unavailable.');
            return;
        }

        const requestId = ++routeRequestIdRef.current;
        const fallbackRoute = [originLocation, responderLocation];
        const modeLabel = routeModeLabel(mode);
        setRouteLoading(true);
        setRouteError(null);

        const applyRoute = (coords: RoutePoint[], distance = '', duration = '', instructions: NavStep[] = []) => {
            if (routeRequestIdRef.current !== requestId) return;
            const visibleCoords = coords.length > 1 ? coords : fallbackRoute;
            setMapRouteCoords(visibleCoords);
            setCompletedRouteCoords([]);
            setRemainingRouteCoords(visibleCoords);
            setNavInstructions(instructions);
            setCurrentStepIdx(0);
            setMapDistance(distance);
            setMapDuration(duration);
            setRouteLoading(false);
            if (options.fit !== false) fitRouteToMap(visibleCoords);
        };

        if (!GOOGLE_MAPS_API_KEY) {
            applyRoute(fallbackRoute, '', `~${modeLabel}`);
            return;
        }

        try {
            const origin = `${originLocation.latitude},${originLocation.longitude}`;
            const destination = `${responderLocation.latitude},${responderLocation.longitude}`;
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${routeModeForApi(mode)}&key=${GOOGLE_MAPS_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            if (routeRequestIdRef.current !== requestId) return;

            if (data?.routes?.length > 0) {
                const route = data.routes[0];
                const coords = polylineDecode(route.overview_polyline?.points ?? '') as RoutePoint[];
                const leg = route.legs?.[0];
                const instructions: NavStep[] = (leg?.steps ?? []).map((step: any) => ({
                    instruction: stripHtml(step.html_instructions ?? ''),
                    distance: step.distance?.text ?? '',
                    maneuver: step.maneuver,
                    endLocation: step.end_location ? { latitude: step.end_location.lat, longitude: step.end_location.lng } : undefined,
                }));
                applyRoute(
                    coords.length > 1 ? coords : fallbackRoute,
                    leg?.distance?.text ?? '',
                    leg?.duration?.text ? `${leg.duration.text} ${modeLabel}` : modeLabel,
                    instructions,
                );
                return;
            }

            applyRoute(fallbackRoute, '', `~${modeLabel}`);
        } catch (error) {
            console.warn('[StandardChatRoom] route load failed, using fallback:', error);
            applyRoute(fallbackRoute, '', `~${modeLabel}`);
        }
    }, [fitRouteToMap]);

    const applyRouteContext = useCallback(async () => {
        const context = await incidentService.getIncidentRouteContext(incidentId);
        const contextVictim = sanitizeCoordinate(Number(context.victim.latitude), Number(context.victim.longitude));
        let nextVictim = contextVictim;

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                nextVictim = sanitizeCoordinate(position.coords.latitude, position.coords.longitude) ?? contextVictim;
            }
        } catch {
            // Latest backend/incident location remains the fallback.
        }

        const volunteers = (context.volunteers ?? [])
            .map((volunteer) => {
                const location = sanitizeCoordinate(Number(volunteer.latitude), Number(volunteer.longitude));
                if (!location) return null;
                return {
                    id: volunteer.id,
                    name: volunteer.name || 'Volunteer',
                    avatarUri: volunteer.photoUri ?? null,
                    location,
                } as Responder;
            })
            .filter(Boolean) as Responder[];

        if (context.victim?.name) setVictimName(context.victim.name);
        if (nextVictim) setUserLoc(nextVictim);
        setRespondersList(volunteers);
        setSelectedResponderId(prev => (volunteers.some(volunteer => volunteer.id === prev) ? prev : volunteers[0]?.id || ''));

        return {
            victim: nextVictim,
            volunteers,
            selected: volunteers.find(volunteer => volunteer.id === selectedResponderId) ?? volunteers[0] ?? null,
        };
    }, [incidentId, selectedResponderId]);

    const openMapOverlay = useCallback(async () => {
        Keyboard.dismiss();
        setIsMapOverlayOpen(true);
        setIsLiveNavMode(false);
        setIsReviewMode(false);
        setRouteError(null);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        Haptics.selectionAsync();
        try {
            const context = await applyRouteContext();
            if (!context?.victim) {
                setRouteError('Could not find your current SOS location.');
                return;
            }
            if (!context.selected) {
                setRouteError('No accepted volunteers with live location yet.');
                return;
            }
            await loadRouteForResponder(context.victim, context.selected, travelMode);
        } catch (error: any) {
            setRouteError(error?.message || 'Unable to load this route.');
        }
    }, [applyRouteContext, loadRouteForResponder, travelMode]);

    useEffect(() => {
        if (!isMapOverlayOpen || !userLoc || !selectedResponder || isLiveNavMode) return;
        Keyboard.dismiss();
        setMapRouteCoords([]);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        loadRouteForResponder(userLoc, selectedResponder, travelMode);
    }, [travelMode, selectedResponderId, isMapOverlayOpen, isLiveNavMode, userLoc, loadRouteForResponder]);

    useEffect(() => {
        if (!isMapOverlayOpen) return;
        if (routePollRef.current) clearInterval(routePollRef.current);
        routePollRef.current = setInterval(async () => {
            try {
                const context = await incidentService.getIncidentRouteContext(incidentId);
                const contextVictim = sanitizeCoordinate(Number(context.victim.latitude), Number(context.victim.longitude));
                const nextVolunteers = (context.volunteers ?? [])
                    .map((volunteer) => {
                        const location = sanitizeCoordinate(Number(volunteer.latitude), Number(volunteer.longitude));
                        if (!location) return null;
                        return {
                            id: volunteer.id,
                            name: volunteer.name || 'Volunteer',
                            avatarUri: volunteer.photoUri ?? null,
                            location,
                        } as Responder;
                    })
                    .filter(Boolean) as Responder[];

                if (context.victim?.name) setVictimName(context.victim.name);
                if (!isLiveNavMode && contextVictim) {
                    setUserLoc(prev => {
                        if (!prev) return contextVictim;
                        return haversineDistance(prev, contextVictim) >= 5 ? contextVictim : prev;
                    });
                }
                setRespondersList(nextVolunteers);
                setSelectedResponderId(prev => (nextVolunteers.some(volunteer => volunteer.id === prev) ? prev : nextVolunteers[0]?.id || ''));

                const nextSelected = nextVolunteers.find(volunteer => volunteer.id === selectedResponderId) ?? nextVolunteers[0] ?? null;
                const activeVictim = userLoc ?? contextVictim;
                if (!activeVictim || !nextSelected?.location || !selectedResponder?.location) return;

                const selectedMoved = haversineDistance(selectedResponder.location, nextSelected.location);
                const victimMoved = contextVictim && userLoc ? haversineDistance(userLoc, contextVictim) : 0;
                if ((selectedMoved >= 40 || victimMoved >= 40) && Date.now() - lastRouteRefreshRef.current > 15000) {
                    lastRouteRefreshRef.current = Date.now();
                    loadRouteForResponder(activeVictim, nextSelected, travelMode, { fit: !isLiveNavMode });
                }
            } catch {
                // Route context polling is best effort; chat remains usable.
            }
        }, 8000);

        return () => {
            if (routePollRef.current) {
                clearInterval(routePollRef.current);
                routePollRef.current = null;
            }
        };
    }, [incidentId, isLiveNavMode, isMapOverlayOpen, loadRouteForResponder, selectedResponder, selectedResponderId, travelMode, userLoc]);

    useEffect(() => {
        if (!isLiveNavMode) {
            if (locationSubRef.current) { locationSubRef.current.remove(); locationSubRef.current = null; }
            return;
        }
        let mounted = true;
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            locationSubRef.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
                (loc) => {
                    if (!mounted) return;
                    const nextVictim = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        heading: loc.coords.heading ?? undefined,
                    };
                    setUserLoc(prev => {
                        if (prev && selectedResponder?.location && haversineDistance(prev, nextVictim) >= 40 && Date.now() - lastRouteRefreshRef.current > 15000) {
                            lastRouteRefreshRef.current = Date.now();
                            loadRouteForResponder(nextVictim, selectedResponder, travelMode, { fit: false });
                        }
                        return nextVictim;
                    });
                }
            );
        })();
        return () => { mounted = false; if (locationSubRef.current) { locationSubRef.current.remove(); locationSubRef.current = null; } };
    }, [isLiveNavMode, loadRouteForResponder, selectedResponder, travelMode]);

    useEffect(() => {
        if (!isLiveNavMode || !selectedResponder?.location) return;
        const volunteerLocation = selectedResponder.location;
        mapRef.current?.animateCamera({ center: volunteerLocation, pitch: 45, heading: 0, zoom: 19 }, { duration: 1000 });

        if (navInstructions.length > 0 && currentStepIdx < navInstructions.length - 1) {
            const currentStep = navInstructions[currentStepIdx];
            if (currentStep.endLocation && haversineDistance(volunteerLocation, currentStep.endLocation) <= 25) {
                setCurrentStepIdx(prev => prev + 1);
            }
        }

        if (mapRouteCoords && mapRouteCoords.length > 0) {
            let closestIdx = 0, minD = Infinity;
            mapRouteCoords.forEach((pt, i) => { const d = haversineDistance(volunteerLocation, pt); if (d < minD) { minD = d; closestIdx = i; } });
            setCompletedRouteCoords(mapRouteCoords.slice(closestIdx));
            setRemainingRouteCoords(mapRouteCoords.slice(0, closestIdx + 1));
        }
    }, [isLiveNavMode, selectedResponder, currentStepIdx, navInstructions, mapRouteCoords]);

    useEffect(() => {
        if (isLiveNavMode && audioEnabled && navInstructions.length > 0 && currentStepIdx < navInstructions.length) {
            Speech.speak(navInstructions[currentStepIdx].instruction);
        }
    }, [isLiveNavMode, audioEnabled, currentStepIdx, navInstructions]);

    useEffect(() => {
        return () => {
            locationSubRef.current?.remove();
            locationSubRef.current = null;
            if (routePollRef.current) {
                clearInterval(routePollRef.current);
                routePollRef.current = null;
            }
        };
    }, []);

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* â”€â”€ Chat Header â”€â”€ */}
                <View style={st.headerOuter}>
                    <BlurView intensity={50} tint="dark" style={st.headerBlur}>
                        <View style={st.headerInner}>
                            <View style={st.headerLeft}>
                                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={st.headerBtn}>
                                    <Feather name="chevron-left" size={22} color={T.ink} />
                                </TouchableOpacity>
                                <View style={st.headerTitleBlock}>
                                    <Text style={st.headerTitle} numberOfLines={1}>ResQher Emergency Chat</Text>
                                    <View style={st.headerMeta}>
                                        <View style={[st.headerStatusPill, isLive ? st.headerStatusPillLive : st.headerStatusPillArchived]}>
                                            <Text style={isLive ? st.headerStatusTextLive : st.headerStatusTextArchived}>{isLive ? 'LIVE' : 'ARCHIVED'}</Text>
                                        </View>
                                        <View style={st.connPill}>
                                            <View style={[st.connDot, { backgroundColor: isConnected ? T.success : T.ink5 }]} />
                                            <Text style={st.connTxt}>{isConnected ? 'Connected' : 'Reconnectingâ€¦'}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            <View style={st.headerRight}>
                                <TouchableOpacity style={st.liveMapCircularBtn} activeOpacity={0.7} onPress={openMapOverlay}>
                                    <View style={[StyleSheet.absoluteFill, st.liveMapCircularBg]} />
                                    <Feather name="map" size={18} color="#FFFFFF" />
                                </TouchableOpacity>
                                <TouchableOpacity style={st.headerMenuBtn} activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(true); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                    <Feather name="more-vertical" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </BlurView>
                </View>

                {/* â”€â”€ Chat Content â”€â”€ */}
                <KeyboardAvoidingView style={st.chatArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}>
                    <FlatList
                        ref={flatRef}
                        data={activeMessages}
                        renderItem={({ item }) => <PillBubble msg={item} isOwn={item.sender.id === (userId ?? 'self')} />}
                        keyExtractor={item => item.id}
                        contentContainerStyle={st.messageList}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={Keyboard.dismiss}
                        ListEmptyComponent={
                            <View style={st.emptyChat}>
                                <View style={st.emptyChatCircle}><Feather name="message-circle" size={24} color={T.ink5} /></View>
                                <Text style={st.emptyChatText}>No messages yet</Text>
                            </View>
                        }
                    />
                    {!isReadOnly ? (
                        <FloatingInput onSend={handleSend} onImagePicked={handleSendPhoto} bottomInset={insets.bottom} />
                    ) : (
                        <ArchivePill
                            bottomInset={insets.bottom}
                            onDelete={handleDeleteIncident}
                            message={incidentStatus === 'CANCELLED' ? 'This SOS was cancelled. Chat is read-only.' : 'This SOS is resolved. Chat is read-only.'}
                        />
                    )}
                </KeyboardAvoidingView>

                {/* â”€â”€ Unified Header Menu Modal (3-Dot Functionality) â”€â”€ */}
                <Modal transparent={true} visible={isHeaderMenuOpen} animationType="fade">
                    <Pressable style={st.headerMenuBackdrop} onPress={() => setHeaderMenuOpen(false)}>
                        <View style={st.headerMenuPanel}>
                            {/* Volunteer Functionalities */}
                            <TouchableOpacity style={st.headerMenuRow} onPress={() => { setHeaderMenuOpen(false); setRespondersOpen(true); }}>
                                <Feather name="users" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>View Responders</Text>
                            </TouchableOpacity>
                            <View style={st.headerMenuDivider} />

                            <TouchableOpacity style={st.headerMenuRow} onPress={() => { setHeaderMenuOpen(false); setEditCaseOpen(true); }}>
                                <Feather name="edit-2" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>Edit Case Details</Text>
                            </TouchableOpacity>
                            <View style={st.headerMenuDivider} />

                            {/* Standard User Controls & Shared Log out */}
                            {isLive ? (
                                <TouchableOpacity style={st.headerMenuRow} onPress={() => { setHeaderMenuOpen(false); setLeaveConfirmOpen(true); }}>
                                    <Feather name="log-out" size={16} color={T.ink3} />
                                    <Text style={st.headerMenuText}>Leave Chat / Dispatch</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={st.headerMenuRow} onPress={() => { setHeaderMenuOpen(false); handleDeleteIncident(); }}>
                                    <Feather name="trash-2" size={16} color="#FF453A" />
                                    <Text style={[st.headerMenuText, st.headerMenuTextDanger]}>Delete Incident</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </Pressable>
                </Modal>

                {/* â”€â”€ Extra Modals (Edit Case, Confirmations) â”€â”€ */}
                <Modal transparent={true} visible={isEditCaseOpen} animationType="slide">
                    <Pressable style={st.caseModalBackdrop} onPress={() => setEditCaseOpen(false)}>
                        <View style={st.caseModalSheet}>
                            <Text style={st.caseModalTitle}>Edit Case Details</Text>
                            <Text style={st.caseModalHint}>Add your notes, condition, and additional context.</Text>
                            <TextInput style={st.caseModalInput} multiline value={caseDetails.notes} onChangeText={(notes) => setCaseDetails(prev => ({ ...prev, notes }))} placeholder="Notes..." placeholderTextColor="rgba(255,255,255,0.35)" />
                            <TextInput style={st.caseModalInputCompact} value={caseDetails.condition} onChangeText={(condition) => setCaseDetails(prev => ({ ...prev, condition }))} placeholder="Condition..." placeholderTextColor="rgba(255,255,255,0.35)" />
                            <TextInput style={st.caseModalInput} multiline value={caseDetails.additionalInfo} onChangeText={(additionalInfo) => setCaseDetails(prev => ({ ...prev, additionalInfo }))} placeholder="Additional info..." placeholderTextColor="rgba(255,255,255,0.35)" />
                            {caseError && <Text style={st.caseModalError}>{caseError}</Text>}
                            <View style={st.caseModalFooter}>
                                <TouchableOpacity style={st.caseModalCancel} onPress={() => setEditCaseOpen(false)}><Text style={st.caseModalCancelText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={[st.caseModalSave, savingCaseDetails && { opacity: 0.65 }]} onPress={handleSaveCaseDetails} disabled={savingCaseDetails}><Text style={st.caseModalSaveText}>{savingCaseDetails ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Modal>

                <Modal transparent={true} visible={isSaveConfirmationOpen} animationType="fade">
                    <View style={st.saveBackdropCentered}>
                        <View style={st.saveCardColored}>
                            <Text style={st.saveTitleColored}>Saved</Text>
                            <Text style={st.saveMessageColored}>Case details saved.</Text>
                        </View>
                    </View>
                </Modal>

                <Modal transparent={true} visible={isLeaveConfirmOpen} animationType="fade">
                    <View style={st.leaveBackdropCentered}>
                        <View style={st.leaveCard}>
                            <Text style={st.leaveTitle}>Are you sure?</Text>
                            <Text style={st.leaveMessage}>Do you want to leave this dispatch? You will no longer receive updates for this case.</Text>
                            <View style={st.leaveActions}>
                                <TouchableOpacity style={st.leaveCancel} onPress={() => setLeaveConfirmOpen(false)}><Text style={st.leaveCancelText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={st.leaveYes} onPress={handleConfirmLeave}><Text style={st.leaveYesText}>Yes</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <RespondersList
                    visible={isRespondersOpen}
                    onClose={() => setRespondersOpen(false)}
                    data={respondersList}
                    sosUser={sosUser ? {
                        id: sosUser.id,
                        name: sosUser.name,
                        avatarUri: sosUser.photoUri ?? null,
                        role: 'USER',
                    } : null}
                    responderCount={respondersList.length}
                    maxResponders={maxResponders}
                />

                <Modal transparent={true} visible={isResponderRemovedOpen} animationType="fade">
                    <View style={st.saveBackdropCentered}>
                        <View style={st.saveCardColored}>
                            <Text style={st.saveTitleColored}>Responder removed</Text>
                            <Text style={st.saveMessageColored}>The responder was removed from the chat room.</Text>
                        </View>
                    </View>
                </Modal>

                {/* â”€â”€ Tactical Map Overlay â”€â”€ */}
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
                            initialRegion={{ latitude: 23.8293, longitude: 90.4182, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                        >
                            {completedRouteCoords.length > 1 && (
                                <Polyline coordinates={completedRouteCoords} strokeColor="#3B82F6" strokeWidth={5} lineCap="round" lineJoin="round" zIndex={5200} />
                            )}
                            {remainingRouteCoords.length > 1 && (
                                <>
                                    <Polyline coordinates={remainingRouteCoords} strokeColor="rgba(138,56,246,0.28)" strokeWidth={10} lineCap="round" lineJoin="round" zIndex={5000} />
                                    <Polyline coordinates={remainingRouteCoords} strokeColor={T.violet} strokeWidth={4} lineCap="round" lineJoin="round" zIndex={5001} />
                                </>
                            )}
                            {completedRouteCoords.length === 0 && mapRouteCoords.length > 1 && (
                                <>
                                    <Polyline coordinates={mapRouteCoords} strokeColor="rgba(138,56,246,0.28)" strokeWidth={10} lineCap="round" lineJoin="round" zIndex={5000} />
                                    <Polyline coordinates={mapRouteCoords} strokeColor={T.violet} strokeWidth={4} lineCap="round" lineJoin="round" zIndex={5001} />
                                </>
                            )}
                            {mapRouteCoords.length > 1 && (
                                <>
                                    <Marker
                                        coordinate={isLiveNavMode && userLoc ? userLoc : mapRouteCoords[0]}
                                        pinColor="#EF4444"
                                        title={victimName || 'Victim'}
                                        description={incident?.address || 'SOS location'}
                                        zIndex={7000}
                                    />
                                    <Marker
                                        coordinate={isLiveNavMode && selectedResponder?.location ? selectedResponder.location : mapRouteCoords[mapRouteCoords.length - 1]}
                                        pinColor={T.violet}
                                        title={selectedResponder?.name || 'Volunteer'}
                                        description="Responder location"
                                        zIndex={7001}
                                    />
                                </>
                            )}
                        </MapView>

                        {/* Top Header - Live Navigation */}
                        {isLiveNavMode && navInstructions.length > 0 && currentStepIdx < navInstructions.length && (
                            <PremiumBar style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 100, borderRadius: 16 }} contentStyle={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(138,56,246,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                    <Ionicons name={getManeuverIcon(navInstructions[currentStepIdx]?.maneuver) as any} size={24} color={T.violet} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: T.violet, fontSize: 14, fontWeight: '800', marginBottom: 2 }}>{navInstructions[currentStepIdx].distance}</Text>
                                    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }} numberOfLines={2}>{navInstructions[currentStepIdx].instruction}</Text>
                                </View>
                                <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }} onPress={() => { setAudioEnabled(p => { if (p) Speech.stop(); return !p; }); }}>
                                    <Ionicons name={audioEnabled ? "volume-high" : "volume-mute"} size={20} color={audioEnabled ? T.violet : T.ink4} />
                                </TouchableOpacity>
                            </PremiumBar>
                        )}

                        {/* Top Header - Overview/Review */}
                        {!isLiveNavMode && (
                            <View style={[st.overlayHeader, { top: insets.top + 8 }]}>
                                <TouchableOpacity style={st.headerBtn} onPress={() => { Keyboard.dismiss(); setIsMapOverlayOpen(false); clearRouteOverview(); }}>
                                    <Feather name="x" size={22} color={T.ink} />
                                </TouchableOpacity>
                                <View style={st.overlayTitleWrap}>
                                    <Text style={st.overlayTitle}>{isReviewMode ? 'Route Review' : 'Route Overview'}</Text>
                                </View>
                                <View style={{ width: 36 }} />
                            </View>
                        )}

                        {/* Bottom Card */}
                        <View style={[st.overlayBottomCard, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
                            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={st.overlayCardTint} pointerEvents="none" />

                            {/* Responders List */}
                            {!isLiveNavMode && !isReviewMode && (
                                <View style={st.responderRow}>
                                    {respondersList.map(responder => {
                                        const isSelected = responder.id === selectedResponderId;
                                        return (
                                            <TouchableOpacity
                                                key={responder.id}
                                                style={st.responderAvatarWrap}
                                                onPress={() => { Keyboard.dismiss(); Haptics.selectionAsync(); setSelectedResponderId(responder.id); }}
                                                activeOpacity={0.75}
                                            >
                                                <View style={[st.responderAvatarRing, isSelected && st.responderAvatarRingActive]}>
                                                    <UserAvatar uri={responder.avatarUri} size={32} style={st.responderAvatar} />
                                                </View>
                                                <Text style={[st.responderAvatarName, isSelected && st.responderAvatarNameActive]} numberOfLines={1}>{responder.name.split(' ')[0]}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                            {!!routeError && !isReviewMode && (
                                <Text style={st.routeErrorText}>{routeError}</Text>
                            )}

                            {isLiveNavMode ? (
                                <View>
                                    {navInstructions.length > 0 && currentStepIdx < navInstructions.length && (
                                        <View style={st.navInstRow}>
                                            <View style={st.navInstIconWrap}><Feather name="arrow-up" size={28} color={T.violet} /></View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={st.navInstPrimary}>{navInstructions[currentStepIdx].instruction}</Text>
                                                <Text style={st.navInstSecondary}>{navInstructions[currentStepIdx].distance}</Text>
                                            </View>
                                        </View>
                                    )}
                                    <View style={st.liveBottomRow}>
                                        <Text style={st.liveStepCounter}>
                                            {navInstructions.length > 0 ? `Step ${currentStepIdx + 1} of ${navInstructions.length}` : 'Live route tracking'}
                                        </Text>
                                        <TouchableOpacity style={st.exitNavBtn} onPress={() => { setIsLiveNavMode(false); mapRef.current?.animateCamera({ pitch: 0, heading: 0, zoom: 14 }); mapRef.current?.fitToCoordinates(mapRouteCoords, { edgePadding: { top: 140, right: 60, bottom: 280, left: 60 }, animated: true }); }}>
                                            <Text style={st.exitNavBtnText}>Exit Live Mode</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : isReviewMode ? (
                                <View>
                                    <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                                        {navInstructions.length === 0 ? (
                                            <Text style={st.reviewEmptyText}>No turn-by-turn steps available for this route.</Text>
                                        ) : (
                                            navInstructions.map((step, idx) => (
                                                <View key={idx} style={[st.reviewStepRow, idx === 0 && { borderTopWidth: 0 }]}>
                                                    <View style={st.reviewStepNum}><Text style={st.reviewStepNumText}>{idx + 1}</Text></View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={st.reviewStepInst}>{step.instruction}</Text>
                                                        <Text style={st.reviewStepDist}>{step.distance}</Text>
                                                    </View>
                                                </View>
                                            ))
                                        )}
                                    </ScrollView>
                                    <TouchableOpacity style={st.exitNavBtn} onPress={() => setIsReviewMode(false)}><Text style={st.exitNavBtnText}>Back to Overview</Text></TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    <View style={st.travelModeRow}>
                                        {(['walking', 'driving', 'motorcycle', 'transit'] as const).map(mode => (
                                            <TouchableOpacity key={mode} style={[st.travelModeBtn, travelMode === mode && st.travelModeBtnActive]} onPress={() => { Keyboard.dismiss(); Haptics.selectionAsync(); setTravelMode(mode); }}>
                                                <Ionicons name={mode === 'driving' ? 'car' : mode === 'walking' ? 'walk' : mode === 'motorcycle' ? 'bicycle' : 'bus'} size={16} color={travelMode === mode ? T.onPrimary : T.ink3} />
                                                <Text style={[st.travelModeText, travelMode === mode && st.travelModeTextActive]}>{mode === 'motorcycle' ? 'Bike' : mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <View style={st.overviewRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={st.overviewDist}>{routeLoading ? 'Loading route...' : mapDistance || 'Route ready'}</Text>
                                            <Text style={st.overviewEta}>{mapDuration || (selectedResponder ? `To ${selectedResponder.name}` : 'Waiting for responder')}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TouchableOpacity style={st.reviewBtn} onPress={() => { Keyboard.dismiss(); setIsReviewMode(true); }}>
                                                <Feather name="list" size={16} color={T.violet} />
                                                <Text style={st.reviewBtnText}>Review</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={st.startNavBtn} onPress={() => {
                                                Keyboard.dismiss();
                                                Haptics.selectionAsync();
                                                if (mapRouteCoords.length <= 1) {
                                                    setRouteError('Please wait for the selected route to load.');
                                                    return;
                                                }
                                                setCompletedRouteCoords([]);
                                                setRemainingRouteCoords(mapRouteCoords);
                                                setIsLiveNavMode(true);
                                                const volunteerPoint = selectedResponder?.location ?? mapRouteCoords[mapRouteCoords.length - 1];
                                                mapRef.current?.animateCamera({ center: volunteerPoint, pitch: 60, heading: 145, zoom: 18 }, { duration: 1000 });
                                            }}>
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
    headerOuter: { paddingHorizontal: S.s3, paddingTop: S.s2, paddingBottom: S.s2, marginBottom: 12 },
    headerBlur: { borderRadius: R.pill, overflow: 'hidden', borderWidth: 1, borderColor: T.hairlineMicro, backgroundColor: T.surfaceBulky },
    headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.s3, paddingVertical: 8, minHeight: 58 },
    headerBtn: { width: 36, height: 36, borderRadius: R.hBtn, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    liveMapCircularBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
    liveMapCircularBg: { backgroundColor: '#1E153A', opacity: 0.60 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    headerTitleBlock: { justifyContent: 'center', marginLeft: 8, flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerMenuBtn: { alignItems: 'center', justifyContent: 'center' },
    headerMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
    headerMenuPanel: { position: 'absolute', top: 60, right: 20, backgroundColor: '#1E153A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', minWidth: 220, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 5 } }) },
    headerMenuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    headerMenuText: { color: '#FFFFFF', fontSize: 16 },
    headerMenuTextDanger: { color: '#FF453A', fontWeight: 'bold' },
    headerMenuDivider: { borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', marginHorizontal: 16 },
    headerTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
    headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    headerStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
    headerStatusPillLive: { backgroundColor: T.violetDim, borderColor: `${T.violet}55` },
    headerStatusPillArchived: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
    headerStatusTextLive: { fontSize: 10, fontWeight: '700', color: T.violet, letterSpacing: 0.8, textTransform: 'uppercase' },
    headerStatusTextArchived: { fontSize: 10, fontWeight: '700', color: T.ink4, letterSpacing: 0.8, textTransform: 'uppercase' },
    connPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    connDot: { width: 5, height: 5, borderRadius: 2.5 },
    connTxt: { fontSize: 9, fontWeight: '600', color: T.ink5, letterSpacing: 0.3 },
    chatArea: { flex: 1 },
    messageList: { paddingHorizontal: S.s4, paddingTop: S.s3, paddingBottom: S.s2 },
    bubbleRow: { flexDirection: 'row', marginBottom: 20, gap: S.s2 },
    bubbleRowOwn: { justifyContent: 'flex-end', alignItems: 'flex-end' },
    bubbleRowOther: { justifyContent: 'flex-start', alignItems: 'flex-start' },
    avatar: { width: 32, height: 32, borderRadius: 16, alignSelf: 'flex-start', flexShrink: 0 },
    bubbleCol: { maxWidth: '75%' },
    senderRow: { flexDirection: 'row', alignItems: 'center', gap: S.s1 + 2, marginBottom: S.s1, paddingHorizontal: S.s2 },
    senderName: { fontSize: 12, fontWeight: 'bold', color: '#C4C1D4', marginBottom: 2 },
    roleBadge: { flexDirection: 'row', alignItems: 'center' },
    roleBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
    bubble: { paddingVertical: S.s3, paddingHorizontal: S.s4 },
    bubbleOther: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' },
    bubbleOtherBg: { backgroundColor: '#1E153A', opacity: 0.70 },
    bubbleOwn: { backgroundColor: T.violetDim, borderWidth: 1, borderColor: `${T.violet}35` },
    msgText: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
    msgTextOwn: { color: T.ink },
    msgTime: { fontSize: 10, color: T.ink5, marginTop: S.s1, paddingHorizontal: S.s2, alignSelf: 'flex-start' },
    msgTimeOwn: { alignSelf: 'flex-end', textAlign: 'right' },
    systemWrap: { flexDirection: 'row', alignItems: 'center', gap: S.s2, marginVertical: S.s3 },
    systemLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: T.lineMid },
    systemPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.s3, paddingVertical: S.s1 },
    systemText: { fontSize: 11, color: T.ink4, fontStyle: 'italic' },
    systemTextEvidence: { color: T.violet, fontWeight: '600', fontStyle: 'normal' },
    audioWrap: { flexDirection: 'row', alignItems: 'center', gap: S.s2 },
    audioPlayBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.violet, alignItems: 'center', justifyContent: 'center' },
    audioWaveform: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 22 },
    waveBar: { width: 3, borderRadius: 1.5 },
    audioDur: { fontSize: 10, color: T.ink4, fontWeight: '600' },
    imageWrap: { width: '100%', height: 100, borderRadius: R.lg, backgroundColor: T.surfaceMid, alignItems: 'center', justifyContent: 'center', gap: S.s2 },
    imageLabel: { fontSize: 11, color: T.ink4, fontWeight: '500' },
    inputOuter: { width: '90%', alignSelf: 'center', paddingTop: S.s2 },
    inputPillContainer: { borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: -3 } }, android: { elevation: 8 } }) },
    inputPillBg: { backgroundColor: '#1E153A', opacity: 0.45 },
    inputPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
    inputAction: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    input: { flex: 1, fontSize: 15, color: '#FFFFFF', maxHeight: 100, paddingVertical: Platform.OS === 'ios' ? 8 : 4 },
    sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#8A38F6', alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#8A38F6', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }, android: { elevation: 8 } }) },
    sendBtnOff: { opacity: 0.5 },
    attachMenuOuter: { position: 'absolute', bottom: 70, left: 20, backgroundColor: '#1E153A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', paddingTop: 8, paddingHorizontal: 8, minWidth: 180, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 5 } }), zIndex: 10 },
    attachModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    attachMenuOuterModal: { position: 'absolute', bottom: 70, left: 20, backgroundColor: '#1E153A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', paddingTop: 8, paddingHorizontal: 8, minWidth: 180, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 5 } }), zIndex: 10 },
    attachOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
    attachOptionText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
    attachOptionDivider: { borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', marginHorizontal: 8 },
    archiveOuter: { paddingHorizontal: S.s4, paddingTop: S.s2, alignItems: 'center', gap: 10 },
    archiveBlur: { borderRadius: R.pill, overflow: 'hidden', borderWidth: 1, borderColor: T.hairlineMicro, backgroundColor: T.surfaceBulky },
    archiveInner: { flexDirection: 'row', alignItems: 'center', gap: S.s2, paddingHorizontal: S.s5, paddingVertical: S.s3 },
    archiveText: { fontSize: 13, fontWeight: '600', color: T.ink4, letterSpacing: 0.2 },
    archiveDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill, backgroundColor: 'rgba(255,69,58,0.10)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.28)' },
    archiveDeleteText: { fontSize: 13, fontWeight: '600', color: '#FF453A' },
    emptyChat: { alignItems: 'center', justifyContent: 'center', paddingTop: S.s8, gap: S.s2 },
    emptyChatCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: T.hairlineMicro, alignItems: 'center', justifyContent: 'center', marginBottom: S.s1 },
    emptyChatText: { ...Ty.bodySm, color: T.ink4 },

    // Modals
    caseModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 20 },
    caseModalSheet: { backgroundColor: '#1E153A', borderRadius: 12, padding: 16, maxHeight: '80%' },
    caseModalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 6 },
    caseModalHint: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12 },
    caseModalInput: { minHeight: 100, maxHeight: 300, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12, color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 12, textAlignVertical: 'top' },
    caseModalInputCompact: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12, color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 12 },
    caseModalError: { color: '#FCA5A5', fontSize: 12, fontWeight: '600', marginBottom: 12 },
    caseModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    caseModalCancel: { paddingHorizontal: 14, paddingVertical: 10 },
    caseModalCancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
    caseModalSave: { backgroundColor: T.violet, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    caseModalSaveText: { color: T.onPrimary, fontWeight: '800' },
    saveBackdropCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    saveCardColored: { width: '100%', maxWidth: 420, backgroundColor: '#1E153A', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 18, alignItems: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
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

    // Overlay Map styles
    overlayHeader: { position: 'absolute', left: S.s3, right: S.s3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
    overlayTitleWrap: { backgroundColor: 'rgba(30, 21, 58, 0.85)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    overlayTitle: { color: T.ink, fontSize: 13, fontWeight: '700' },
    overlayBottomCard: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(10, 5, 20, 0.5)', paddingTop: 20, paddingHorizontal: S.s4, zIndex: 10 },
    overlayCardTint: { ...StyleSheet.absoluteFillObject, backgroundColor: `${T.violet}08` },
    responderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, marginBottom: 16 },
    responderAvatarWrap: { flex: 1, alignItems: 'center' },
    responderAvatarRing: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    responderAvatarRingActive: { borderColor: T.violet, backgroundColor: 'rgba(138,56,246,0.18)' },
    responderAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
    responderAvatarName: { marginTop: 8, color: T.ink3, fontSize: 12, fontWeight: '700', textAlign: 'center' },
    responderAvatarNameActive: { color: T.violet },
    travelModeRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
    travelModeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    travelModeBtnActive: { backgroundColor: T.violet, borderColor: T.violet },
    travelModeText: { color: T.ink3, fontSize: 11, fontWeight: '700' },
    travelModeTextActive: { color: T.onPrimary },
    overviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    overviewDist: { color: T.violet, fontSize: 24, fontWeight: '900' },
    overviewEta: { color: T.ink3, fontSize: 14, fontWeight: '600', marginTop: 2 },
    startNavBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.violet, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, gap: 8 },
    startNavBtnText: { color: T.onPrimary, fontSize: 15, fontWeight: '700' },
    reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: 'rgba(138,56,246,0.15)', borderWidth: 1, borderColor: 'rgba(138,56,246,0.3)' },
    reviewBtnText: { color: T.violet, fontSize: 14, fontWeight: '700' },
    reviewStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
    reviewStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(138,56,246,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    reviewStepNumText: { color: T.violet, fontSize: 12, fontWeight: '800' },
    reviewStepInst: { color: T.ink, fontSize: 14, fontWeight: '700' },
    reviewStepDist: { color: T.ink3, fontSize: 12, fontWeight: '500', marginTop: 2 },
    reviewEmptyText: { color: T.ink3, fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 18 },
    routeErrorText: { color: '#FCA5A5', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
    navInstRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    navInstIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(138,56,246,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(138,56,246,0.3)' },
    navInstPrimary: { color: T.ink, fontSize: 16, fontWeight: '800' },
    navInstSecondary: { color: T.ink3, fontSize: 13, fontWeight: '500', marginTop: 4 },
    liveBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
    liveStepCounter: { color: T.ink3, fontSize: 13, fontWeight: '600' },
    exitNavBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    exitNavBtnText: { color: T.ink2, fontSize: 13, fontWeight: '700' },
});
