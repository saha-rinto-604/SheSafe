import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Animated,
    Easing,
    Dimensions,
    StatusBar,
    Platform,
    Modal,
    Image,
    ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Theme } from '../../src/constants/theme';

const { width, height } = Dimensions.get('window');
const T = Theme.colors;

const DEFAULT_REGION = {
    latitude: 23.8103,
    longitude: 90.4125,
    latitudeDelta: 0.014,
    longitudeDelta: 0.014,
};

// ────────────────────────────────────────────────────────────────────────────
// Drawer
// ────────────────────────────────────────────────────────────────────────────
function Drawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const slideX = useRef(new Animated.Value(-width * 0.76)).current;

    useEffect(() => {
        Animated.spring(slideX, {
            toValue: visible ? 0 : -width * 0.76,
            useNativeDriver: true,
            tension: 60,
            friction: 12,
        }).start();
    }, [visible]);

    const items: { icon: React.ComponentProps<typeof Feather>['name']; label: string }[] = [
        { icon: 'home', label: 'Home' },
        { icon: 'message-circle', label: 'Group Chat' },
        { icon: 'activity', label: 'Medical Help' },
        { icon: 'phone-call', label: 'Emergency Contacts' },
        { icon: 'settings', label: 'Settings' },
        { icon: 'log-out', label: 'Logout' },
    ];

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <TouchableOpacity style={s.drawerOverlay} activeOpacity={1} onPress={onClose} />
            <Animated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
                <LinearGradient
                    colors={['#7C3AED', '#4C1D95']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.drawerHeader}
                >
                    <View style={s.drawerAvatarRing}>
                        <Feather name="shield" size={28} color="#fff" />
                    </View>
                    <Text style={s.drawerAppName}>ResQher</Text>
                    <Text style={s.drawerSub}>Emergency Assistance Platform</Text>
                </LinearGradient>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                    {items.map((item, i) => (
                        <TouchableOpacity key={i} style={s.drawerItem} onPress={onClose} activeOpacity={0.65}>
                            <View style={s.drawerIconBox}>
                                <Feather name={item.icon} size={19} color={T.primary} />
                            </View>
                            <Text style={s.drawerItemLabel}>{item.label}</Text>
                            <Feather name="chevron-right" size={15} color={T.muted} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </Animated.View>
        </Modal>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Screen
// ────────────────────────────────────────────────────────────────────────────
export default function SOSScreen() {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Home');
    const [sosPressCount, setSosPressCount] = useState(0);
    const [isTracking, setIsTracking] = useState(false);

    const [currentRegion, setCurrentRegion] = useState(DEFAULT_REGION);
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
    const [address, setAddress] = useState('Detecting location...');

    // Animations
    const ring1Scale = useRef(new Animated.Value(1)).current;
    const ring1Op = useRef(new Animated.Value(0.4)).current;
    const btnScale = useRef(new Animated.Value(1)).current;

    // ── Location init ───────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setAddress('Location access denied');
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const { latitude, longitude } = pos.coords;
            setUserLoc({ latitude, longitude });
            const r = { latitude, longitude, latitudeDelta: 0.009, longitudeDelta: 0.009 };
            setCurrentRegion(r);
            setTimeout(() => mapRef.current?.animateToRegion(r, 800), 500);

            const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geo.length > 0) {
                const g = geo[0];
                setAddress((`${g.street ?? ''} ${g.city ?? g.region ?? ''}`).trim() || 'Custom location');
            } else {
                setAddress('Current location found');
            }
        })();
    }, []);

    // ── Live Tracking ───────────────────────────────────────────
    useEffect(() => {
        let watchSub: Location.LocationSubscription;
        if (isTracking) {
            (async () => {
                watchSub = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, distanceInterval: 5 },
                    (loc) => {
                        const { latitude, longitude } = loc.coords;
                        setUserLoc({ latitude, longitude });
                        mapRef.current?.animateToRegion({
                            latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005
                        }, 800);
                    }
                );
            })();
        }
        return () => {
            if (watchSub) watchSub.remove();
        };
    }, [isTracking]);

    // ── Pulse loop ─────────────────────────────────────────
    useEffect(() => {
        const loop = () => {
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(ring1Scale, { toValue: 1.4, duration: 2000, easing: Easing.out(Easing.sin), useNativeDriver: true }),
                    Animated.timing(ring1Scale, { toValue: 1, duration: 10, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(ring1Op, { toValue: 0, duration: 2000, useNativeDriver: true }),
                    Animated.timing(ring1Op, { toValue: 0.4, duration: 10, useNativeDriver: true }),
                ]),
            ]).start(() => loop());
        };
        loop();
    }, []);

    // ── SOS actions ────────────────────────────────────────────────
    const handleSOS = useCallback(() => {
        Animated.sequence([
            Animated.timing(btnScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
            Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 90, friction: 5 }),
        ]).start();

        if (isTracking) {
            // Already tracking, tap to stop
            Alert.alert('Cancel SOS', 'Are you sure you want to stop tracking?', [
                { text: 'No' },
                {
                    text: 'Yes', onPress: () => {
                        setIsTracking(false);
                        setSosPressCount(0);
                    }
                }
            ]);
            return;
        }

        const newCount = sosPressCount + 1;
        setSosPressCount(newCount);

        if (newCount >= 3) {
            setIsTracking(true);
            Alert.alert(
                'SOS Triggered',
                'Your real-time location is now being tracked and shared with authorities/contacts.',
                [{ text: 'OK' }]
            );
        }
    }, [sosPressCount, isTracking]);

    // Format remaining clicks
    const renderSubTxt = () => {
        if (isTracking) return 'Tracking...\nTap to stop';
        const remaining = 3 - sosPressCount;
        return remaining === 1 ? 'Press 1 more time' : `Press ${remaining} times`;
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
            <Drawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

            {/* ── HEADER ─────────────────────────────────────── */}
            <View style={[s.header, { paddingTop: Math.max(insets.top, 20) }]}>
                <Image
                    source={require('../../assets/images/icon.png')}
                    style={s.headerLogo}
                    resizeMode="contain"
                />

                <View style={s.headerLocBox}>
                    <View style={s.headerLocTitleRow}>
                        <Feather name="map-pin" size={11} color={T.text} />
                        <Text style={s.headerLocTitle}>Current location</Text>
                    </View>
                    <Text style={s.headerLocText} numberOfLines={1}>{address}</Text>
                </View>

                {/* Right area placeholders from screenshot: Notification & Hamburger side by side */}
                <TouchableOpacity style={s.headerBtn} activeOpacity={0.7}>
                    <Feather name="bell" size={20} color={T.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[s.headerBtn, { marginLeft: 8 }]} activeOpacity={0.7} onPress={() => setDrawerOpen(true)}>
                    <Feather name="menu" size={22} color={T.text} />
                </TouchableOpacity>
            </View>

            {/* ── MAP & BODY ───────────────────────────────────────── */}
            <View style={s.bodyWrap}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={DEFAULT_REGION}
                    showsUserLocation={false}
                    showsCompass={false}
                    mapType="standard"
                >
                    {userLoc && (
                        <Marker coordinate={userLoc} tracksViewChanges={false}>
                            <View style={s.markerOuter}><View style={s.markerInner} /></View>
                        </Marker>
                    )}
                </MapView>

                {/* Optional Blur Overlay */}
                {!isTracking && (
                    <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
                )}

                {/* Center SOS component */}
                <View style={s.centerOverlayWrap} pointerEvents="box-none">
                    <View style={s.sosBaseBg}>
                        {/* Outer pulsating ring */}
                        <Animated.View
                            style={[
                                s.sosRing,
                                {
                                    transform: [{ scale: ring1Scale }],
                                    opacity: ring1Op,
                                    backgroundColor: isTracking ? '#EF4444' : T.primaryLight,
                                },
                            ]}
                        />
                        {/* Actual button */}
                        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                            <TouchableOpacity activeOpacity={0.9} onPress={handleSOS}>
                                <LinearGradient
                                    colors={isTracking ? ['#EF4444', '#B91C1C'] : ['#E9D5FF', '#7C3AED']}
                                    start={{ x: 0.2, y: 0.1 }}
                                    end={{ x: 0.8, y: 0.9 }}
                                    style={s.sosBtnInner}
                                >
                                    <Text style={s.sosBtnText}>SOS</Text>
                                    <Text style={s.sosBtnSub}>{renderSubTxt()}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </View>

                {/* ── FLOATING NAVBAR ───────────────────────────────────── */}
                <View style={[s.floatNavContainer, { paddingBottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
                    <View style={s.floatNavBg}>
                        {[
                            { id: 'Home', icon: 'home' },
                            { id: 'Chat', icon: 'message-circle' },
                            { id: 'Explore', icon: 'compass' },
                            { id: 'Medical', icon: 'activity' },
                        ].map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={s.floatNavTab}
                                    onPress={() => setActiveTab(tab.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[s.navIconBox, isActive && s.navIconBoxActive]}>
                                        <Feather name={tab.icon as any} size={20} color={isActive ? T.primary : T.muted} />
                                    </View>
                                    <Text style={[s.navLabel, isActive && s.navLabelActive]}>{tab.id}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </View>
    );
}



// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#ffffff' },

    // ── Header
    header: {
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        zIndex: 10,
    },
    headerLogo: {
        width: 38,
        height: 38,
        marginRight: 10,
    },
    headerLocBox: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 8,
    },
    headerLocTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    headerLocTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: T.mutedDark,
        marginLeft: 4,
    },
    headerLocText: {
        fontSize: 15,
        fontWeight: '800',
        color: T.text,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f8f9fa',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Body & Map
    bodyWrap: {
        flex: 1,
        position: 'relative',
        backgroundColor: T.background,
    },
    markerOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(124,58,237,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: T.primary,
        borderWidth: 2,
        borderColor: '#fff',
    },

    // ── SOS Overlay
    centerOverlayWrap: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    sosBaseBg: {
        width: 320,
        height: 320,
        borderRadius: 160,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sosRing: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
    },
    sosBtnInner: {
        width: 170,
        height: 170,
        borderRadius: 85,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: T.primaryDark,
        shadowOpacity: 0.3,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    sosBtnText: {
        color: '#ffffff',
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: 2,
        textShadowColor: 'rgba(0,0,0,0.15)',
        textShadowRadius: 8,
        textShadowOffset: { width: 0, height: 2 },
    },
    sosBtnSub: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 4,
        textAlign: 'center',
        lineHeight: 18,
    },

    // ── Floating Nav
    floatNavContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 20,
    },
    floatNavBg: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        width: '92%',
        borderRadius: 24,
        paddingVertical: 14,
        paddingHorizontal: 12,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 15,
        marginBottom: 8,
    },
    floatNavTab: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    navIconBox: {
        width: 44,
        height: 34,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navIconBoxActive: {
        // Active background style similar to new designs
        backgroundColor: 'transparent',
    },
    navLabel: {
        fontSize: 10,
        fontWeight: '500',
        color: T.muted,
        marginTop: 4,
    },
    navLabelActive: {
        color: T.primary,
        fontWeight: '700',
    },

    // ── Drawer
    drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30,27,75,0.45)' },
    drawer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.76, backgroundColor: T.surface },
    drawerHeader: { paddingTop: 60, paddingBottom: 30, paddingHorizontal: 22 },
    drawerAvatarRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    drawerAppName: { color: '#fff', fontSize: 22, fontWeight: '800' },
    drawerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
    drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
    drawerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.07)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    drawerItemLabel: { flex: 1, fontSize: 15, color: T.text, fontWeight: '600' },
});
