import { PlaybackSection } from '../types/section';

export interface SectionEngineState {
  currentSectionIndex: number | null;
  shouldEndTrack: boolean;
  seekTargetSeconds: number | null;
}

export class SectionPlaybackEngine {
  private sections: PlaybackSection[] = [];
  private isEnabled: boolean = true;

  constructor(sections: PlaybackSection[] = [], isEnabled: boolean = true) {
    this.setSections(sections);
    this.isEnabled = isEnabled;
  }

  public setSections(sections: PlaybackSection[]): void {
    // Ensure sections are sorted by startSeconds ascending
    this.sections = [...sections].sort((a, b) => a.startSeconds - b.startSeconds);
  }

  public getSections(): PlaybackSection[] {
    return this.sections;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public isSectionModeEnabled(): boolean {
    return this.isEnabled && this.sections.length > 0;
  }

  /**
   * Evaluates what position the player should start at when a track is first loaded or played.
   * If sections exist and are enabled: returns first section start time if position is before it.
   */
  public getInitialPlaybackPosition(currentPosition: number = 0): number {
    if (!this.isSectionModeEnabled()) {
      return currentPosition;
    }
    const firstSection = this.sections[0];
    if (currentPosition < firstSection.startSeconds) {
      return firstSection.startSeconds;
    }
    // If currentPosition is already inside a section, keep it
    const inside = this.findSectionIndexAt(currentPosition);
    if (inside !== null) {
      return currentPosition;
    }
    // If between sections, snap to next section
    const next = this.findNextSectionIndex(currentPosition);
    if (next !== null) {
      return this.sections[next].startSeconds;
    }
    // Past all sections
    return firstSection.startSeconds;
  }

  /**
   * Called on continuous position updates during playback (e.g. every 100-200ms).
   * Decides if playback needs to seek to the next section or terminate track.
   */
  public evaluatePosition(currentPosition: number): SectionEngineState {
    if (!this.isSectionModeEnabled()) {
      return {
        currentSectionIndex: null,
        shouldEndTrack: false,
        seekTargetSeconds: null,
      };
    }

    const activeIdx = this.findSectionIndexAt(currentPosition);

    if (activeIdx !== null) {
      const activeSection = this.sections[activeIdx];
      // Check if we hit or surpassed the section end boundary
      if (currentPosition >= activeSection.endSeconds - 0.05) {
        // Move to next section or end
        const nextIdx = activeIdx + 1;
        if (nextIdx < this.sections.length) {
          return {
            currentSectionIndex: nextIdx,
            shouldEndTrack: false,
            seekTargetSeconds: this.sections[nextIdx].startSeconds,
          };
        } else {
          // Reached end of final section
          return {
            currentSectionIndex: null,
            shouldEndTrack: true,
            seekTargetSeconds: null,
          };
        }
      }

      return {
        currentSectionIndex: activeIdx,
        shouldEndTrack: false,
        seekTargetSeconds: null,
      };
    }

    // Current position is NOT inside any configured section!
    // Check if before first section
    if (currentPosition < this.sections[0].startSeconds) {
      return {
        currentSectionIndex: 0,
        shouldEndTrack: false,
        seekTargetSeconds: this.sections[0].startSeconds,
      };
    }

    // Check if between sections
    const nextIdx = this.findNextSectionIndex(currentPosition);
    if (nextIdx !== null) {
      return {
        currentSectionIndex: nextIdx,
        shouldEndTrack: false,
        seekTargetSeconds: this.sections[nextIdx].startSeconds,
      };
    }

    // Past last section
    return {
      currentSectionIndex: null,
      shouldEndTrack: true,
      seekTargetSeconds: null,
    };
  }

  /**
   * Handles user manual seek request.
   * If seeking into a dead/skipped zone, snaps to next valid section start.
   */
  public clampSeekPosition(requestedSeconds: number): { targetSeconds: number; shouldEnd: boolean } {
    if (!this.isSectionModeEnabled()) {
      return { targetSeconds: requestedSeconds, shouldEnd: false };
    }

    // If seeking inside an allowed section
    const insideIdx = this.findSectionIndexAt(requestedSeconds);
    if (insideIdx !== null) {
      return { targetSeconds: requestedSeconds, shouldEnd: false };
    }

    // If seeking before first section
    if (requestedSeconds < this.sections[0].startSeconds) {
      return { targetSeconds: this.sections[0].startSeconds, shouldEnd: false };
    }

    // If seeking between sections, snap to next section start
    const nextIdx = this.findNextSectionIndex(requestedSeconds);
    if (nextIdx !== null) {
      return { targetSeconds: this.sections[nextIdx].startSeconds, shouldEnd: false };
    }

    // Seeking past all sections
    return { targetSeconds: requestedSeconds, shouldEnd: true };
  }

  /**
   * Helper to find which section index contains the given position.
   */
  public findSectionIndexAt(position: number): number | null {
    for (let i = 0; i < this.sections.length; i++) {
      const s = this.sections[i];
      if (position >= s.startSeconds && position < s.endSeconds) {
        return i;
      }
    }
    return null;
  }

  /**
   * Helper to find index of next section starting after given position.
   */
  public findNextSectionIndex(position: number): number | null {
    for (let i = 0; i < this.sections.length; i++) {
      if (this.sections[i].startSeconds > position) {
        return i;
      }
    }
    return null;
  }
}
