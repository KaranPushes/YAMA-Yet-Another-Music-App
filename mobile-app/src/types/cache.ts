export type DownloadStatus = 'NOT_DOWNLOADED' | 'DOWNLOADING' | 'CACHED' | 'FAILED';

export interface CacheEntry {
  songId: string;
  localFilePath: string;
  downloadedBytes: number;
  totalBytes: number;
  downloadStatus: DownloadStatus;
  lastAccessed: number;
  isComplete: boolean;
  errorMessage?: string;
}

export interface CacheStats {
  totalSongsCached: number;
  totalBytesUsed: number;
}
