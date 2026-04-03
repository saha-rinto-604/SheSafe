import React, { useState } from 'react';
import { View, TextInput, StyleSheet, FlatList, TouchableOpacity, Text, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, Ty, S, R, Sh } from '../constants/theme';
import { DHAKA_PLACES, PlaceSuggestion } from '../data/dhakaPlaces';

interface Props {
    onSelectPlace: (place: PlaceSuggestion) => void;
}

export default function MapSearchBar({ onSelectPlace }: Props) {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const filteredPlaces = query.trim() === '' 
        ? [] 
        : DHAKA_PLACES.filter(p => 
            p.name.toLowerCase().includes(query.toLowerCase()) || 
            p.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
          ).slice(0, 5); // limit to top 5 suggestions

    const handleSelect = (place: PlaceSuggestion) => {
        setQuery(place.name);
        setIsFocused(false);
        onSelectPlace(place);
    };

    return (
        <View style={st.container}>
            <View style={[st.inputWrapper, isFocused && st.inputWrapperFocused]}>
                <Feather name="search" size={20} color={isFocused ? T.violet : T.inputIconDefault} style={st.icon} />
                <TextInput
                    style={st.input}
                    placeholder="Search areas in Dhaka..."
                    placeholderTextColor={T.ink5}
                    value={query}
                    onChangeText={setQuery}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 100)} // allow tap to register
                    returnKeyType="search"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Feather name="x-circle" size={18} color={T.ink4} />
                    </TouchableOpacity>
                )}
            </View>

            {isFocused && filteredPlaces.length > 0 && (
                <View style={st.suggestionsBox}>
                    <FlatList
                        data={filteredPlaces}
                        keyExtractor={item => item.id}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity style={st.item} onPress={() => handleSelect(item)}>
                                <View style={st.itemIconBg}>
                                    <Feather name="map-pin" size={14} color={T.ink2} />
                                </View>
                                <View style={st.itemTexts}>
                                    <Text style={st.itemName}>{item.name}</Text>
                                    <Text style={st.itemAddress}>{item.address}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}
        </View>
    );
}

const st = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: S.s4,
        right: S.s4,
        zIndex: 100,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.surfaceBulky,
        borderRadius: R.full,
        paddingHorizontal: S.s3,
        height: 52,
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        ...(Platform.OS === 'ios' ? Sh.card.ios : Sh.card.android),
    },
    inputWrapperFocused: {
        borderColor: T.violetDark,
        backgroundColor: T.surfaceBulkyActive,
    },
    icon: {
        marginRight: S.s2,
    },
    input: {
        flex: 1,
        ...Ty.bodyMd,
        color: T.ink,
        paddingVertical: 0,
    },
    suggestionsBox: {
        marginTop: S.s2,
        backgroundColor: T.surfaceGlass,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: T.hairlineMicro,
        overflow: 'hidden',
        ...(Platform.OS === 'ios' ? Sh.card.ios : Sh.card.android),
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: S.s3,
        borderBottomWidth: 1,
        borderBottomColor: T.hairlineMicro,
    },
    itemIconBg: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: T.surfaceDark,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: S.s3,
    },
    itemTexts: {
        flex: 1,
    },
    itemName: {
        ...Ty.bodyMd,
        fontWeight: '600',
        color: T.ink,
    },
    itemAddress: {
        ...Ty.bodySm,
        color: T.ink3,
        marginTop: 2,
    },
});
