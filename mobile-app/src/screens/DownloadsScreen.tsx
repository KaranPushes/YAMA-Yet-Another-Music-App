import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { DownloadJob, DownloadItem, DownloadStatus } from '../types/download';
import {
  getDownloadJobs,
  retryDownloadJob,
  cancelDownloadJob,
  cancelDownloadItem,
  clearDownloadHistory,
} from '../api/downloadApi';
import { AddMusicModal } from '../components/AddMusicModal';
import { usePlayerControls } from '../player/PlayerContext';
import { fetchSongById } from '../api/songApi';
import {
  DownloadCloud,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Music,
  ListMusic,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Play,
  Sparkles,
  XCircle,
  Trash2,
} from 'lucide-react-native';

interface DownloadsScreenProps {
  navigation: any;
}

export const DownloadsScreen: React.FC<DownloadsScreenProps> = ({ navigation }) => {
  const controls = usePlayerControls();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'FAILED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);

  const pollingRef = useRef<any>(null);

  const loadJobs = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getDownloadJobs();
      setJobs(data);
    } catch (err: any) {
      console.warn('Failed to load download jobs:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Set up polling while active downloads exist
  useEffect(() => {
    const hasActive = jobs.some(
      (j) => j.status === 'QUEUED' || j.status === 'DOWNLOADING' || j.status === 'SCANNING' || j.status === 'PROCESSING'
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

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadJobs(true);
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryDownloadJob(jobId);
      loadJobs(true);
    } catch (err: any) {
      Alert.alert('Retry Failed', err.message || 'Could not retry download.');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    Alert.alert('Cancel Download', 'Do you want to stop this download?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Stop Download',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelDownloadJob(jobId);
            loadJobs(true);
          } catch (err: any) {
            Alert.alert('Cancel Failed', err.message || 'Could not stop download.');
          }
        },
      },
    ]);
  };

  const handleCancelItem = async (itemId: string, title: string) => {
    Alert.alert('Stop Song Download', `Cancel download for "${title}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelDownloadItem(itemId);
            loadJobs(true);
          } catch (err: any) {
            Alert.alert('Cancel Failed', err.message || 'Could not cancel item.');
          }
        },
      },
    ]);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Download History',
      'Remove completed, cancelled, and failed downloads from your history list? Songs already in your library will remain untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearDownloadHistory();
              loadJobs(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not clear history.');
            }
          },
        },
      ]
    );
  };

  const toggleExpandJob = (id: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePlayCompletedSong = async (songId: string) => {
    try {
      const song = await fetchSongById(songId);
      controls.playTrack(song, [song], 0);
      navigation.navigate('Player');
    } catch (err: any) {
      Alert.alert('Play Error', 'Could not load song audio.');
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (filter === 'ACTIVE') {
      return (
        j.status === 'QUEUED' ||
        j.status === 'DOWNLOADING' ||
        j.status === 'SCANNING' ||
        j.status === 'PROCESSING'
      );
    }
    if (filter === 'COMPLETED') {
      return j.status === 'COMPLETED' || j.status === 'PARTIALLY_COMPLETED';
    }
    if (filter === 'FAILED') {
      return j.status === 'FAILED';
    }
    return true;
  });

  const renderStatusBadge = (status: DownloadStatus) => {
    switch (status) {
      case 'DOWNLOADING':
      case 'PROCESSING':
        return (
          <View style={[styles.statusBadge, styles.statusDownloading]}>
            <ActivityIndicator size={10} color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.primary }]}>Downloading</Text>
          </View>
        );
      case 'SCANNING':
        return (
          <View style={[styles.statusBadge, styles.statusScanning]}>
            <Sparkles size={11} color={colors.accentPurple} />
            <Text style={[styles.statusText, { color: colors.accentPurple }]}>Scanning</Text>
          </View>
        );
      case 'COMPLETED':
        return (
          <View style={[styles.statusBadge, styles.statusCompleted]}>
            <CheckCircle2 size={11} color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.primary }]}>Completed</Text>
          </View>
        );
      case 'PARTIALLY_COMPLETED':
        return (
          <View style={[styles.statusBadge, styles.statusCompleted]}>
            <CheckCircle2 size={11} color={colors.warning} />
            <Text style={[styles.statusText, { color: colors.warning }]}>Partial</Text>
          </View>
        );
      case 'FAILED':
        return (
          <View style={[styles.statusBadge, styles.statusFailed]}>
            <AlertCircle size={11} color={colors.error} />
            <Text style={[styles.statusText, { color: colors.error }]}>Failed</Text>
          </View>
        );
      case 'SKIPPED':
        return (
          <View style={[styles.statusBadge, styles.statusSkipped]}>
            <CheckCircle2 size={11} color={colors.textSecondary} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>In Library</Text>
          </View>
        );
      case 'CANCELLED':
        return (
          <View style={[styles.statusBadge, styles.statusCancelled]}>
            <XCircle size={11} color={colors.textMuted} />
            <Text style={[styles.statusText, { color: colors.textMuted }]}>Cancelled</Text>
          </View>
        );
      case 'QUEUED':
      default:
        return (
          <View style={[styles.statusBadge, styles.statusQueued]}>
            <Clock size={11} color={colors.textSecondary} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>Queued</Text>
          </View>
        );
    }
  };

  const renderJobCard = ({ item: job }: { item: DownloadJob }) => {
    const isExpanded = expandedJobIds.has(job.id);
    const progressPercent =
      job.totalItems > 0 ? Math.round((job.completedItems / job.totalItems) * 100) : 0;

    return (
      <View style={styles.jobCard}>
        {/* Job Summary Header */}
        <TouchableOpacity
          style={styles.jobHeader}
          onPress={() => toggleExpandJob(job.id)}
          activeOpacity={0.7}
        >
          <View style={styles.jobTypeIcon}>
            {job.type === 'PLAYLIST' ? (
              <ListMusic size={18} color={colors.accentPurple} />
            ) : (
              <Music size={18} color={colors.primary} />
            )}
          </View>

          <View style={styles.jobInfo}>
            <View style={styles.jobTitleRow}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {job.title || job.queryOrUrl}
              </Text>
            </View>
            <Text style={styles.jobSubtitle}>
              {job.type === 'PLAYLIST' ? 'Playlist Import' : 'Single Track'} •{' '}
              {job.completedItems} / {job.totalItems} completed
              {job.failedItems > 0 ? ` (${job.failedItems} failed)` : ''}
            </Text>
          </View>

          <View style={styles.jobRight}>
            {renderStatusBadge(job.status)}
            {isExpanded ? (
              <ChevronUp size={16} color={colors.textSecondary} style={{ marginTop: 4 }} />
            ) : (
              <ChevronDown size={16} color={colors.textSecondary} style={{ marginTop: 4 }} />
            )}
          </View>
        </TouchableOpacity>

        {/* Progress Bar */}
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor:
                  job.status === 'FAILED'
                    ? colors.error
                    : job.status === 'COMPLETED'
                    ? colors.primary
                    : colors.accentPurple,
              },
            ]}
          />
        </View>

        {/* Action row for Active or Failed */}
        {(job.failedItems > 0 || job.status === 'QUEUED' || job.status === 'DOWNLOADING' || job.status === 'PROCESSING') && (
          <View style={styles.jobActionRow}>
            {job.failedItems > 0 && (
              <TouchableOpacity style={styles.retryButton} onPress={() => handleRetryJob(job.id)}>
                <RotateCcw size={13} color={colors.primary} />
                <Text style={styles.retryButtonText}>Retry Failed ({job.failedItems})</Text>
              </TouchableOpacity>
            )}
            {(job.status === 'QUEUED' || job.status === 'DOWNLOADING' || job.status === 'PROCESSING') && (
              <TouchableOpacity style={styles.cancelJobButton} onPress={() => handleCancelJob(job.id)}>
                <XCircle size={13} color={colors.error || '#EF4444'} />
                <Text style={styles.cancelJobButtonText}>Stop Download</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Expanded Items List */}
        {isExpanded && job.items && job.items.length > 0 && (
          <View style={styles.itemsListContainer}>
            {job.items.map((track) => (
              <View key={track.id} style={styles.trackItemRow}>
                <View style={styles.trackItemInfo}>
                  <Text style={styles.trackItemTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackItemArtist} numberOfLines={1}>
                    {track.artist}
                  </Text>
                  {track.errorMessage && (
                    <Text style={styles.trackErrorText} numberOfLines={2}>
                      {track.errorMessage}
                    </Text>
                  )}
                </View>

                <View style={styles.trackItemRight}>
                  {renderStatusBadge(track.status)}
                  {track.songId && (
                    <TouchableOpacity
                      style={styles.quickPlayItemButton}
                      onPress={() => handlePlayCompletedSong(track.songId!)}
                    >
                      <Play size={12} color={colors.background} fill={colors.background} />
                    </TouchableOpacity>
                  )}
                  {(track.status === 'QUEUED' ||
                    track.status === 'DOWNLOADING' ||
                    track.status === 'PROCESSING') && (
                    <TouchableOpacity
                      style={styles.cancelItemBtn}
                      onPress={() => handleCancelItem(track.id, track.title)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <XCircle size={15} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.titleRow}>
              <Sparkles size={22} color={colors.primary} />
              <Text style={styles.screenTitle}>SUMMON</Text>
            </View>
            <Text style={styles.screenSubtitle}>ACQUISITION PORTAL // SAVIFY ENGINE</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleClearHistory}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleRefresh}>
              <RefreshCw size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addMusicButton}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={14} color={colors.textDark} />
              <Text style={styles.addMusicButtonText}>+ SUMMON</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(['ALL', 'ACTIVE', 'COMPLETED', 'FAILED'] as const).map((chip) => (
            <TouchableOpacity
              key={chip}
              style={[styles.filterChip, filter === chip && styles.activeFilterChip]}
              onPress={() => setFilter(chip)}
            >
              <Text style={[styles.filterChipText, filter === chip && styles.activeFilterChipText]}>
                {chip === 'ALL'
                  ? 'All'
                  : chip === 'ACTIVE'
                  ? 'Active'
                  : chip === 'COMPLETED'
                  ? 'Completed'
                  : 'Failed'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Opening portal...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredJobs}
            keyExtractor={(item) => item.id}
            renderItem={renderJobCard}
            contentContainerStyle={styles.listContent}
            getItemLayout={(data, index) => ({ length: 90, offset: 90 * index, index })}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Sparkles size={46} color={colors.primaryDark} />
                <Text style={styles.emptyTitle}>NO TRANSMISSIONS YET</Text>
                <Text style={styles.emptySubtext}>
                  {filter !== 'ALL'
                    ? `No ${filter.toLowerCase()} transmissions.`
                    : 'Paste a song link or search external tracks to summon music directly into your repository.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Plus size={14} color={colors.textDark} />
                  <Text style={styles.emptyAddButtonText}>SUMMON MUSIC</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>

      {/* Add Music Modal */}
      <AddMusicModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onJobCreated={(job) => {
          setJobs((prev) => [job, ...prev]);
        }}
        onPlaySong={(song) => {
          controls.playTrack(song, [song], 0);
          navigation.navigate('Player');
        }}
      />
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    backgroundColor: colors.surfaceCard,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addMusicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 5,
  },
  addMusicButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeFilterChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  activeFilterChipText: {
    color: colors.primary,
  },
  listContent: {
    paddingBottom: 90,
  },
  jobCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  jobTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobInfo: {
    flex: 1,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  jobSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  jobRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: colors.surfaceElevated,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
  },
  jobActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  retryButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  cancelJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    marginLeft: 8,
  },
  cancelJobButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.error || '#EF4444',
  },
  itemsListContainer: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  trackItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  trackItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  trackItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  trackItemArtist: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  trackErrorText: {
    fontSize: 10,
    color: colors.error,
    marginTop: 2,
  },
  trackItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickPlayItemButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelItemBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  statusDownloading: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusScanning: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusSkipped: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusQueued: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusCancelled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 13,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  emptyAddButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.background,
  },
});
