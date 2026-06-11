import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

import { T } from '../../constants/theme';

type VideoMessageCardProps = {
  title?: string;
  filename?: string | null;
  onPress: () => void;
};

type PlayerModalProps = {
  visible: boolean;
  sourceUri?: string | null;
  title?: string;
  onClose: () => void;
};

export function VideoMessageCard({
  title = 'Live Safety Video',
  filename,
  onPress,
}: VideoMessageCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.82} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Feather name="play" size={18} color="#FFFFFF" />
      </View>
      <View style={styles.cardTextCol}>
        <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>{filename || 'Tap to play video'}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={T.ink4} />
    </TouchableOpacity>
  );
}

function PlayerContent({ sourceUri, title, onClose }: { sourceUri: string; title: string; onClose: () => void }) {
  const [firstFrameLoaded, setFirstFrameLoaded] = useState(false);
  const player = useVideoPlayer(sourceUri, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    try {
      player.play();
    } catch {
      Alert.alert('Live Safety Video', 'Video could not be played on this device.');
    }
    return () => {
      try {
        player.pause();
      } catch {
        // Ignore cleanup failures from native player teardown.
      }
    };
  }, [player]);

  return (
    <View style={styles.modalRoot}>
      <View style={styles.modalHeader}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.modalTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.videoShell}>
        {!firstFrameLoaded && (
          <View style={styles.videoPlaceholder}>
            <Feather name="video" size={28} color={T.ink4} />
            <Text style={styles.placeholderText}>Loading video...</Text>
          </View>
        )}
        <VideoView
          style={styles.video}
          player={player}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
          onFirstFrameRender={() => setFirstFrameLoaded(true)}
        />
      </View>
    </View>
  );
}

export function LiveSafetyVideoPlayerModal({
  visible,
  sourceUri,
  title = 'Live Safety Video',
  onClose,
}: PlayerModalProps) {
  return (
    <Modal visible={visible && !!sourceUri} animationType="slide" presentationStyle="fullScreen">
      {sourceUri ? (
        <PlayerContent sourceUri={sourceUri} title={title} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 236,
    maxWidth: '100%',
    minHeight: 72,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextCol: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: T.ink4,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#050507',
  },
  modalHeader: {
    minHeight: 76,
    paddingTop: 28,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  videoShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  video: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: '88%',
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  placeholderText: {
    color: T.ink4,
    fontSize: 13,
    fontWeight: '700',
  },
});
