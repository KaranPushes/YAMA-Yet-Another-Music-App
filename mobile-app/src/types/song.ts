import { PlaybackSection } from './section';

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  duration: number; // in seconds
  fileSize: number; // in bytes
  fileFormat: string; // e.g. "mp3", "flac"
  bitrate?: number;
  year?: number;
  hasArtwork: boolean;
  artworkUrl: string;
  streamUrl: string;
  producer?: string;
  sections: PlaybackSection[];
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  isFirst: boolean;
  isLast: boolean;
}
