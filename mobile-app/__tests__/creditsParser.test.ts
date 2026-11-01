import { parseCredits } from '../src/utils/creditsParser';

describe('creditsParser', () => {
  it('extracts singers and lyricists correctly', () => {
    const credits = parseCredits('RED', 'Seedhe Maut, Hisab');
    expect(credits.singers).toBe('Seedhe Maut, Hisab');
    expect(credits.lyricists).toBe('Seedhe Maut, Hisab');
  });

  it('extracts producer when marked with (Prod. by ...)', () => {
    const credits = parseCredits('Gourmet Shit! (Prod. by Sez on the Beat)', 'Seedhe Maut, Raftaar');
    expect(credits.singers).toBe('Seedhe Maut, Raftaar');
    expect(credits.producer).toBe('Sez on the Beat');
    expect(credits.hasExplicitProducer).toBe(true);
  });

  it('extracts beatmaker when last artist contains beat', () => {
    const credits = parseCredits('101', 'Seedhe Maut, Sez on the Beat');
    expect(credits.singers).toBe('Seedhe Maut');
    expect(credits.producer).toBe('Sez on the Beat');
    expect(credits.hasExplicitProducer).toBe(true);
  });

  it('never uses song title as artist or producer', () => {
    const credits = parseCredits('Song Title', 'Song Title', 'Song Title');
    expect(credits.singers).not.toBe('Song Title');
    expect(credits.producer).not.toBe('Song Title');
  });

  it('extracts featured artists from title into singers', () => {
    const credits = parseCredits('Chalo Chalein (feat. Seedhe Maut)', 'Ritviz');
    expect(credits.singers).toContain('Ritviz');
    expect(credits.singers).toContain('Seedhe Maut');
  });

  it('uses producerMeta if provided from server metadata', () => {
    const credits = parseCredits('Nanchaku', 'MC Stan, Seedhe Maut', undefined, 'Stanny In The House');
    expect(credits.producer).toBe('Stanny In The House');
    expect(credits.hasExplicitProducer).toBe(true);
  });

  it('never returns Independent Production as fallback', () => {
    const credits = parseCredits('Simple Song', 'Solo Artist');
    expect(credits.producer).not.toBe('Independent Production');
    expect(credits.producer).toBe('Solo Artist');
  });
});
