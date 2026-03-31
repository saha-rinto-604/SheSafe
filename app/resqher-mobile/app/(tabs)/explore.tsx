import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Image, Platform } from 'react-native';
import MapView, { Marker, Circle, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Feather, Ionicons } from '@expo/vector-icons';
import { T, R, S, Ty, Sh } from '../../src/constants/theme';
import AtmosphericShell from '../../src/components/AtmosphericShell';
import MapSearchBar from '../../src/components/MapSearchBar';
import { generateRandomZoneData, Volunteer } from '../../src/data/mockExplore';
import { PlaceSuggestion } from '../../src/data/dhakaPlaces';

const INITIAL_REGION = {
    latitude: 23.7461, // Dhanmondi Lake
    longitude: 90.3760,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

export default function ExploreScreen() {
    const mapRef = useRef<MapView>(null);
    const [zoneData, setZoneData] = useState<ReturnType<typeof generateRandomZoneData> | null>(null);

    // Initial load: generate zone around center
    React.useEffect(() => {
        setZoneData(generateRandomZoneData(INITIAL_REGION.latitude, INITIAL_REGION.longitude));
    }, []);

    const handleMapPress = (e: any) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        setZoneData(generateRandomZoneData(latitude, longitude));
        
        // Slightly pan to keep it centered
        mapRef.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        }, 500);
    };

    const handleSelectPlace = (place: PlaceSuggestion) => {
        mapRef.current?.animateToRegion({
            latitude: place.latitude,
            longitude: place.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        }, 800);
        
        // Auto generate zone at searched location
        setTimeout(() => {
            setZoneData(generateRandomZoneData(place.latitude, place.longitude));
        }, 850);
    };

    const getZoneColor = (type: string, isStroke = false) => {
        if (type === 'RED') return isStroke ? 'rgba(255, 59, 48, 0.6)' : 'rgba(255, 59, 48, 0.25)';
        return isStroke ? 'rgba(255, 204, 0, 0.8)' : 'rgba(255, 204, 0, 0.3)';
    };

    return (
        <AtmosphericShell>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            
            <MapSearchBar onSelectPlace={handleSelectPlace} />

            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                initialRegion={INITIAL_REGION}
                customMapStyle={darkMapStyle}
                showsUserLocation
                showsMyLocationButton={false}
                onPress={handleMapPress}
                toolbarEnabled={false}
            >
                {zoneData && (
                    <>
                        <Circle
                            center={zoneData.center}
                            radius={zoneData.radiusMeters}
                            fillColor={getZoneColor(zoneData.zoneType, false)}
                            strokeColor={getZoneColor(zoneData.zoneType, true)}
                            strokeWidth={2}
                            zIndex={1}
                        />

                        {zoneData.volunteers.map(vol => (
                            <Marker
                                key={vol.id}
                                coordinate={{ latitude: vol.latitude, longitude: vol.longitude }}
                                zIndex={3}
                            >
                                <View style={st.markerContainer}>
                                    <View style={st.markerDot} />
                                    <View style={st.markerHalo} />
                                </View>
                                <Callout tooltip>
                                    <View style={st.calloutBox}>
                                        <View style={st.calloutHeader}>
                                            <Text style={st.calloutName}>{vol.name}</Text>
                                            {vol.verified && (
                                                <Ionicons name="checkmark-circle" size={14} color={T.success} style={{ marginLeft: 4 }} />
                                            )}
                                        </View>
                                        <Text style={st.calloutRole}>Community Volunteer</Text>
                                        <View style={st.calloutMetaRow}>
                                            <Feather name="map-pin" size={12} color={T.gold} />
                                            <Text style={st.calloutMeta}>{vol.distanceStr}</Text>
                                            <Text style={st.calloutDot}>•</Text>
                                            <Feather name="star" size={12} color={T.gold} />
                                            <Text style={st.calloutMeta}>{vol.rating}</Text>
                                        </View>
                                    </View>
                                    <View style={st.calloutTriangle} />
                                </Callout>
                            </Marker>
                        ))}
                    </>
                )}
            </MapView>
            
            {/* Quick Action Overlay at Bottom */}
            <View style={st.bottomBar}>
               <TouchableOpacity style={st.requestBtn}>
                   <Feather name="shield" size={18} color={T.onPrimary} style={{ marginRight: 8 }} />
                   <Text style={st.requestBtnText}>Request Help Here</Text>
               </TouchableOpacity>
            </View>
        </AtmosphericShell>
    );
}

const st = StyleSheet.create({
    bottomBar: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 80, // Above tab bar
        left: S.s4,
        right: S.s4,
        alignItems: 'center',
    },
    requestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.violet,
        paddingVertical: 14,
        paddingHorizontal: S.s5,
        borderRadius: R.full,
        ...(Platform.OS === 'ios' ? Sh.sosGlow : Sh.card.android),
    },
    requestBtnText: {
        ...Ty.btn,
    },
    markerContainer: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: T.success,
        borderWidth: 2,
        borderColor: '#000',
        zIndex: 2,
    },
    markerHalo: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(16, 185, 129, 0.2)', // T.success tint
        zIndex: 1,
    },
    calloutBox: {
        backgroundColor: T.surfaceBulky,
        padding: S.s3,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: T.lineMid,
        minWidth: 180,
    },
    calloutHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    calloutName: {
        ...Ty.bodyMd,
        fontWeight: '700',
        color: T.ink,
    },
    calloutRole: {
        ...Ty.label,
        color: T.violetLight,
        marginTop: 2,
        marginBottom: 6,
    },
    calloutMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    calloutMeta: {
        ...Ty.helper,
        color: T.ink3,
        marginLeft: 4,
    },
    calloutDot: {
        color: T.ink5,
        marginHorizontal: 6,
    },
    calloutTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: T.surfaceBulky,
        alignSelf: 'center',
        marginTop: -1,
    }
});

// Snazzy Maps Tactical Dark Style 
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#111113" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111113" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8E8E93" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#E5E5EA" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#636366" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1A1A1E" }]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#48484A" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2C2C2E" }]
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1A1A1E" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8E8E93" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3A3A3C" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#111113" }]
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#E5E5EA" }]
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2C2C2E" }]
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8E8E93" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#090514" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#48484A" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#111113" }]
  }
];
