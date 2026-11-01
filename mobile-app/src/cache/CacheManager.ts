import { CacheStorage } from './CacheStorage';
import { DownloadManager } from './DownloadManager';
import { Song } from '../types/song';
import { CacheEntry } from '../types/cache';
import { getFullStreamUrl } from '../api/songApi';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTO_CACHE_KEY = 'yama_auto_cache_enabled';

export class CacheManager {
  private static autoCacheEnabled: boolean | null = null;

  static async isAutoCacheEnabled(): Promise<boolean> {
    if (this.autoCacheEnabled !== null) {
      return this.autoCacheEnabled;
    }
    try {
      const val = await AsyncStorage.getItem(AUTO_CACHE_KEY);
      this.autoCacheEnabled = val === 'true'; // Default is FALSE so clearing cache stays clean!
    } catch (_) {
      this.autoCacheEnabled = false;
    }
    return this.autoCacheEnabled;
  }

  static async setAutoCacheEnabled(enabled: boolean): Promise<void> {
    this.autoCacheEnabled = enabled;
    try {
      await AsyncStorage.setItem(AUTO_CACHE_KEY, enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to save auto cache preference:', e);
    }
  }

  /**
   * Resolves the optimal playback URI for a song:
   * If fully cached locally on disk -> returns `file://...`
   * If not cached -> returns backend HTTP streaming endpoint URL
   */
  static async resolvePlaybackUri(song: Song): Promise<{ uri: string; isLocal: boolean }> {
    const entry = await CacheStorage.getEntry(song.id);
    if (entry && entry.isComplete && entry.localFilePath) {
      try {
        const info = await FileSystem.getInfoAsync(entry.localFilePath);
        if (info.exists) {
          return { uri: entry.localFilePath, isLocal: true };
        }
      } catch (_) {}
    }
    const streamUrl = await getFullStreamUrl(song.id);
    return { uri: streamUrl, isLocal: false };
  }

  static async getCacheEntry(songId: string): Promise<CacheEntry | null> {
    return CacheStorage.getEntry(songId);
  }

  static async isSongCached(songId: string): Promise<boolean> {
    const entry = await CacheStorage.getEntry(songId);
    if (entry && entry.isComplete && entry.localFilePath) {
      try {
        const info = await FileSystem.getInfoAsync(entry.localFilePath);
        return info.exists;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  static async startBackgroundCache(song: Song): Promise<void> {
    // Check if auto caching is permitted
    const enabled = await this.isAutoCacheEnabled();
    if (!enabled) {
      return;
    }

    // Non-blocking fire-and-forget download
    DownloadManager.downloadSong(song).catch((err) => {
      console.warn(`Background caching skipped for ${song.title}:`, err.message);
    });
  }
}
