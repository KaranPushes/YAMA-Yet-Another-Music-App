import { SectionPlaybackEngine } from '../src/player/SectionPlaybackEngine';
import { PlaybackSection } from '../src/types/section';

describe('SectionPlaybackEngine', () => {
  const mockSections: PlaybackSection[] = [
    { id: '1', songId: 's1', startSeconds: 42.0, endSeconds: 77.0 },
    { id: '2', songId: 's1', startSeconds: 125.0, endSeconds: 158.0 },
    { id: '3', songId: 's1', startSeconds: 194.0, endSeconds: 231.0 },
  ];

  test('when no sections exist, plays normally from 0', () => {
    const engine = new SectionPlaybackEngine([]);
    expect(engine.isSectionModeEnabled()).toBe(false);
    expect(engine.getInitialPlaybackPosition(0)).toBe(0);

    const evalRes = engine.evaluatePosition(50.0);
    expect(evalRes.currentSectionIndex).toBeNull();
    expect(evalRes.shouldEndTrack).toBe(false);
    expect(evalRes.seekTargetSeconds).toBeNull();

    const seekRes = engine.clampSeekPosition(100.0);
    expect(seekRes.targetSeconds).toBe(100.0);
    expect(seekRes.shouldEnd).toBe(false);
  });

  test('when sections exist, initial position before first section jumps to first section start', () => {
    const engine = new SectionPlaybackEngine(mockSections);
    expect(engine.isSectionModeEnabled()).toBe(true);
    expect(engine.getInitialPlaybackPosition(0)).toBe(42.0);
    expect(engine.getInitialPlaybackPosition(20.0)).toBe(42.0);
  });

  test('plays normally inside a section', () => {
    const engine = new SectionPlaybackEngine(mockSections);
    const evalRes = engine.evaluatePosition(50.0);
    expect(evalRes.currentSectionIndex).toBe(0);
    expect(evalRes.shouldEndTrack).toBe(false);
    expect(evalRes.seekTargetSeconds).toBeNull();
  });

  test('automatically seeks to next section when reaching end of current section', () => {
    const engine = new SectionPlaybackEngine(mockSections);
    // Reaching 77.0 (end of section 0)
    const evalRes = engine.evaluatePosition(77.0);
    expect(evalRes.currentSectionIndex).toBe(1);
    expect(evalRes.shouldEndTrack).toBe(false);
    expect(evalRes.seekTargetSeconds).toBe(125.0); // start of section 1
  });

  test('seeks to section 2 when section 1 ends', () => {
    const engine = new SectionPlaybackEngine(mockSections);
    // Reaching 158.0 (end of section 1)
    const evalRes = engine.evaluatePosition(158.0);
    expect(evalRes.currentSectionIndex).toBe(2);
    expect(evalRes.shouldEndTrack).toBe(false);
    expect(evalRes.seekTargetSeconds).toBe(194.0); // start of section 2
  });

  test('terminates track when final section ends', () => {
    const engine = new SectionPlaybackEngine(mockSections);
    // Reaching 231.0 (end of section 2, final section)
    const evalRes = engine.evaluatePosition(231.0);
    expect(evalRes.shouldEndTrack).toBe(true);
    expect(evalRes.seekTargetSeconds).toBeNull();
  });

  test('jumps to next section if position is detected in dead zone between sections', () => {
    const engine = new SectionPlaybackEngine(mockSections);
    // Position 90.0 is between section 0 (ends 77) and section 1 (starts 125)
    const evalRes = engine.evaluatePosition(90.0);
    expect(evalRes.currentSectionIndex).toBe(1);
    expect(evalRes.seekTargetSeconds).toBe(125.0);
    expect(evalRes.shouldEndTrack).toBe(false);
  });

  test('seeking inside an allowed section is preserved', () => {
    const engine = new SectionPlaybackEngine(mockSections);
    const seekRes = engine.clampSeekPosition(60.0);
    expect(seekRes.targetSeconds).toBe(60.0);
    expect(seekRes.shouldEnd).toBe(false);
  });

  test('seeking into dead zone snaps forward to next allowed section start', () => {
    const engine = new SectionPlaybackEngine(mockSections);
    // Seeking to 100.0 (between 77 and 125)
    const seekRes = engine.clampSeekPosition(100.0);
    expect(seekRes.targetSeconds).toBe(125.0);
    expect(seekRes.shouldEnd).toBe(false);
  });

  test('seeking past all sections terminates track', () => {
    const engine = new SectionPlaybackEngine(mockSections);
    // Seeking to 250.0 (all sections ended at 231)
    const seekRes = engine.clampSeekPosition(250.0);
    expect(seekRes.shouldEnd).toBe(true);
  });

  test('section starting at 0 works seamlessly', () => {
    const zeroStartSections: PlaybackSection[] = [
      { id: 'z1', songId: 's2', startSeconds: 0.0, endSeconds: 30.0 },
      { id: 'z2', songId: 's2', startSeconds: 60.0, endSeconds: 90.0 },
    ];
    const engine = new SectionPlaybackEngine(zeroStartSections);
    expect(engine.getInitialPlaybackPosition(0)).toBe(0.0);

    const evalRes = engine.evaluatePosition(30.0);
    expect(evalRes.currentSectionIndex).toBe(1);
    expect(evalRes.seekTargetSeconds).toBe(60.0);
  });
});
