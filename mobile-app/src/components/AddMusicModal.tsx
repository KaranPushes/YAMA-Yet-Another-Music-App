import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { colors } from '../theme/colors';
import {
  DownloadJob,
  PlaylistPreview,
  UnifiedSearchResult,
  ExternalTrack,
} from '../types/download';
import {
  createDownloadJob,
  previewPlaylist,
  searchUnified,
} from '../api/downloadApi';
import {
  Link,
  Search,
  X,
  DownloadCloud,
  CheckCircle2,
  Clock,
  Sparkles,
  Music,
  ListPlus,
  Play,
  ArrowRight,
} from 'lucide-react-native';
import { Song } from '../types/song';

interface AddMusicModalProps {
  visible: boolean;
  onClose: () => void;
  onJobCreated?: (job: DownloadJob) => void;
  onPlaySong?: (song: Song) => void;
}

export const AddMusicModal: React.FC<AddMusicModalProps> = ({
  visible,
  onClose,
  onJobCreated,
  onPlaySong,
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'search'>('link');

  // Link tab state
  const [urlInput, setUrlInput] = useState('');
  const [isResolvingPlaylist, setIsResolvingPlaylist] = useState(false);
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult | null>(null);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());

  const resetState = () => {
    setUrlInput('');
    setPlaylistPreview(null);
    setIsResolvingPlaylist(false);
    setIsSubmitting(false);
    setSearchQuery('');
    setSearchResults(null);
    setQueuedIds(new Set());
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePreviewLink = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid URL', 'Please paste a valid song or playlist URL.');
      return;
    }

    setIsResolvingPlaylist(true);
    try {
      const preview = await previewPlaylist(trimmed);
      if (!preview || !preview.tracks || preview.tracks.length === 0) {
        Alert.alert('No Tracks Found', 'Could not extract song or playlist details from this URL.');
      } else {
        setPlaylistPreview(preview);
      }
    } catch (err: any) {
      Alert.alert('Preview Failed', err.message || 'Could not resolve track details from the provided link.');
    } finally {
      setIsResolvingPlaylist(false);
    }
  };

  const handleDownloadConfirmed = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || !playlistPreview) return;
    setIsSubmitting(true);
    try {
      const isMultiple = playlistPreview.totalTracks > 1;
      const type = isMultiple ? 'PLAYLIST' : 'TRACK';
      const singleTrack = !isMultiple && playlistPreview.tracks && playlistPreview.tracks.length > 0 ? playlistPreview.tracks[0] : null;
      const job = await createDownloadJob(
        type,
        undefined,
        trimmed,
        singleTrack ? singleTrack.title : playlistPreview.title,
        singleTrack ? singleTrack.artist : undefined,
        playlistPreview.title,
        playlistPreview.artworkUrl
      );
      onJobCreated?.(job);
      Alert.alert(
        isMultiple ? 'Playlist Queued' : 'Download Started',
        isMultiple
          ? `Importing "${playlistPreview.title || 'Playlist'}". Missing tracks have been added to your queue.`
          : `"${playlistPreview.title || 'Song'}" has been added to your download queue.`,
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Unable to queue download.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setIsSearching(true);
    try {
      const res = await searchUnified(trimmed);
      setSearchResults(res);
    } catch (err: any) {
      Alert.alert('Search Failed', err.message || 'Unable to search external catalog.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTrack = async (item: ExternalTrack) => {
    try {
      const key = `${item.title}-${item.artist}`;
      setQueuedIds((prev) => new Set(prev).add(key));
      const job = await createDownloadJob(
        'TRACK',
        item.sourceQuery || `${item.title} ${item.artist}`,
        undefined,
        item.title,
        item.artist,
        item.album,
        item.artworkUrl
      );
      onJobCreated?.(job);
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not queue track.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <DownloadCloud size={20} color={colors.primary} />
              <Text style={styles.modalTitle}>Add Music to YAMA</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Segmented Control / Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'link' && styles.activeTabButton]}
              onPress={() => setActiveTab('link')}
            >
              <Link size={14} color={activeTab === 'link' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'link' && styles.activeTabText]}>
                Paste Link / Playlist
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'search' && styles.activeTabButton]}
              onPress={() => setActiveTab('search')}
            >
              <Search size={14} color={activeTab === 'search' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
                Search Catalog
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab 1: Paste Link */}
          {activeTab === 'link' && (
            <ScrollView style={styles.tabScrollContent} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Enter Song or Playlist URL</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.urlInput}
                  placeholder="https://open.spotify.com/track/... or playlist"
                  placeholderTextColor={colors.textMuted}
                  value={urlInput}
                  onChangeText={(text) => {
                    setUrlInput(text);
                    if (playlistPreview) setPlaylistPreview(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Playlist Preview Card if resolved */}
              {isResolvingPlaylist ? (
                <View style={styles.resolvingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.resolvingText}>Resolving playlist tracks via Savify...</Text>
                </View>
              ) : playlistPreview ? (
                <View style={styles.previewCard}>
                  {playlistPreview.artworkUrl ? (
                    <Image
                      source={{ uri: playlistPreview.artworkUrl }}
                      style={styles.previewArtwork}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle} numberOfLines={2}>
                      {playlistPreview.title}
                    </Text>
                    <Text style={styles.previewSubtitle}>
                      {playlistPreview.totalTracks} tracks found
                    </Text>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statPillGreen}>
                      <CheckCircle2 size={13} color={colors.primary} />
                      <Text style={styles.statTextGreen}>
                        {playlistPreview.alreadyInLibraryCount} in YAMA
                      </Text>
                    </View>

                    <View style={styles.statPillPurple}>
                      <ListPlus size={13} color={colors.accentPurple} />
                      <Text style={styles.statTextPurple}>
                        {playlistPreview.missingCount} missing
                      </Text>
                    </View>
                  </View>

                  {/* Track items list: show ALL tracks */}
                  <View style={styles.tracksPreviewList}>
                    {playlistPreview.tracks.map((track, idx) => (
                      <View key={idx} style={styles.trackPreviewItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.trackPreviewTitle} numberOfLines={1}>
                            {track.title}
                          </Text>
                          <Text style={styles.trackPreviewArtist} numberOfLines={1}>
                            {track.artist}
                          </Text>
                        </View>
                        {track.alreadyInLibrary ? (
                          <View style={styles.inLibraryBadge}>
                            <Text style={styles.inLibraryText}>✓ In Library</Text>
                          </View>
                        ) : (
                          <View style={styles.missingBadge}>
                            <Text style={styles.missingText}>↓ Missing</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>

                  {playlistPreview.missingCount > 0 ? (
                    <TouchableOpacity
                      style={styles.primaryActionButton}
                      onPress={handleDownloadConfirmed}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color={colors.background} size="small" />
                      ) : (
                        <>
                          <DownloadCloud size={16} color={colors.background} />
                          <Text style={styles.primaryActionButtonText}>
                            {playlistPreview.totalTracks === 1
                              ? 'Download Song'
                              : `Download ${playlistPreview.missingCount} Missing Tracks`}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <View style={styles.allDownloadedNotice}>
                        <CheckCircle2 size={15} color={colors.primary} />
                        <Text style={styles.allDownloadedText}>
                          {playlistPreview.totalTracks === 1
                            ? 'This song is already in your YAMA library!'
                            : 'All tracks are already in your YAMA library!'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.primaryActionButton, { marginTop: 12, backgroundColor: colors.surfaceHighlight }]}
                        onPress={handleDownloadConfirmed}
                        disabled={isSubmitting}
                      >
                        <DownloadCloud size={16} color={colors.textPrimary} />
                        <Text style={[styles.primaryActionButtonText, { color: colors.textPrimary }]}>
                          Force Re-download
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryActionButton, isSubmitting && { opacity: 0.7 }]}
                  onPress={handlePreviewLink}
                  disabled={isSubmitting || isResolvingPlaylist}
                >
                  {isResolvingPlaylist ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <>
                      <Sparkles size={16} color={colors.background} />
                      <Text style={styles.primaryActionButtonText}>
                        Preview Link Before Download
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* Tab 2: Search External */}
          {activeTab === 'search' && (
            <View style={styles.searchTabContainer}>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Song name, artist, album..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={styles.searchSubmitButton}
                  onPress={handleSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Search size={16} color={colors.background} />
                  )}
                </TouchableOpacity>
              </View>

              {isSearching ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.resolvingText}>Searching music sources...</Text>
                </View>
              ) : searchResults ? (
                <FlatList
                  data={searchResults.external}
                  keyExtractor={(item, idx) => `${item.title}-${item.artist}-${idx}`}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  ListHeaderComponent={
                    searchResults.library.length > 0 ? (
                      <View style={styles.localResultsSection}>
                        <Text style={styles.sectionHeader}>Already in Your YAMA Library</Text>
                        {searchResults.library.slice(0, 2).map((song) => (
                          <View key={song.id} style={styles.localSongCard}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.trackPreviewTitle} numberOfLines={1}>
                                {song.title}
                              </Text>
                              <Text style={styles.trackPreviewArtist} numberOfLines={1}>
                                {song.artist}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.playLocalButton}
                              onPress={() => {
                                onPlaySong?.(song);
                                handleClose();
                              }}
                            >
                              <Play size={14} color={colors.background} fill={colors.background} />
                              <Text style={styles.playLocalButtonText}>Play</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>
                          Available for Acquisition
                        </Text>
                      </View>
                    ) : null
                  }
                  renderItem={({ item }) => {
                    const key = `${item.title}-${item.artist}`;
                    const isQueued = queuedIds.has(key);
                    return (
                      <View style={styles.externalResultCard}>
                        {item.artworkUrl ? (
                          <Image source={{ uri: item.artworkUrl }} style={styles.resultArtwork} />
                        ) : (
                          <View style={styles.resultArtworkFallback}>
                            <Music size={18} color={colors.textSecondary} />
                          </View>
                        )}
                        <View style={styles.resultInfo}>
                          <Text style={styles.trackPreviewTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.trackPreviewArtist} numberOfLines={1}>
                            {item.artist} {item.album ? `• ${item.album}` : ''}
                          </Text>
                        </View>

                        {item.alreadyInLibrary ? (
                          <View style={styles.inLibraryBadge}>
                            <Text style={styles.inLibraryText}>✓ In Library</Text>
                          </View>
                        ) : isQueued ? (
                          <View style={styles.queuedBadge}>
                            <Clock size={12} color={colors.primary} />
                            <Text style={styles.queuedBadgeText}>Queued</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.addTrackButton}
                            onPress={() => handleAddTrack(item)}
                          >
                            <DownloadCloud size={13} color={colors.background} />
                            <Text style={styles.addTrackButtonText}>+ Add</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.centerContainer}>
                      <Text style={styles.emptyText}>No results found for "{searchQuery}".</Text>
                    </View>
                  }
                />
              ) : (
                <View style={styles.emptySearchPrompt}>
                  <Sparkles size={36} color={colors.primary} />
                  <Text style={styles.emptyPromptTitle}>Discover & Import Any Track</Text>
                  <Text style={styles.emptyPromptSub}>
                    Search by track or artist to acquire high-fidelity audio directly into YAMA.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 16,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: colors.surfaceCard,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
  },
  tabScrollContent: {
    maxHeight: 480,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputRow: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  urlInput: {
    color: colors.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  resolvingContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  resolvingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  previewCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  previewArtwork: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
  },
  previewHeader: {
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  previewSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statPillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  statTextGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  statPillPurple: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  statTextPurple: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentPurple,
  },
  tracksPreviewList: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
    marginBottom: 14,
    gap: 8,
  },
  trackPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  trackPreviewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  trackPreviewArtist: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  inLibraryBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inLibraryText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  missingBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  missingText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentPurple,
  },
  moreTracksText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  primaryActionButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  allDownloadedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  allDownloadedText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  searchTabContainer: {
    height: 440,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 13,
  },
  searchSubmitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  localResultsSection: {
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  localSongCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceCard,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  playLocalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  playLocalButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.background,
  },
  externalResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    gap: 10,
  },
  resultArtwork: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  resultArtworkFallback: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  queuedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  queuedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  addTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addTrackButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.background,
  },
  emptySearchPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyPromptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyPromptSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
