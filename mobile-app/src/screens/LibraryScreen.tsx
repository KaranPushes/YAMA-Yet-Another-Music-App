import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Image,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { Song } from '../types/song';
import { fetchSongs } from '../api/songApi';
import { SongListItem } from '../components/SongListItem';
import { ArtworkImage } from '../components/ArtworkImage';
import { usePlayerControls, useCurrentSongId } from '../player/PlayerContext';
import { CacheStorage } from '../cache/CacheStorage';
import { Playlist, PlaylistStorage } from '../cache/PlaylistStorage';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import {
  Heart,
  ListMusic,
  Plus,
  Play,
  Trash2,
  HardDrive,
  FolderHeart,
  Music,
  ChevronRight,
  ArrowLeft,
  ArrowUpDown,
  X,
  EllipsisVertical,
  GripVertical,
  ListPlus,
} from 'lucide-react-native';

interface LibraryScreenProps {
  navigation: any;
}

interface DraggablePlaylistTrackProps {
  item: Song;
  index: number;
  totalItems: number;
  onReorder: (from: number, to: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const DraggablePlaylistTrack: React.FC<DraggablePlaylistTrackProps> = ({
  item,
  index,
  totalItems,
  onReorder,
  onDragStart,
  onDragEnd,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(index);
  const dragY = useRef(new Animated.Value(0)).current;
  const startIndexRef = useRef(index);
  startIndexRef.current = index;
  const targetPreviewRef = useRef(index);
  targetPreviewRef.current = previewIndex;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
        onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          setIsDragging(true);
          onDragStart();
          targetPreviewRef.current = startIndexRef.current;
          setPreviewIndex(startIndexRef.current);
        },
        onPanResponderMove: (_, gestureState) => {
          dragY.setValue(gestureState.dy);
          const rowHeight = 56;
          const shift = Math.round(gestureState.dy / rowHeight);
          const target = Math.max(0, Math.min(totalItems - 1, startIndexRef.current + shift));
          if (target !== targetPreviewRef.current) {
            targetPreviewRef.current = target;
            setPreviewIndex(target);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          setIsDragging(false);
          onDragEnd();
          const rowHeight = 56;
          const shift = Math.round(gestureState.dy / rowHeight);
          const fromIdx = startIndexRef.current;
          const toIdx = Math.max(0, Math.min(totalItems - 1, fromIdx + shift));
          Animated.spring(dragY, {
            toValue: 0,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
          }).start();
          if (toIdx !== fromIdx) {
            onReorder(fromIdx, toIdx);
          }
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          setIsDragging(false);
          onDragEnd();
          Animated.spring(dragY, {
            toValue: 0,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
          }).start();
        },
      }),
    [totalItems, onReorder, dragY, onDragStart, onDragEnd]
  );

