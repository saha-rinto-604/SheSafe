import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/theme';
import { API_BASE_URL } from '../../services/api';

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
    const resolvedUri = React.useMemo(() => {
        const trimmed = uri?.trim();
        if (!trimmed) return null;
        if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('file:') || trimmed.startsWith('data:')) {
            return trimmed;
        }
        const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        return `${API_BASE_URL}${path}`;
    }, [uri]);

    React.useEffect(() => {
        setFailed(false);
    }, [resolvedUri]);

    return (
        <View
            style={[
                styles.avatarContainer,
                { width: size, height: size, borderRadius: size / 2, backgroundColor },
                style,
            ]}
        >
            {failed || !resolvedUri || resolvedUri.includes('pravatar') ? (
                <Ionicons name="person" size={size * 0.58} color={iconColor} />
            ) : (
                <Image
                    source={{ uri: resolvedUri }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    onError={() => setFailed(true)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    avatarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: T.violetDim,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
});
