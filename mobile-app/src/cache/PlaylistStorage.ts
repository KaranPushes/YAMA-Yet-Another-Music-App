import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
}

const LIKED_SONGS_KEY = 'yama_liked_songs';
const PLAYLISTS_KEY = 'yama_user_playlists';

type ChangeListener = () => void;

export class PlaylistStorage {
  private static cachedLikedIds: Set<string> | null = null;
  private static cachedPlaylists: Playlist[] | null = null;
  private static listeners: Set<ChangeListener> = new Set();

  static addChangeListener(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static notifyListeners(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('Error in playlist change listener:', e);
      }
    });
  }

  // --- LIKED SONGS ---

  static async getLikedSongIds(): Promise<string[]> {
    if (this.cachedLikedIds !== null) {
      return Array.from(this.cachedLikedIds);
    }
    try {
      const raw = await AsyncStorage.getItem(LIKED_SONGS_KEY);
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        this.cachedLikedIds = new Set(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load liked songs:', e);
    }
    this.cachedLikedIds = new Set();
    return [];
  }

  static async isSongLiked(songId: string): Promise<boolean> {
    const list = await this.getLikedSongIds();
    return this.cachedLikedIds ? this.cachedLikedIds.has(songId) : list.includes(songId);
  }

  static async toggleLikeSong(songId: string): Promise<boolean> {
    await this.getLikedSongIds();
    const set = this.cachedLikedIds || new Set();
    let isNowLiked = false;
    if (set.has(songId)) {
      set.delete(songId);
      isNowLiked = false;
    } else {
      set.add(songId);
      isNowLiked = true;
    }
    this.cachedLikedIds = new Set(set);
    try {
      await AsyncStorage.setItem(LIKED_SONGS_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      console.error('Failed to persist liked songs:', e);
    }
    this.notifyListeners();
    return isNowLiked;
  }

  // --- PLAYLISTS ---

  static async getPlaylists(): Promise<Playlist[]> {
    if (this.cachedPlaylists !== null) {
      // Return a fresh clone so React state comparisons always detect changes
      return this.cachedPlaylists.map((p) => ({ ...p, songIds: [...p.songIds] }));
    }
    try {
      const raw = await AsyncStorage.getItem(PLAYLISTS_KEY);
      if (raw) {
        const parsed: Playlist[] = JSON.parse(raw);
        this.cachedPlaylists = parsed;
        return parsed.map((p) => ({ ...p, songIds: [...p.songIds] }));
      }
    } catch (e) {
      console.warn('Failed to load playlists:', e);
    }
    this.cachedPlaylists = [];
    return [];
  }

  static async createPlaylist(
    name: string,
    description?: string,
    artworkUrl?: string,
    initialSongIds?: string[]
  ): Promise<Playlist> {
    const list = await this.getPlaylists();
    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim() || 'My Playlist',
      description: description?.trim() || '',
      artworkUrl: artworkUrl?.trim() || undefined,
      songIds: initialSongIds ? [...initialSongIds] : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newPlaylist, ...list];
    this.cachedPlaylists = updated;
    await this.persistPlaylists(updated);
    this.notifyListeners();
    return { ...newPlaylist };
  }

  static async pruneDeletedSongs(validSongIds: Set<string>): Promise<void> {
    if (!validSongIds || validSongIds.size === 0) return;

    // 1. Prune liked songs
    const likedIds = await this.getLikedSongIds();
    const prunedLiked = likedIds.filter((id) => validSongIds.has(id));
    if (prunedLiked.length !== likedIds.length) {
      this.cachedLikedIds = new Set(prunedLiked);
      try {
        await AsyncStorage.setItem(LIKED_SONGS_KEY, JSON.stringify(prunedLiked));
      } catch (e) {
        console.error('Failed to persist pruned liked songs:', e);
      }
    }

    // 2. Prune playlists
    const playlists = await this.getPlaylists();
    let didChange = false;
    const updatedPlaylists = playlists.map((pl) => {
      const validSongs = pl.songIds.filter((id) => validSongIds.has(id));
      if (validSongs.length !== pl.songIds.length) {
        didChange = true;
        return {
          ...pl,
          songIds: validSongs,
          updatedAt: Date.now(),
        };
      }
      return pl;
    });

    if (didChange) {
      this.cachedPlaylists = updatedPlaylists;
      await this.persistPlaylists(updatedPlaylists);
      this.notifyListeners();
    }
  }

  static async deletePlaylist(playlistId: string): Promise<void> {
    const list = await this.getPlaylists();
    const filtered = list.filter((p) => p.id !== playlistId);
    this.cachedPlaylists = filtered;
    await this.persistPlaylists(filtered);
    this.notifyListeners();
  }

  static async addSongToPlaylist(playlistId: string, songId: string): Promise<boolean> {
    const list = await this.getPlaylists();
    let didAdd = false;

    const updated = list.map((p) => {
      if (p.id === playlistId) {
        if (!p.songIds.includes(songId)) {
          didAdd = true;
          return {
            ...p,
            songIds: [...p.songIds, songId],
            updatedAt: Date.now(),
          };
        }
      }
      return { ...p, songIds: [...p.songIds] };
    });

    if (didAdd) {
      this.cachedPlaylists = updated;
      await this.persistPlaylists(updated);
      this.notifyListeners();
    }
    return didAdd;
  }

  static async removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
    const list = await this.getPlaylists();
    let didRemove = false;

    const updated = list.map((p) => {
      if (p.id === playlistId) {
        if (p.songIds.includes(songId)) {
          didRemove = true;
          return {
            ...p,
            songIds: p.songIds.filter((id) => id !== songId),
            updatedAt: Date.now(),
          };
        }
      }
      return { ...p, songIds: [...p.songIds] };
    });

    if (didRemove) {
      this.cachedPlaylists = updated;
      await this.persistPlaylists(updated);
      this.notifyListeners();
    }
  }

  static async reorderPlaylistSongs(playlistId: string, fromIndex: number, toIndex: number): Promise<void> {
    const list = await this.getPlaylists();
    let didReorder = false;

    const updated = list.map((p) => {
      if (p.id === playlistId) {
        if (
          fromIndex >= 0 &&
          fromIndex < p.songIds.length &&
          toIndex >= 0 &&
          toIndex < p.songIds.length &&
          fromIndex !== toIndex
        ) {
          didReorder = true;
          const newSongs = [...p.songIds];
          const [moved] = newSongs.splice(fromIndex, 1);
          newSongs.splice(toIndex, 0, moved);
          return {
            ...p,
            songIds: newSongs,
            updatedAt: Date.now(),
          };
        }
      }
      return { ...p, songIds: [...p.songIds] };
    });

    if (didReorder) {
      this.cachedPlaylists = updated;
      await this.persistPlaylists(updated);
      this.notifyListeners();
    }
  }


  private static async persistPlaylists(playlists: Playlist[]): Promise<void> {
    try {
      await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
    } catch (e) {
      console.error('Failed to persist playlists:', e);
    }
  }
}
