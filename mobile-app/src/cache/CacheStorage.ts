import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { CacheEntry, CacheStats } from '../types/cache';

const CACHE_INDEX_KEY = 'yama_cache_index';

export class CacheStorage {
  private static memoryIndex: Map<string, CacheEntry> | null = null;

  static async loadIndex(): Promise<Map<string, CacheEntry>> {
    if (this.memoryIndex !== null) {
      return this.memoryIndex;
    }
    try {
      const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      if (raw) {
        const parsed: Record<string, CacheEntry> = JSON.parse(raw);
        this.memoryIndex = new Map(Object.entries(parsed));

        // Purge any zombie entries whose files no longer exist on disk
        let purgedAny = false;
        for (const [id, entry] of Array.from(this.memoryIndex.entries())) {
          if (entry.isComplete && entry.localFilePath) {
            try {
              const fileCheck = await FileSystem.getInfoAsync(entry.localFilePath);
              if (!fileCheck.exists) {
                this.memoryIndex.delete(id);
                purgedAny = true;
              }
            } catch (_) {
              this.memoryIndex.delete(id);
              purgedAny = true;
            }
          }
        }
        if (purgedAny) {
          await this.persist();
        }

        return this.memoryIndex;
      }
    } catch (e) {
      console.error('Failed to load cache index from storage:', e);
    }
    this.memoryIndex = new Map();
    return this.memoryIndex;
  }

  static async getEntry(songId: string): Promise<CacheEntry | null> {
    const index = await this.loadIndex();
    const entry = index.get(songId);
    if (!entry) return null;

    // Double check file existence if marked complete
    if (entry.isComplete && entry.localFilePath) {
      try {
        const info = await FileSystem.getInfoAsync(entry.localFilePath);
        if (!info.exists) {
          await this.removeEntry(songId);
          return null;
        }
      } catch (_) {
        await this.removeEntry(songId);
        return null;
      }
    }
    return entry;
  }

  static async setEntry(entry: CacheEntry): Promise<void> {
    const index = await this.loadIndex();
    index.set(entry.songId, entry);
    await this.persist();
  }

  static async removeEntry(songId: string): Promise<void> {
    const index = await this.loadIndex();
    index.delete(songId);
    await this.persist();
  }

  static async getAllEntries(): Promise<CacheEntry[]> {
    const index = await this.loadIndex();
    const list: CacheEntry[] = [];
    for (const entry of index.values()) {
      if (entry.isComplete && entry.localFilePath) {
        try {
          const info = await FileSystem.getInfoAsync(entry.localFilePath);
          if (info.exists) {
            list.push(entry);
          }
        } catch (_) {}
      } else {
        list.push(entry);
      }
    }
    return list;
  }

  static async clearAll(): Promise<void> {
    this.memoryIndex = new Map();
    try {
      await AsyncStorage.removeItem(CACHE_INDEX_KEY);
    } catch (e) {
      console.warn('Failed to clear cache index from AsyncStorage:', e);
    }
  }

  static async getStats(): Promise<CacheStats> {
    const entries = await this.getAllEntries();
    const completed = entries.filter((e) => e.isComplete);
    const totalBytes = completed.reduce((acc, curr) => acc + (curr.downloadedBytes || 0), 0);
    return {
      totalSongsCached: completed.length,
      totalBytesUsed: totalBytes,
    };
  }

  private static async persist(): Promise<void> {
    if (!this.memoryIndex) return;
    try {
      const obj: Record<string, CacheEntry> = {};
      this.memoryIndex.forEach((val, key) => {
        obj[key] = val;
      });
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(obj));
    } catch (e) {
      console.error('Failed to persist cache index:', e);
    }
  }
}
