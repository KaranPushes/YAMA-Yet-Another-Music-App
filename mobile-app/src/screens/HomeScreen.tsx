import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { Song } from '../types/song';
import { fetchSongs, triggerLibraryScan } from '../api/songApi';
import { SongListItem } from '../components/SongListItem';
import { ArtworkImage } from '../components/ArtworkImage';
import { usePlayerControls, useCurrentSongId } from '../player/PlayerContext';
import { PlaylistStorage } from '../cache/PlaylistStorage';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { AddMusicModal } from '../components/AddMusicModal';
import { DownloadJob, ExternalTrack } from '../types/download';
import { searchUnified, createDownloadJob, getDownloadJobs } from '../api/downloadApi';
import {
  Search,
  RefreshCw,
  Play,
  Sparkles,
  Disc,
  Clock,
  DownloadCloud,
  Plus,
  Check,
  Music,
  ListMusic,
  ArrowLeft,
  X,
  BookmarkPlus,
} from 'lucide-react-native';
import {
  PixelDiceIcon,
  PixelPlayIcon,
  PixelSparkleIcon,
} from '../components/PixelIcons';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const controls = usePlayerControls();
  const currentSongId = useCurrentSongId();

  const [songs, setSongs] = useState<Song[]>([]);
  const [importedJobs, setImportedJobs] = useState<DownloadJob[]>([]);
  const [selectedImportedJob, setSelectedImportedJob] = useState<DownloadJob | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [savedMixIds, setSavedMixIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // External catalog search
  const [externalTracks, setExternalTracks] = useState<ExternalTrack[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [queuedKeys, setQueuedKeys] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);

  // Add to Playlist modal
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<Song | null>(null);

  // Map of songs by ID for fast lookup
  const songMap = useMemo(() => {
    const map = new Map<string, Song>();
    songs.forEach((s) => map.set(s.id, s));
    return map;
  }, [songs]);

  // Load imported playlists / acquisition jobs
  const loadImportedPlaylists = useCallback(async () => {
    try {
      const jobs = await getDownloadJobs(0, 40);
      // Filter jobs that represent playlists or multi-track acquisitions
      const playlistJobs = (jobs || []).filter(
        (j) => j.type === 'PLAYLIST' || (j.items && j.items.length > 1)
      );
      setImportedJobs(playlistJobs);
    } catch (err: any) {
      console.warn('Failed to load imported playlists on Home:', err.message);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await fetchSongs(searchQuery);
      const fetchedSongs = res.content || [];
      setSongs(fetchedSongs);

      // Prune deleted songs from playlists & liked songs
      const validIds = new Set(fetchedSongs.map((s) => s.id));
      PlaylistStorage.pruneDeletedSongs(validIds).catch(() => {});
    } catch (err: any) {
      console.warn('Failed to fetch songs on Home:', err.message);
      setErrorMessage('Unable to connect to YAMA server. Check your Server URL in Settings.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadData();
    loadImportedPlaylists();
  }, [loadData, loadImportedPlaylists]);

  // Search external catalog when user types query
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setExternalTracks([]);
      setIsSearchingExternal(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingExternal(true);
      try {
        const res = await searchUnified(q);
        const notInLibrary = (res.external || []).filter((item) => !item.alreadyInLibrary);
        setExternalTracks(notInLibrary);
      } catch (err: any) {
        console.warn('External search error:', err.message);
      } finally {
        setIsSearchingExternal(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddExternalSong = async (track: ExternalTrack) => {
    const key = `${track.title}-${track.artist}`;
    setQueuedKeys((prev) => new Set(prev).add(key));
    try {
      await createDownloadJob('TRACK', track.sourceQuery || `${track.title} ${track.artist}`);
    } catch (err: any) {
      Alert.alert('Acquisition Failed', err.message || 'Could not queue track.');
      setQueuedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleAddImportedToLibrary = async (job: DownloadJob) => {
    const matchedSongIds = (job.items || [])
      .map((it) => it.songId)
      .filter((id): id is string => typeof id === 'string' && songMap.has(id));

    const playlistTitle = job.title || 'Imported Playlist';
    await PlaylistStorage.createPlaylist(
      playlistTitle,
      `Imported via YAMA Acquisition (${matchedSongIds.length} tracks)`,
      undefined,
      matchedSongIds
    );

    setSavedJobIds((prev) => new Set(prev).add(job.id));
    Alert.alert(
      '★ SAVED TO LIBRARY!',
      `"${playlistTitle}" was added to your Library with ${matchedSongIds.length} available songs.`
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
    loadImportedPlaylists();
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await triggerLibraryScan();
      await loadData();
      await loadImportedPlaylists();
    } catch (err: any) {
      console.warn('Sync failed:', err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handlePlaySong = (song: Song, index: number, songList: Song[]) => {
    controls.playTrack(song, songList, index);
    navigation.navigate('Player');
  };

  // Sort songs by createdAt descending for "Recently Added"
  const recentlyAdded = useMemo(() => {
    return [...songs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [songs]);

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return songs;
    const q = searchQuery.toLowerCase();
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.album && s.album.toLowerCase().includes(q))
    );
  }, [songs, searchQuery]);

  const dynamicMixes = useMemo(() => {
    if (songs.length === 0) return [];
    const mixes: {
      id: string;
      badge: string;
      title: string;
      subtitle: string;
      songs: Song[];
      tag: string;
    }[] = [];

    // Mix 1: Neon Night Drive (Longer / chill tracks or first half)
    const nightDriveTracks = songs.filter((s) => (s.duration || 0) >= 180);
    const pool1 = nightDriveTracks.length >= 2 ? nightDriveTracks : songs.slice(0, 6);
    if (pool1.length > 0) {
      mixes.push({
        id: 'mix_neon_night',
        badge: '[CHILL // WAVE]',
        title: 'NEON NIGHT DRIVE',
        subtitle: 'Atmospheric synth & late night groove',
        songs: pool1.slice(0, 8),
        tag: 'SYNTH',
      });
    }

    // Mix 2: Boss Rush Blaster (Energetic / shorter tracks or reverse)
    const bossRushTracks = songs.filter((s) => (s.duration || 0) < 180);
    const pool2 = bossRushTracks.length >= 2 ? bossRushTracks : [...songs].reverse().slice(0, 6);
    if (pool2.length > 0) {
      mixes.push({
        id: 'mix_boss_rush',
        badge: '[HIGH SPEED // 1UP]',
        title: 'BOSS RUSH BLASTER',
        subtitle: 'Uptempo arcade power soundtrack',
        songs: pool2.slice(0, 8),
        tag: 'SPEED',
      });
    }

    // Mix 3: Artist Spotlight (Find top artist with >= 2 songs)
    const artistCounts: Record<string, Song[]> = {};
    songs.forEach((s) => {
      const art = s.artist?.trim();
      if (art && art !== 'Unknown' && art !== 'Unknown Artist') {
        if (!artistCounts[art]) artistCounts[art] = [];
        artistCounts[art].push(s);
      }
    });
    const sortedArtists = Object.entries(artistCounts).sort((a, b) => b[1].length - a[1].length);
    if (sortedArtists.length > 0 && sortedArtists[0][1].length >= 2) {
      const [topArtist, artistSongs] = sortedArtists[0];
      mixes.push({
        id: `mix_artist_${topArtist.toLowerCase().replace(/\s+/g, '_')}`,
        badge: '[ARTIST SPOTLIGHT]',
        title: `${topArtist.toUpperCase()} ESSENTIALS`,
        subtitle: `Curated signature tracks by ${topArtist}`,
        songs: artistSongs,
        tag: 'ARTIST',
      });
    }

    // Mix 4: Random Quest Odyssey
    if (songs.length >= 3) {
      const shuffled = [...songs].sort((a, b) => (a.title > b.title ? 1 : -1));
      mixes.push({
        id: 'mix_arcade_quest',
        badge: '[RANDOM QUEST]',
        title: 'ARCADE ODYSSEY',
        subtitle: 'Eclectic crossover session from your vault',
        songs: shuffled.slice(0, 8),
        tag: 'QUEST',
      });
    }

    return mixes;
  }, [songs]);

  const handleStartShuffleJam = () => {
    if (songs.length === 0) {
      Alert.alert('No Tracks', 'Your library is empty. Add songs to start a jam session!');
      return;
    }
    const shuffled = [...songs].sort(() => 0.5 - Math.random());
    handlePlaySong(shuffled[0], 0, shuffled);
  };

  const handleSaveDynamicMix = async (mix: { id: string; title: string; subtitle: string; songs: Song[] }) => {
    try {
      const ids = mix.songs.map((s) => s.id);
      await PlaylistStorage.createPlaylist(mix.title, mix.subtitle, undefined, ids);
      setSavedMixIds((prev) => new Set(prev).add(mix.id));
      Alert.alert('PLAYLIST SAVED ★', `"${mix.title}" has been saved into your Library!`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save playlist');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Retro Arcade Header */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.appName}>YAMA</Text>
              <View style={styles.arcadeBadge}>
                <Sparkles size={10} color={colors.primaryDark} />
                <Text style={styles.arcadeBadgeText}>[1UP RETRO]</Text>
              </View>
            </View>
            <Text style={styles.appSubtitle}>8-BIT SOUNDTRACK & ARCHIVE</Text>
          </View>

          <View style={styles.headerButtonsRow}>
            <TouchableOpacity
              style={[styles.scanButton, isScanning && styles.scanningButton]}
              onPress={handleScan}
              disabled={isScanning}
              activeOpacity={0.7}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={colors.textDark} />
              ) : (
                <>
                  <RefreshCw size={12} color={colors.textDark} />
                  <Text style={styles.scanButtonText}>SYNC</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Retro Pixel Search Bar */}
        <View style={styles.searchBar}>
          <View style={styles.searchPrefixBadge}>
            <Text style={styles.searchPrefixText}>[FIND]</Text>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search audio, artist, stage..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
              <Text style={styles.clearSearchText}>[CLR]</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>LOADING SOUNDTRACK...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorTitle}>[ CONNECTION ERROR ]</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.settingsNavButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.settingsNavText}>OPEN SETTINGS</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredSongs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            getItemLayout={(data, index) => ({ length: 68, offset: 68 * index, index })}
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
            ListHeaderComponent={
              !searchQuery.trim() && songs.length > 0 ? (
                <View style={styles.homeSectionsContainer}>
                  {/* ARCADE SHUFFLE JAM BANNER */}
                  <View style={styles.shuffleJamBanner}>
                    <View style={styles.shuffleJamLeft}>
                      <View style={styles.shuffleBadgeRow}>
                        <PixelDiceIcon size={13} color={colors.primaryLight} />
                        <Text style={styles.shuffleBadgeText}>[ARCADE DICE // 1-TAP SHUFFLE]</Text>
                      </View>
                      <Text style={styles.shuffleJamTitle}>SHUFFLE JAM SESSION</Text>
                      <Text style={styles.shuffleJamSub}>
                        Roll the 8-bit dice & queue up a randomized soundtrack mix.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.shuffleJamBtn}
                      onPress={handleStartShuffleJam}
                      activeOpacity={0.8}
                    >
                      <PixelPlayIcon size={12} color={colors.textDark} />
                      <Text style={styles.shuffleJamBtnText}>JAM</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 1. RETRO 2-COLUMN QUICK GRID ("JUMP BACK IN") */}
                  <View style={styles.sectionHeaderLine}>
                    <Text style={styles.sectionBadgeTag}>[STAGE 01]</Text>
                    <Text style={styles.greetingHeading}>JUMP BACK IN</Text>
                  </View>

                  <View style={styles.quickGridContainer}>
                    {songs.slice(0, 6).map((song, idx) => (
                      <TouchableOpacity
                        key={`grid_${song.id}`}
                        style={styles.gridCard}
                        onPress={() => handlePlaySong(song, idx, songs.slice(0, 6))}
                        activeOpacity={0.8}
                      >
                        <View style={styles.gridArtBox}>
                          <ArtworkImage
                            songId={song.id}
                            hasArtwork={song.hasArtwork}
                            title={song.title}
                            artist={song.artist}
                            size={44}
                            borderRadius={3}
                          />
                        </View>
                        <View style={styles.gridCardContent}>
                          <Text numberOfLines={1} style={styles.gridCardTitle}>
                            {song.title}
                          </Text>
                          <Text numberOfLines={1} style={styles.gridCardArtist}>
                            {song.artist}
                          </Text>
                        </View>
                        <View style={styles.gridPlayButton}>
                          <Play size={10} color={colors.textDark} fill={colors.textDark} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 2. IMPORTED PLAYLISTS SECTION */}
                  <View style={[styles.sectionHeaderLine, { marginTop: 22 }]}>
                    <Text style={styles.sectionBadgeTag}>[DISC]</Text>
                    <Text style={styles.greetingHeading}>IMPORTED PLAYLISTS</Text>
                  </View>

                  {importedJobs.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.horizontalScrollContent}
                    >
                      {importedJobs.map((job) => {
                        const items = job.items || [];
                        const completedCount = items.filter((i) => i.status === 'COMPLETED').length;
                        const firstCompletedWithSong = items.find((i) => i.songId && songMap.has(i.songId));
                        const matchedSong = firstCompletedWithSong?.songId ? songMap.get(firstCompletedWithSong.songId) : null;
                        const isSaved = savedJobIds.has(job.id);

                        return (
                          <View key={job.id} style={styles.importedPlaylistCard}>
                            <TouchableOpacity
                              onPress={() => setSelectedImportedJob(job)}
                              activeOpacity={0.8}
                            >
                              <View style={styles.playlistArtFrame}>
                                {matchedSong && matchedSong.hasArtwork ? (
                                  <ArtworkImage
                                    songId={matchedSong.id}
                                    hasArtwork={matchedSong.hasArtwork}
                                    title={matchedSong.title}
                                    artist={matchedSong.artist}
                                    size={110}
                                    borderRadius={4}
                                  />
                                ) : (
                                  <View style={styles.playlistArtFallback}>
                                    <ListMusic size={32} color={colors.primaryDark} />
                                  </View>
                                )}
                                <View style={styles.statusTag}>
                                  <Text style={styles.statusTagText}>
                                    {job.status === 'COMPLETED' ? 'READY' : job.status}
                                  </Text>
                                </View>
                              </View>

                              <Text numberOfLines={1} style={styles.importedPlaylistTitle}>
                                {job.title || 'Imported Playlist'}
                              </Text>
                              <Text numberOfLines={1} style={styles.importedPlaylistCount}>
                                [{completedCount}/{job.totalItems || items.length} TRACKS]
                              </Text>
                            </TouchableOpacity>

                            {/* [ + ADD TO LIBRARY ] BUTTON */}
                            <TouchableOpacity
                              style={[
                                styles.addToLibraryBtn,
                                isSaved && styles.addToLibraryBtnSaved,
                              ]}
                              onPress={() => handleAddImportedToLibrary(job)}
                              activeOpacity={0.8}
                            >
                              {isSaved ? (
                                <>
                                  <Check size={11} color={colors.textDark} />
                                  <Text style={styles.addToLibraryText}>SAVED ★</Text>
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus size={11} color={colors.textDark} />
                                  <Text style={styles.addToLibraryText}>+ TO LIBRARY</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <TouchableOpacity
                      style={styles.emptyImportCard}
                      onPress={() => navigation.navigate('Search')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.emptyImportIconBox}>
                        <Search size={20} color={colors.primaryDark} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.emptyImportTitle}>[ + DISCOVER & IMPORT ]</Text>
                        <Text style={styles.emptyImportSub}>
                          Paste Spotify or YouTube playlist links in the Search tab to acquire music.
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* 3. DYNAMIC ARCADE JAMS & RANDOM PLAYLISTS */}
                  {dynamicMixes.length > 0 && (
                    <>
                      <View style={[styles.sectionHeaderLine, { marginTop: 22 }]}>
                        <Text style={styles.sectionBadgeTag}>[ARCADE JAMS]</Text>
                        <Text style={styles.greetingHeading}>SMART MIXES & JAMS</Text>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                      >
                        {dynamicMixes.map((mix) => {
                          const isSaved = savedMixIds.has(mix.id);
                          const leadSong = mix.songs[0];
                          return (
                            <View key={mix.id} style={styles.dynamicMixCard}>
                              <TouchableOpacity
                                onPress={() => handlePlaySong(leadSong, 0, mix.songs)}
                                activeOpacity={0.8}
                              >
                                <View style={styles.mixArtFrame}>
                                  {leadSong && leadSong.hasArtwork ? (
                                    <ArtworkImage
                                      songId={leadSong.id}
                                      hasArtwork={leadSong.hasArtwork}
                                      title={leadSong.title}
                                      artist={leadSong.artist}
                                      size={120}
                                      borderRadius={4}
                                    />
                                  ) : (
                                    <View style={styles.mixArtFallback}>
                                      <Disc size={36} color={colors.primaryLight} />
                                    </View>
                                  )}
                                  <View style={styles.mixTag}>
                                    <Text style={styles.mixTagText}>{mix.tag}</Text>
                                  </View>
                                  <View style={styles.quickPlayOverlay}>
                                    <Play size={12} color={colors.textDark} fill={colors.textDark} />
                                  </View>
                                </View>

                                <Text numberOfLines={1} style={styles.dynamicMixTitle}>
                                  {mix.title}
                                </Text>
                                <Text numberOfLines={1} style={styles.dynamicMixSubtitle}>
                                  {mix.subtitle}
                                </Text>
                                <Text style={styles.dynamicMixCount}>
                                  [{mix.songs.length} TRACKS]
                                </Text>
                              </TouchableOpacity>

                              {/* Action Buttons: PLAY + SAVE */}
                              <View style={styles.mixActionRow}>
                                <TouchableOpacity
                                  style={styles.mixPlayBtn}
                                  onPress={() => handlePlaySong(leadSong, 0, mix.songs)}
                                  activeOpacity={0.8}
                                >
                                  <Play size={10} color={colors.textDark} fill={colors.textDark} />
                                  <Text style={styles.mixPlayBtnText}>PLAY</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[styles.mixSaveBtn, isSaved && styles.mixSaveBtnSaved]}
                                  onPress={() => handleSaveDynamicMix(mix)}
                                  activeOpacity={0.8}
                                >
                                  {isSaved ? (
                                    <>
                                      <Check size={10} color={colors.textDark} />
                                      <Text style={styles.mixSaveBtnText}>SAVED</Text>
                                    </>
                                  ) : (
                                    <>
                                      <Plus size={10} color={colors.primaryLight} />
                                      <Text style={[styles.mixSaveBtnText, { color: colors.primaryLight }]}>
                                        SAVE
                                      </Text>
                                    </>
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </ScrollView>
                    </>
                  )}

                  {/* 3. RECENTLY ADDED SOUNDTRACK */}
                  {recentlyAdded.length > 0 && (
                    <>
                      <View style={[styles.sectionHeaderLine, { marginTop: 22 }]}>
                        <Text style={styles.sectionBadgeTag}>[LOG]</Text>
                        <Text style={styles.greetingHeading}>RECENTLY ADDED</Text>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                      >
                        {recentlyAdded.map((song, idx) => (
                          <TouchableOpacity
                            key={song.id}
                            style={styles.recentCard}
                            onPress={() => handlePlaySong(song, idx, recentlyAdded)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.recentArtFrame}>
                              <ArtworkImage
                                songId={song.id}
                                hasArtwork={song.hasArtwork}
                                title={song.title}
                                artist={song.artist}
                                size={110}
                                borderRadius={4}
                              />
                              <View style={styles.quickPlayOverlay}>
                                <Play size={14} color={colors.textDark} fill={colors.textDark} />
                              </View>
                            </View>
                            <Text numberOfLines={1} style={styles.recentTitle}>
                              {song.title}
                            </Text>
                            <Text numberOfLines={1} style={styles.recentArtist}>
                              {song.artist}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}

                  {/* 4. ALL SONGS SECTION HEADING */}
                  <View style={[styles.sectionHeaderLine, { marginTop: 22, marginBottom: 8 }]}>
                    <Text style={styles.sectionBadgeTag}>[BGM]</Text>
                    <Text style={styles.greetingHeading}>ALL TRACKS ({songs.length})</Text>
                  </View>
                </View>
              ) : searchQuery.trim() && filteredSongs.length > 0 ? (
                <View style={[styles.sectionHeaderLine, { marginBottom: 8 }]}>
                  <Text style={styles.sectionBadgeTag}>[RESULT]</Text>
                  <Text style={styles.greetingHeading}>
                    MATCHED TRACKS ({filteredSongs.length})
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <SongListItem
                song={item}
                isCurrentSong={currentSongId === item.id}
                onPress={() => handlePlaySong(item, index, filteredSongs)}
                onAddToPlaylist={(song) => setSelectedSongForPlaylist(song)}
              />
            )}
            ListFooterComponent={
              searchQuery.trim().length > 0 ? (
                <View style={styles.externalSearchSection}>
                  {isSearchingExternal ? (
                    <View style={styles.searchingExternalRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.searchingExternalText}>
                        SEARCHING CATALOG FOR TRACKS...
                      </Text>
                    </View>
                  ) : externalTracks.length > 0 ? (
                    <View>
                      <View style={[styles.sectionHeaderLine, { marginTop: 14, marginBottom: 8 }]}>
                        <Text style={styles.sectionBadgeTag}>[NET]</Text>
                        <Text style={styles.greetingHeading}>ACQUISITION MATCHES</Text>
                      </View>

                      {externalTracks.map((item, idx) => {
                        const key = `${item.title}-${item.artist}`;
                        const isQueued = queuedKeys.has(key);
                        return (
                          <View key={idx} style={styles.externalResultCard}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.externalTrackTitle} numberOfLines={1}>
                                {item.title}
                              </Text>
                              <Text style={styles.externalTrackArtist} numberOfLines={1}>
                                {item.artist} {item.album ? `• ${item.album}` : ''}
                              </Text>
                            </View>
                            {isQueued ? (
                              <View style={styles.queuedBadge}>
                                <Check size={11} color={colors.mint} />
                                <Text style={styles.queuedBadgeText}>QUEUED</Text>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.addToYamaButton}
                                onPress={() => handleAddExternalSong(item)}
                                activeOpacity={0.8}
                              >
                                <Plus size={11} color={colors.textDark} />
                                <Text style={styles.addToYamaButtonText}>ACQUIRE</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : filteredSongs.length === 0 ? (
                    <View style={styles.fallbackAcquisitionCard}>
                      <DownloadCloud size={32} color={colors.primaryDark} />
                      <Text style={styles.fallbackTitle}>NOT IN ARCHIVE</Text>
                      <Text style={styles.fallbackSubtext}>
                        "{searchQuery}" was not found locally. Would you like to acquire it?
                      </Text>
                      <TouchableOpacity
                        style={styles.fallbackAddButton}
                        onPress={() =>
                          handleAddExternalSong({
                            title: searchQuery,
                            artist: 'Various',
                            duration: 0,
                            sourceQuery: searchQuery,
                            alreadyInLibrary: false,
                          })
                        }
                        activeOpacity={0.8}
                      >
                        <Plus size={13} color={colors.textDark} />
                        <Text style={styles.fallbackAddButtonText}>ACQUIRE TRACK</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null
            }
            ListEmptyComponent={
              !searchQuery.trim() ? (
                <View style={styles.emptyContainer}>
                  <Disc size={38} color={colors.primaryDark} />
                  <Text style={styles.emptyTitle}>NO TRACKS FOUND</Text>
                  <Text style={styles.emptySubtext}>
                    Tap SYNC above or ACQUIRE to import your favorite music!
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>

      {/* IMPORTED PLAYLIST TRACKS MODAL */}
      <Modal
        visible={selectedImportedJob !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedImportedJob(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          {selectedImportedJob && (() => {
            const items = selectedImportedJob.items || [];
            const readySongs: Song[] = [];
            items.forEach((it) => {
              if (it.songId && songMap.has(it.songId)) {
                readySongs.push(songMap.get(it.songId)!);
              }
            });

            return (
              <View style={styles.modalContainer}>
                {/* Modal Header */}
                <View style={styles.modalNav}>
                  <TouchableOpacity
                    style={styles.modalBackBtn}
                    onPress={() => setSelectedImportedJob(null)}
                    activeOpacity={0.7}
                  >
                    <ArrowLeft size={16} color={colors.cream} />
                    <Text style={styles.modalBackBtnText}>BACK</Text>
                  </TouchableOpacity>
                  <Text numberOfLines={1} style={styles.modalNavTitle}>
                    {selectedImportedJob.title || 'Imported Playlist'}
                  </Text>
                </View>

                {/* Hero Panel */}
                <View style={styles.modalHero}>
                  <View style={styles.modalHeroArtFrame}>
                    {readySongs.length > 0 && readySongs[0].hasArtwork ? (
                      <ArtworkImage
                        songId={readySongs[0].id}
                        hasArtwork={readySongs[0].hasArtwork}
                        title={readySongs[0].title}
                        artist={readySongs[0].artist}
                        size={76}
                        borderRadius={4}
                      />
                    ) : (
                      <View style={styles.modalHeroFallback}>
                        <ListMusic size={32} color={colors.primaryDark} />
                      </View>
                    )}
                  </View>

                  <View style={styles.modalHeroContent}>
                    <Text numberOfLines={2} style={styles.modalHeroTitle}>
                      {selectedImportedJob.title || 'Imported Playlist'}
                    </Text>
                    <Text style={styles.modalHeroSub}>
                      [{readySongs.length}/{items.length} TRACKS READY]
                    </Text>

                    <View style={styles.modalHeroBtnRow}>
                      {readySongs.length > 0 && (
                        <TouchableOpacity
                          style={styles.modalPlayAllBtn}
                          onPress={() => {
                            handlePlaySong(readySongs[0], 0, readySongs);
                            setSelectedImportedJob(null);
                          }}
                          activeOpacity={0.8}
                        >
                          <Play size={12} color={colors.textDark} fill={colors.textDark} />
                          <Text style={styles.modalPlayAllText}>PLAY ALL</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.modalSaveToLibBtn}
                        onPress={() => {
                          handleAddImportedToLibrary(selectedImportedJob);
                        }}
                        activeOpacity={0.8}
                      >
                        <BookmarkPlus size={12} color={colors.textDark} />
                        <Text style={styles.modalSaveToLibText}>+ TO LIBRARY</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Tracks list */}
                <FlatList
                  data={items}
                  keyExtractor={(it) => it.id}
                  contentContainerStyle={styles.modalTrackList}
                  getItemLayout={(data, index) => ({ length: 68, offset: 68 * index, index })}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  removeClippedSubviews={true}
                  renderItem={({ item, index }) => {
                    const matched = item.songId && songMap.has(item.songId) ? songMap.get(item.songId) : null;
                    return matched ? (
                      <SongListItem
                        song={matched}
                        isCurrentSong={currentSongId === matched.id}
                        onPress={() => {
                          handlePlaySong(matched, index, readySongs);
                          setSelectedImportedJob(null);
                        }}
                        onAddToPlaylist={(song) => setSelectedSongForPlaylist(song)}
                      />
                    ) : (
                      <View style={styles.pendingItemCard}>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={styles.pendingTitle}>
                            {item.title}
                          </Text>
                          <Text numberOfLines={1} style={styles.pendingArtist}>
                            {item.artist}
                          </Text>
                        </View>
                        <View style={styles.pendingStatusBadge}>
                          <Text style={styles.pendingStatusText}>[{item.status}]</Text>
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Add Music Modal */}
      <AddMusicModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          loadImportedPlaylists();
        }}
        onJobCreated={() => {
          setShowAddModal(false);
          loadImportedPlaylists();
          navigation.navigate('Search');
        }}
      />

      {/* Add to Custom Playlist Modal */}
      <AddToPlaylistModal
        visible={selectedSongForPlaylist !== null}
        song={selectedSongForPlaylist}
        onClose={() => setSelectedSongForPlaylist(null)}
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
  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  arcadeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E1E34',
    borderWidth: 1,
    borderColor: colors.primaryDark,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    gap: 3,
  },
  arcadeBadgeText: {
    fontSize: 9,
    color: colors.primaryDark,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addMusicHeaderBtn: {
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
  addMusicHeaderText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
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
  scanningButton: {
    opacity: 0.7,
  },
  scanButtonText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 8,
    height: 42,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  searchPrefixBadge: {
    backgroundColor: '#27203A',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.lavender,
    marginRight: 6,
  },
  searchPrefixText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.lavender,
    letterSpacing: 0.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearSearch: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.pixelBorderSoft,
  },
  clearSearchText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 1,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.error,
    letterSpacing: 1,
  },
  errorMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  settingsNavButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
  },
  settingsNavText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textDark,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 90,
  },
  homeSectionsContainer: {
    paddingBottom: 6,
  },
  sectionHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionBadgeTag: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  greetingHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.creamLight,
    letterSpacing: 0.8,
  },
  quickGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  gridCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48.5%',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    padding: 6,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  gridArtBox: {
    borderWidth: 1,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  gridCardContent: {
    flex: 1,
    marginLeft: 8,
    marginRight: 4,
  },
  gridCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  gridCardArtist: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1,
    fontWeight: '600',
  },
  gridPlayButton: {
    width: 22,
    height: 22,
    borderRadius: 3,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.pixelBorder,
  },
  horizontalScrollContent: {
    paddingVertical: 4,
    gap: 10,
  },
  importedPlaylistCard: {
    width: 130,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    padding: 8,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  playlistArtFrame: {
    width: 110,
    height: 110,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  playlistArtFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#27223A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTag: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(15, 14, 23, 0.85)',
    borderWidth: 1,
    borderColor: colors.mint,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  statusTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.mint,
    letterSpacing: 0.5,
  },
  importedPlaylistTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
  },
  importedPlaylistCount: {
    fontSize: 9,
    color: colors.lavender,
    fontWeight: '800',
    marginTop: 1,
  },
  addToLibraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    paddingVertical: 4,
    marginTop: 6,
    gap: 4,
  },
  addToLibraryBtnSaved: {
    backgroundColor: colors.mint,
  },
  addToLibraryText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  emptyImportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primaryDark,
    borderRadius: 5,
    padding: 12,
    marginVertical: 4,
  },
  emptyImportIconBox: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#2D1E36',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  emptyImportTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  emptyImportSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  shuffleJamBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  shuffleJamLeft: {
    flex: 1,
    marginRight: 10,
  },
  shuffleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  shuffleBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primaryLight,
    letterSpacing: 0.8,
  },
  shuffleJamTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  shuffleJamSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
  shuffleJamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  shuffleJamBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 1,
  },
  dynamicMixCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 6,
    padding: 8,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  mixArtFrame: {
    width: 120,
    height: 120,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  mixArtFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#27223A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixTag: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(15, 14, 23, 0.88)',
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  mixTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.primaryLight,
    letterSpacing: 0.5,
  },
  dynamicMixTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 6,
  },
  dynamicMixSubtitle: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1,
  },
  dynamicMixCount: {
    fontSize: 9,
    color: colors.primaryLight,
    fontWeight: '800',
    marginTop: 2,
  },
  mixActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  mixPlayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    paddingVertical: 4,
    gap: 4,
  },
  mixPlayBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  mixSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    paddingVertical: 4,
    gap: 3,
  },
  mixSaveBtnSaved: {
    backgroundColor: colors.mint,
  },
  mixSaveBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  recentCard: {
    width: 120,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    padding: 6,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  recentArtFrame: {
    width: 104,
    height: 104,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  quickPlayOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.pixelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
  },
  recentArtist: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1,
    fontWeight: '600',
  },
  externalSearchSection: {
    marginTop: 14,
  },
  searchingExternalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  searchingExternalText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  externalResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 5,
    padding: 10,
    marginVertical: 3,
  },
  externalTrackTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  externalTrackArtist: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  queuedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162C25',
    borderWidth: 1,
    borderColor: colors.mint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    gap: 4,
  },
  queuedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.mint,
    letterSpacing: 0.5,
  },
  addToYamaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    gap: 4,
  },
  addToYamaButtonText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  fallbackAcquisitionCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 6,
    padding: 16,
    marginTop: 8,
  },
  fallbackTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1,
    marginTop: 8,
  },
  fallbackSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  fallbackAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
    shadowColor: colors.pixelShadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  fallbackAddButtonText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 13,
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
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.pixelBorderSoft,
  },
  modalBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    marginRight: 10,
  },
  modalBackBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  modalNavTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  modalHero: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.pixelBorder,
    alignItems: 'center',
  },
  modalHeroArtFrame: {
    borderWidth: 2,
    borderColor: colors.pixelBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalHeroFallback: {
    width: 76,
    height: 76,
    backgroundColor: '#27203A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeroContent: {
    flex: 1,
    marginLeft: 12,
  },
  modalHeroTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  modalHeroSub: {
    fontSize: 10,
    color: colors.lavender,
    fontWeight: '800',
    marginTop: 2,
  },
  modalHeroBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalPlayAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.pixelBorder,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  modalPlayAllText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  modalSaveToLibBtn: {
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
  modalSaveToLibText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  modalTrackList: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingBottom: 40,
  },
  pendingItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDarker,
    borderWidth: 1.5,
    borderColor: colors.pixelBorderSoft,
    borderRadius: 4,
    padding: 8,
    marginVertical: 3,
    opacity: 0.8,
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pendingArtist: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  pendingStatusBadge: {
    backgroundColor: '#27223A',
    borderWidth: 1,
    borderColor: colors.pixelBorderSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  pendingStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.creamMuted,
  },
});
