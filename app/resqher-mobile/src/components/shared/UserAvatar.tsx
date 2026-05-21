import React from 'react';
import { View, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/theme';

type UserAvatarProps = {
    uri?: string | null;
    size?: number;
    style?: any;
    iconColor?: string;
    backgroundColor?: string;
};

export default function UserAvatar({ 
    uri, 
    size = 40, 
    style,
    iconColor = T.violet,
    backgroundColor = T.violetDim
}: UserAvatarProps) {
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        setFailed(false);
    }, [uri]);

    // If the URI is missing, falsey, or includes the hardcoded pravatar fallback
    if (failed || !uri || uri.trim() === '' || uri.includes('pravatar')) {
        return (
            <View style={[
                styles.fallbackContainer, 
                style,
                { width: size, height: size, borderRadius: size / 2, backgroundColor }
            ]}>
                <Ionicons name="person" size={size * 0.6} color={iconColor} />
            </View>
        );
    }

    return (
        <Image 
            source={{ uri }} 
            style={[
                style,
                { width: size, height: size, borderRadius: size / 2 }
            ]} 
            resizeMode="cover"
            onError={() => setFailed(true)}
        />
    );
}

const styles = StyleSheet.create({
    fallbackContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: T.lineMid,
    }
});
