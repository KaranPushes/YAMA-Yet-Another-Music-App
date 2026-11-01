/**
 * Smart credits parser for YAMA song playback.
 * Extracts distinct singers, lyricists, and producers.
 * Guarantees the song title is never displayed as the artist or producer.
 */

export interface ParsedCredits {
  singers: string;
  lyricists: string;
  producer: string;
  hasExplicitProducer: boolean;
}

export function parseCredits(
  title: string = '',
  artist: string = '',
  albumArtist?: string,
  producerMeta?: string
): ParsedCredits {
  const cleanTitle = (title || '').trim();
  let rawArtist = (artist || '').trim();

  // Guard: If artist is empty or mistakenly set to the song title, prevent repeating title
  if (!rawArtist || rawArtist.toLowerCase() === cleanTitle.toLowerCase()) {
    rawArtist = 'Unknown Artist';
  }

  // 1. Direct producer from metadata if present and not matching the song title
  let extractedProducer = '';
  let cleanArtist = rawArtist;
  let hasExplicitProducer = false;

  if (producerMeta && producerMeta.trim()) {
    const pTrim = producerMeta.trim();
    if (pTrim.toLowerCase() !== cleanTitle.toLowerCase()) {
      extractedProducer = pTrim;
      hasExplicitProducer = true;
    }
  }

  // 2. Look for producer patterns in title (e.g. "(Prod. by Sez)", "[prod by Metro]", "feat. X")
  const prodRegex = /(?:\(|\[|\b)(?:prod(?:uced)?\.?\s*by|beats?\s*by|music\s*by)\s*([^)\],]+)(?:\)|\]|\b)/i;

  if (!extractedProducer) {
    const titleProdMatch = cleanTitle.match(prodRegex);
    if (titleProdMatch && titleProdMatch[1]) {
      extractedProducer = titleProdMatch[1].trim();
      hasExplicitProducer = true;
    }
  }

  if (!extractedProducer) {
    const artistProdMatch = rawArtist.match(prodRegex);
    if (artistProdMatch && artistProdMatch[1]) {
      extractedProducer = artistProdMatch[1].trim();
      hasExplicitProducer = true;
      // Remove producer part from artist string
      cleanArtist = rawArtist.replace(prodRegex, '').trim().replace(/,\s*$/, '');
    }
  }

  // 3. Extract featured artists from title (e.g., "(feat. Artist)", "[ft. Artist]")
  const featRegex = /(?:\(|\[|\b)(?:feat\.?|ft\.?)\s*([^)\],]+)(?:\)|\]|\b)/i;
  const featMatch = cleanTitle.match(featRegex);
  let allSingers = cleanArtist;
  if (featMatch && featMatch[1]) {
    const featArtist = featMatch[1].trim();
    if (
      !allSingers.toLowerCase().includes(featArtist.toLowerCase()) &&
      featArtist.toLowerCase() !== cleanTitle.toLowerCase()
    ) {
      allSingers = `${allSingers}, ${featArtist}`;
    }
  }

  // Clean trailing commas, hyphens, and whitespace
  allSingers = allSingers.replace(/^[,\s-]+|[,\s-]+$/g, '') || 'Unknown Artist';

  // 4. If still no explicit producer, check if artist has multiple entries where the last is a beatmaker (e.g. "Sez on the Beat")
  if (!extractedProducer) {
    const artistParts = cleanArtist.split(/,\s*|\s*&\s*|\s+x\s+/i);
    if (artistParts.length > 1) {
      const last = artistParts[artistParts.length - 1].trim();
      if (
        /beat|producer|prod|sound|music/i.test(last) ||
        (albumArtist && albumArtist.toLowerCase() === last.toLowerCase() && artistParts.length > 1)
      ) {
        extractedProducer = last;
        hasExplicitProducer = true;
        // The singers are the other artist parts
        allSingers = artistParts.slice(0, -1).join(', ').trim();
      }
    }
  }

  // 5. Fallback for producer: Never say "Independent Production". Use album artist or artist directly
  if (!extractedProducer) {
    if (
      albumArtist &&
      albumArtist !== 'Various' &&
      albumArtist.toLowerCase() !== rawArtist.toLowerCase() &&
      !cleanTitle.toLowerCase().includes(albumArtist.toLowerCase())
    ) {
      extractedProducer = albumArtist;
    } else {
      // Attribute to song's performer/artist like Spotify
      extractedProducer = allSingers !== 'Unknown Artist' ? allSingers : 'Original Production';
    }
  }

  // Filter out any occurrences where singers or producer match the song title
  if (allSingers.toLowerCase() === cleanTitle.toLowerCase()) {
    allSingers = 'Various Artists';
  }
  if (extractedProducer.toLowerCase() === cleanTitle.toLowerCase()) {
    extractedProducer = allSingers;
  }

  // Lyricists: In music conventions, the singers/songwriters are the lyricists
  const lyricists = allSingers;

  return {
    singers: allSingers,
    lyricists: lyricists,
    producer: extractedProducer,
    hasExplicitProducer,
  };
}
