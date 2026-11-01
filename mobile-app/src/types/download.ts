import { Song } from './song';

export type JobType = 'TRACK' | 'PLAYLIST';

export type DownloadStatus =
  | 'QUEUED'
  | 'DOWNLOADING'
  | 'PROCESSING'
  | 'SCANNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'PARTIALLY_COMPLETED'
  | 'CANCELLED';

export interface DownloadItem {
  id: string;
  title: string;
  artist: string;
  sourceUrl?: string;
  status: DownloadStatus;
  progress: number;
  songId?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface DownloadJob {
  id: string;
  type: JobType;
  source: string;
  queryOrUrl: string;
  title: string;
  status: DownloadStatus;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  createdAt: string;
  updatedAt: string;
  items: DownloadItem[];
}

export interface PlaylistTrackPreview {
  title: string;
  artist: string;
  url?: string;
  duration: number;
  alreadyInLibrary: boolean;
  songId?: string;
}

export interface PlaylistPreview {
  title: string;
  totalTracks: number;
  alreadyInLibraryCount: number;
  missingCount: number;
  artworkUrl?: string;
  tracks: PlaylistTrackPreview[];
}

export interface ExternalTrack {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  artworkUrl?: string;
  sourceQuery: string;
  alreadyInLibrary: boolean;
  songId?: string;
}

export interface UnifiedSearchResult {
  library: Song[];
  external: ExternalTrack[];
}
