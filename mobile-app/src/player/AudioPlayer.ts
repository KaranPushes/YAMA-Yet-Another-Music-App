import { createAudioPlayer, setAudioModeAsync, AudioPlayer as ExpoAudioPlayer } from 'expo-audio';
import { isRunningInExpoGo } from 'expo';
import { Song } from '../types/song';
import { PlaybackSection } from '../types/section';
import { SectionPlaybackEngine } from './SectionPlaybackEngine';
import { CacheManager } from '../cache/CacheManager';
import { getApiBaseUrl } from '../api/client';

export type PlayerStateCallback = (state: {
  positionSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  isBuffering: boolean;
  isFinished: boolean;
  activeSectionIndex: number | null;
}) => void;

export type TrackEndCallback = () => void;

export class AudioPlayer {
  private player: ExpoAudioPlayer | null = null;
  private currentSong: Song | null = null;
  private sectionEngine: SectionPlaybackEngine;
  private stateCallback: PlayerStateCallback | null = null;
  private trackEndCallback: TrackEndCallback | null = null;
  private isHandlingSectionSeek: boolean = false;
  private lastSeekTimestamp: number = 0;
  private isAudioModeConfigured: boolean = false;
  private removeStatusListener: (() => void) | null = null;
  private tickerInterval: any = null;
  private lastStateEmitTimestamp: number = 0;
  private lastEmittedSectionIdx: number | null = null;

  constructor() {
    this.sectionEngine = new SectionPlaybackEngine([]);
  }

  public setStateCallback(cb: PlayerStateCallback | null): void {
    this.stateCallback = cb;
  }

  public setTrackEndCallback(cb: TrackEndCallback | null): void {
    this.trackEndCallback = cb;
  }

  public getCurrentSong(): Song | null {
    return this.currentSong;
  }

  public getSectionEngine(): SectionPlaybackEngine {
    return this.sectionEngine;
  }

