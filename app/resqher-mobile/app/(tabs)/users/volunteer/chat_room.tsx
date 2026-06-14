/**
 * volunteer/chat_room.tsx - Tactical Group Chat (Volunteer)
 * Mirrors standard-user chat room UI for consistency.
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Image,
    Platform, StatusBar, KeyboardAvoidingView, Keyboard,
    Modal, Pressable, Alert, ScrollView, AppState
} from 'react-native';
import MapView, { Marker, Polyline, type MapViewRef } from '../../../../src/components/shared/MapViewCompat';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useRouter, useLocalSearchParams, useIsFocused } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import UserAvatar from '../../../../src/components/shared/UserAvatar';


import AtmosphericShell from '../../../../src/components/AtmosphericShell';
import RespondersList from '../../../../src/components/RespondersList';
import LiveSafetyVideoRecorder from '../../../../src/components/shared/LiveSafetyVideoRecorder';
import { LiveSafetyVideoPlayerModal, VideoMessageCard } from '../../../../src/components/shared/LiveSafetyVideoPlayer';
import { LiveSafetyWebRTCBroadcaster, LiveSafetyWebRTCViewer } from '../../../../src/components/shared/LiveSafetyWebRTCStream';
import { T, R, S, Ty } from '../../../../src/constants/theme';
import AICopilotSheet from '../../../../components/AICopilotSheet';
import { DEFAULT_GROUP_CHAT_NAME, type Incident, type IncidentCategory, type LiveVideoRequest, type Message, type Role } from '../../../../src/types/chat';
import { incidentService } from '../../../../src/services/incidentService';
import { liveVideoService } from '../../../../src/services/liveVideoService';
import { getStoredIdentity } from '../../../../src/services/api';
import { useChatSocket } from '../../../../src/hooks/useChatSocket';
import { useGlobalLiveSafetyVideo } from '../../../../src/context/GlobalLiveSafetyVideoContext';
import {
    ENDPOINT_MOVE_THRESHOLD_M,
    OFF_ROUTE_THRESHOLD_M,
    REROUTE_DELAY_MS,
    REROUTE_THROTTLE_MS,
    getForwardRouteProgress,
} from '../../../../src/utils/routeRealtime';

// --- Constants --------------------------------------------------------------
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const COPILOT_ICON = require('../../../../assets/images/aicopiloticon.png');

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

type RoutePoint = { latitude: number; longitude: number; heading?: number };
type TravelMode = 'walking' | 'driving' | 'motorcycle' | 'transit';

function isActiveStatus(status?: string): boolean {
    return status === 'ACTIVE' || status === 'LIVE' || status === 'IN_PROGRESS';
}

function isFinalIncidentStatus(status?: string | null): boolean {
    const normalized = String(status || '').toUpperCase();
    return normalized === 'RESOLVED' || normalized === 'CANCELLED';
}

function policeRequestMessageForError(error: any) {
    const status = Number(error?.status || 0);
    const message = String(error?.message || '').toLowerCase();
    if (status === 409 || message.includes('already')) {
        return 'Police request already submitted for this incident.';
    }
    if (status === 400 || message.includes('active sos')) {
        return 'This SOS is no longer active.';
    }
    if (status === 403 || message.includes('participants')) {
        return 'Only incident participants can request police assistance.';
    }
    if (status >= 500 || message.includes('internal server') || message.includes('server error')) {
        return 'Could not submit police request. Please try again after backend is fixed.';
    }
    return error?.message || 'Could not submit police request. Please try again after backend is fixed.';
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
// --- Role badge config ------------------------------------------------------
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

// --- Helpers ----------------------------------------------------------------
function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
}

// --- RoleBadge --------------------------------------------------------------
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

// --- PillBubble - Directional tail (R.pill 3 corners, 0 near avatar) -------
const PillBubble = memo(function PillBubble({ msg, isOwn, onPlayVideo }: { msg: Message; isOwn: boolean; onPlayVideo: (uri: string, title?: string) => void }) {
    if (msg.type === 'SYSTEM') return <SystemBubble msg={msg} />;

    const role = msg.sender.role;
    const alignRight = isOwn;
    const imageUri = msg.mediaUrl || (/^https?:\/\//i.test(msg.content) ? msg.content : '');
    const videoUri = msg.mediaUrl || (/^https?:\/\//i.test(msg.content) ? msg.content : '');

    const tailStyle = alignRight
        ? {
            borderBottomRightRadius: 6,
        }
        : {
            borderBottomLeftRadius: 6,
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
                    (msg.type === 'IMAGE' || msg.type === 'VIDEO') && st.imageBubble,
                    tailStyle,
                ]}>
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
                            {imageUri ? (
                                <Image source={{ uri: imageUri }} style={st.chatImage} resizeMode="cover" />
                            ) : (
                                <>
                                    <Feather name="image" size={22} color={T.ink4} />
                                    <Text style={st.imageLabel}>Photo unavailable</Text>
                                </>
                            )}
                        </View>
                    ) : msg.type === 'VIDEO' ? (
                        <VideoMessageCard
                            filename={msg.mediaFilename}
                            onPress={() => {
                                if (!videoUri) {
                                    Alert.alert('Live Safety Video', 'Video could not be played on this device.');
                                    return;
                                }
                                onPlayVideo(videoUri, msg.mediaFilename || 'Live Safety Video');
                            }}
                        />
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

// --- Floating Glass Pill Input ----------------------------------------------
// -- Tactical Map Style ----------------------------------------------------
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

function FloatingInput({
    onSend,
    bottomInset,
    onImagePicked,
    isUploadingImage,
    canRequestLiveVideo,
    onRequestLiveVideo,
    isRequestingLiveVideo,
    liveVideoRequestLabel = 'Request Live Safety Video',
}: {
    onSend: (text: string) => void;
    bottomInset: number;
    onImagePicked: (uri: string) => void;
    isUploadingImage: boolean;
    canRequestLiveVideo?: boolean;
    onRequestLiveVideo?: () => void;
    isRequestingLiveVideo?: boolean;
    liveVideoRequestLabel?: string;
}) {
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
                            {canRequestLiveVideo && (
                                <>
                                    <TouchableOpacity
                                        style={st.attachOptionRow}
                                        activeOpacity={0.7}
                                        disabled={isRequestingLiveVideo}
                                        onPress={() => {
                                            if (isRequestingLiveVideo) return;
                                            Haptics.selectionAsync();
                                            setAttachMenuVisible(false);
                                            onRequestLiveVideo?.();
                                        }}
                                    >
                                        <Feather name={isRequestingLiveVideo ? 'loader' : 'video'} size={20} color="#FFFFFF" />
                                        <Text style={st.attachOptionText}>{isRequestingLiveVideo ? 'Requesting...' : liveVideoRequestLabel}</Text>
                                    </TouchableOpacity>
                                    <View style={st.attachOptionDivider} />
                                </>
                            )}
                            <TouchableOpacity
                                style={[st.attachOptionRow, { paddingBottom: 12 }]}
                                activeOpacity={0.7}
                                disabled={isUploadingImage}
                                onPress={async () => {
                                    if (isUploadingImage) return;
                                    Haptics.selectionAsync();
                                    try {
                                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                        if (status !== 'granted') {
                                            Alert.alert('Permission required', 'Permission to access media library is required.');
                                            return;
                                        }

                                        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
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
                                <Feather name={isUploadingImage ? 'loader' : 'image'} size={20} color="#FFFFFF" />
                                <Text style={st.attachOptionText}>{isUploadingImage ? 'Uploading...' : 'Photo'}</Text>
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
                            if (isUploadingImage) return;
                            Haptics.selectionAsync();
                            setAttachMenuVisible(!isAttachMenuVisible);
                        }}
                        disabled={isUploadingImage}
                        activeOpacity={0.7}
                    >
                        <Feather name={isUploadingImage ? 'loader' : 'paperclip'} size={20} color={isAttachMenuVisible ? T.violet : "#FFFFFF"} />
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
                        textAlignVertical="top"
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
                    <Text style={st.archiveText}>Incident Archived • Case Read-Only</Text>
                </View>
            </BlurView>
        </View>
    );
}

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

// --- Main - Chat Room -------------------------------------------------------

// -------------------------------------------------------------------------------
// PremiumBar & Nav Helpers
// -------------------------------------------------------------------------------
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
    tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,10,18,0.4)' },
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

function sanitizeCoordinate(lat: number, lng: number): RoutePoint | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)) };
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
    return html.replace(/<[^>]*>/g, '');
}

export default function ChatRoom() {
    const router = useRouter();
    const isChatFocused = useIsFocused();
    const insets = useSafeAreaInsets();
    const { incidentId, category } = useLocalSearchParams<{ incidentId: string; category?: string }>();
    const liveIncidentId = String(incidentId || '');
    const { managedIncidentId } = useGlobalLiveSafetyVideo();
    const isBackendIncidentId = /^\d+$/.test(liveIncidentId);
    const [selfId, setSelfId] = useState<string | undefined>();
    const {
        messages,
        participants,
        liveLocation,
        isConnected: isChatSocketConnected,
        sendMessage,
        sendImage,
        sendLocationUpdate,
        error: chatError,
        refreshMessages,
        liveVideoRequest: socketLiveVideoRequest,
        liveVideoEvent,
        liveStreamEvent,
        clearLiveVideoRequest,
        clearLiveVideoEvent,
        sendLiveStreamSignal,
    } = useChatSocket(isBackendIncidentId ? liveIncidentId : '', selfId, 'VOLUNTEER');
    const [incident, setIncident] = useState<Incident | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isRequestingLiveVideo, setIsRequestingLiveVideo] = useState(false);
    const [liveVideoStatus, setLiveVideoStatus] = useState<'idle' | 'waiting' | 'connecting' | 'live' | 'rejoin' | 'recording' | 'uploading' | 'latest' | 'ended' | 'error'>('idle');
    const [liveStreamAction, setLiveStreamAction] = useState<'request' | 'rejoin' | 'restart' | null>(null);
    const [isLiveStreamViewerVisible, setLiveStreamViewerVisible] = useState(false);
    const [videoPlayer, setVideoPlayer] = useState<{ uri: string; title: string } | null>(null);
    const [victimLiveVideoRequest, setVictimLiveVideoRequest] = useState<LiveVideoRequest | null>(null);
    const [victimLiveVideoAutoStart, setVictimLiveVideoAutoStart] = useState(false);
    const [isVictimLiveVideoPromptVisible, setVictimLiveVideoPromptVisible] = useState(false);
    const [victimLiveVideoCountdown, setVictimLiveVideoCountdown] = useState(10);
    const [isVictimLiveStreamBroadcasterVisible, setVictimLiveStreamBroadcasterVisible] = useState(false);
    const [isVictimLiveVideoRecorderVisible, setVictimLiveVideoRecorderVisible] = useState(false);
    const [victimLiveVideoAppState, setVictimLiveVideoAppState] = useState(AppState.currentState);
    const isStartingVictimLiveVideoRef = useRef(false);

    const resolvedCategory: IncidentCategory =
        (category === 'MY_EMERGENCY' ? 'MY_EMERGENCY' : 'ASSISTED') as IncidentCategory;
    const isMyEmergency = resolvedCategory === 'MY_EMERGENCY';

    const flatRef = useRef<FlatList>(null);
    const isLive = isActiveStatus(incident?.status);
    const isReadOnly = isFinalIncidentStatus(incident?.status);
    const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);
    const [isAiSheetOpen, setAiSheetOpen] = useState(false);

    // Map Overlay State
    const [isMapOverlayOpen, setIsMapOverlayOpen] = useState(false);
    const isSnapshotMap = isMapOverlayOpen && isReadOnly;
    const [mapRouteCoords, setMapRouteCoords] = useState<RoutePoint[]>([]);
    const [mapDistance, setMapDistance] = useState('');
    const [mapDuration, setMapDuration] = useState('');
    const [isLiveNavMode, setIsLiveNavMode] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [userLoc, setUserLoc] = useState<RoutePoint | null>(null);
    const [victimLocation, setVictimLocation] = useState<RoutePoint | null>(null);
    const [victimName, setVictimName] = useState('Victim');
    const locationSubRef = useRef<Location.LocationSubscription | null>(null);
    const routeRequestIdRef = useRef(0);
    const victimPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastVictimRouteRefreshRef = useRef(0);
    const lastOverviewRouteRef = useRef<{ origin: RoutePoint; destination: RoutePoint; mode: TravelMode } | null>(null);
    const offRouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRerouteAtRef = useRef(0);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [selectedResponderId, setSelectedResponderId] = useState('');
    const mapRef = useRef<MapViewRef>(null);

    // Travel Mode
    const [travelMode, setTravelMode] = useState<TravelMode>('walking');
    const [, setTravelModeDropdownOpen] = useState(false);

    // Nav Instructions (for live/review mode)
    type NavStep = { instruction: string; distance: string; maneuver?: string; endLocation?: { latitude: number; longitude: number } };
    const [navInstructions, setNavInstructions] = useState<NavStep[]>([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);

    // Route Progress (completed portion turns green)
    const [completedRouteCoords, setCompletedRouteCoords] = useState<RoutePoint[]>([]);
    const [remainingRouteCoords, setRemainingRouteCoords] = useState<RoutePoint[]>([]);
    const [snapshotFinalizedAt, setSnapshotFinalizedAt] = useState<string | null>(null);

    // Responders list modal state (local mock list of 5)
    const [isRespondersOpen, setRespondersOpen] = useState(false);
    const [isResponderRemovedOpen] = useState(false);
    const [respondersList, setRespondersList] = useState<Responder[]>([]);
    const [responderDirectory, setResponderDirectory] = useState<ResponderDirectory>({
        sosUser: null,
        volunteers: [],
        responderCount: 0,
        maxResponders: 3,
    });

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
    const [lawStatus, setLawStatus] = useState<string | null>(null);
    const [lawConfirmOpen, setLawConfirmOpen] = useState(false);
    const [lawRequesting, setLawRequesting] = useState(false);
    const lawRequestingRef = useRef(false);
    const [lawMessage, setLawMessage] = useState<string | null>(null);

    const handleConfirmLeave = useCallback(async () => {
        Haptics.selectionAsync();
        setHeaderMenuOpen(false);
        setLeaveConfirmOpen(false);
        await incidentService.leaveChat(liveIncidentId);
        router.back();
    }, [liveIncidentId, router]);

    const handleRequestLaw = useCallback(async () => {
        if (!isBackendIncidentId || lawRequestingRef.current) return;
        lawRequestingRef.current = true;
        setLawRequesting(true);
        setLawMessage(null);
        try {
            const request = await incidentService.requestLawEnforcement(liveIncidentId);
            setLawStatus(request.status || 'PENDING_ADMIN_REVIEW');
            setLawConfirmOpen(false);
            setLawMessage('Submitted to admin for review.');
        } catch (error: any) {
            if (Number(error?.status || 0) === 409 || String(error?.message || '').toLowerCase().includes('already')) {
                setLawStatus('PENDING_ADMIN_REVIEW');
            }
            setLawMessage(policeRequestMessageForError(error));
        } finally {
            lawRequestingRef.current = false;
            setLawRequesting(false);
        }
    }, [isBackendIncidentId, liveIncidentId]);

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

    useEffect(() => {
        if (!isBackendIncidentId) return;
        incidentService.getLawEnforcementStatus(liveIncidentId)
            .then((request) => setLawStatus(request.exists ? request.status || null : null))
            .catch(() => undefined);
    }, [isBackendIncidentId, liveIncidentId]);

    const loadResponders = useCallback(async () => {
        if (!liveIncidentId || isSnapshotMap) return;
        const response = await incidentService.getIncidentResponders(liveIncidentId);
        const volunteers = (response.volunteers || []).map(volunteer => ({
            id: volunteer.id,
            name: volunteer.name,
            avatarUri: volunteer.photoUri ?? null,
            location: sanitizeCoordinate(Number(volunteer.latitude), Number(volunteer.longitude)) ?? undefined,
        })).filter(volunteer => String(volunteer.id) !== String(response.sosUser?.id ?? ''));
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
        setSelectedResponderId(prev => volunteers.some(volunteer => volunteer.id === prev) ? prev : volunteers[0]?.id || '');
    }, [isSnapshotMap, liveIncidentId]);

    useEffect(() => {
        if (!liveIncidentId) return;
        let mounted = true;
        const initialTimer = setTimeout(() => {
            if (!mounted) return;
            loadResponders().catch(error => {
                if (mounted) console.warn('[VolunteerChatRoom] responders unavailable:', error?.message || error);
            });
            if (!isBackendIncidentId || isMyEmergency) return;
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
                    const status = Number(error?.response?.status ?? error?.status);
                    if (mounted && status !== 403) {
                        console.warn('[VolunteerChatRoom] case details unavailable:', error?.message || error);
                    }
                });
        }, 0);
        const interval = setInterval(() => {
            loadResponders().catch(() => undefined);
        }, 7000);
        return () => {
            mounted = false;
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [isBackendIncidentId, isMyEmergency, liveIncidentId, loadResponders]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (responderDirectory.volunteers.length > 0) return;
            if (isMyEmergency) {
                setRespondersList([]);
                setSelectedResponderId('');
                return;
            }
            const nextResponders = participants
                .filter(participant => participant.role !== 'USER')
                .map(participant => ({
                    id: participant.id,
                    name: participant.name,
                    avatarUri: participant.avatarUrl ?? null,
                }));
            setRespondersList(nextResponders);
            setSelectedResponderId(prev => prev || nextResponders[0]?.id || '');
        }, 0);
        return () => clearTimeout(timer);
    }, [isMyEmergency, participants, responderDirectory.volunteers.length]);

    const selectedResponder = React.useMemo(
        () => respondersList.find(responder => responder.id === selectedResponderId) ?? respondersList[0] ?? null,
        [respondersList, selectedResponderId]
    );

    const isAcceptedResponderForIncident = React.useMemo(() => {
        if (!selfId) return false;
        return responderDirectory.volunteers.some(volunteer => String(volunteer.id) === String(selfId));
    }, [responderDirectory.volunteers, selfId]);

    const canRequestLiveVideo = isBackendIncidentId
        && !isMyEmergency
        && isLive
        && !isReadOnly
        && isAcceptedResponderForIncident;
    const isGloballyManagedVictimVideo = isMyEmergency && managedIncidentId === liveIncidentId;
    const canStartLiveVideoRequest = canRequestLiveVideo && liveStreamAction !== null;
    const liveVideoRequestLabel = liveStreamAction === 'rejoin'
        ? liveVideoStatus === 'error' ? 'Retry Connection' : 'Rejoin Live Stream'
        : liveStreamAction === 'restart'
            ? 'Restart Live Stream'
            : 'Request Live Safety Video';
    const liveVideoStatusText = liveVideoStatus === 'waiting'
        ? 'Waiting for victim...'
        : liveVideoStatus === 'connecting'
            ? 'Connecting to Live Safety Video...'
            : liveVideoStatus === 'live'
                ? 'Live Safety Video is active.'
        : liveVideoStatus === 'rejoin'
            ? 'The victim is still streaming. You can rejoin without requesting again.'
        : liveVideoStatus === 'recording'
            ? 'Live Safety Video is recording evidence. The first clip will appear soon.'
            : liveVideoStatus === 'uploading'
                ? 'Uploading latest safety clip...'
                : liveVideoStatus === 'latest'
                    ? 'Latest Live Safety Video clip is available in chat.'
                    : liveVideoStatus === 'ended'
                        ? 'Live Safety Video ended.'
                        : liveVideoStatus === 'error'
                            ? 'Live Safety Video request could not be started.'
                            : '';

    const clearRouteOverview = useCallback(() => {
        routeRequestIdRef.current += 1;
        locationSubRef.current?.remove();
        locationSubRef.current = null;
        if (victimPollRef.current) {
            clearInterval(victimPollRef.current);
            victimPollRef.current = null;
        }
        if (offRouteTimerRef.current) {
            clearTimeout(offRouteTimerRef.current);
            offRouteTimerRef.current = null;
        }
        lastRerouteAtRef.current = 0;
        lastOverviewRouteRef.current = null;
        setMapRouteCoords([]);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        setIsLiveNavMode(false);
        setIsReviewMode(false);
        setMapDistance('');
        setMapDuration('');
        setSnapshotFinalizedAt(null);
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

    const fitMapCoordinates = useCallback((coords: RoutePoint[]) => {
        if (coords.length <= 0) return;
        setTimeout(() => {
            if (coords.length === 1) {
                mapRef.current?.animateCamera({ center: coords[0], zoom: 15, pitch: 0, heading: 0 }, { duration: 450 });
                return;
            }
            mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 140, right: 60, bottom: 300, left: 60 },
                animated: true,
            });
        }, 250);
    }, []);

    const loadRouteForIncident = useCallback(async (
        originLocation: RoutePoint,
        destinationLocation: RoutePoint,
        mode: TravelMode,
        options: { fit?: boolean; clearExisting?: boolean } = {},
    ) => {
        const requestId = ++routeRequestIdRef.current;
        const fallbackRoute = [originLocation, destinationLocation];
        const modeLabel = routeModeLabel(mode);
        if (options.clearExisting !== false) {
            setMapRouteCoords([]);
            setCompletedRouteCoords([]);
            setRemainingRouteCoords([]);
            setNavInstructions([]);
            setCurrentStepIdx(0);
        }

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
            if (options.fit !== false) fitRouteToMap(visibleCoords);
        };

        if (!GOOGLE_MAPS_API_KEY) {
            applyRoute(fallbackRoute, '', `~${modeLabel}`);
            return;
        }

        try {
            const origin = `${originLocation.latitude},${originLocation.longitude}`;
            const destination = `${destinationLocation.latitude},${destinationLocation.longitude}`;
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${routeModeForApi(mode)}&key=${GOOGLE_MAPS_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            if (routeRequestIdRef.current !== requestId) return;

            if (data?.routes?.length > 0) {
                const route = data.routes[0];
                const coords = polylineDecode(route.overview_polyline?.points ?? '');
                const leg = route.legs?.[0];
                const steps = leg?.steps ?? [];
                const instructions: NavStep[] = steps.map((step: any) => ({
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
            console.warn('[VolunteerChatRoom] route load failed, using fallback:', error);
            applyRoute(fallbackRoute, '', `~${modeLabel}`);
        }
    }, [fitRouteToMap]);

    const handleSelectResponder = useCallback(async (responderId: string) => {
        if (isSnapshotMap) {
            setSelectedResponderId(responderId);
            return;
        }
        if (responderId === selectedResponderId) return;
        Haptics.selectionAsync();
        setSelectedResponderId(responderId);
        const nextResponder = respondersList.find(responder => responder.id === responderId);
        if (isMyEmergency && nextResponder?.location && userLoc) {
            setVictimLocation(nextResponder.location);
            setVictimName(nextResponder.name || 'Responder');
            await loadRouteForIncident(userLoc, nextResponder.location, travelMode);
        }
    }, [isMyEmergency, isSnapshotMap, loadRouteForIncident, respondersList, selectedResponderId, travelMode, userLoc]);

    const applySnapshotContext = useCallback(async () => {
        const snapshot = await incidentService.getIncidentMapSnapshot(liveIncidentId);
        const victim = snapshot.victimLocation
            ? sanitizeCoordinate(Number(snapshot.victimLocation.latitude), Number(snapshot.victimLocation.longitude))
            : null;
        const volunteers = (snapshot.volunteerLocations ?? [])
            .map((volunteer) => {
                const location = sanitizeCoordinate(Number(volunteer.latitude), Number(volunteer.longitude));
                if (!location) return null;
                return {
                    id: String(volunteer.userId || volunteer.id || ''),
                    name: volunteer.name || 'Volunteer',
                    avatarUri: volunteer.photoUri ?? null,
                    location,
                } as Responder;
            })
            .filter((volunteer): volunteer is Responder => !!volunteer && !!volunteer.id);
        const polyline = (snapshot.polyline ?? [])
            .map((point) => sanitizeCoordinate(Number(point.latitude), Number(point.longitude)))
            .filter((point): point is RoutePoint => !!point);

        setUserLoc(null);
        setVictimLocation(victim);
        setVictimName(snapshot.victimLocation?.name || 'Victim');
        setRespondersList(volunteers);
        setResponderDirectory(prev => ({
            ...prev,
            volunteers,
            responderCount: volunteers.length,
        }));
        setSelectedResponderId(volunteers[0]?.id || '');
        setMapRouteCoords(polyline);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        setIsLiveNavMode(false);
        setIsReviewMode(false);
        setSnapshotFinalizedAt(snapshot.finalizedAt ?? null);
        setMapDistance(snapshot.status === 'CANCELLED' ? 'Case cancelled' : 'Case resolved');
        setMapDuration('Showing last known map state');

        const markerCoords = [
            ...(victim ? [victim] : []),
            ...volunteers.map(volunteer => volunteer.location).filter((location): location is RoutePoint => !!location),
        ];
        fitMapCoordinates(polyline.length > 1 ? polyline : markerCoords);
        if (!victim && markerCoords.length === 0) {
            setMapDuration('No saved map location is available for this archived case');
        }
    }, [fitMapCoordinates, liveIncidentId]);

    const openMapOverlay = useCallback(async () => {
        Keyboard.dismiss();
        Haptics.selectionAsync();
        clearRouteOverview();
        setIsMapOverlayOpen(true);
        setIsLiveNavMode(false);
        setIsReviewMode(false);
        setTravelModeDropdownOpen(false);

        try {
            if (isReadOnly) {
                await applySnapshotContext();
                return;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Location required', 'Please enable location access to view the route.');
                return;
            }

            const [position, context] = await Promise.all([
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                incidentService.getIncidentRouteContext(liveIncidentId),
            ]);
            const origin = sanitizeCoordinate(position.coords.latitude, position.coords.longitude);
            if (!origin) {
                Alert.alert('Route unavailable', 'Could not find valid current location.');
                return;
            }
            if (isMyEmergency) {
                const acceptedResponders = (context.volunteers || [])
                    .map(volunteer => ({
                        id: String(volunteer.id),
                        name: volunteer.name,
                        avatarUri: volunteer.photoUri ?? null,
                        location: sanitizeCoordinate(Number(volunteer.latitude), Number(volunteer.longitude)) ?? undefined,
                    }))
                    .filter(responder => responder.id !== String(context.victim.id) && responder.location);

                setResponderDirectory(prev => ({
                    ...prev,
                    volunteers: acceptedResponders,
                    responderCount: acceptedResponders.length,
                }));
                setRespondersList(acceptedResponders);
                setUserLoc({ ...origin, heading: position.coords.heading ?? undefined });

                const nextResponder = acceptedResponders.find(responder => responder.id === selectedResponderId) ?? acceptedResponders[0];
                setSelectedResponderId(nextResponder?.id || '');
                if (!nextResponder?.location) {
                    setVictimLocation(null);
                    setVictimName('Waiting for responder');
                    setMapRouteCoords([]);
                    setCompletedRouteCoords([]);
                    setRemainingRouteCoords([]);
                    setMapDistance('');
                    setMapDuration('Waiting for a responder to accept');
                    return;
                }

                setVictimLocation(nextResponder.location);
                setVictimName(nextResponder.name || 'Responder');
                await loadRouteForIncident(origin, nextResponder.location, travelMode);
                return;
            }
            const destination = sanitizeCoordinate(Number(context.victim.latitude), Number(context.victim.longitude));
            if (!destination) {
                Alert.alert('Route unavailable', 'Could not find valid volunteer or SOS location.');
                return;
            }
            setUserLoc({ ...origin, heading: position.coords.heading ?? undefined });
            setVictimLocation(destination);
            setVictimName(context.victim.name || 'Victim');
            await loadRouteForIncident(origin, destination, travelMode);
        } catch (error: any) {
            Alert.alert('Route unavailable', error?.message || 'Unable to load this route.');
        }
    }, [applySnapshotContext, clearRouteOverview, isMyEmergency, isReadOnly, liveIncidentId, loadRouteForIncident, selectedResponderId, travelMode]);

    useEffect(() => {
        if (!isMapOverlayOpen || isSnapshotMap || !userLoc || !victimLocation || isLiveNavMode) return;
        Keyboard.dismiss();
        const previous = lastOverviewRouteRef.current;
        const modeChanged = previous?.mode !== travelMode;
        const originMoved = !previous || haversineDistance(previous.origin, userLoc) >= ENDPOINT_MOVE_THRESHOLD_M;
        const destinationMoved = !previous || haversineDistance(previous.destination, victimLocation) >= ENDPOINT_MOVE_THRESHOLD_M;
        if (!modeChanged && !originMoved && !destinationMoved) return;
        if (!modeChanged && Date.now() - lastVictimRouteRefreshRef.current < REROUTE_THROTTLE_MS) return;
        lastVictimRouteRefreshRef.current = Date.now();
        lastOverviewRouteRef.current = { origin: userLoc, destination: victimLocation, mode: travelMode };
        setMapRouteCoords([]);
        setCompletedRouteCoords([]);
        setRemainingRouteCoords([]);
        setNavInstructions([]);
        setCurrentStepIdx(0);
        loadRouteForIncident(userLoc, victimLocation, travelMode);
    }, [travelMode, isMapOverlayOpen, isSnapshotMap, isLiveNavMode, userLoc, victimLocation, loadRouteForIncident]);

    useEffect(() => {
        if (!isMapOverlayOpen || isSnapshotMap || !liveIncidentId || isMyEmergency) return;
        if (victimPollRef.current) clearInterval(victimPollRef.current);
        victimPollRef.current = setInterval(async () => {
            try {
                const context = await incidentService.getIncidentRouteContext(liveIncidentId);
                const nextVictim = sanitizeCoordinate(Number(context.victim.latitude), Number(context.victim.longitude));
                if (!nextVictim) return;
                setVictimName(context.victim.name || 'Victim');
                setVictimLocation(prev => {
                    if (!prev) return nextVictim;
                    const movedM = haversineDistance(prev, nextVictim);
                    if (movedM < 5) return prev;
                    if (movedM >= ENDPOINT_MOVE_THRESHOLD_M && userLoc && Date.now() - lastVictimRouteRefreshRef.current > REROUTE_THROTTLE_MS) {
                        lastVictimRouteRefreshRef.current = Date.now();
                        loadRouteForIncident(userLoc, nextVictim, travelMode, { fit: !isLiveNavMode, clearExisting: false });
                    }
                    return nextVictim;
                });
            } catch {
                // Polling is best effort; chat remains usable if route context refresh fails.
            }
        }, 8000);

        return () => {
            if (victimPollRef.current) {
                clearInterval(victimPollRef.current);
                victimPollRef.current = null;
            }
        };
    }, [isMapOverlayOpen, isSnapshotMap, isLiveNavMode, isMyEmergency, liveIncidentId, loadRouteForIncident, travelMode, userLoc]);

    useEffect(() => {
        if (!isMapOverlayOpen || isSnapshotMap || !liveLocation) return;
        const timer = setTimeout(() => {
            const role = String(liveLocation.role || '').toUpperCase();
            const liveUserId = liveLocation.userId ? String(liveLocation.userId) : '';

            if (isMyEmergency) {
                const isResponderLocation = role === 'VOLUNTEER' && !!liveUserId && liveUserId !== String(selfId ?? '');
                if (!isResponderLocation) return;
                const nextResponderLocation = sanitizeCoordinate(Number(liveLocation.latitude), Number(liveLocation.longitude));
                if (!nextResponderLocation) return;
                setRespondersList(prev => prev.map(responder =>
                    responder.id === liveUserId ? { ...responder, location: nextResponderLocation } : responder
                ));
                setResponderDirectory(prev => ({
                    ...prev,
                    volunteers: prev.volunteers.map(responder =>
                        responder.id === liveUserId ? { ...responder, location: nextResponderLocation } : responder
                    ),
                }));
                const isSelectedResponder = liveUserId === selectedResponderId || (!selectedResponderId && respondersList[0]?.id === liveUserId);
                if (!isSelectedResponder) return;
                const movedM = victimLocation ? haversineDistance(victimLocation, nextResponderLocation) : Infinity;
                if (movedM < 1) return;
                setVictimLocation({ ...nextResponderLocation });
                setVictimName(respondersList.find(responder => responder.id === liveUserId)?.name || 'Responder');
                if (movedM >= ENDPOINT_MOVE_THRESHOLD_M && userLoc && Date.now() - lastVictimRouteRefreshRef.current > REROUTE_THROTTLE_MS) {
                    lastVictimRouteRefreshRef.current = Date.now();
                    loadRouteForIncident(userLoc, nextResponderLocation, travelMode, { fit: !isLiveNavMode, clearExisting: false });
                }
                return;
            }

            const isVictimLocation = role === 'USER' || role === 'STANDARD_USER' || (!role && !!liveUserId && liveUserId !== String(selfId ?? ''));
            if (!isVictimLocation) return;

            const nextVictim = sanitizeCoordinate(Number(liveLocation.latitude), Number(liveLocation.longitude));
            if (!nextVictim) return;

            const movedM = victimLocation ? haversineDistance(victimLocation, nextVictim) : Infinity;
            if (movedM < 1) return;
            setVictimLocation({ ...nextVictim });
            if (movedM >= ENDPOINT_MOVE_THRESHOLD_M && userLoc && Date.now() - lastVictimRouteRefreshRef.current > REROUTE_THROTTLE_MS) {
                lastVictimRouteRefreshRef.current = Date.now();
                loadRouteForIncident(userLoc, nextVictim, travelMode, { fit: !isLiveNavMode, clearExisting: false });
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [isLiveNavMode, isMapOverlayOpen, isSnapshotMap, isMyEmergency, liveLocation, loadRouteForIncident, respondersList, selectedResponderId, selfId, travelMode, userLoc, victimLocation]);

    useEffect(() => {
        if (!isMapOverlayOpen || isSnapshotMap) {
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
                        const nextVolunteer = {
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            heading: loc.coords.heading ?? undefined,
                        };
                        sendLocationUpdate(nextVolunteer);
                        setUserLoc(prev => {
                            if (prev && victimLocation && haversineDistance(prev, nextVolunteer) >= ENDPOINT_MOVE_THRESHOLD_M && Date.now() - lastVictimRouteRefreshRef.current > REROUTE_THROTTLE_MS) {
                                lastVictimRouteRefreshRef.current = Date.now();
                                loadRouteForIncident(nextVolunteer, victimLocation, travelMode, { fit: false, clearExisting: false });
                            }
                            return { ...nextVolunteer };
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
    }, [isMapOverlayOpen, isSnapshotMap, loadRouteForIncident, sendLocationUpdate, travelMode, victimLocation]);

    useEffect(() => {
        if (isSnapshotMap || !isLiveNavMode || !userLoc) {
            if (offRouteTimerRef.current) {
                clearTimeout(offRouteTimerRef.current);
                offRouteTimerRef.current = null;
            }
            return;
        }

        mapRef.current?.animateCamera({
            center: { latitude: userLoc.latitude, longitude: userLoc.longitude },
            pitch: 45,
            heading: userLoc.heading ?? 0,
            zoom: 19,
        }, { duration: 1000 });

        const progressTimer = setTimeout(() => {
            if (navInstructions.length > 0 && currentStepIdx < navInstructions.length - 1) {
                const currentStep = navInstructions[currentStepIdx];
                if (currentStep.endLocation) {
                    const dist = haversineDistance(userLoc, currentStep.endLocation);
                    if (dist <= 25) {
                        setCurrentStepIdx(prev => prev + 1);
                    }
                }
            }

            if (mapRouteCoords.length > 0) {
                const progress = getForwardRouteProgress(userLoc, mapRouteCoords);
                setCompletedRouteCoords(progress.completedRouteCoords);
                setRemainingRouteCoords(progress.remainingRouteCoords);

                if (progress.nearestDistanceM > OFF_ROUTE_THRESHOLD_M) {
                    if (!offRouteTimerRef.current && victimLocation) {
                        offRouteTimerRef.current = setTimeout(() => {
                            offRouteTimerRef.current = null;
                            if (!victimLocation) return;
                            if (Date.now() - lastRerouteAtRef.current < REROUTE_THROTTLE_MS) return;
                            lastRerouteAtRef.current = Date.now();
                            loadRouteForIncident(userLoc, victimLocation, travelMode, { fit: false, clearExisting: false });
                        }, REROUTE_DELAY_MS);
                    }
                } else if (offRouteTimerRef.current) {
                    clearTimeout(offRouteTimerRef.current);
                    offRouteTimerRef.current = null;
                }
            }
        }, 0);

        return () => clearTimeout(progressTimer);
    }, [isSnapshotMap, isLiveNavMode, userLoc, currentStepIdx, navInstructions, mapRouteCoords, victimLocation, loadRouteForIncident, travelMode]);

    useEffect(() => {
        if (isLiveNavMode && audioEnabled && navInstructions.length > 0 && currentStepIdx < navInstructions.length) {
            Speech.speak(navInstructions[currentStepIdx].instruction);
        }
    }, [isLiveNavMode, audioEnabled, currentStepIdx, navInstructions]);

    useEffect(() => {
        return () => {
            locationSubRef.current?.remove();
            locationSubRef.current = null;
            if (victimPollRef.current) {
                clearInterval(victimPollRef.current);
                victimPollRef.current = null;
            }
            if (offRouteTimerRef.current) {
                clearTimeout(offRouteTimerRef.current);
                offRouteTimerRef.current = null;
            }
            routeRequestIdRef.current += 1;
        };
    }, []);


    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
        }
    }, [messages.length]);

    const handleSend = useCallback(async (text: string) => {
        await sendMessage(text, 'TEXT');
    }, [sendMessage]);

    const handleSendPhoto = useCallback(async (uri: string) => {
        if (!isBackendIncidentId || isUploadingImage) return;
        setIsUploadingImage(true);
        try {
            await sendImage(uri);
        } catch (err: any) {
            Alert.alert('Image upload failed', err?.message || 'Please try again.');
        } finally {
            setIsUploadingImage(false);
        }
    }, [isBackendIncidentId, isUploadingImage, sendImage]);

    const handleRequestLiveVideo = useCallback(async () => {
        if (!canStartLiveVideoRequest || isRequestingLiveVideo) return;
        if (liveStreamAction === 'rejoin') {
            setLiveVideoStatus('connecting');
            setLiveStreamAction(null);
            setLiveStreamViewerVisible(true);
            return;
        }
        setIsRequestingLiveVideo(true);
        try {
            const result = await liveVideoService.requestLiveVideo(liveIncidentId);
            const status = String(result.request?.status || '').toUpperCase();
            if (status === 'STREAMING') {
                setLiveVideoStatus('connecting');
                setLiveStreamAction(null);
                setLiveStreamViewerVisible(true);
            } else if (status === 'APPROVED') {
                setLiveVideoStatus('connecting');
                setLiveStreamAction(null);
            } else if (status === 'RECORDING') {
                setLiveVideoStatus('recording');
                setLiveStreamAction(null);
            } else {
                setLiveVideoStatus('waiting');
                setLiveStreamAction(null);
            }
        } catch {
            setLiveVideoStatus('error');
            setLiveStreamAction(liveStreamAction === 'restart' ? 'restart' : 'request');
        } finally {
            setIsRequestingLiveVideo(false);
        }
    }, [canStartLiveVideoRequest, isRequestingLiveVideo, liveIncidentId, liveStreamAction]);

    const refreshLiveStreamState = useCallback(async () => {
        if (!canRequestLiveVideo) return;
        try {
            const state = await liveVideoService.getLiveStreamState(liveIncidentId);
            if (state.canRejoin) {
                setLiveVideoStatus('rejoin');
                setLiveStreamAction('rejoin');
                return;
            }
            if (state.status === 'PENDING') {
                setLiveVideoStatus('waiting');
                setLiveStreamAction(null);
                return;
            }
            if (state.status === 'APPROVED') {
                setLiveVideoStatus('connecting');
                setLiveStreamAction(null);
                return;
            }
            if (state.status === 'RECORDING') {
                setLiveVideoStatus('recording');
                setLiveStreamAction(null);
                return;
            }
            if (state.canRestart) {
                setLiveVideoStatus('ended');
                setLiveStreamAction('restart');
                return;
            }
            setLiveVideoStatus('idle');
            setLiveStreamAction(state.canRequest ? 'request' : null);
        } catch {
            setLiveStreamAction(null);
        }
    }, [canRequestLiveVideo, liveIncidentId]);

    useEffect(() => {
        if (!canRequestLiveVideo || !isChatFocused) return;
        const timer = setTimeout(() => void refreshLiveStreamState(), 0);
        return () => clearTimeout(timer);
    }, [canRequestLiveVideo, isChatFocused, isChatSocketConnected, refreshLiveStreamState]);

    useEffect(() => {
        if (!canRequestLiveVideo || !isLiveStreamViewerVisible) return;
        let cancelled = false;
        liveVideoService.getLiveStreamState(liveIncidentId)
            .then(state => {
                if (cancelled || state.canRejoin) return;
                setLiveStreamViewerVisible(false);
                void refreshLiveStreamState();
            })
            .catch(() => {
                if (cancelled) return;
                setLiveStreamViewerVisible(false);
                void refreshLiveStreamState();
            });
        return () => { cancelled = true; };
    }, [canRequestLiveVideo, isLiveStreamViewerVisible, liveIncidentId, refreshLiveStreamState]);

    useEffect(() => {
        if (!canRequestLiveVideo) {
            const timer = setTimeout(() => setLiveStreamAction(null), 0);
            return () => clearTimeout(timer);
        }
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active' && isChatFocused) void refreshLiveStreamState();
        });
        return () => subscription.remove();
    }, [canRequestLiveVideo, isChatFocused, refreshLiveStreamState]);

    const showVictimLiveVideoRequest = useCallback((request: LiveVideoRequest | null, autoStartAllowed: boolean) => {
        if (!isMyEmergency || !request || !isLive || isReadOnly || !isBackendIncidentId || isGloballyManagedVictimVideo) return;
        setVictimLiveVideoRequest(request);
        setVictimLiveVideoAutoStart(autoStartAllowed);
        setVictimLiveVideoCountdown(10);
        setVictimLiveVideoPromptVisible(true);
    }, [isBackendIncidentId, isGloballyManagedVictimVideo, isLive, isMyEmergency, isReadOnly]);

    const dismissVictimLiveVideoRequest = useCallback(() => {
        setVictimLiveVideoRequest(null);
        setVictimLiveVideoAutoStart(false);
        setVictimLiveVideoCountdown(10);
        setVictimLiveVideoPromptVisible(false);
        clearLiveVideoRequest();
        clearLiveVideoEvent();
    }, [clearLiveVideoEvent, clearLiveVideoRequest]);

    const startVictimLiveVideoRecording = useCallback(async () => {
        if (!victimLiveVideoRequest || !isMyEmergency || !isLive || isReadOnly || isGloballyManagedVictimVideo || isVictimLiveVideoRecorderVisible || isStartingVictimLiveVideoRef.current) return;
        if (AppState.currentState !== 'active' || !isChatFocused) return;
        isStartingVictimLiveVideoRef.current = true;
        try {
            await liveVideoService.respondLiveVideoRequest(liveIncidentId, victimLiveVideoRequest.id, 'APPROVED');
            setVictimLiveVideoPromptVisible(false);
            setVictimLiveStreamBroadcasterVisible(true);
        } catch (error: any) {
            Alert.alert('Live Safety Video', error?.message || 'This incident is no longer active.');
        } finally {
            isStartingVictimLiveVideoRef.current = false;
        }
    }, [isChatFocused, isGloballyManagedVictimVideo, isLive, isMyEmergency, isReadOnly, isVictimLiveVideoRecorderVisible, liveIncidentId, victimLiveVideoRequest]);

    const declineVictimLiveVideoRequest = useCallback(async () => {
        const request = victimLiveVideoRequest;
        try {
            if (request && isMyEmergency) {
                await liveVideoService.respondLiveVideoRequest(liveIncidentId, request.id, 'DECLINED');
            }
        } catch (error: any) {
            Alert.alert('Live Safety Video', error?.message || 'Live Safety Video was declined.');
        } finally {
            dismissVictimLiveVideoRequest();
        }
    }, [dismissVictimLiveVideoRequest, isMyEmergency, liveIncidentId, victimLiveVideoRequest]);

    const handleVictimLiveVideoRecorded = useCallback(async (uri: string) => {
        if (!isMyEmergency || !isLive || isReadOnly) {
            throw new Error('This incident is no longer active.');
        }
        await liveVideoService.uploadLiveVideo(liveIncidentId, uri);
        await refreshMessages();
    }, [isLive, isMyEmergency, isReadOnly, liveIncidentId, refreshMessages]);

    const handleVictimLiveVideoSessionStop = useCallback(async () => {
        const request = victimLiveVideoRequest;
        if (request && isMyEmergency) {
            await liveVideoService.respondLiveVideoRequest(liveIncidentId, request.id, 'STOPPED').catch(() => undefined);
        }
        setVictimLiveVideoRecorderVisible(false);
        dismissVictimLiveVideoRequest();
    }, [dismissVictimLiveVideoRequest, isMyEmergency, liveIncidentId, victimLiveVideoRequest]);

    const handleVictimLiveStreamClose = useCallback(() => {
        setVictimLiveStreamBroadcasterVisible(false);
        dismissVictimLiveVideoRequest();
    }, [dismissVictimLiveVideoRequest]);

    const handleVictimStopStreaming = useCallback(async () => {
        const request = victimLiveVideoRequest;
        if (request && isMyEmergency) {
            await liveVideoService.respondLiveVideoRequest(liveIncidentId, request.id, 'STOPPED').catch(() => undefined);
        }
        setVictimLiveStreamBroadcasterVisible(false);
        dismissVictimLiveVideoRequest();
    }, [dismissVictimLiveVideoRequest, isMyEmergency, liveIncidentId, victimLiveVideoRequest]);

    const handleVictimStopAndSaveEvidence = useCallback(async () => {
        const request = victimLiveVideoRequest;
        if (request && isMyEmergency) {
            await liveVideoService.respondLiveVideoRequest(liveIncidentId, request.id, 'STOPPED').catch(() => undefined);
        }
        setVictimLiveStreamBroadcasterVisible(false);
        await new Promise(resolve => setTimeout(resolve, 1200));
        if (AppState.currentState !== 'active' || !isChatFocused) return;
        setVictimLiveVideoRecorderVisible(true);
    }, [isChatFocused, isMyEmergency, liveIncidentId, victimLiveVideoRequest]);

    const handleVictimLiveStreamFallbackEvidence = useCallback(async () => {
        setVictimLiveStreamBroadcasterVisible(false);
        await new Promise(resolve => setTimeout(resolve, 1200));
        if (AppState.currentState !== 'active' || !isChatFocused) return;
        setVictimLiveVideoRecorderVisible(true);
    }, [isChatFocused]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', setVictimLiveVideoAppState);
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (!isMyEmergency || !isBackendIncidentId || !isLive || isReadOnly) {
            const clearTimer = setTimeout(() => {
                dismissVictimLiveVideoRequest();
                setVictimLiveStreamBroadcasterVisible(false);
                setVictimLiveVideoRecorderVisible(false);
            }, 0);
            return () => clearTimeout(clearTimer);
        }

        let cancelled = false;
        liveVideoService.getPendingLiveVideoRequest(liveIncidentId)
            .then(({ request, autoStartAllowed }) => {
                if (cancelled || !request || request.status !== 'PENDING') return;
                showVictimLiveVideoRequest(request, autoStartAllowed);
            })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [dismissVictimLiveVideoRequest, isBackendIncidentId, isLive, isMyEmergency, isReadOnly, liveIncidentId, showVictimLiveVideoRequest]);

    useEffect(() => {
        if (!isMyEmergency || socketLiveVideoRequest?.status !== 'PENDING') return;
        const showTimer = setTimeout(() => {
            showVictimLiveVideoRequest(
                socketLiveVideoRequest,
                liveVideoEvent?.type === 'requested' ? liveVideoEvent.autoStartAllowed : false,
            );
        }, 0);
        return () => clearTimeout(showTimer);
    }, [isMyEmergency, liveVideoEvent, showVictimLiveVideoRequest, socketLiveVideoRequest]);

    useEffect(() => {
        if (!isVictimLiveVideoPromptVisible || !victimLiveVideoAutoStart || !victimLiveVideoRequest) return;
        if (victimLiveVideoAppState !== 'active' || !isChatFocused) return;

        const resetTimer = setTimeout(() => setVictimLiveVideoCountdown(10), 0);
        const interval = setInterval(() => {
            if (AppState.currentState !== 'active' || !isChatFocused) return;
            setVictimLiveVideoCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    void startVictimLiveVideoRecording();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            clearTimeout(resetTimer);
            clearInterval(interval);
        };
    }, [isChatFocused, isVictimLiveVideoPromptVisible, startVictimLiveVideoRecording, victimLiveVideoAppState, victimLiveVideoAutoStart, victimLiveVideoRequest]);

    useEffect(() => {
        const eventTimer = setTimeout(() => {
            if (!isMyEmergency && (liveVideoEvent?.type === 'declined' || liveVideoEvent?.type === 'stopped' || liveVideoEvent?.type === 'completed')) {
                setLiveVideoStatus('ended');
                setLiveStreamAction('restart');
                setLiveStreamViewerVisible(false);
            }
            if (!isMyEmergency && (liveVideoEvent?.type === 'approved' || liveVideoEvent?.type === 'recording')) {
                setLiveVideoStatus(liveVideoEvent?.type === 'approved' ? 'connecting' : 'recording');
                setLiveStreamAction(null);
            }
            if (!isMyEmergency && liveVideoEvent?.type === 'uploading') {
                setLiveVideoStatus('uploading');
            }
            if (!isMyEmergency && liveVideoEvent?.type === 'clip') {
                setLiveVideoStatus('latest');
                setLiveStreamAction('restart');
            }
        }, 0);
        return () => clearTimeout(eventTimer);
    }, [isMyEmergency, liveVideoEvent]);

    useEffect(() => {
        if (isMyEmergency || !liveStreamEvent) return;
        const timer = setTimeout(() => {
            if (liveStreamEvent.type === 'live-stream:approved') {
                setLiveVideoStatus('connecting');
                setLiveStreamAction(null);
            }
            if (liveStreamEvent.type === 'live-stream:start') {
                setLiveVideoStatus('connecting');
                setLiveStreamAction(null);
                setLiveStreamViewerVisible(true);
            }
            if (liveStreamEvent.type === 'live-stream:offer') {
                setLiveVideoStatus('live');
                setLiveStreamAction(null);
            }
            if (liveStreamEvent.type === 'live-stream:declined' || liveStreamEvent.type === 'live-stream:stop') {
                setLiveVideoStatus('ended');
                setLiveStreamAction('restart');
                setLiveStreamViewerVisible(false);
            }
            if (liveStreamEvent.type === 'live-stream:error') {
                setLiveVideoStatus('error');
                setLiveStreamAction('rejoin');
                setLiveStreamViewerVisible(false);
            }
            if (liveStreamEvent.type === 'live-stream:state') {
                const status = String(liveStreamEvent.payload?.request?.status || '').toUpperCase();
                if (status === 'STREAMING') {
                    setLiveVideoStatus('rejoin');
                    setLiveStreamAction('rejoin');
                }
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [isMyEmergency, liveStreamEvent]);

    useEffect(() => {
        if (isLive && !isReadOnly && isBackendIncidentId) return;
        const timer = setTimeout(() => {
            setLiveStreamViewerVisible(false);
            setVictimLiveStreamBroadcasterVisible(false);
        }, 0);
        return () => clearTimeout(timer);
    }, [isBackendIncidentId, isLive, isReadOnly]);

    const openVideoPlayer = useCallback((uri: string, title = 'Live Safety Video') => {
        setVideoPlayer({ uri, title });
    }, []);

    const renderMessage = useCallback(({ item }: { item: Message }) => (
        <PillBubble msg={item} isOwn={item.sender.id === selfId} onPlayVideo={openVideoPlayer} />
    ), [openVideoPlayer, selfId]);

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
                    behavior="padding"
                    keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
                >
                    {!isBackendIncidentId && (
                        <View style={st.chatErrorCard}>
                            <Feather name="alert-circle" size={16} color={T.danger} />
                            <Text style={st.chatErrorText}>Missing or invalid incident id. Please open this chat from your messages list.</Text>
                            <TouchableOpacity style={st.chatErrorBtn} onPress={() => router.back()} activeOpacity={0.8}>
                                <Text style={st.chatErrorBtnText}>Back</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {isBackendIncidentId && !!chatError && (
                        <TouchableOpacity style={st.chatErrorCard} onPress={refreshMessages} activeOpacity={0.8}>
                            <Feather name="alert-circle" size={16} color={T.danger} />
                            <Text style={st.chatErrorText}>{chatError} Tap to retry.</Text>
                        </TouchableOpacity>
                    )}
                    <FlatList
                        ref={flatRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item.id}
                        contentContainerStyle={[
                            st.messageList,
                            isLive && isBackendIncidentId && st.messageListWithInput,
                        ]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        onScrollBeginDrag={Keyboard.dismiss}
                        ListEmptyComponent={
                            <View style={st.emptyChat}>
                                <View style={st.emptyChatCircle}>
                                    <Feather name={chatError || !isBackendIncidentId ? 'alert-circle' : 'message-circle'} size={24} color={chatError || !isBackendIncidentId ? T.danger : T.ink5} />
                                </View>
                                <Text style={st.emptyChatText}>
                                    {!isBackendIncidentId ? 'Invalid chat link' : chatError ? chatError : 'No messages yet'}
                                </Text>
                            </View>
                        }
                    />

                    {!!liveVideoStatusText && canRequestLiveVideo && (
                        <View style={st.liveVideoPendingPill}>
                            <Feather name={liveVideoStatus === 'latest' ? 'play-circle' : liveVideoStatus === 'ended' || liveVideoStatus === 'error' ? 'info' : 'video'} size={13} color={T.violet} />
                            <Text style={st.liveVideoPendingText}>{liveVideoStatusText}</Text>
                        </View>
                    )}
                    {isLive && isBackendIncidentId ? (
                        <FloatingInput
                            onSend={handleSend}
                            bottomInset={insets.bottom}
                            onImagePicked={handleSendPhoto}
                            isUploadingImage={isUploadingImage}
                            canRequestLiveVideo={canStartLiveVideoRequest}
                            liveVideoRequestLabel={liveVideoRequestLabel}
                            onRequestLiveVideo={handleRequestLiveVideo}
                            isRequestingLiveVideo={isRequestingLiveVideo}
                        />
                    ) : isBackendIncidentId ? (
                        <ArchivePill bottomInset={insets.bottom} />
                    ) : null}
                </KeyboardAvoidingView>

                <LiveSafetyVideoPlayerModal
                    visible={!!videoPlayer}
                    sourceUri={videoPlayer?.uri}
                    title={videoPlayer?.title}
                    onClose={() => setVideoPlayer(null)}
                />

                <Modal transparent visible={!isGloballyManagedVictimVideo && isVictimLiveVideoPromptVisible && !!victimLiveVideoRequest && !isVictimLiveVideoRecorderVisible && !isVictimLiveStreamBroadcasterVisible} animationType="fade">
                    <View style={st.liveVideoBackdrop}>
                        <View style={st.liveVideoCard}>
                            <View style={st.liveVideoIcon}>
                                <Feather name="video" size={22} color="#FFFFFF" />
                            </View>
                            <Text style={st.liveVideoTitle}>Live Safety Video Request</Text>
                            <Text style={st.liveVideoBody}>
                                {victimLiveVideoAutoStart
                                    ? `Live Safety Video will start in ${victimLiveVideoCountdown} seconds.`
                                    : 'An accepted responder is requesting live video to better understand your situation.'}
                            </Text>
                            <View style={st.liveVideoActions}>
                                <TouchableOpacity style={[st.liveVideoButton, st.liveVideoPrimary]} activeOpacity={0.82} onPress={startVictimLiveVideoRecording}>
                                    <Text style={st.liveVideoPrimaryText}>{victimLiveVideoAutoStart ? 'Start Now' : 'Start Live Stream'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[st.liveVideoButton, st.liveVideoSecondary]} activeOpacity={0.82} onPress={declineVictimLiveVideoRequest}>
                                    <Text style={st.liveVideoSecondaryText}>{victimLiveVideoAutoStart ? 'Cancel' : 'Not Now'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <LiveSafetyWebRTCViewer
                    visible={isLiveStreamViewerVisible}
                    incidentId={liveIncidentId}
                    incidentLabel={`Incident #${liveIncidentId}`}
                    liveStreamEvent={liveStreamEvent}
                    sendSignal={sendLiveStreamSignal}
                    onClose={() => {
                        setLiveStreamViewerVisible(false);
                        setLiveVideoStatus('rejoin');
                        setLiveStreamAction('rejoin');
                        void refreshLiveStreamState();
                    }}
                />

                <LiveSafetyWebRTCBroadcaster
                    visible={!isGloballyManagedVictimVideo && isVictimLiveStreamBroadcasterVisible}
                    incidentId={liveIncidentId}
                    incidentLabel={`Incident #${liveIncidentId}`}
                    sessionActive={isLive && !isReadOnly && isChatFocused && victimLiveVideoAppState === 'active'}
                    liveStreamEvent={liveStreamEvent}
                    sendSignal={sendLiveStreamSignal}
                    onClose={handleVictimLiveStreamClose}
                    onFallbackEvidence={handleVictimLiveStreamFallbackEvidence}
                    onStopStreaming={handleVictimStopStreaming}
                    onStopAndSaveEvidence={handleVictimStopAndSaveEvidence}
                />

                <LiveSafetyVideoRecorder
                    visible={!isGloballyManagedVictimVideo && isVictimLiveVideoRecorderVisible}
                    incidentLabel={`Incident #${liveIncidentId}`}
                    sessionActive={isLive && !isReadOnly && isChatFocused && victimLiveVideoAppState === 'active'}
                    onClipRecorded={handleVictimLiveVideoRecorded}
                    onStopSession={handleVictimLiveVideoSessionStop}
                />

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
                                onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); setAiSheetOpen(true); }}
                            >
                                <Image source={COPILOT_ICON} style={st.headerMenuAiIcon} resizeMode="contain" />
                                <Text style={st.headerMenuText}>SheSafe AI Safety Copilot</Text>
                            </TouchableOpacity>

                            <View style={st.headerMenuDivider} />

                            {isLive && isBackendIncidentId && (
                                <>
                                    <TouchableOpacity
                                        style={st.headerMenuRow}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setHeaderMenuOpen(false);
                                            setLawMessage(lawStatus ? 'Police request already submitted for this incident.' : null);
                                            setLawConfirmOpen(true);
                                        }}
                                    >
                                        <Feather name="shield" size={16} color={lawStatus ? T.ink4 : '#FFFFFF'} />
                                        <Text style={[st.headerMenuText, lawStatus && { color: T.ink4 }]}>Request Police</Text>
                                    </TouchableOpacity>
                                    <View style={st.headerMenuDivider} />
                                </>
                            )}

                            <TouchableOpacity
                                style={st.headerMenuRow}
                                activeOpacity={0.7}
                                onPress={() => { Haptics.selectionAsync(); setLeaveConfirmOpen(true); setHeaderMenuOpen(false); }}
                            >
                                <Feather name="x-circle" size={16} color="#FF453A" />
                                <Text style={[st.headerMenuText, st.headerMenuTextDanger]}>Leave Chat / Dispatch</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>

                <AICopilotSheet visible={isAiSheetOpen} onClose={() => setAiSheetOpen(false)} role="volunteer" incidentId={isBackendIncidentId ? liveIncidentId : null} />

                <Modal transparent visible={lawConfirmOpen} animationType="fade">
                    <View style={st.leaveBackdropCentered}>
                        <View style={st.leaveCard}>
                            <Text style={st.leaveTitle}>Request Police Assistance?</Text>
                            <Text style={st.leaveMessage}>This will send the incident to admin with an automatic incident summary for review.</Text>
                            {!!lawStatus && <Text style={[st.leaveMessage, { color: T.violet }]}>Current status: {lawStatus.replace(/_/g, ' ')}</Text>}
                            {!!lawMessage && <Text style={[st.leaveMessage, { color: lawStatus ? T.violet : T.dangerText }]}>{lawMessage}</Text>}
                            <View style={st.leaveActions}>
                                <TouchableOpacity style={st.leaveCancel} onPress={() => setLawConfirmOpen(false)}><Text style={st.leaveCancelText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={[st.leaveYes, lawStatus && { opacity: 0.45 }]} disabled={!!lawStatus || lawRequesting} onPress={handleRequestLaw}>
                                    <Text style={st.leaveYesText}>{lawRequesting ? 'Submitting...' : 'Submit Request'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
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

                {/* -- Map Overlay --------------------------------------------------- */}
                {isMapOverlayOpen && (
                    <View style={StyleSheet.absoluteFill}>
                        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                        <MapView
                            ref={mapRef}
                            debugName="VolunteerChatRouteMap"
                            style={StyleSheet.absoluteFill}
                            userInterfaceStyle="dark"
                            customMapStyle={TACTICAL_MAP_STYLE}
                            pitchEnabled={true}
                            showsUserLocation={!isSnapshotMap}
                            showsMyLocationButton={false}
                            initialRegion={{
                                latitude: 23.8293,
                                longitude: 90.4182,
                                latitudeDelta: 0.05,
                                longitudeDelta: 0.05,
                            }}
                        >
                            {/* Completed route (blue) */}
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
                                <>
                                    <Polyline
                                        coordinates={remainingRouteCoords}
                                        strokeColor="rgba(138,56,246,0.28)"
                                        strokeWidth={10}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                    <Polyline
                                        coordinates={remainingRouteCoords}
                                        strokeColor={T.violet}
                                        strokeWidth={4}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                </>
                            )}
                            {/* Fallback: full route if no progress split yet */}
                            {completedRouteCoords.length === 0 && mapRouteCoords.length > 1 && (
                                <>
                                    <Polyline
                                        coordinates={mapRouteCoords}
                                        strokeColor="rgba(138,56,246,0.28)"
                                        strokeWidth={10}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                    <Polyline
                                        coordinates={mapRouteCoords}
                                        strokeColor={T.violet}
                                        strokeWidth={4}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                </>
                            )}
                            {isSnapshotMap && victimLocation && (
                                <Marker
                                    coordinate={victimLocation}
                                    pinColor="#EF4444"
                                    title={victimName || 'Victim'}
                                    description="Last known victim location"
                                    zIndex={1000}
                                />
                            )}
                            {isSnapshotMap && respondersList.map(responder => responder.location ? (
                                <Marker
                                    key={`snapshot-${responder.id}`}
                                    coordinate={responder.location}
                                    pinColor={T.violet}
                                    title={responder.name || 'Volunteer'}
                                    description="Last known responder location"
                                    zIndex={999}
                                />
                            ) : null)}
                            {!isSnapshotMap && mapRouteCoords.length > 0 && (
                                <>
                                    {/* Volunteer Marker (origin) */}
                                    <Marker
                                        coordinate={isLiveNavMode && userLoc ? { latitude: userLoc.latitude, longitude: userLoc.longitude } : mapRouteCoords[0]}
                                        pinColor={T.violet}
                                        title="You"
                                        description={isMyEmergency ? 'Requester location' : 'Volunteer location'}
                                        zIndex={1000}
                                    />
                                    {/* Victim Marker (destination) */}
                                    <Marker
                                        coordinate={isLiveNavMode && victimLocation ? victimLocation : mapRouteCoords[mapRouteCoords.length - 1]}
                                        pinColor="#EF4444"
                                        title={isMyEmergency ? (selectedResponder?.name || victimName || 'Responder') : (victimName || 'Victim')}
                                        description={isMyEmergency ? 'Responder location' : (incident?.address || 'SOS location')}
                                        zIndex={999}
                                    />
                                </>
                            )}
                        </MapView>

                        {/* Top Header - Live mode shows current instruction */}
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
                                    onPress={() => { Keyboard.dismiss(); setIsMapOverlayOpen(false); clearRouteOverview(); }}
                                >
                                    <Feather name="x" size={22} color={T.ink} />
                                </TouchableOpacity>
                                <View style={st.overlayTitleWrap}>
                                    <Text style={st.overlayTitle}>
                                        {isSnapshotMap ? 'Snapshot Map' : isReviewMode ? 'Route Review' : 'Route Overview'}
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
                            {isMyEmergency && !isLiveNavMode && !isReviewMode && respondersList.length > 0 && (
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

                            {/* -- LIVE MODE -------------------------------- */}
                            {isSnapshotMap ? (
                                <View>
                                    <View style={st.overviewRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={st.overviewDist}>{mapDistance || 'Archived case'}</Text>
                                            <Text style={st.overviewEta}>
                                                {mapDuration}{snapshotFinalizedAt ? ` · ${formatTime(snapshotFinalizedAt)}` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ) : isLiveNavMode ? (
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
                                                if (offRouteTimerRef.current) {
                                                    clearTimeout(offRouteTimerRef.current);
                                                    offRouteTimerRef.current = null;
                                                }
                                                setIsLiveNavMode(false);
                                                setCompletedRouteCoords([]);
                                                setRemainingRouteCoords(mapRouteCoords);
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

                                /* -- REVIEW MODE -------------------------------- */
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

                                /* -- ROUTE OVERVIEW (default) ------------------- */
                            ) : isMyEmergency && respondersList.length === 0 ? (
                                <View style={st.waitingResponderCard}>
                                    <View style={st.waitingResponderIcon}>
                                        <Feather name="clock" size={18} color={T.violet} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={st.waitingResponderTitle}>Waiting for responder</Text>
                                        <Text style={st.waitingResponderText}>Accepted volunteers will appear here when they join this SOS.</Text>
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    {/* Travel Mode Selector */}
                                    <View style={st.travelModeRow}>
                                        {(['walking', 'driving', 'motorcycle', 'transit'] as const).map((mode) => (
                                            <TouchableOpacity
                                                key={mode}
                                                style={[st.travelModeBtn, travelMode === mode && st.travelModeBtnActive]}
                                                onPress={() => {
                                                    Keyboard.dismiss();
                                                    Haptics.selectionAsync();
                                                    setTravelMode(mode);
                                                }}
                                                activeOpacity={0.75}
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
                                                    Keyboard.dismiss();
                                                    Haptics.selectionAsync();
                                                    if (mapRouteCoords.length <= 1) {
                                                        Alert.alert('Route unavailable', 'Please wait for the route to load.');
                                                        return;
                                                    }
                                                    if (offRouteTimerRef.current) {
                                                        clearTimeout(offRouteTimerRef.current);
                                                        offRouteTimerRef.current = null;
                                                    }
                                                    lastRerouteAtRef.current = 0;
                                                    setCompletedRouteCoords([]);
                                                    setRemainingRouteCoords(mapRouteCoords);
                                                    setIsLiveNavMode(true);
                                                    mapRef.current?.animateCamera({
                                                        center: mapRouteCoords[0],
                                                        pitch: 60,
                                                        heading: 145,
                                                        zoom: 18,
                                                    }, { duration: 1000 });
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

// --- Styles -----------------------------------------------------------------
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
        minWidth: 260,
        ...Platform.select({
            ios: {
                shadowColor: '#8A38F6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
            },
            android: { elevation: 4 },
        }),
    },
    headerMenuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    headerMenuAiIcon: {
        width: 22,
        height: 22,
        borderRadius: 11,
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

    chatArea: { flex: 1, minHeight: 0 },
    messageList: {
        flexGrow: 1,
        paddingHorizontal: S.s4,
        paddingTop: S.s3,
        paddingBottom: S.s4,
    },
    messageListWithInput: {
        paddingBottom: S.s5,
    },

    bubbleRow: {
        flexDirection: 'row',
        marginBottom: 14,
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
        maxWidth: '78%',
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
        fontWeight: '700',
        color: 'rgba(245,245,247,0.66)',
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
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    bubbleOther: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    bubbleOwn: {
        backgroundColor: 'rgba(124,58,237,0.95)',
    },
    bubbleVictim: {
    },

    msgText: {
        fontSize: 14,
        color: '#FFFFFF',
        lineHeight: 20,
    },
    msgTextOwn: {
        color: '#FFFFFF',
    },
    msgTextVictim: {
        color: '#FFFFFF',
    },
    msgTime: {
        fontSize: 10,
        color: 'rgba(245,245,247,0.34)',
        marginTop: 4,
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
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
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
        width: 220,
        maxWidth: '100%',
        height: 180,
        borderRadius: 14,
        backgroundColor: T.surfaceMid,
        alignItems: 'center',
        justifyContent: 'center',
        gap: S.s2,
        overflow: 'hidden',
    },
    imageBubble: {
        paddingVertical: 4,
        paddingHorizontal: 4,
        backgroundColor: 'transparent',
    },
    chatImage: {
        width: '100%',
        height: '100%',
        borderRadius: 14,
    },
    imageLabel: {
        fontSize: 11,
        color: T.ink4,
        fontWeight: '500',
    },

    liveVideoPendingPill: {
        alignSelf: 'center',
        maxWidth: '92%',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 9,
        marginBottom: 8,
        backgroundColor: 'rgba(30,21,58,0.88)',
        borderWidth: 1,
        borderColor: 'rgba(138,56,246,0.28)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    liveVideoPendingText: {
        color: T.ink,
        fontSize: 12,
        fontWeight: '700',
        flexShrink: 1,
    },
    liveVideoBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.62)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    liveVideoCard: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 18,
        backgroundColor: '#1E153A',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        padding: 20,
        alignItems: 'center',
        gap: 12,
    },
    liveVideoUploadCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 18,
        backgroundColor: '#1E153A',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        padding: 20,
        alignItems: 'center',
        gap: 10,
    },
    liveVideoIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#DC2626',
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveVideoTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
    liveVideoBody: { color: T.ink3, fontSize: 13, lineHeight: 19, textAlign: 'center', fontWeight: '600' },
    liveVideoActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    liveVideoButton: { minHeight: 44, borderRadius: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
    liveVideoPrimary: { backgroundColor: '#DC2626' },
    liveVideoSecondary: { backgroundColor: T.surfaceBulky, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
    liveVideoPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    liveVideoSecondaryText: { color: T.ink, fontSize: 13, fontWeight: '800' },

    inputOuter: {
        width: '92%',
        maxWidth: 720,
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
                shadowColor: '#8A38F6',
                shadowOpacity: 0.10,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: -3 },
            },
            android: { elevation: 6 },
        }),
    },
    inputPillBg: {
        backgroundColor: '#1E153A',
        opacity: 0.45,
    },
    inputPill: {
        flexDirection: 'row',
        alignItems: 'flex-end',
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
        maxHeight: 112,
        paddingTop: Platform.OS === 'ios' ? 8 : 6,
        paddingBottom: Platform.OS === 'ios' ? 8 : 6,
        includeFontPadding: false,
        textAlignVertical: 'top',
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
                shadowColor: '#8A38F6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
            },
            android: { elevation: 4 },
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
                shadowColor: '#8A38F6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
            },
            android: { elevation: 4 },
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
    chatErrorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: S.s4,
        marginTop: S.s3,
        paddingHorizontal: S.s3,
        paddingVertical: S.s2,
        borderRadius: R.md,
        backgroundColor: T.dangerLight,
        borderWidth: 1,
        borderColor: T.dangerBorder,
    },
    chatErrorText: {
        flex: 1,
        fontSize: 12,
        color: T.danger,
        fontWeight: '700',
    },
    chatErrorBtn: {
        paddingHorizontal: S.s3,
        paddingVertical: S.s1,
        borderRadius: R.pill,
        backgroundColor: T.danger,
    },
    chatErrorBtnText: {
        fontSize: 12,
        color: T.onPrimary,
        fontWeight: '800',
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
        ...StyleSheet.absoluteFill,
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
    waitingResponderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    waitingResponderIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(138,56,246,0.15)',
    },
    waitingResponderTitle: {
        color: T.ink,
        fontSize: 15,
        fontWeight: '900',
        marginBottom: 2,
    },
    waitingResponderText: {
        color: T.ink3,
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
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
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
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
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 4 },
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
            ios: { shadowColor: '#8A38F6', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 4 },
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
    // -- Live Mode Top Banner ---------------------------------------------
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

    // -- Travel Mode Selector ---------------------------------------------
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

    // -- Review Mode ------------------------------------------------------
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
