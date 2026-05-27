import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../../constants/theme';
import UserAvatar from './UserAvatar';

export type GroupChatAvatarParticipant = {
    id?: string | number | null;
    name?: string | null;
    role?: string | null;
    photoUri?: string | null;
    photoUrl?: string | null;
    profilePhoto?: string | null;
    avatarUrl?: string | null;
    active?: boolean | null;
    status?: string | null;
    leftAt?: string | null;
    left_at?: string | null;
    archivedAt?: string | null;
    archived_at?: string | null;
    deletedForUserAt?: string | null;
    deleted_for_user_at?: string | null;
};

type GroupChatAvatarProps = {
    participants?: GroupChatAvatarParticipant[];
    size?: number;
    isLive?: boolean;
};

function participantPhoto(participant: GroupChatAvatarParticipant): string | null {
    return participant.photoUri
        ?? participant.photoUrl
        ?? participant.profilePhoto
        ?? participant.avatarUrl
        ?? null;
}

function isActiveParticipant(participant: GroupChatAvatarParticipant): boolean {
    const status = String(participant.status ?? '').toUpperCase();
    if (participant.active === false) return false;
    if (participant.leftAt || participant.left_at) return false;
    if (participant.archivedAt || participant.archived_at) return false;
    if (participant.deletedForUserAt || participant.deleted_for_user_at) return false;
    if (status === 'LEFT' || status === 'REMOVED' || status === 'INACTIVE' || status === 'ARCHIVED') return false;
    return true;
}

export default function GroupChatAvatar({
    participants = [],
    size = 44,
    isLive = false,
}: GroupChatAvatarProps) {
    const visibleParticipants = participants.filter(isActiveParticipant).slice(0, 2);
    const singleSize = size - 2;
    const stackedSize = Math.round(size * 0.68);

    return (
        <View style={[styles.wrap, { width: size, height: size }]}>
            {visibleParticipants.length <= 1 ? (
                <View style={[styles.singleFrame, isLive ? styles.liveFrame : styles.idleFrame, { width: size, height: size, borderRadius: 12 }]}>
                    <UserAvatar uri={participantPhoto(visibleParticipants[0] ?? {})} size={singleSize} />
                </View>
            ) : (
                <View style={[styles.stackFrame, isLive ? styles.liveFrame : styles.idleFrame, { width: size, height: size, borderRadius: 12 }]}>
                    <View style={[styles.avatarBack, { width: stackedSize, height: stackedSize, borderRadius: stackedSize / 2 }]}>
                        <UserAvatar uri={participantPhoto(visibleParticipants[0])} size={stackedSize} />
                    </View>
                    <View style={[styles.avatarFront, { width: stackedSize, height: stackedSize, borderRadius: stackedSize / 2 }]}>
                        <UserAvatar uri={participantPhoto(visibleParticipants[1])} size={stackedSize} />
                    </View>
                </View>
            )}
            {isLive && <View style={styles.liveDot} />}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexShrink: 0,
    },
    singleFrame: {
        borderWidth: 1,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stackFrame: {
        borderWidth: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    liveFrame: {
        backgroundColor: T.violetDim,
        borderColor: T.violet,
    },
    idleFrame: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    avatarBack: {
        position: 'absolute',
        left: 2,
        top: 3,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#0A0A12',
    },
    avatarFront: {
        position: 'absolute',
        right: 2,
        bottom: 3,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#0A0A12',
    },
    liveDot: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: T.danger,
        borderWidth: 1.5,
        borderColor: '#120B22',
        zIndex: 10,
    },
});
