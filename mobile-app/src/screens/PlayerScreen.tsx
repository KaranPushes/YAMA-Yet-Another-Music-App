import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlayer } from '../player/PlayerContext';
import { colors } from '../theme/colors';
import { ArtworkImage } from '../components/ArtworkImage';
import { SectionRangeVisualizer } from '../components/SectionRangeVisualizer';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { QueueModal } from '../components/QueueModal';
import { PlaylistStorage } from '../cache/PlaylistStorage';
import { formatTime, formatBytes } from '../utils/formatTime';
import { parseCredits } from '../utils/creditsParser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  RotateCcw,
  RotateCw,
  Scissors,
  HardDrive,
  Cloud,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ListPlus,
  ListMusic,
  Mic2,
  Sliders,
  Disc3,
  Music2,
} from 'lucide-react-native';
import { PixelPlayIcon, PixelPauseIcon } from '../components/PixelIcons';

interface PlayerScreenProps {
  navigation: any;
}

export const PlayerScreen: React.FC<PlayerScreenProps> = ({ navigation }) => {
  const { state, controls } = usePlayer();
  const {
    currentSong,
    isPlaying,
    isBuffering,
    positionSeconds,
    durationSeconds,
    activeSectionIndex,
    isSectionModeEnabled,
    playbackSource,
    repeatMode,
    isShuffle,
  } = state;

  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState<boolean>(false);
  const [showQueueModal, setShowQueueModal] = useState<boolean>(false);
  const [seekInterval, setSeekInterval] = useState<string>('10');

  useEffect(() => {
    AsyncStorage.getItem('yama_seek_interval').then((saved) => {
      if (saved) setSeekInterval(saved);
    });
  }, []);

  useEffect(() => {
    if (currentSong) {
      PlaylistStorage.isSongLiked(currentSong.id).then(setIsLiked);
    }
    const unsubscribe = PlaylistStorage.addChangeListener(() => {
      if (currentSong) {
        PlaylistStorage.isSongLiked(currentSong.id).then(setIsLiked);
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [currentSong?.id]);

  const handleToggleLike = async () => {
    if (!currentSong) return;
    const next = await PlaylistStorage.toggleLikeSong(currentSong.id);
    setIsLiked(next);
  };

  if (!currentSong) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No song currently selected.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back to Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sections = currentSong.sections || [];
  const currentSection =
    activeSectionIndex !== null && sections[activeSectionIndex]
      ? sections[activeSectionIndex]
      : null;

  const formatName = (currentSong.fileFormat || 'MP3').toUpperCase();
  const bitrateVal = currentSong.bitrate
    ? `${Math.round(currentSong.bitrate > 1000 ? currentSong.bitrate / 1000 : currentSong.bitrate)} kbps`
    : '320 kbps';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Dismiss Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.chevronButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronDown size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.topBarMeta}>
            <Text style={styles.playingFromText}>NOW PLAYING</Text>
            <Text numberOfLines={1} style={styles.albumSubtext}>
              {currentSong.album || 'Personal Collection'}
            </Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* Large Artwork */}
        <View style={styles.artworkContainer}>
          <ArtworkImage
            songId={currentSong.id}
            hasArtwork={currentSong.hasArtwork}
            title={currentSong.title}
            artist={currentSong.artist}
            size={290}
            borderRadius={20}
          />
        </View>

        {/* Title & Artist with Like and Add-To-Playlist buttons */}
        <View style={styles.metaSection}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text numberOfLines={1} style={styles.songTitle}>
                {currentSong.title}
              </Text>
              <Text numberOfLines={1} style={styles.songArtist}>
                {currentSong.artist}
              </Text>
            </View>

            {/* Quick Action Icons: Like & Add to Playlist */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                onPress={handleToggleLike}
                style={styles.headerIconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Heart
                  size={22}
                  color={isLiked ? colors.accentPink : colors.textSecondary}
                  fill={isLiked ? colors.accentPink : 'transparent'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowPlaylistModal(true)}
                style={styles.headerIconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ListPlus size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Playback Source Pill */}
          <View style={styles.sourcePillRow}>
            <View style={styles.sourcePill}>
              {playbackSource === 'local' ? (
                <>
                  <HardDrive size={12} color={colors.primary} />
                  <Text style={styles.localSourceText}>Local Storage (Offline)</Text>
                </>
              ) : (
                <>
                  <Cloud size={12} color={colors.accentPurpleLight} />
                  <Text style={styles.streamSourceText}>High-Speed Range Stream</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Section Range Visualizer & Active Section Info */}
        <View style={styles.timelineContainer}>
          {sections.length > 0 && (
            <View style={styles.activeSectionHeader}>
              <View style={styles.activeSectionBadge}>
                <Scissors size={12} color={colors.primary} />
                <Text style={styles.activeSectionText}>
                  {currentSection
                    ? `Section ${activeSectionIndex! + 1}/${sections.length}: ${formatTime(
                        currentSection.startSeconds
                      )} → ${formatTime(currentSection.endSeconds)}`
                    : isSectionModeEnabled
                    ? 'Seeking Active Section...'
                    : `${sections.length} configured sections`}
                </Text>
              </View>
            </View>
          )}

          {/* Interactive Scrubbing Timeline Bar */}
          <SectionRangeVisualizer
            durationSeconds={durationSeconds}
            positionSeconds={positionSeconds}
            sections={sections}
            isSectionModeEnabled={isSectionModeEnabled}
            onSeek={(sec) => controls.seekTo(sec)}
            height={38}
          />

          {/* Time Labels */}
          <View style={styles.timeLabelsRow}>
            <Text style={styles.timeText}>{formatTime(positionSeconds)}</Text>
            <Text style={styles.timeText}>{formatTime(durationSeconds)}</Text>
          </View>
        </View>

        {/* Section Playback Toggle Switch */}
        {sections.length > 0 && (
          <View style={styles.sectionModeRow}>
            <View style={styles.sectionModeInfo}>
              <Text style={styles.sectionModeTitle}>Section-Only Playback</Text>
              <Text style={styles.sectionModeSubtext}>
                Automatically skips unselected parts during playback
              </Text>
            </View>
            <Switch
              value={isSectionModeEnabled}
              onValueChange={controls.toggleSectionMode}
              trackColor={{ false: colors.surfaceHighlight, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>
        )}

        {/* Secondary controls: Shuffle, Section Skip, Repeat */}
        <View style={styles.secondaryControlsRow}>
          {/* Shuffle Button */}
          <TouchableOpacity
            onPress={controls.toggleShuffle}
            style={[styles.modeButton, isShuffle && styles.activeModeButton]}
          >
            <Shuffle
              size={18}
              color={isShuffle ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Skip to Previous Section */}
          <TouchableOpacity
            onPress={controls.skipToPreviousSection}
            style={styles.sectionSkipButton}
            disabled={sections.length === 0}
          >
            <Rewind
              size={18}
              color={sections.length > 0 ? colors.textPrimary : colors.textMuted}
            />
            <Text style={[styles.sectionSkipText, sections.length === 0 && styles.disabledText]}>
              Prev Section
            </Text>
          </TouchableOpacity>

          {/* Skip to Next Section */}
          <TouchableOpacity
            onPress={controls.skipToNextSection}
            style={styles.sectionSkipButton}
            disabled={sections.length === 0}
          >
            <Text style={[styles.sectionSkipText, sections.length === 0 && styles.disabledText]}>
              Next Section
            </Text>
            <FastForward
              size={18}
              color={sections.length > 0 ? colors.textPrimary : colors.textMuted}
            />
          </TouchableOpacity>

          {/* Repeat Mode Button */}
          <TouchableOpacity
            onPress={controls.toggleRepeat}
            style={[styles.modeButton, repeatMode !== 'off' && styles.activeModeButton]}
          >
            {repeatMode === 'one' ? (
              <Repeat1 size={18} color={colors.primary} />
            ) : (
              <Repeat
                size={18}
                color={repeatMode === 'all' ? colors.primary : colors.textSecondary}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Main Playback Controls: Prev Track, Seek -s, Play/Pause, Seek +s, Next Track */}
        <View style={styles.mainControlsRow}>
          <TouchableOpacity
            onPress={controls.playPrevious}
            style={styles.trackNavButton}
            activeOpacity={0.7}
          >
            <SkipBack size={26} color={colors.textPrimary} />
          </TouchableOpacity>

          {seekInterval !== 'NONE' && (
            <TouchableOpacity
              onPress={() => controls.seekTo(Math.max(0, positionSeconds - (Number(seekInterval) || 10)))}
              style={styles.seekStepButton}
              activeOpacity={0.7}
            >
              <RotateCcw size={19} color={colors.primaryLight} />
              <Text style={styles.seekStepText}>-{seekInterval}s</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={controls.togglePlayPause}
            style={styles.mainPlayButton}
            activeOpacity={0.8}
          >
            {isBuffering ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : isPlaying ? (
              <PixelPauseIcon size={26} color={colors.background} />
            ) : (
              <PixelPlayIcon size={26} color={colors.background} />
            )}
          </TouchableOpacity>

          {seekInterval !== 'NONE' && (
            <TouchableOpacity
              onPress={() => controls.seekTo(Math.min(durationSeconds, positionSeconds + (Number(seekInterval) || 10)))}
              style={styles.seekStepButton}
              activeOpacity={0.7}
            >
              <RotateCw size={19} color={colors.primaryLight} />
              <Text style={styles.seekStepText}>+{seekInterval}s</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={controls.playNext}
            style={styles.trackNavButton}
            activeOpacity={0.7}
          >
            <SkipForward size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Playback Actions Row: Queue & Custom Sections */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowQueueModal(true)}
          >
            <ListMusic size={14} color={colors.primary} />
            <Text style={styles.actionButtonText}>QUEUE ({state.queue.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('SectionEditor', { song: currentSong })}
          >
            <Scissors size={14} color={colors.accentSecondary} />
            <Text style={styles.actionButtonText}>SECTIONS ({sections.length})</Text>
          </TouchableOpacity>
        </View>

        {/* SPOTIFY-STYLE CREDITS & SONG INFORMATION PANEL */}
        {(() => {
          const credits = parseCredits(
            currentSong.title,
            currentSong.artist,
            currentSong.albumArtist,
            currentSong.producer
          );
          return (
            <View style={styles.creditsPanel}>
              <View style={styles.creditsHeader}>
                <Text style={styles.creditsHeading}>Credits</Text>
                <View style={styles.sourceTag}>
                  <Text style={styles.sourceTagText}>{currentSong.album || 'Single'}</Text>
                </View>
              </View>

              {/* Performed By (Singers) */}
              <View style={styles.creditItem}>
                <View style={styles.creditIconCircle}>
                  <Mic2 size={16} color={colors.primary} />
                </View>
                <View style={styles.creditTextContainer}>
                  <Text style={styles.creditName}>{credits.singers}</Text>
                  <Text style={styles.creditRole}>Vocals • Performer</Text>
                </View>
              </View>

              {/* Written / Lyricist */}
              <View style={styles.creditItem}>
                <View style={styles.creditIconCircle}>
                  <Music2 size={16} color={colors.accentPurpleLight} />
                </View>
                <View style={styles.creditTextContainer}>
                  <Text style={styles.creditName}>{credits.lyricists}</Text>
                  <Text style={styles.creditRole}>Writer • Lyricist</Text>
                </View>
              </View>

              {/* Produced By */}
              <View style={styles.creditItem}>
                <View style={styles.creditIconCircle}>
                  <Sliders size={16} color={colors.primary} />
                </View>
                <View style={styles.creditTextContainer}>
                  <Text style={styles.creditName}>{credits.producer}</Text>
                  <Text style={styles.creditRole}>Producer</Text>
                </View>
              </View>

              {/* Release & Distribution metadata */}
              <View style={styles.releaseMetaRow}>
                <View style={styles.metaChip}>
                  <Disc3 size={13} color={colors.textSecondary} />
                  <Text style={styles.metaChipText}>{currentSong.album || 'Original Release'}</Text>
                </View>
                <Text style={styles.metaYearText}>
                  {currentSong.year || (currentSong.createdAt ? new Date(currentSong.createdAt).getFullYear() : '2026')}
                </Text>
              </View>
            </View>
          );
        })()}
      </ScrollView>

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        visible={showPlaylistModal}
        song={currentSong}
        onClose={() => setShowPlaylistModal(false)}
      />

      {/* Queue Reordering Modal */}
      <QueueModal
        visible={showQueueModal}
        onClose={() => setShowQueueModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  chevronButton: {
    padding: 4,
  },
  topBarMeta: {
    alignItems: 'center',
  },
  playingFromText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  albumSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
    maxWidth: 220,
  },
  artworkContainer: {
    alignItems: 'center',
    marginVertical: 14,
    borderWidth: 3,
    borderColor: colors.pixelBorder,
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    alignSelf: 'center',
  },
  metaSection: {
    marginBottom: 10,
    marginTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  songTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  songArtist: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 2,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorderSoft,
  },
  sourcePillRow: {
    marginTop: 8,
    flexDirection: 'row',
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.pixelBorderSoft,
  },
  localSourceText: {
    fontSize: 9,
    color: colors.mint,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  streamSourceText: {
    fontSize: 9,
    color: colors.lavender,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timelineContainer: {
    marginVertical: 8,
  },
  activeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A203F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.lavender,
  },
  activeSectionText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.lavender,
    letterSpacing: 0.5,
  },
  timeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    color: colors.creamMuted,
    fontWeight: '800',
  },
  sectionModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 5,
    marginVertical: 6,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sectionModeInfo: {
    flex: 1,
    marginRight: 10,
  },
  sectionModeTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  sectionModeSubtext: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  modeButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorderSoft,
  },
  activeModeButton: {
    backgroundColor: '#2E1E34',
    borderColor: colors.primaryDark,
  },
  sectionSkipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
  },
  sectionSkipText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  disabledText: {
    color: colors.textMuted,
  },
  mainControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginVertical: 10,
  },
  seekStepButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
  },
  seekStepText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryLight,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  trackNavButton: {
    padding: 10,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  mainPlayButton: {
    width: 62,
    height: 62,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: colors.pixelBorder,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
  creditsPanel: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    padding: 14,
    marginTop: 10,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  creditsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  creditsHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.creamLight,
    letterSpacing: 0.8,
  },
  sourceTag: {
    backgroundColor: '#27203A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.lavender,
  },
  sourceTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.lavender,
    letterSpacing: 0.5,
  },
  creditItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  creditIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.pixelBorderSoft,
  },
  creditTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  creditName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  creditRole: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 1,
    fontWeight: '700',
  },
  releaseMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 4,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  metaYearText: {
    fontSize: 11,
    color: colors.creamMuted,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
