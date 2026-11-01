import { Song } from './song';
import { PlaybackSection } from './section';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';
export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentSong: Song | null;
  status: PlaybackStatus;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  isBuffering: boolean;
  activeSectionIndex: number | null; // which configured section is currently playing
  isSectionModeEnabled: boolean; // toggle to enforce section bounds
  playbackSource: 'local' | 'remote' | null;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: Song[];
  queueIndex: number;
  errorMessage?: string;
}

export interface PlayerControls {
  playSong: (song: Song, newQueue?: Song[]) => Promise<void>;
  playTrack: (song: Song, newQueue?: Song[], index?: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  skipToNextSection: () => Promise<void>;
  skipToPreviousSection: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  toggleSectionMode: () => void;
  refreshSongSections: (sections: PlaybackSection[]) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  addToQueue: (song: Song) => void;
  playNextInQueue: (song: Song) => void;
  jumpToQueueItem: (index: number) => Promise<void>;
}