  private async configureAudioMode(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: !isRunningInExpoGo(),
        interruptionMode: 'doNotMix',
      });
      this.isAudioModeConfigured = true;
    } catch (e) {
      console.warn('Failed to configure Audio mode:', e);
    }
  }

  /**
   * Starts high-frequency 100ms ticker for guaranteed smooth realtime updates
   */
  private startTicker(): void {
    this.stopTicker();
    this.tickerInterval = setInterval(() => {
      if (this.player && this.currentSong) {
        try {
          const isPlaying = this.player.playing;
          const posSec = this.player.currentTime || 0;
          const durSec = this.player.duration || this.currentSong.duration || 0;

          if (isPlaying) {
            this.handlePlaybackTick(posSec, durSec, isPlaying);
          }
        } catch (_) { }
      }
    }, 100);
  }

  private stopTicker(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }

  /**
   * Loads and plays a song.
   * If sections exist, seeks to first section immediately.
   * Automatically initiates background cache if not already cached.
   */
  public async loadAndPlay(song: Song, forceSectionMode?: boolean): Promise<{ isLocal: boolean }> {
    await this.configureAudioMode();
    await this.unload();

    this.currentSong = song;
    this.sectionEngine.setSections(song.sections || []);
    if (forceSectionMode !== undefined) {
      this.sectionEngine.setEnabled(forceSectionMode);
    }

    // Determine whether to play from local cache or stream URL
    const { uri, isLocal } = await CacheManager.resolvePlaybackUri(song);

    // If not cached, trigger background download
    if (!isLocal) {
      CacheManager.startBackgroundCache(song);
    }

    const player = createAudioPlayer(uri, {
      updateInterval: 100, // 100ms native update frequency
    });
    this.player = player;

    // Enable lock screen controls and notification media session with track metadata & artwork
    // Supported in standalone builds (app.json config plugin). Safely skipped in Expo Go to avoid missing service binding errors.
    try {
      if (!isRunningInExpoGo() && typeof (player as any).setActiveForLockScreen === 'function') {
        const baseUrl = await getApiBaseUrl();
        const artwork = song.hasArtwork
          ? `${baseUrl}/api/songs/${song.id}/artwork`
          : undefined;
        (player as any).setActiveForLockScreen(true, {
          title: song.title,
          artist: song.artist,
          albumTitle: song.album || undefined,
          artworkUrl: artwork,
        });
      }
    } catch (err: any) {
      console.warn('Notice: Lockscreen background controls unavailable:', err?.message || err);
    }

    // Listen to playback updates from native event emitter
    const subscription = (player as any).addListener('playbackStatusUpdate', (status: any) => {
      this.handlePlaybackStatusUpdate(status);
    });
    this.removeStatusListener = () => {
      subscription?.remove();
    };

    // Check initial start position based on sections
    const initialPosition = this.sectionEngine.getInitialPlaybackPosition(0);
    if (initialPosition > 0) {
      await player.seekTo(initialPosition);
    }

    player.play();
    this.startTicker();
    return { isLocal };
  }

  public play(): void {
    if (this.player) {
      this.player.play();
      this.startTicker();
    }
  }

  public pause(): void {
    if (this.player) {
      this.player.pause();
      this.stopTicker();
    }
  }

  public async togglePlayPause(): Promise<boolean> {
    if (!this.player) return false;
    if (this.player.playing) {
      this.pause();
      return false;
    } else {
      this.play();
      return true;
    }
  }

  public async seekTo(seconds: number): Promise<void> {
    if (!this.player) return;

    // Evaluate section bounds on seek
    const { targetSeconds, shouldEnd } = this.sectionEngine.clampSeekPosition(seconds);
    if (shouldEnd) {
      this.handleTrackEnd();
      return;
    }

    this.isHandlingSectionSeek = true;
    this.lastSeekTimestamp = Date.now();
    try {
      await this.player.seekTo(targetSeconds);
      if (this.stateCallback) {
        const durSec = this.player.duration || this.currentSong?.duration || 0;
        this.stateCallback({
          positionSeconds: targetSeconds,
          durationSeconds: durSec,
          isPlaying: this.player.playing,
          isBuffering: false,
          isFinished: false,
          activeSectionIndex: this.sectionEngine.findSectionIndexAt(targetSeconds),
        });
      }
    } finally {
      // Maintain guard for 350ms to allow native audio engine to settle
      setTimeout(() => {
        this.isHandlingSectionSeek = false;
      }, 350);
    }
  }

  public async skipToNextSection(): Promise<void> {
    if (!this.player || !this.currentSong) return;
    const currentSec = this.player.currentTime;
    const nextIdx = this.sectionEngine.findNextSectionIndex(currentSec);
    const sections = this.sectionEngine.getSections();

    if (nextIdx !== null && nextIdx < sections.length) {
      await this.seekTo(sections[nextIdx].startSeconds);
    }
  }

  public async skipToPreviousSection(): Promise<void> {
    if (!this.player || !this.currentSong) return;
    const currentSec = this.player.currentTime;
    const sections = this.sectionEngine.getSections();
    if (sections.length === 0) {
      await this.seekTo(0);
      return;
    }

    // Find previous section
    for (let i = sections.length - 1; i >= 0; i--) {
      if (sections[i].startSeconds < currentSec - 2.0) {
        await this.seekTo(sections[i].startSeconds);
        return;
      }
    }
    // Default to first section
    await this.seekTo(sections[0].startSeconds);
  }

  public updateSections(sections: PlaybackSection[]): void {
    this.sectionEngine.setSections(sections);
    if (this.currentSong) {
      this.currentSong.sections = sections;
    }
  }

  public setSectionMode(enabled: boolean): void {
    this.sectionEngine.setEnabled(enabled);
  }

  public async unload(): Promise<void> {
    this.stopTicker();
    if (this.removeStatusListener) {
      this.removeStatusListener();
      this.removeStatusListener = null;
    }
    if (this.player) {
      try {
        this.player.pause();
        this.player.clearLockScreenControls?.();
        this.player.remove();
      } catch (_) { }
      this.player = null;
    }
    this.isHandlingSectionSeek = false;
  }

  private handleTrackEnd(): void {
    this.pause();
    const durSec = this.player?.duration || this.currentSong?.duration || 0;
    if (this.stateCallback) {
      this.stateCallback({
        positionSeconds: durSec,
        durationSeconds: durSec,
        isPlaying: false,
        isBuffering: false,
        isFinished: true,
        activeSectionIndex: null,
      });
    }
    if (this.trackEndCallback) {
      this.trackEndCallback();
    }
  }

  private handlePlaybackTick = (posSec: number, durSec: number, playing: boolean): void => {
    if (!this.player || this.isHandlingSectionSeek) return;
    if (Date.now() - this.lastSeekTimestamp < 350) return;

    let activeSectionIdx = this.sectionEngine.findSectionIndexAt(posSec);

    // Check Section Engine rules
    if (playing && this.sectionEngine.isSectionModeEnabled()) {
      const decision = this.sectionEngine.evaluatePosition(posSec);

      if (decision.shouldEndTrack) {
        this.isHandlingSectionSeek = true;
        try {
          this.handleTrackEnd();
        } finally {
          this.isHandlingSectionSeek = false;
        }
        return;
      }

      if (decision.seekTargetSeconds !== null) {
        this.isHandlingSectionSeek = true;
        this.lastSeekTimestamp = Date.now();
        this.player.seekTo(decision.seekTargetSeconds).finally(() => {
          setTimeout(() => {
            this.isHandlingSectionSeek = false;
          }, 200);
        });
        activeSectionIdx = decision.currentSectionIndex;
      }
    }

    // Throttle UI update emission to ~250ms unless section changed or playback stopped
    const now = Date.now();
    const sectionChanged = activeSectionIdx !== this.lastEmittedSectionIdx;
    const shouldEmit = !playing || sectionChanged || (now - this.lastStateEmitTimestamp >= 250);

    if (shouldEmit && this.stateCallback) {
      this.lastStateEmitTimestamp = now;
      this.lastEmittedSectionIdx = activeSectionIdx;
      this.stateCallback({
        positionSeconds: posSec,
        durationSeconds: durSec,
        isPlaying: playing,
        isBuffering: false,
        isFinished: false,
        activeSectionIndex: activeSectionIdx,
      });
    }
  };

  private handlePlaybackStatusUpdate = (status: any): void => {
    if (!this.player) return;

    const posSec = status.currentTime || 0;
    const durSec = status.duration || this.currentSong?.duration || 0;

    if (status.didJustFinish) {
      this.handleTrackEnd();
      return;
    }

    this.handlePlaybackTick(posSec, durSec, status.playing);
  };
}

export const audioPlayerInstance = new AudioPlayer();
