import * as FileSystem from 'expo-file-system/legacy';
import { CacheStorage } from './CacheStorage';
import { CacheEntry } from '../types/cache';
import { Song } from '../types/song';
import { getFullStreamUrl } from '../api/songApi';

const CACHE_FOLDER = `${FileSystem.documentDirectory || ''}yama_music_cache/`;

export type DownloadProgressCallback = (songId: string, progress: number) => void;

export class DownloadManager {
  private static activeDownloads: Map<string, Promise<string>> = new Map();
  private static activeResumables: Map<string, FileSystem.DownloadResumable> = new Map();
  private static progressListeners: Set<DownloadProgressCallback> = new Set();

  static async ensureCacheDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_FOLDER);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
    }
  }

  static addProgressListener(cb: DownloadProgressCallback): () => void {
    this.progressListeners.add(cb);
    return () => this.progressListeners.delete(cb);
  }

  private static notifyProgress(songId: string, progress: number): void {
    this.progressListeners.forEach((listener) => {
      try {
        listener(songId, progress);
      } catch (e) {
        console.error('Error in download progress listener:', e);
      }
    });
  }

  /**
   * Starts downloading a song in the background and saves it into local storage.
   * If already downloading, returns existing promise.
   * If already cached and file exists, returns cached path immediately.
   */
  static async downloadSong(song: Song): Promise<string> {
    await this.ensureCacheDirectory();

    // Check if already cached
    const existing = await CacheStorage.getEntry(song.id);
    if (existing && existing.isComplete) {
      const fileCheck = await FileSystem.getInfoAsync(existing.localFilePath);
      if (fileCheck.exists) {
        existing.lastAccessed = Date.now();
        await CacheStorage.setEntry(existing);
        return existing.localFilePath;
      }
    }

    // Check if download is already in-flight
    if (this.activeDownloads.has(song.id)) {
      return this.activeDownloads.get(song.id)!;
    }

    const downloadPromise = this.executeDownload(song);
    this.activeDownloads.set(song.id, downloadPromise);

    try {
      const path = await downloadPromise;
      return path;
    } finally {
      this.activeDownloads.delete(song.id);
      this.activeResumables.delete(song.id);
    }
  }

  private static async executeDownload(song: Song): Promise<string> {
    const streamUrl = await getFullStreamUrl(song.id);
    const extension = song.fileFormat || 'mp3';
    const targetPath = `${CACHE_FOLDER}${song.id}.${extension}`;
    const partPath = `${targetPath}.part`;

    const entry: CacheEntry = {
      songId: song.id,
      localFilePath: targetPath,
      downloadedBytes: 0,
      totalBytes: song.fileSize || 0,
      downloadStatus: 'DOWNLOADING',
      lastAccessed: Date.now(),
      isComplete: false,
    };
    await CacheStorage.setEntry(entry);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        streamUrl,
        partPath,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesExpectedToWrite > 0
              ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
              : 0;
          this.notifyProgress(song.id, progress);
        }
      );

      this.activeResumables.set(song.id, downloadResumable);

      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error('Download did not return valid file URI');
      }

      // Rename .part to final destination
      await FileSystem.moveAsync({
        from: partPath,
        to: targetPath,
      });

      const finalInfo = await FileSystem.getInfoAsync(targetPath);
      entry.isComplete = true;
      entry.downloadStatus = 'CACHED';
      entry.downloadedBytes =
        finalInfo.exists && 'size' in finalInfo && finalInfo.size ? finalInfo.size : song.fileSize;
      entry.localFilePath = targetPath;
      await CacheStorage.setEntry(entry);

      this.notifyProgress(song.id, 1.0);
      return targetPath;
    } catch (error: any) {
      console.error(`Failed to download song ${song.id}:`, error);
      entry.downloadStatus = 'FAILED';
      entry.errorMessage = error.message || 'Download error';
      await CacheStorage.setEntry(entry);
      // Clean up part file if exists
      try {
        const checkPart = await FileSystem.getInfoAsync(partPath);
        if (checkPart.exists) {
          await FileSystem.deleteAsync(partPath, { idempotent: true });
        }
      } catch (_) {}
      throw error;
    }
  }

  static async deleteSongFromCache(songId: string): Promise<void> {
    // Abort active download if in-flight
    const activeResumable = this.activeResumables.get(songId);
    if (activeResumable) {
      try {
        await activeResumable.pauseAsync();
      } catch (_) {}
      this.activeResumables.delete(songId);
      this.activeDownloads.delete(songId);
    }

    const entry = await CacheStorage.getEntry(songId);
    if (entry && entry.localFilePath) {
      try {
        await FileSystem.deleteAsync(entry.localFilePath, { idempotent: true });
      } catch (e) {
        console.warn('Error deleting cached file:', e);
      }
      // Also delete any partial file
      try {
        await FileSystem.deleteAsync(`${entry.localFilePath}.part`, { idempotent: true });
      } catch (_) {}
    }
    await CacheStorage.removeEntry(songId);
  }

  static async clearAllCache(): Promise<void> {
    // 1. Abort all active downloads
    for (const [songId, resumable] of Array.from(this.activeResumables.entries())) {
      try {
        await resumable.pauseAsync();
      } catch (_) {}
    }
    this.activeResumables.clear();
    this.activeDownloads.clear();

    // 2. Wipe directory on disk completely
    try {
      await FileSystem.deleteAsync(CACHE_FOLDER, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
    } catch (e) {
      console.warn('Error clearing cache directory:', e);
    }

    // 3. Clear database storage index
    await CacheStorage.clearAll();
  }
}
