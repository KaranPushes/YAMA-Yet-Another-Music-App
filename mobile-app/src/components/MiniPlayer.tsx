import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { usePlayer } from '../player/PlayerContext';
import { colors } from '../theme/colors';
import { ArtworkImage } from './ArtworkImage';
import { Play, Pause, SkipForward, Heart } from 'lucide-react-native';
import { PixelPlayIcon, PixelPauseIcon } from './PixelIcons';
import { PlaylistStorage } from '../cache/PlaylistStorage';

interface MiniPlayerProps {
  onPress: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onPress }) => {
  const { state, controls } = usePlayer();
  const [isLiked, setIsLiked] = useState<boolean>(false);

  useEffect(() => {
    if (state.currentSong) {
      PlaylistStorage.isSongLiked(state.currentSong.id).then(setIsLiked);
    }
    const unsubscribe = PlaylistStorage.addChangeListener(() => {
      if (state.currentSong) {
        PlaylistStorage.isSongLiked(state.currentSong.id).then(setIsLiked);
      }
    });
    return () => unsubscribe();
  }, [state.currentSong?.id]);

  if (!state.currentSong) {
    return null;
  }

  const { currentSong, isPlaying, isBuffering, positionSeconds, durationSeconds, activeSectionIndex } = state;
  const progress = durationSeconds > 0 ? (positionSeconds / durationSeconds) * 100 : 0;
  const sectionCount = currentSong.sections ? currentSong.sections.length : 0;

  const handleToggleLike = async () => {
    if (!currentSong) return;
    const next = await PlaylistStorage.toggleLikeSong(currentSong.id);
    setIsLiked(next);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Retro 8-bit Micro Progress Bar */}
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.contentRow}>
        <View style={styles.artFrame}>
          <ArtworkImage
            songId={currentSong.id}
            hasArtwork={currentSong.hasArtwork}
            title={currentSong.title}
            artist={currentSong.artist}
            size={42}
            borderRadius={3}
          />
          <View style={styles.bgmBadge}>
            <Text style={styles.bgmBadgeText}>BGM</Text>
          </View>
        </View>

        <View style={styles.metaContainer}>
          <Text numberOfLines={1} style={styles.title}>
            {currentSong.title}
          </Text>
          <View style={styles.artistRow}>
            <Text numberOfLines={1} style={styles.artist}>
              {currentSong.artist}
            </Text>
            {activeSectionIndex !== null && sectionCount > 0 && (
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionIndicator}>
                  [PART {activeSectionIndex + 1}/{sectionCount}]
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleToggleLike();
            }}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
            <Heart
              size={17}
              color={isLiked ? colors.primaryDark : colors.textMuted}
              fill={isLiked ? colors.primaryDark : 'transparent'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              controls.playNext();
            }}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
            <SkipForward size={18} color={colors.cream} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              controls.togglePlayPause();
            }}
            style={styles.playButton}
            activeOpacity={0.8}
          >
            {isBuffering ? (
              <ActivityIndicator size="small" color={colors.textDark} />
            ) : isPlaying ? (
              <PixelPauseIcon size={14} color={colors.textDark} />
            ) : (
              <PixelPlayIcon size={14} color={colors.textDark} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 2.5,
    borderColor: colors.pixelBorder,
    paddingBottom: 2,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: '#27223A',
    width: '100%',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: colors.primary,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  artFrame: {
    position: 'relative',
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bgmBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  bgmBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: colors.textDark,
  },
  metaContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  artist: {
    fontSize: 11,
    color: colors.textSecondary,
    maxWidth: 150,
    fontWeight: '600',
  },
  sectionBadge: {
    marginLeft: 6,
  },
  sectionIndicator: {
    fontSize: 9,
    color: colors.lavender,
    fontWeight: '800',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    padding: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.pixelBorderSoft,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
});
