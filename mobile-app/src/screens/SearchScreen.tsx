import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import {
  DownloadJob,
  DownloadItem,
  PlaylistPreview,
  UnifiedSearchResult,
  ExternalTrack,
} from '../types/download';
import {
  createDownloadJob,
  previewPlaylist,
  searchUnified,
  getDownloadJobs,
  retryDownloadJob,
  cancelDownloadJob,
  clearDownloadHistory,
} from '../api/downloadApi';
import { usePlayerControls } from '../player/PlayerContext';
import {
  Search,
  Link,
  DownloadCloud,
  CheckCircle2,
  Clock,
  Music,
  ListPlus,
  Play,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';

interface SearchScreenProps {
  navigation: any;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const controls = usePlayerControls();
  const [activeTab, setActiveTab] = useState<'search' | 'link' | 'tasks'>('search');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult | null>(null);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());

  // Link State
  const [urlInput, setUrlInput] = useState('');
  const [isResolvingPlaylist, setIsResolvingPlaylist] = useState(false);
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tasks State
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const pollingRef = useRef<any>(null);

  const loadJobs = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoadingJobs(true);
    try {
      const data = await getDownloadJobs();
      setJobs(data);
    } catch (err: any) {
      console.warn('Failed to load download jobs:', err.message);
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Poll when active downloads exist
  useEffect(() => {
    const hasActive = jobs.some(
      (j) =>
        j.status === 'QUEUED' ||
        j.status === 'DOWNLOADING' ||
        j.status === 'SCANNING' ||
        j.status === 'PROCESSING'
    );

    if (hasActive) {
      pollingRef.current = setInterval(() => {
        loadJobs(true);
      }, 3500);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [jobs, loadJobs]);

  // Handle Search
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

  // Handle Add Track from Search
  const handleAddTrack = async (item: ExternalTrack) => {
    const key = `${item.title}-${item.artist}`;
    setQueuedIds((prev) => new Set(prev).add(key));
    try {
      await createDownloadJob(
        'TRACK',
        item.sourceQuery || `${item.title} ${item.artist}`,
        undefined,
        item.title,
        item.artist,
        item.album,
        item.artworkUrl
      );
      loadJobs(true);
      Alert.alert('Queued', `"${item.title}" added to acquisition queue.`);
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not queue track.');
    }
  };

  // Handle Link Resolution
  const handlePreviewLink = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid URL', 'Please paste a valid song or playlist URL.');
      return;
    }
    setIsResolvingPlaylist(true);
    setPlaylistPreview(null);
    try {
      const preview = await previewPlaylist(trimmed);
      if (!preview || preview.totalTracks === 0) {
        Alert.alert('No Tracks Found', 'Could not extract song or playlist details from this URL.');
      } else {
        setPlaylistPreview(preview);
      }
    } catch (err: any) {
      Alert.alert('Preview Failed', err.message || 'Could not resolve track details from link.');
    } finally {
      setIsResolvingPlaylist(false);
    }
  };

  // Confirm and Queue Link Download
  const handleDownloadConfirmed = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || !playlistPreview) return;
    setIsSubmitting(true);
    try {
      const isMultiple = playlistPreview.totalTracks > 1;
      const type = isMultiple ? 'PLAYLIST' : 'TRACK';
      const singleTrack = !isMultiple && playlistPreview.tracks && playlistPreview.tracks.length > 0
        ? playlistPreview.tracks[0]
        : null;

      await createDownloadJob(
        type,
        undefined,
        trimmed,
        singleTrack ? singleTrack.title : playlistPreview.title,
        singleTrack ? singleTrack.artist : undefined,
        playlistPreview.title,
        playlistPreview.artworkUrl
      );

      loadJobs(true);
      Alert.alert(
        isMultiple ? 'Playlist Queued' : 'Download Started',
        isMultiple
          ? `Acquiring "${playlistPreview.title || 'Playlist'}". Missing tracks have been queued.`
          : `"${playlistPreview.title || 'Song'}" queued for acquisition.`,
        [{ text: 'View Tasks', onPress: () => setActiveTab('tasks') }, { text: 'OK' }]
      );
      setPlaylistPreview(null);
      setUrlInput('');
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Unable to queue download.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelDownloadJob(jobId);
      loadJobs(true);
      Alert.alert('Cancelled', 'Download stopped. Successfully completed tracks remain in your library.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to cancel download.');
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryDownloadJob(jobId);
      loadJobs(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to retry download.');
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Remove completed, failed, and cancelled download tasks from the list? (Your music library will remain intact).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearDownloadHistory();
            loadJobs();
          },
        },
      ]
    );
  };

  const toggleExpand = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const filteredJobs = jobs.filter((j) => {
    if (taskFilter === 'ACTIVE') {
      return (
        j.status === 'QUEUED' ||
        j.status === 'DOWNLOADING' ||
        j.status === 'PROCESSING' ||
        j.status === 'SCANNING'
      );
    }
    if (taskFilter === 'COMPLETED') {
      return j.status === 'COMPLETED' || j.status === 'PARTIALLY_COMPLETED';
    }
    return true;
  });

  const activeJobsCount = jobs.filter(
    (j) =>
      j.status === 'QUEUED' ||
      j.status === 'DOWNLOADING' ||
      j.status === 'PROCESSING' ||
      j.status === 'SCANNING'
  ).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Retro Header */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.titleRow}>
              <Search size={18} color={colors.primary} />
              <Text style={styles.headerTitle}>SEARCH & ACQUIRE</Text>
            </View>
            <Text style={styles.headerSubtitle}>SEARCH SONGS OR PASTE PLAYLIST URLS</Text>
          </View>
        </View>

        {/* Retro Sub-Navigation Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]}
            onPress={() => setActiveTab('search')}
            activeOpacity={0.8}
          >
            <Search size={13} color={activeTab === 'search' ? colors.textDark : colors.textMuted} />
            <Text style={[styles.tabBtnText, activeTab === 'search' && styles.tabBtnTextActive]}>
              SEARCH
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'link' && styles.tabBtnActive]}
            onPress={() => setActiveTab('link')}
            activeOpacity={0.8}
          >
            <Link size={13} color={activeTab === 'link' ? colors.textDark : colors.textMuted} />
            <Text style={[styles.tabBtnText, activeTab === 'link' && styles.tabBtnTextActive]}>
              PASTE LINK
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'tasks' && styles.tabBtnActive]}
            onPress={() => setActiveTab('tasks')}
            activeOpacity={0.8}
          >
            <DownloadCloud
              size={13}
              color={activeTab === 'tasks' ? colors.textDark : colors.textMuted}
            />
            <Text style={[styles.tabBtnText, activeTab === 'tasks' && styles.tabBtnTextActive]}>
              TASKS {activeJobsCount > 0 ? `(${activeJobsCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: DIRECT SEARCH */}
        {activeTab === 'search' && (
          <View style={styles.contentContainer}>
            <View style={styles.searchBarRow}>
              <View style={styles.inputWrapper}>
                <Search size={16} color={colors.primaryLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search track, artist, or album..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    if (!text.trim()) {
                      setSearchResults(null);
                    }
                  }}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                    }}
                    style={styles.clearBtn}
                  >
                    <X size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleSearch}
                disabled={isSearching}
                activeOpacity={0.8}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color={colors.textDark} />
                ) : (
                  <Text style={styles.actionBtnText}>GO</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Suggestions / Tags */}
            {!searchResults && (
              <View style={styles.tagsContainer}>
                <Text style={styles.tagsLabel}>POPULAR SEARCHES:</Text>
                <View style={styles.tagsRow}>
                  {['Synthwave', 'Chiptune', 'Lo-Fi Beats', 'Retro Game OST', 'City Pop'].map(
                    (tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={styles.tagChip}
                        onPress={() => {
                          setSearchQuery(tag);
                          searchUnified(tag).then(setSearchResults);
                        }}
                      >
                        <Text style={styles.tagChipText}>#{tag}</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
            )}

            {/* Search Results List */}
            {searchResults && (
              <FlatList
                data={searchResults.external}
                keyExtractor={(item, index) => `${item.title}-${item.artist}-${index}`}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const key = `${item.title}-${item.artist}`;
                  const isQueued = queuedIds.has(key);
                  return (
                    <View style={styles.resultItem}>
                      <View style={styles.resultArtFrame}>
                        {item.artworkUrl ? (
                          <Image
                            source={{ uri: item.artworkUrl }}
                            style={{ width: 44, height: 44 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <Music size={20} color={colors.primaryLight} />
                        )}
                      </View>
                      <View style={styles.resultMeta}>
                        <Text numberOfLines={1} style={styles.resultTitle}>
                          {item.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.resultArtist}>
                          {item.artist} {item.album ? `• ${item.album}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.acquireBtn, isQueued && styles.acquireBtnQueued]}
                        onPress={() => handleAddTrack(item)}
                        disabled={isQueued}
                        activeOpacity={0.7}
                      >
                        {isQueued ? (
                          <CheckCircle2 size={12} color={colors.mint} />
                        ) : (
                          <ListPlus size={12} color={colors.textDark} />
                        )}
                        <Text
                          style={[
                            styles.acquireBtnText,
                            isQueued && { color: colors.mint },
                          ]}
                        >
                          {isQueued ? 'QUEUED' : 'ACQUIRE'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>NO TRACKS FOUND</Text>
                    <Text style={styles.emptySubtext}>Try a different artist or song name.</Text>
                  </View>
                }
              />
            )}
          </View>
        )}

        {/* TAB 2: LINK RESOLVER */}
        {activeTab === 'link' && (
          <ScrollView style={styles.contentContainer} contentContainerStyle={{ paddingBottom: 30 }}>
            <View style={styles.linkCard}>
              <Text style={styles.cardSectionLabel}>PASTE URL TO PREVIEW & IMPORT</Text>
              <Text style={styles.cardSubtext}>
                Supports Spotify playlists, albums, songs, and YouTube links.
              </Text>
              <View style={styles.searchBarRow}>
                <View style={styles.inputWrapper}>
                  <Link size={16} color={colors.primaryLight} style={styles.inputIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="https://open.spotify.com/playlist/... or youtube.com/..."
                    placeholderTextColor={colors.textMuted}
                    value={urlInput}
                    onChangeText={(text) => {
                      setUrlInput(text);
                      if (!text.trim()) setPlaylistPreview(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {urlInput.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setUrlInput('');
                        setPlaylistPreview(null);
                      }}
                      style={styles.clearBtn}
                    >
                      <X size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handlePreviewLink}
                  disabled={isResolvingPlaylist}
                  activeOpacity={0.8}
                >
                  {isResolvingPlaylist ? (
                    <ActivityIndicator size="small" color={colors.textDark} />
                  ) : (
                    <Text style={styles.actionBtnText}>RESOLVE</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Playlist Preview Card */}
            {playlistPreview && (
              <View style={styles.previewContainer}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewArtFrame}>
                    {playlistPreview.artworkUrl ? (
                      <Image
                        source={{ uri: playlistPreview.artworkUrl }}
                        style={{ width: 56, height: 56 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Music size={26} color={colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={styles.previewTitle}>
                      {playlistPreview.title}
                    </Text>
                    <Text style={styles.previewMeta}>
                      [{playlistPreview.totalTracks} TOTAL TRACKS]
                    </Text>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownNew}>
                        +{playlistPreview.missingCount} TO ACQUIRE
                      </Text>
                      {playlistPreview.alreadyInLibraryCount > 0 && (
                        <Text style={styles.breakdownExisting}>
                          • {playlistPreview.alreadyInLibraryCount} IN LIBRARY
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Track List Preview */}
                <View style={styles.previewTracksList}>
                  {playlistPreview.tracks.slice(0, 15).map((t, idx) => (
                    <View key={idx} style={styles.previewTrackRow}>
                      <Text style={styles.previewTrackIndex}>
                        {(idx + 1).toString().padStart(2, '0')}
                      </Text>
                      <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <Text numberOfLines={1} style={styles.previewTrackTitle}>
                          {t.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.previewTrackArtist}>
                          {t.artist}
                        </Text>
                      </View>
                      {t.alreadyInLibrary ? (
                        <View style={styles.inLibraryBadge}>
                          <CheckCircle2 size={10} color={colors.mint} />
                          <Text style={styles.inLibraryText}>READY</Text>
                        </View>
                      ) : (
                        <Text style={styles.queuedBadge}>NEW</Text>
                      )}
                    </View>
                  ))}
                  {playlistPreview.tracks.length > 15 && (
                    <Text style={styles.moreTracksText}>
                      + {playlistPreview.tracks.length - 15} MORE TRACKS IN PLAYLIST
                    </Text>
                  )}
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                  style={styles.confirmAcquireBtn}
                  onPress={handleDownloadConfirmed}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={colors.textDark} />
                  ) : (
                    <>
                      <DownloadCloud size={16} color={colors.textDark} />
                      <Text style={styles.confirmAcquireBtnText}>
                        ACQUIRE {playlistPreview.missingCount > 0 ? `(${playlistPreview.missingCount} TRACKS)` : 'PLAYLIST'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {/* TAB 3: ACQUISITION TASKS */}
        {activeTab === 'tasks' && (
          <View style={styles.contentContainer}>
            {/* Filter & Clear Controls */}
            <View style={styles.tasksControlRow}>
              <View style={styles.filterGroup}>
                {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, taskFilter === f && styles.filterChipActive]}
                    onPress={() => setTaskFilter(f)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        taskFilter === f && styles.filterChipTextActive,
                      ]}
                    >
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {jobs.length > 0 && (
                <TouchableOpacity
                  style={styles.clearHistoryBtn}
                  onPress={handleClearHistory}
                  activeOpacity={0.8}
                >
                  <Trash2 size={12} color={colors.error} />
                  <Text style={styles.clearHistoryText}>CLEAR</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Jobs List */}
            <FlatList
              data={filteredJobs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={isLoadingJobs}
                  onRefresh={() => loadJobs(false)}
                  tintColor={colors.primary}
                />
              }
              renderItem={({ item }) => {
                const isExpanded = expandedJobIds.has(item.id);
                const isDownloading =
                  item.status === 'QUEUED' ||
                  item.status === 'DOWNLOADING' ||
                  item.status === 'PROCESSING' ||
                  item.status === 'SCANNING';
                const isCompleted = item.status === 'COMPLETED';
                const isPartial = item.status === 'PARTIALLY_COMPLETED';

                return (
                  <View style={styles.taskCard}>
                    <TouchableOpacity
                      style={styles.taskCardHeader}
                      onPress={() => toggleExpand(item.id)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.taskTitleRow}>
                          <Text numberOfLines={1} style={styles.taskTitle}>
                            {item.title || item.queryOrUrl}
                          </Text>
                          <View
                            style={[
                              styles.statusPill,
                              isDownloading && styles.statusPillActive,
                              isCompleted && styles.statusPillCompleted,
                              isPartial && styles.statusPillPartial,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                isDownloading && styles.statusPillTextActive,
                                isCompleted && styles.statusPillTextCompleted,
                                isPartial && styles.statusPillTextPartial,
                              ]}
                            >
                              {item.status}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.taskProgressText}>
                          [{item.completedItems} / {item.totalItems} TRACKS COMPLETED]
                        </Text>
                      </View>

                      <View style={styles.taskActions}>
                        {isDownloading && (
                          <TouchableOpacity
                            style={styles.taskCancelBtn}
                            onPress={() => handleCancelJob(item.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <XCircle size={18} color={colors.error} />
                          </TouchableOpacity>
                        )}
                        {item.status === 'FAILED' && (
                          <TouchableOpacity
                            style={styles.taskRetryBtn}
                            onPress={() => handleRetryJob(item.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <RotateCcw size={16} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                        {item.items && item.items.length > 0 && (
                          <View style={styles.expandChevron}>
                            {isExpanded ? (
                              <ChevronUp size={16} color={colors.textSecondary} />
                            ) : (
                              <ChevronDown size={16} color={colors.textSecondary} />
                            )}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Progress Bar */}
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${
                              item.totalItems > 0
                                ? Math.round((item.completedItems / item.totalItems) * 100)
                                : 0
                            }%`,
                          },
                        ]}
                      />
                    </View>

                    {/* Expanded Track Details */}
                    {isExpanded && item.items && (
                      <View style={styles.taskItemsList}>
                        {item.items.map((subItem) => (
                          <View key={subItem.id} style={styles.subItemRow}>
                            <Text numberOfLines={1} style={styles.subItemTitle}>
                              {subItem.title} - {subItem.artist}
                            </Text>
                            <Text style={styles.subItemStatus}>{subItem.status}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <DownloadCloud size={38} color={colors.primary} />
                  <Text style={styles.emptyTitle}>NO ACQUISITION TASKS</Text>
                  <Text style={styles.emptySubtext}>
                    Search a track or paste a playlist link to begin acquiring music.
                  </Text>
                </View>
              }
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.2,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.creamMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.pixelBorder,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    paddingVertical: 8,
    borderRadius: 4,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  tabBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  tabBtnTextActive: {
    color: colors.textDark,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 6,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    height: 42,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.8,
  },
  tagsContainer: {
    paddingVertical: 14,
  },
  tagsLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.creamMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryLight,
  },
  listContent: {
    paddingBottom: 24,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    padding: 8,
    marginVertical: 4,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  resultArtFrame: {
    width: 44,
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.pixelBorder,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDarker,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  resultMeta: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  resultArtist: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  acquireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 3,
  },
  acquireBtnQueued: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.mint,
  },
  acquireBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textDark,
  },
  linkCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  cardSubtext: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 3,
    marginBottom: 10,
  },
  previewContainer: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewArtFrame: {
    width: 56,
    height: 56,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    overflow: 'hidden',
    backgroundColor: colors.surfaceDarker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  previewMeta: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  breakdownNew: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.mint,
  },
  breakdownExisting: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  previewTracksList: {
    borderTopWidth: 1.5,
    borderTopColor: colors.pixelBorderSoft,
    paddingTop: 8,
    marginBottom: 12,
  },
  previewTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  previewTrackIndex: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    width: 20,
  },
  previewTrackTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  previewTrackArtist: {
    fontSize: 9,
    color: colors.textMuted,
  },
  inLibraryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  inLibraryText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.mint,
  },
  queuedBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  moreTracksText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.creamMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  confirmAcquireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    paddingVertical: 12,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  confirmAcquireBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 1,
  },
  tasksControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.textDark,
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#24141A',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 3,
  },
  clearHistoryText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.error,
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    padding: 10,
    marginVertical: 4,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    maxWidth: 180,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.pixelBorder,
  },
  statusPillActive: {
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.primary,
  },
  statusPillCompleted: {
    backgroundColor: '#12261C',
    borderColor: colors.mint,
  },
  statusPillPartial: {
    backgroundColor: '#262414',
    borderColor: colors.primary,
  },
  statusPillText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.textMuted,
  },
  statusPillTextActive: {
    color: colors.primaryLight,
  },
  statusPillTextCompleted: {
    color: colors.mint,
  },
  statusPillTextPartial: {
    color: colors.primaryLight,
  },
  taskProgressText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.creamMuted,
    marginTop: 2,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskCancelBtn: {
    padding: 4,
  },
  taskRetryBtn: {
    padding: 4,
  },
  expandChevron: {
    padding: 4,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  taskItemsList: {
    borderTopWidth: 1,
    borderTopColor: colors.pixelBorderSoft,
    marginTop: 8,
    paddingTop: 6,
  },
  subItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  subItemTitle: {
    fontSize: 10,
    color: colors.textPrimary,
    flex: 1,
  },
  subItemStatus: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1,
  },
  emptySubtext: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