  return (
    <Animated.View
      style={[
        styles.reorderTrackRow,
        isDragging && styles.reorderTrackRowDragging,
        {
          transform: [{ translateY: dragY }],
          zIndex: isDragging ? 999 : 1,
        },
      ]}
    >
      <View style={[styles.indexBox, isDragging && styles.indexBoxDragging]}>
        <Text style={[styles.reorderIndexText, isDragging && styles.reorderIndexTextDragging]}>
          {isDragging
            ? `➔${(previewIndex + 1).toString().padStart(2, '0')}`
            : (index + 1).toString().padStart(2, '0')}
        </Text>
      </View>
      <View style={{ width: 38, height: 38, marginHorizontal: 8 }}>
        <ArtworkImage
          songId={item.id}
          hasArtwork={item.hasArtwork}
          title={item.title}
          artist={item.artist}
          size={38}
          borderRadius={3}
        />
      </View>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text numberOfLines={1} style={styles.reorderTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.reorderArtist}>
          {item.artist}
        </Text>
      </View>
      <View {...panResponder.panHandlers} style={styles.dragHandle}>
        <GripVertical
          size={20}
          color={isDragging ? colors.primaryLight : colors.textSecondary}
        />
      </View>
    </Animated.View>
  );
};

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ navigation }) => {
  const controls = usePlayerControls();
  const currentSongId = useCurrentSongId();

  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedSongIds, setLikedSongIds] = useState<string[]>([]);
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'playlists' | 'liked' | 'cached'>('playlists');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [isDraggingActive, setIsDraggingActive] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-reset tab to root state when navigating away to another tab
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setSelectedPlaylist(null);
      setIsReordering(false);
      setIsDraggingActive(false);
      setSelectedSongForActions(null);
    });
    return unsubscribe;
  }, [navigation]);

  // Create Playlist Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Add to Playlist modal for individual songs
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<Song | null>(null);

  // Action sheet for playlist tracks (Spotify-style 3 dots menu)
  const [selectedSongForActions, setSelectedSongForActions] = useState<Song | null>(null);

  const songMap = useMemo(() => {
    const map = new Map<string, Song>();
    allSongs.forEach((s) => map.set(s.id, s));
    return map;
  }, [allSongs]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetchSongs('');
      const songList = res.content || [];
      setAllSongs(songList);

      // Prune deleted songs from playlists & liked songs
      const validIds = new Set(songList.map((s) => s.id));
      await PlaylistStorage.pruneDeletedSongs(validIds);

      const plList = await PlaylistStorage.getPlaylists();
      setPlaylists(plList);
      setSelectedPlaylist((prev) => {
        if (!prev) return null;
        return plList.find((p) => p.id === prev.id) || null;
      });

      const liked = await PlaylistStorage.getLikedSongIds();
      setLikedSongIds(liked);

      const cacheEntries = await CacheStorage.getAllEntries();
      const completed = new Set(cacheEntries.filter((e) => e.isComplete).map((e) => e.songId));
      setCachedIds(completed);
    } catch (err: any) {
      console.warn('Failed to load library data:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = PlaylistStorage.addChangeListener(() => {
      loadData();
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your new playlist.');
      return;
    }
    await PlaylistStorage.createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setShowCreateModal(false);
    await loadData();
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    Alert.alert(
      'Remove from Library',
      `Remove "${playlist.name}" from your app library?\n\n(All songs remain safe and untouched on your server. You can re-add this collection anytime.)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from Library',
          style: 'destructive',
          onPress: async () => {
            await PlaylistStorage.deletePlaylist(playlist.id);
            if (selectedPlaylist?.id === playlist.id) {
              setSelectedPlaylist(null);
              setIsReordering(false);
            }
            await loadData();
          },
        },
      ]
    );
  };

  const handleRemoveTrackFromPlaylist = (song: Song) => {
    if (!selectedPlaylist) return;
    Alert.alert(
      'Remove from Playlist',
      `Remove "${song.title}" from "${selectedPlaylist.name}"?\n\n(The song will remain available in your library and on the server.)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await PlaylistStorage.removeSongFromPlaylist(selectedPlaylist.id, song.id);
          },
        },
      ]
    );
  };

  const handleMoveSong = async (fromIndex: number, toIndex: number) => {
    if (!selectedPlaylist) return;
    if (toIndex < 0 || toIndex >= activePlaylistSongs.length) return;
    await PlaylistStorage.reorderPlaylistSongs(selectedPlaylist.id, fromIndex, toIndex);
  };

  const likedSongs = useMemo(() => {
    return allSongs.filter((s) => likedSongIds.includes(s.id));
  }, [allSongs, likedSongIds]);

  const cachedSongs = useMemo(() => {
    return allSongs.filter((s) => cachedIds.has(s.id));
  }, [allSongs, cachedIds]);

  // Maintain the exact custom order configured by user:
  const activePlaylistSongs = useMemo(() => {
    if (!selectedPlaylist) return [];
    const songs: Song[] = [];
    selectedPlaylist.songIds.forEach((id) => {
      const s = songMap.get(id);
      if (s) songs.push(s);
    });
    return songs;
  }, [selectedPlaylist, songMap]);

  const handlePlaySongList = (song: Song, index: number, list: Song[]) => {
    controls.playTrack(song, list, index);
    navigation.navigate('Player');
  };

  const handlePlayAll = (list: Song[]) => {
    if (list.length === 0) return;
    controls.playTrack(list[0], list, 0);
    navigation.navigate('Player');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Retro Header */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.headerTitle}>LIBRARY</Text>
              <View style={styles.arcadeBadge}>
                <Text style={styles.arcadeBadgeText}>[INVENTORY]</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>PLAYLISTS, FAVORITES & OFFLINE ARCHIVE</Text>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.8}
          >
            <Plus size={13} color={colors.textDark} />
            <Text style={styles.createBtnText}>NEW PLAYLIST</Text>
          </TouchableOpacity>
        </View>

        {/* Retro View Switcher Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'playlists' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedPlaylist(null);
              setActiveTab('playlists');
            }}
            activeOpacity={0.8}
          >
            <ListMusic
              size={13}
              color={activeTab === 'playlists' ? colors.textDark : colors.textMuted}
            />
            <Text
              style={[styles.tabText, activeTab === 'playlists' && styles.tabTextActive]}
            >
              PLAYLISTS ({playlists.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'liked' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedPlaylist(null);
              setActiveTab('liked');
            }}
            activeOpacity={0.8}
          >
            <Heart
              size={13}
              color={activeTab === 'liked' ? colors.textDark : colors.textMuted}
              fill={activeTab === 'liked' ? colors.textDark : 'transparent'}
            />
            <Text style={[styles.tabText, activeTab === 'liked' && styles.tabTextActive]}>
              LIKED ({likedSongs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'cached' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedPlaylist(null);
              setActiveTab('cached');
            }}
            activeOpacity={0.8}
          >
            <HardDrive
              size={13}
              color={activeTab === 'cached' ? colors.textDark : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === 'cached' && styles.tabTextActive]}>
              CACHED ({cachedSongs.length})
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>LOADING INVENTORY...</Text>
          </View>
        ) : selectedPlaylist ? (
          /* PLAYLIST DETAIL VIEW */
          <View style={{ flex: 1 }}>
            <View style={styles.playlistDetailHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setIsReordering(false);
                  setSelectedPlaylist(null);
                }}
                activeOpacity={0.8}
              >
                <ArrowLeft size={15} color={colors.textPrimary} />
                <Text style={styles.backButtonText}>BACK</Text>
              </TouchableOpacity>

              <View style={styles.playlistHeaderActions}>
                {activePlaylistSongs.length > 1 && (
                  <TouchableOpacity
                    style={[styles.reorderToggleBtn, isReordering && styles.reorderToggleBtnActive]}
                    onPress={() => setIsReordering(!isReordering)}
                    activeOpacity={0.8}
                  >
                    <ArrowUpDown size={13} color={isReordering ? colors.textDark : colors.primary} />
                    <Text style={[styles.reorderToggleText, isReordering && styles.reorderToggleTextActive]}>
                      {isReordering ? 'DONE' : 'REORDER'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.deletePlaylistBtn}
                  onPress={() => handleDeletePlaylist(selectedPlaylist)}
                  activeOpacity={0.8}
                >
                  <Trash2 size={13} color={colors.error} />
                  <Text style={styles.deletePlaylistBtnText}>REMOVE</Text>
                </TouchableOpacity>
              </View>
            </View>

            {(() => {
              const firstSong = activePlaylistSongs[0];
              return (
                <View style={styles.playlistHeroCard}>
                  <View style={styles.playlistHeroArtFrame}>
                    {selectedPlaylist.artworkUrl ? (
                      <Image
                        source={{ uri: selectedPlaylist.artworkUrl }}
                        style={{ width: 66, height: 66 }}
                        resizeMode="cover"
                      />
                    ) : firstSong && firstSong.hasArtwork ? (
                      <ArtworkImage
                        songId={firstSong.id}
                        hasArtwork={firstSong.hasArtwork}
                        title={firstSong.title}
                        artist={firstSong.artist}
                        size={66}
                        borderRadius={3}
                      />
                    ) : (
                      <View style={styles.playlistHeroIcon}>
                        <Music size={26} color={colors.primary} />
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={styles.playlistHeroTitle}>
                      {selectedPlaylist.name}
                    </Text>
                    <Text style={styles.playlistHeroSubtitle}>
                      [{activePlaylistSongs.length} TRACKS READY]
                    </Text>
                  </View>

                  {activePlaylistSongs.length > 0 && !isReordering && (
                    <TouchableOpacity
                      style={styles.heroPlayButton}
                      onPress={() => handlePlayAll(activePlaylistSongs)}
                      activeOpacity={0.8}
                    >
                      <Play size={14} color={colors.textDark} fill={colors.textDark} />
                      <Text style={styles.heroPlayText}>PLAY ALL</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}

            <FlatList
              data={activePlaylistSongs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              getItemLayout={(data, index) => ({ length: 68, offset: 68 * index, index })}
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              scrollEnabled={!isDraggingActive}
              renderItem={({ item, index }) => (
                isReordering ? (
                  <DraggablePlaylistTrack
                    item={item}
                    index={index}
                    totalItems={activePlaylistSongs.length}
                    onReorder={handleMoveSong}
                    onDragStart={() => setIsDraggingActive(true)}
                    onDragEnd={() => setIsDraggingActive(false)}
                  />
                ) : (
                  <View style={styles.playlistTrackRow}>
                    <View style={{ flex: 1 }}>
                      <SongListItem
                        song={item}
                        isCurrentSong={currentSongId === item.id}
                        onPress={() => handlePlaySongList(item, index, activePlaylistSongs)}
                        onAddToPlaylist={(song) => setSelectedSongForPlaylist(song)}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.trackMenuBtn}
                      onPress={() => setSelectedSongForActions(item)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <EllipsisVertical size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>PLAYLIST IS EMPTY</Text>
                  <Text style={styles.emptySubtext}>
                    Add songs to this playlist using the [+] button on any track.
                  </Text>
                </View>
              }
            />
          </View>
        ) : activeTab === 'playlists' ? (
          /* PLAYLISTS LIST */
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            getItemLayout={(data, index) => ({ length: 64, offset: 64 * index, index })}
            initialNumToRender={12}
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
            ListHeaderComponent={
              /* Liked Songs Quick Card */
              <TouchableOpacity
                style={styles.likedHeroCard}
                onPress={() => setActiveTab('liked')}
                activeOpacity={0.8}
              >
                <View style={styles.likedIconBg}>
                  <Heart size={20} color={colors.textDark} fill={colors.textDark} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.likedHeroTitle}>LIKED TRACKS</Text>
                  <Text style={styles.likedHeroSubtitle}>
                    [{likedSongs.length} FAVORITES]
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.primaryDark} />
              </TouchableOpacity>
            }
            renderItem={({ item }) => {
              // Real valid count strictly filtering server-existing songs
              const validCount = item.songIds.filter((id) => songMap.has(id)).length;
              const itemFirstSong = allSongs.find((s) => item.songIds.includes(s.id));

              return (
                <TouchableOpacity
                  style={styles.playlistRowItem}
                  onPress={() => setSelectedPlaylist(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.playlistRowArtFrame}>
                    {item.artworkUrl ? (
                      <Image
                        source={{ uri: item.artworkUrl }}
                        style={{ width: 44, height: 44 }}
                        resizeMode="cover"
                      />
                    ) : itemFirstSong && itemFirstSong.hasArtwork ? (
                      <ArtworkImage
                        songId={itemFirstSong.id}
                        hasArtwork={itemFirstSong.hasArtwork}
                        title={itemFirstSong.title}
                        artist={itemFirstSong.artist}
                        size={44}
                        borderRadius={3}
                      />
                    ) : (
                      <View style={styles.playlistRowIcon}>
                        <Music size={18} color={colors.primaryDark} />
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={styles.playlistRowTitle}>
                      {item.name}
                    </Text>
                    <Text style={styles.playlistRowCount}>
                      [{validCount} TRACKS]
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.creamMuted} />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FolderHeart size={38} color={colors.primaryDark} />
                <Text style={styles.emptyTitle}>NO PLAYLISTS YET</Text>
                <Text style={styles.emptySubtext}>
                  Tap "+ NEW PLAYLIST" above to create your first collection.
                </Text>
              </View>
            }
          />
        ) : activeTab === 'liked' ? (
          /* LIKED SONGS LIST */
          <FlatList
            data={likedSongs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            getItemLayout={(data, index) => ({ length: 68, offset: 68 * index, index })}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            ListHeaderComponent={
              likedSongs.length > 0 ? (
                <View style={styles.tabHeaderActionRow}>
                  <Text style={styles.tabHeaderCount}>[{likedSongs.length} FAVORITES]</Text>
                  <TouchableOpacity
                    style={styles.playAllBtn}
                    onPress={() => handlePlayAll(likedSongs)}
                    activeOpacity={0.8}
                  >
                    <Play size={11} color={colors.textDark} fill={colors.textDark} />
                    <Text style={styles.playAllBtnText}>PLAY ALL</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <SongListItem
                song={item}
                isCurrentSong={currentSongId === item.id}
                onPress={() => handlePlaySongList(item, index, likedSongs)}
                onAddToPlaylist={(song) => setSelectedSongForPlaylist(song)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Heart size={38} color={colors.primaryDark} />
                <Text style={styles.emptyTitle}>NO LIKED TRACKS</Text>
                <Text style={styles.emptySubtext}>
                  Tap the heart icon on any song to save it to your favorites.
                </Text>
              </View>
            }
          />
        ) : (
          /* CACHED SONGS LIST */
          <FlatList
            data={cachedSongs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            getItemLayout={(data, index) => ({ length: 68, offset: 68 * index, index })}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            ListHeaderComponent={
              cachedSongs.length > 0 ? (
                <View style={styles.tabHeaderActionRow}>
                  <Text style={styles.tabHeaderCount}>
                    [{cachedSongs.length} OFFLINE READY]
                  </Text>
                  <TouchableOpacity
                    style={styles.playAllBtn}
                    onPress={() => handlePlayAll(cachedSongs)}
                    activeOpacity={0.8}
                  >
                    <Play size={11} color={colors.textDark} fill={colors.textDark} />
                    <Text style={styles.playAllBtnText}>PLAY ALL</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <SongListItem
                song={item}
                isCurrentSong={currentSongId === item.id}
                onPress={() => handlePlaySongList(item, index, cachedSongs)}
                onAddToPlaylist={(song) => setSelectedSongForPlaylist(song)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <HardDrive size={38} color={colors.mint} />
                <Text style={styles.emptyTitle}>NO CACHED TRACKS</Text>
                <Text style={styles.emptySubtext}>
                  Cached tracks appear here for offline listening.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* CREATE PLAYLIST MODAL */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>[NEW PLAYLIST]</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 8-Bit Beats, Boss Battle, Chill"
              placeholderTextColor={colors.textMuted}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCreateModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCreate}
                onPress={handleCreatePlaylist}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCreateText}>CREATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD TO PLAYLIST MODAL */}
      <AddToPlaylistModal
        visible={selectedSongForPlaylist !== null}
        song={selectedSongForPlaylist}
        onClose={() => setSelectedSongForPlaylist(null)}
      />

      {/* SONG ACTION SHEET MODAL (Spotify-style 3 dots menu) */}
      <Modal
        visible={!!selectedSongForActions}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSongForActions(null)}
      >
        <View style={styles.actionSheetOverlay}>
          <TouchableOpacity
            style={styles.actionSheetBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedSongForActions(null)}
          />
          {selectedSongForActions && (
            <View style={styles.actionSheetContent}>
              <View style={styles.actionSheetHeader}>
                <View style={styles.actionSheetArtFrame}>
                  <ArtworkImage
                    songId={selectedSongForActions.id}
                    hasArtwork={selectedSongForActions.hasArtwork}
                    title={selectedSongForActions.title}
                    artist={selectedSongForActions.artist}
                    size={48}
                    borderRadius={4}
                  />
                </View>
                <View style={styles.actionSheetMeta}>
                  <Text numberOfLines={1} style={styles.actionSheetTitle}>
                    {selectedSongForActions.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.actionSheetArtist}>
                    {selectedSongForActions.artist}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedSongForActions(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.actionSheetItem}
                activeOpacity={0.7}
                onPress={() => {
                  const s = selectedSongForActions;
                  setSelectedSongForActions(null);
                  controls.playNextInQueue(s);
                  Alert.alert('Queue Updated', `"${s.title}" will play next.`);
                }}
              >
                <ListPlus size={18} color={colors.primaryLight} />
                <Text style={styles.actionSheetItemText}>Play Next in Queue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetItem}
                activeOpacity={0.7}
                onPress={() => {
                  const s = selectedSongForActions;
                  setSelectedSongForActions(null);
                  controls.addToQueue(s);
                  Alert.alert('Queue Updated', `"${s.title}" added to queue.`);
                }}
              >
                <ListMusic size={18} color={colors.mint} />
                <Text style={styles.actionSheetItemText}>Add to Queue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetItem}
                activeOpacity={0.7}
                onPress={() => {
                  const s = selectedSongForActions;
                  setSelectedSongForActions(null);
                  setSelectedSongForPlaylist(s);
                }}
              >
                <Plus size={18} color={colors.lavender} />
                <Text style={styles.actionSheetItemText}>Add to Another Playlist</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetItem}
                activeOpacity={0.7}
                onPress={async () => {
                  const s = selectedSongForActions;
                  setSelectedSongForActions(null);
                  await PlaylistStorage.toggleLikeSong(s.id);
                  const updatedLikes = await PlaylistStorage.getLikedSongIds();
                  setLikedSongIds(updatedLikes);
                }}
              >
                <Heart
                  size={18}
                  color={likedSongIds.includes(selectedSongForActions.id) ? colors.primary : colors.textMuted}
                  fill={likedSongIds.includes(selectedSongForActions.id) ? colors.primary : 'transparent'}
                />
                <Text style={styles.actionSheetItemText}>
                  {likedSongIds.includes(selectedSongForActions.id)
                    ? 'Remove from Liked Songs'
                    : 'Save to Liked Songs'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionSheetItem, styles.actionSheetItemDestructive]}
                activeOpacity={0.7}
                onPress={() => {
                  const s = selectedSongForActions;
                  setSelectedSongForActions(null);
                  handleRemoveTrackFromPlaylist(s);
                }}
              >
                <Trash2 size={18} color={colors.error} />
                <Text style={[styles.actionSheetItemText, styles.actionSheetItemTextDestructive]}>
                  Remove from this Playlist
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.pixelBorderSoft,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  arcadeBadge: {
    backgroundColor: '#271F36',
    borderWidth: 1,
    borderColor: colors.lavender,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  arcadeBadgeText: {
    fontSize: 8,
    color: colors.lavender,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    gap: 4,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  createBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.pixelBorderSoft,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.pixelBorder,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: colors.textDark,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 90,
  },
  likedHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    padding: 10,
    marginBottom: 8,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  likedIconBg: {
    width: 44,
    height: 44,
    backgroundColor: colors.primaryDark,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
  },
  likedHeroTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  likedHeroSubtitle: {
    fontSize: 10,
    color: colors.lavender,
    fontWeight: '800',
    marginTop: 2,
  },
  playlistRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    padding: 8,
    marginVertical: 3,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  playlistRowArtFrame: {
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  playlistRowIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#27203A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistRowTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  playlistRowCount: {
    fontSize: 10,
    color: colors.creamMuted,
    marginTop: 2,
    fontWeight: '700',
  },
  playlistDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  backButtonText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  playlistHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reorderToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
  },
  reorderToggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  reorderToggleText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  reorderToggleTextActive: {
    color: colors.textDark,
  },
  deletePlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
    backgroundColor: '#2A141A',
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  deletePlaylistBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.error,
    letterSpacing: 0.5,
  },
  reorderTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginVertical: 3,
  },
  indexBox: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBoxDragging: {
    backgroundColor: colors.primary,
    borderRadius: 3,
    paddingHorizontal: 4,
    width: 'auto',
    minWidth: 32,
  },
  reorderIndexText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  reorderIndexTextDragging: {
    color: colors.textDark,
  },
  reorderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  reorderArtist: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moveBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: {
    opacity: 0.3,
  },
  playlistTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackRemoveBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    padding: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  playlistHeroArtFrame: {
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  playlistHeroIcon: {
    width: 66,
    height: 66,
    backgroundColor: '#27203A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistHeroTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  playlistHeroSubtitle: {
    fontSize: 10,
    color: colors.lavender,
    fontWeight: '800',
    marginTop: 2,
  },
  heroPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  heroPlayText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  tabHeaderActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  tabHeaderCount: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.lavender,
    letterSpacing: 0.5,
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  playAllBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1,
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 14, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 6,
    padding: 16,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1,
  },
  modalInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorderSoft,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  modalCancel: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorderSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 3,
  },
  modalCancelText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textSecondary,
  },
  reorderTrackRowDragging: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 999,
  },
  dragHandle: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackMenuBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCreate: {
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 3,
  },
  modalCreateText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textDark,
  },
  // Spotify-style Action Sheet styles
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 12, 16, 0.85)',
    justifyContent: 'flex-end',
  },
  actionSheetBackdrop: {
    flex: 1,
  },
  actionSheetContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: colors.pixelBorder,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.pixelBorderSoft,
    marginBottom: 8,
  },
  actionSheetArtFrame: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
  },
  actionSheetMeta: {
    flex: 1,
    marginLeft: 12,
  },
  actionSheetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  actionSheetArtist: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  actionSheetItemDestructive: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.pixelBorderSoft,
  },
  actionSheetItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 14,
    letterSpacing: 0.5,
  },
  actionSheetItemTextDestructive: {
    color: colors.error,
  },
});
