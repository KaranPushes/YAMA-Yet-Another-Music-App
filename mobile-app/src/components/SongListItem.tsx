import React, { useEffect, useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Song } from '../types/song';
import { colors } from '../theme/colors';
import { ArtworkImage } from './ArtworkImage';
import { formatTime } from '../utils/formatTime';
import { CheckCircle2, Cloud, Scissors, Heart, ListPlus } from 'lucide-react-native';
import { CacheManager } from '../cache/CacheManager';
import { PlaylistStorage } from '../cache/PlaylistStorage';

interface SongListItemProps {
  song: Song;
  onPress: () => void;
  onAddToPlaylist?: (song: Song) => void;
  isCurrentSong?: boolean;
}

const SongListItemComponent: React.FC<SongListItemProps> = ({
  song,
  onPress,
  onAddToPlaylist,
  isCurrentSong = false,
}) => {
  const [isCached, setIsCached] = useState<boolean>(false);
  const [isLiked, setIsLiked] = useState<boolean>(false);

  const sectionCount = song.sections ? song.sections.length : 0;

  useEffect(() => {
    let active = true;
    CacheManager.isSongCached(song.id).then((cached) => {
      if (active) setIsCached(cached);
    });
    PlaylistStorage.isSongLiked(song.id).then((liked) => {
      if (active) setIsLiked(liked);
    });

    const unsubscribe = PlaylistStorage.addChangeListener(() => {
      if (active) {
        PlaylistStorage.isSongLiked(song.id).then((liked) => {
          if (active) setIsLiked(liked);
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [song.id]);

  const handleToggleLike = async () => {
    const next = await PlaylistStorage.toggleLikeSong(song.id);
    setIsLiked(next);
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isCurrentSong && styles.currentPlayingContainer,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.artworkWrapper}>
        <ArtworkImage
          songId={song.id}
          hasArtwork={song.hasArtwork}
          title={song.title}
          artist={song.artist}
          size={50}
          borderRadius={4}
        />
        {isCurrentSong && (
          <View style={styles.playingIndicatorTag}>
            <Text style={styles.playingIndicatorText}>▶</Text>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[styles.title, isCurrentSong && styles.currentTitle]}
          >
            {song.title}
          </Text>
        </View>

        <Text numberOfLines={1} style={styles.artist}>
          {song.artist} {song.album ? `• ${song.album}` : ''}
        </Text>

        <View style={styles.badgesRow}>
          {sectionCount > 0 && (
            <View style={styles.sectionBadge}>
              <Scissors size={9} color={colors.lavender} />
              <Text style={styles.sectionBadgeText}>
                [{sectionCount} PTS]
              </Text>
            </View>
          )}

          <View style={[styles.cacheBadge, isCached ? styles.cacheBadgeActive : styles.cacheBadgeStream]}>
            {isCached ? (
              <>
                <CheckCircle2 size={10} color={colors.mint} />
                <Text style={styles.cachedText}>CACHED</Text>
              </>
            ) : (
              <>
                <Cloud size={10} color={colors.textMuted} />
                <Text style={styles.streamText}>STREAM</Text>
              </>
            )}
          </View>

          <Text style={styles.duration}>{formatTime(song.duration)}</Text>
        </View>
      </View>

      {/* Action Buttons: Like & Add to Playlist */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={handleToggleLike}
          style={[styles.iconBtn, isLiked && styles.iconBtnActive]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Heart
            size={17}
            color={isLiked ? colors.primaryDark : colors.textMuted}
            fill={isLiked ? colors.primaryDark : 'transparent'}
          />
        </TouchableOpacity>

        {onAddToPlaylist && (
          <TouchableOpacity
            onPress={() => onAddToPlaylist(song)}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ListPlus size={17} color={colors.cream} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const SongListItem = memo(SongListItemComponent, (prev, next) => {
  return (
    prev.song.id === next.song.id &&
    prev.isCurrentSong === next.isCurrentSong &&
    prev.song.title === next.song.title &&
    prev.song.artist === next.song.artist &&
    prev.song.duration === next.song.duration &&
    prev.song.sections?.length === next.song.sections?.length &&
    prev.onPress === next.onPress &&
    prev.onAddToPlaylist === next.onAddToPlaylist
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginVertical: 4,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    // Retro arcade hard offset shadow
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  currentPlayingContainer: {
    borderColor: colors.primaryDark,
    backgroundColor: '#251E38',
  },
  artworkWrapper: {
    position: 'relative',
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    overflow: 'hidden',
  },
  playingIndicatorTag: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderTopLeftRadius: 3,
  },
  playingIndicatorText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  currentTitle: {
    color: colors.primary,
  },
  artist: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A203F',
    borderWidth: 1,
    borderColor: colors.lavender,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    gap: 3,
  },
  sectionBadgeText: {
    fontSize: 9,
    color: colors.lavender,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cacheBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    gap: 3,
  },
  cacheBadgeActive: {
    backgroundColor: '#162C25',
    borderColor: colors.mint,
  },
  cacheBadgeStream: {
    backgroundColor: '#1A1828',
    borderColor: colors.pixelBorderSoft,
  },
  cachedText: {
    fontSize: 9,
    color: colors.mint,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  streamText: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  duration: {
    fontSize: 10,
    color: colors.creamMuted,
    marginLeft: 2,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.pixelBorderSoft,
  },
  iconBtnActive: {
    borderColor: colors.primaryDark,
    backgroundColor: '#2E1E34',
  },
});
