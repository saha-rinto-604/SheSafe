import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
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

    return (
        <View
            style={[
                styles.avatarContainer,
                style,
                { width: size, height: size, borderRadius: size / 2, backgroundColor }
            ]}
        >
            {failed || !uri || uri.trim() === '' || uri.includes('pravatar') ? (
                <Ionicons name="person" size={size * 0.58} color={iconColor} />
            ) : (
                <Image
                    source={{ uri }}
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
