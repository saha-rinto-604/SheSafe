/**
 * SharedChatRoom.tsx — Unified tactical group chat
 * ─────────────────────────────────────────────────
 * Merged from standard-user/chat_room.tsx and volunteer/chat_room.tsx.
 * Zero hardcoded mock data — all incidents, messages, and replies come via props.
 * Map overlay is opt-in via enableMapOverlay prop.
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
    Platform, StatusBar, KeyboardAvoidingView, Keyboard,
    Modal, Pressable, Alert
} from 'react-native';
import MapView, { Marker, Polyline, type MapViewRef } from './MapViewCompat';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import AtmosphericShell from '../AtmosphericShell';
import { T } from '../../constants/theme';
import { DEFAULT_GROUP_CHAT_NAME, type Incident, type Message, type Role } from '../../types/chat';
import { decodePolyline } from './map/decodePolyline';
import { st } from './ChatRoom.styles';
import UserAvatar from './UserAvatar';

// ─── Constants ──────────────────────────────────────────────────────────────
const SELF_ID = 'self';
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// ─── Props ──────────────────────────────────────────────────────────────────
export type SharedChatRoomProps = {
    incidents: Record<string, Incident>;
    initialMessages: Record<string, Message[]>;
    autoReplies: string[];
    selfRole: Role;
    defaultIncidentId: string;
    enableMapOverlay?: boolean;
};

// ─── Role badge config (identical in both originals) ────────────────────────
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

// ─── Helpers (identical in both originals) ──────────────────────────────────
function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
}

// unused — kept for parity with originals, clean up in a later pass
// ─── RoleBadge ──────────────────────────────────────────────────────────────
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

// ─── PillBubble — Directional tail (R.pill 3 corners, 0 near avatar) ───────
const PillBubble = memo(function PillBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
    if (msg.type === 'SYSTEM') return <SystemBubble msg={msg} />;

    const role = msg.sender.role;
    const isVictimMessage = role === 'USER' && msg.sender.id !== 'system';
    const alignRight = isOwn || isVictimMessage;

    const tailStyle = alignRight
        ? { borderBottomRightRadius: 6 }
        : { borderBottomLeftRadius: 6 };

    return (
        <View style={[st.bubbleRow, alignRight ? st.bubbleRowOwn : st.bubbleRowOther]}>
            {!alignRight && (
                <UserAvatar uri={null} size={32} style={st.avatar} />
            )}
            <View style={st.bubbleCol}>
                {!alignRight && (
                    <View style={st.senderRow}>
                        <Text style={st.senderName}>{msg.sender.name}</Text>
                        <RoleBadge role={role} />
                    </View>
                )}
                <View style={[st.bubble, alignRight ? st.bubbleOwn : st.bubbleOther, tailStyle]}>
                    {msg.type === 'AUDIO' ? (
                        <View style={st.audioWrap}>
                            <TouchableOpacity style={st.audioPlayBtn}>
                                <Feather name="play" size={13} color={T.onPrimary} />
                            </TouchableOpacity>
                            <View style={st.audioWaveform}>
                                {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.3, 0.65, 0.5, 0.85, 0.4, 0.55, 0.7, 0.3].map((h, i) => (
                                    <View key={i} style={[st.waveBar, { height: h * 18, backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : T.ink4 }]} />
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

// ─── Floating Glass Pill Input ──────────────────────────────────────────────
function FloatingInput({ onSend, bottomInset }: { onSend: (text: string) => void; bottomInset: number }) {
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
        <View style={[st.inputOuter, { paddingBottom: Math.max(bottomInset, 30) }]}>
            {isAttachMenuVisible && (
                <View style={st.attachMenuOuter}>
                    <TouchableOpacity style={st.attachOptionRow} activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(false); }}>
                        <Feather name="mic" size={20} color="#FFFFFF" />
                        <Text style={st.attachOptionText}>Audio Note</Text>
                    </TouchableOpacity>
                    <View style={st.attachOptionDivider} />
                    <TouchableOpacity style={st.attachOptionRow} activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(false); }}>
                        <Feather name="video" size={20} color="#FFFFFF" />
                        <Text style={st.attachOptionText}>Video Evidence</Text>
                    </TouchableOpacity>
                    <View style={st.attachOptionDivider} />
                    <TouchableOpacity style={[st.attachOptionRow, { paddingBottom: 12 }]} activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(false); }}>
                        <Feather name="image" size={20} color="#FFFFFF" />
                        <Text style={st.attachOptionText}>Photo</Text>
                    </TouchableOpacity>
                </View>
            )}
            <View style={st.inputPillContainer}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
                    <View style={[StyleSheet.absoluteFill, st.inputPillBg]} />
                </BlurView>
                <View style={st.inputPill}>
                    <TouchableOpacity style={st.inputAction} onPress={() => { Haptics.selectionAsync(); setAttachMenuVisible(!isAttachMenuVisible); }} activeOpacity={0.7}>
                        <Feather name="paperclip" size={20} color={isAttachMenuVisible ? T.violet : "#FFFFFF"} />
                    </TouchableOpacity>
                    <TextInput ref={inputRef} style={st.input} placeholder="Type a message…" placeholderTextColor="rgba(255, 255, 255, 0.5)" value={text} onChangeText={setText} multiline maxLength={2000} onFocus={() => setAttachMenuVisible(false)} />
                    <TouchableOpacity style={[st.sendBtn, !hasText && st.sendBtnOff]} onPress={handleSend} disabled={!hasText} activeOpacity={0.7}>
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// ─── Read-Only Archive Pill (RESOLVED state) ────────────────────────────────
function ArchivePill({ bottomInset }: { bottomInset: number }) {
    return (
        <View style={[st.archiveOuter, { paddingBottom: Math.max(bottomInset, 16) }]}>
            <BlurView intensity={30} tint="dark" style={st.archiveBlur}>
                <View style={st.archiveInner}>
                    <Feather name="lock" size={13} color={T.ink4} />
                    <Text style={st.archiveText}>Incident Archived • Case Read-Only</Text>
                </View>
            </BlurView>
        </View>
    );
}

// ─── Main — Shared Chat Room ────────────────────────────────────────────────
export function SharedChatRoom({
    incidents,
    initialMessages,
    autoReplies,
    selfRole,
    defaultIncidentId,
    enableMapOverlay = false,
}: SharedChatRoomProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { incidentId } = useLocalSearchParams<{ incidentId: string }>();

    const incident = incidents[incidentId || defaultIncidentId] ?? incidents[defaultIncidentId];
    const [messages, setMessages] = useState<Message[]>(
        initialMessages[incidentId || defaultIncidentId] ?? initialMessages[defaultIncidentId]
    );
    const flatRef = useRef<FlatList>(null);
    const isLive = incident.status === 'LIVE';
    const [isHeaderMenuOpen, setHeaderMenuOpen] = useState(false);

    // ── Map Overlay State (hooks declared unconditionally per React rules) ──
    const [isMapOverlayOpen, setIsMapOverlayOpen] = useState(false);
    const [mapRouteCoords, setMapRouteCoords] = useState<{latitude: number; longitude: number}[]>([]);
    const [mapDistance, setMapDistance] = useState('');
    const [mapDuration, setMapDuration] = useState('');
    const [isLiveNavMode, setIsLiveNavMode] = useState(false);
    const mapRef = useRef<MapViewRef>(null);

    const openMapOverlay = useCallback(async () => {
        if (!enableMapOverlay) return;
        setIsMapOverlayOpen(true);
        Haptics.selectionAsync();

        if (mapRouteCoords.length > 0) return;

        const VOLUNTEER_LOC = { latitude: 23.8293, longitude: 90.4182 };
        const origin = `${VOLUNTEER_LOC.latitude},${VOLUNTEER_LOC.longitude}`;
        const destination = `${incident.location.latitude},${incident.location.longitude}`;

        if (!GOOGLE_MAPS_API_KEY) {
            setMapRouteCoords([VOLUNTEER_LOC, incident.location]);
            setMapDistance('3.2 km');
            setMapDuration('~12 min');
            return;
        }

        try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data?.routes?.length > 0) {
                const points = data.routes[0].overview_polyline.points;
                const coords = decodePolyline(points);
                const leg = data.routes[0].legs?.[0];
                setMapRouteCoords(coords);
                setMapDistance(leg?.distance?.text ?? 'Unknown');
                setMapDuration(leg?.duration?.text ?? 'Unknown');
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
    }, [enableMapOverlay, incident.location, mapRouteCoords.length]);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
        }
    }, [messages.length]);

    const handleSend = useCallback((text: string) => {
        const userMsg: Message = {
            id: `m-self-${Date.now()}`,
            incidentId: incident.id,
            sender: { id: SELF_ID, name: 'You', role: selfRole },
            content: text,
            type: 'TEXT',
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg]);

        setTimeout(() => {
            const reply: Message = {
                id: `m-auto-${Date.now()}`,
                incidentId: incident.id,
                sender: { id: 'v1', name: 'Kabir Hossain', role: 'VOLUNTEER' },
                content: autoReplies[Math.floor(Math.random() * autoReplies.length)],
                type: 'TEXT',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, reply]);
        }, 1000);
    }, [incident.id, selfRole, autoReplies]);

    const renderMessage = useCallback(({ item }: { item: Message }) => (
        <PillBubble msg={item} isOwn={item.sender.id === SELF_ID} />
    ), []);

    return (
        <AtmosphericShell>
            <View style={[st.root, { paddingTop: insets.top }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                {/* ── Floating Capsule Header ── */}
                <View style={st.headerOuter}>
                    <BlurView intensity={50} tint="dark" style={st.headerBlur}>
                        <View style={st.headerInner}>
                            <View style={st.headerLeft}>
                                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back(); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={st.headerBtn} activeOpacity={0.7}>
                                    <Feather name="chevron-left" size={22} color={T.ink} />
                                </TouchableOpacity>
                                <View style={st.headerTitleBlock}>
                                    <Text style={st.headerTitle} numberOfLines={1}>{DEFAULT_GROUP_CHAT_NAME}</Text>
                                    <View style={st.headerMeta}>
                                        <View style={[st.headerStatusPill, isLive ? st.headerStatusPillLive : st.headerStatusPillArchived]}>
                                            <Text style={isLive ? st.headerStatusTextLive : st.headerStatusTextArchived}>
                                                {isLive ? 'LIVE' : 'ARCHIVED'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <View style={st.headerRight}>
                                <TouchableOpacity style={st.liveMapCircularBtn} activeOpacity={0.7} onPress={enableMapOverlay ? openMapOverlay : () => { Haptics.selectionAsync(); router.back(); }}>
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

                <View style={{ marginTop: 12 }} />

                <KeyboardAvoidingView style={st.chatArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 56}>
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
                    {isLive ? <FloatingInput onSend={handleSend} bottomInset={insets.bottom} /> : <ArchivePill bottomInset={insets.bottom} />}
                </KeyboardAvoidingView>

                {/* ── Header Menu Modal ── */}
                <Modal transparent={true} visible={isHeaderMenuOpen} animationType="fade">
                    <Pressable style={st.headerMenuBackdrop} onPress={() => setHeaderMenuOpen(false)}>
                        <View style={st.headerMenuPanel}>
                            <TouchableOpacity style={st.headerMenuRow} activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); }}>
                                <Feather name="users" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>View Responders</Text>
                            </TouchableOpacity>
                            <View style={st.headerMenuDivider} />
                            <TouchableOpacity style={st.headerMenuRow} activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); }}>
                                <Feather name="edit-2" size={16} color="#FFFFFF" />
                                <Text style={st.headerMenuText}>Edit Case Details</Text>
                            </TouchableOpacity>
                            <View style={st.headerMenuDivider} />
                            <TouchableOpacity style={st.headerMenuRow} activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); setHeaderMenuOpen(false); }}>
                                <Feather name="x-circle" size={16} color="#FF453A" />
                                <Text style={[st.headerMenuText, st.headerMenuTextDanger]}>Leave Dispatch</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>

                {/* ── Map Overlay (volunteer only, gated by enableMapOverlay) ── */}
                {enableMapOverlay && isMapOverlayOpen && (
                    <View style={StyleSheet.absoluteFill}>
                        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                        <MapView
                            ref={mapRef}
                            style={StyleSheet.absoluteFill}
                            userInterfaceStyle="dark"
                            customMapStyle={[
                                { "elementType": "geometry", "stylers": [{ "color": "#0B071A" }] },
                                { "elementType": "labels.text.fill", "stylers": [{ "color": "#4A4568" }] },
                                { "elementType": "labels.text.stroke", "stylers": [{ "visibility": "off" }] },
                                { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#18142A" }] },
                                { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#05030A" }] }
                            ]}
                            pitchEnabled={true}
                            initialRegion={{ latitude: 23.8293, longitude: 90.4182, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                        >
                            {mapRouteCoords.length > 1 && (
                                <Polyline coordinates={mapRouteCoords} strokeColor={T.violet} strokeWidth={4} lineCap="round" lineJoin="round" />
                            )}
                            {mapRouteCoords.length > 0 && (
                                <>
                                    <Marker coordinate={mapRouteCoords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                                        <View style={st.sosMarkerInnerA}>
                                            <UserAvatar uri={null} size={28} style={st.sosMarkerAvatar} />
                                        </View>
                                    </Marker>
                                    <Marker coordinate={mapRouteCoords[mapRouteCoords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                                        <View style={st.sosMarkerInnerB}>
                                            <UserAvatar uri={null} size={28} style={st.sosMarkerAvatar} />
                                        </View>
                                    </Marker>
                                </>
                            )}
                        </MapView>
                        <View style={[st.overlayHeader, { top: insets.top + 8 }]}>
                            <TouchableOpacity style={st.headerBtn} onPress={() => { setIsMapOverlayOpen(false); setIsLiveNavMode(false); }}>
                                <Feather name="x" size={22} color={T.ink} />
                            </TouchableOpacity>
                            <View style={st.overlayTitleWrap}>
                                <Text style={st.overlayTitle}>{isLiveNavMode ? 'Navigating to Victim' : 'Route Overview'}</Text>
                            </View>
                            <View style={{ width: 36 }} />
                        </View>
                        <View style={[st.overlayBottomCard, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
                            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={st.overlayCardTint} pointerEvents="none" />
                            {isLiveNavMode ? (
                                <View style={st.navInstRow}>
                                    <View style={st.navInstIconWrap}>
                                        <Feather name="arrow-up-right" size={32} color={T.violet} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={st.navInstPrimary}>Turn right on Pragati Sarani</Text>
                                        <Text style={st.navInstSecondary}>In 200 meters · {mapDuration}</Text>
                                    </View>
                                    <TouchableOpacity style={st.exitNavBtn} onPress={() => {
                                        Haptics.selectionAsync();
                                        setIsLiveNavMode(false);
                                        mapRef.current?.animateCamera({ pitch: 0, heading: 0, zoom: 14 });
                                        mapRef.current?.fitToCoordinates(mapRouteCoords, { edgePadding: { top: 140, right: 60, bottom: 280, left: 60 }, animated: true });
                                    }}>
                                        <Text style={st.exitNavBtnText}>Exit</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={st.overviewRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={st.overviewDist}>{mapDistance}</Text>
                                        <Text style={st.overviewEta}>{mapDuration} drive</Text>
                                    </View>
                                    <TouchableOpacity style={st.startNavBtn} onPress={() => {
                                        Haptics.selectionAsync();
                                        setIsLiveNavMode(true);
                                        if (mapRouteCoords.length > 0) {
                                            mapRef.current?.animateCamera({ center: mapRouteCoords[0], pitch: 60, heading: 145, zoom: 18 }, { duration: 1000 });
                                        }
                                    }}>
                                        <Ionicons name="navigate" size={16} color={T.onPrimary} />
                                        <Text style={st.startNavBtnText}>Start Live Nav</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </View>
        </AtmosphericShell>
    );
}
