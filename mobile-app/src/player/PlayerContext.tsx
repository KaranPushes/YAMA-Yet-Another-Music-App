import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Song } from '../types/song';
import { PlaybackSection } from '../types/section';
import { PlayerState, PlayerControls, RepeatMode } from '../types/player';
import { fetchSections } from '../api/sectionApi';
import { fetchSongs } from '../api/songApi';
import { audioPlayerInstance } from './AudioPlayer';

interface PlayerContextValue {
  state: PlayerState;
  controls: PlayerControls;
}

const initialPlayerState: PlayerState = {
  currentSong: null,
  status: 'idle',
  positionSeconds: 0,
  durationSeconds: 0,
  isPlaying: false,
  isBuffering: false,
  activeSectionIndex: null,
  isSectionModeEnabled: true,
  playbackSource: null,
  repeatMode: 'off',
  isShuffle: false,
  queue: [],
  queueIndex: -1,
};

const PlayerContext = createContext<PlayerContextValue | null>(null);
const PlayerControlsContext = createContext<PlayerControls | null>(null);
const CurrentSongIdContext = createContext<string | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PlayerState>(initialPlayerState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const playSongInternal = useCallback(async (song: Song, upcomingQueue: Song[]) => {
    setState((prev) => ({
      ...prev,
      currentSong: song,
      queue: upcomingQueue,
      queueIndex: 0,
      status: 'loading',
      positionSeconds: 0,
      durationSeconds: song.duration,
      errorMessage: undefined,
    }));

    let effectiveSong = song;
    if (!song.sections || song.sections.length === 0) {
      try {
        const freshSections = await fetchSections(song.id);
        if (freshSections && freshSections.length > 0) {
          effectiveSong = { ...song, sections: freshSections };
        }
      } catch (_) {}
    }

    try {
      const { isLocal } = await audioPlayerInstance.loadAndPlay(effectiveSong, stateRef.current.isSectionModeEnabled);
      setState((prev) => ({
        ...prev,
        currentSong: effectiveSong,
        status: 'playing',
        isPlaying: true,
        playbackSource: isLocal ? 'local' : 'remote',
      }));
    } catch (err: any) {
      console.error('Error loading song:', err);
      setState((prev) => ({
        ...prev,
        status: 'error',
        isPlaying: false,
        errorMessage: err.message || 'Failed to play track',
      }));
    }
  }, []);

  const playSong = useCallback(async (song: Song, newQueue?: Song[]) => {
    const upcoming = (newQueue || []).filter((s) => s.id !== song.id);
    await playSongInternal(song, upcoming);
  }, [playSongInternal]);

  const playTrack = useCallback(async (song: Song, list?: Song[], index?: number) => {
    let upcoming: Song[] = [];
    if (list && list.length > 0) {
      const startIdx = index !== undefined && index >= 0 ? index : list.findIndex((s) => s.id === song.id);
      if (startIdx !== -1) {
        upcoming = list.slice(startIdx + 1);
      }
    }
    await playSongInternal(song, upcoming);
  }, [playSongInternal]);

  const playNext = useCallback(async () => {
    const { queue, repeatMode, currentSong } = stateRef.current;

    if (repeatMode === 'one' && currentSong) {
      await audioPlayerInstance.seekTo(0);
      audioPlayerInstance.play();
      return;
    }

    if (queue.length === 0) {
      // Autoplay / Radio: If queue is empty, continue playing random library songs
      try {
        const res = await fetchSongs('');
        const library = res.content || [];
        const candidates = library.filter((s) => s.id !== currentSong?.id);
        const pool = candidates.length > 0 ? candidates : library;
        if (pool.length > 0) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          const randomSong = pool[randomIndex];
          await playSongInternal(randomSong, []);
          return;
        }
      } catch (err) {
        console.warn('Autoplay failed to select random track:', err);
      }
      return;
    }

    // Spotify behavior: the upcoming song is popped, and subsequent songs remain
    const nextSong = queue[0];
    const remainingQueue = queue.slice(1);
    await playSongInternal(nextSong, remainingQueue);
  }, [playSongInternal]);

  const jumpToQueueItem = useCallback(async (index: number) => {
    const { queue } = stateRef.current;
    if (index < 0 || index >= queue.length) return;

    // Spotify behavior: jumping to track k automatically prunes all tracks above it (0..k)
    const targetSong = queue[index];
    const remainingQueue = queue.slice(index + 1);
    await playSongInternal(targetSong, remainingQueue);
  }, [playSongInternal]);

  const playPrevious = useCallback(async () => {
    const { positionSeconds } = stateRef.current;
    // In Spotify upcoming queue model, restart the current song
    await audioPlayerInstance.seekTo(0);
    audioPlayerInstance.play();
  }, []);

  // Set up audio player event listener and track completion handler
  useEffect(() => {
    audioPlayerInstance.setStateCallback((update) => {
      setState((prev) => ({
        ...prev,
        positionSeconds: update.positionSeconds,
        durationSeconds: update.durationSeconds || prev.durationSeconds,
        isPlaying: update.isPlaying,
        isBuffering: update.isBuffering,
        status: update.isFinished ? 'stopped' : update.isPlaying ? 'playing' : 'paused',
        activeSectionIndex: update.activeSectionIndex,
      }));
    });

    audioPlayerInstance.setTrackEndCallback(() => {
      // Auto-advance or repeat when track finishes
      playNext();
    });

    return () => {
      audioPlayerInstance.setStateCallback(null);
      audioPlayerInstance.setTrackEndCallback(null);
    };
  }, [playNext]);

  const togglePlayPause = useCallback(async () => {
    const isPlaying = await audioPlayerInstance.togglePlayPause();
    setState((prev) => ({
      ...prev,
      isPlaying,
      status: isPlaying ? 'playing' : 'paused',
    }));
  }, []);

  const seekTo = useCallback(async (seconds: number) => {
    await audioPlayerInstance.seekTo(seconds);
    setState((prev) => ({ ...prev, positionSeconds: seconds }));
  }, []);

  const skipToNextSection = useCallback(async () => {
    await audioPlayerInstance.skipToNextSection();
  }, []);

  const skipToPreviousSection = useCallback(async () => {
    await audioPlayerInstance.skipToPreviousSection();
  }, []);

  const toggleRepeat = useCallback(() => {
    setState((prev) => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const currentIdx = modes.indexOf(prev.repeatMode);
      const nextMode = modes[(currentIdx + 1) % modes.length];
      return { ...prev, repeatMode: nextMode };
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setState((prev) => ({ ...prev, isShuffle: !prev.isShuffle }));
  }, []);

  const toggleSectionMode = useCallback(() => {
    setState((prev) => {
      const nextMode = !prev.isSectionModeEnabled;
      audioPlayerInstance.setSectionMode(nextMode);
      return { ...prev, isSectionModeEnabled: nextMode };
    });
  }, []);

  const refreshSongSections = useCallback((sections: PlaybackSection[]) => {
    audioPlayerInstance.updateSections(sections);
    setState((prev) => {
      if (!prev.currentSong) return prev;
      const updatedCurrent = {
        ...prev.currentSong,
        sections,
      };
      const updatedQueue = prev.queue.map((s) =>
        s.id === prev.currentSong?.id ? updatedCurrent : s
      );
      return {
        ...prev,
        currentSong: updatedCurrent,
        queue: updatedQueue,
      };
    });
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const q = [...prev.queue];
      if (fromIndex < 0 || fromIndex >= q.length || toIndex < 0 || toIndex >= q.length) {
        return prev;
      }
      const [item] = q.splice(fromIndex, 1);
      q.splice(toIndex, 0, item);
      const curId = prev.currentSong?.id;
      const newQueueIndex = curId ? q.findIndex((s) => s.id === curId) : prev.queueIndex;
      return {
        ...prev,
        queue: q,
        queueIndex: newQueueIndex !== -1 ? newQueueIndex : prev.queueIndex,
      };
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.queue.length) return prev;
      const q = [...prev.queue];
      q.splice(index, 1);
      const curId = prev.currentSong?.id;
      const newQueueIndex = curId ? q.findIndex((s) => s.id === curId) : -1;
      return {
        ...prev,
        queue: q,
        queueIndex: newQueueIndex !== -1 ? newQueueIndex : 0,
      };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState((prev) => {
      const remaining = prev.currentSong ? [prev.currentSong] : [];
      return {
        ...prev,
        queue: remaining,
        queueIndex: remaining.length > 0 ? 0 : -1,
      };
    });
  }, []);

  const addToQueue = useCallback((song: Song) => {
    setState((prev) => ({
      ...prev,
      queue: [...prev.queue, song],
    }));
  }, []);

  const playNextInQueue = useCallback((song: Song) => {
    setState((prev) => ({
      ...prev,
      queue: [song, ...prev.queue.filter((s) => s.id !== song.id)],
    }));
  }, []);

  const controls: PlayerControls = useMemo(() => ({
    playSong,
    playTrack,
    togglePlayPause,
    seekTo,
    skipToNextSection,
    skipToPreviousSection,
    playNext,
    playPrevious,
    toggleRepeat,
    toggleShuffle,
    toggleSectionMode,
    refreshSongSections,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    addToQueue,
    playNextInQueue,
    jumpToQueueItem,
  }), [
    playSong,
    playTrack,
    togglePlayPause,
    seekTo,
    skipToNextSection,
    skipToPreviousSection,
    playNext,
    playPrevious,
    toggleRepeat,
    toggleShuffle,
    toggleSectionMode,
    refreshSongSections,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    addToQueue,
    playNextInQueue,
    jumpToQueueItem,
  ]);

  const contextValue = useMemo(() => ({ state, controls }), [state, controls]);
  const currentSongId = state.currentSong?.id || null;

  return (
    <PlayerControlsContext.Provider value={controls}>
      <CurrentSongIdContext.Provider value={currentSongId}>
        <PlayerContext.Provider value={contextValue}>
          {children}
        </PlayerContext.Provider>
      </CurrentSongIdContext.Provider>
    </PlayerControlsContext.Provider>
  );
};

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

export function usePlayerControls(): PlayerControls {
  const controls = useContext(PlayerControlsContext);
  if (!controls) {
    throw new Error('usePlayerControls must be used within a PlayerProvider');
  }
  return controls;
}

export function useCurrentSongId(): string | null {
  return useContext(CurrentSongIdContext);
}
