import { PlaylistStorage } from '../src/cache/PlaylistStorage';

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] || null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

describe('PlaylistStorage', () => {
  test('toggles liked songs correctly', async () => {
    const isLiked1 = await PlaylistStorage.toggleLikeSong('song-1');
    expect(isLiked1).toBe(true);

    const checkLiked = await PlaylistStorage.isSongLiked('song-1');
    expect(checkLiked).toBe(true);

    const isLiked2 = await PlaylistStorage.toggleLikeSong('song-1');
    expect(isLiked2).toBe(false);

    const checkUnliked = await PlaylistStorage.isSongLiked('song-1');
    expect(checkUnliked).toBe(false);
  });

  test('creates playlist and adds songs', async () => {
    const playlist = await PlaylistStorage.createPlaylist('Night Vibes');
    expect(playlist.name).toBe('Night Vibes');
    expect(playlist.songIds).toEqual([]);

    const added = await PlaylistStorage.addSongToPlaylist(playlist.id, 'song-abc');
    expect(added).toBe(true);

    const playlists = await PlaylistStorage.getPlaylists();
    const found = playlists.find((p) => p.id === playlist.id);
    expect(found?.songIds).toContain('song-abc');

    await PlaylistStorage.removeSongFromPlaylist(playlist.id, 'song-abc');
    const playlistsAfter = await PlaylistStorage.getPlaylists();
    const foundAfter = playlistsAfter.find((p) => p.id === playlist.id);
    expect(foundAfter?.songIds).not.toContain('song-abc');

    await PlaylistStorage.deletePlaylist(playlist.id);
    const playlistsFinal = await PlaylistStorage.getPlaylists();
    expect(playlistsFinal.find((p) => p.id === playlist.id)).toBeUndefined();
  });

  test('prunes deleted server songs from liked songs and playlists', async () => {
    // Setup liked songs: song-alive and song-deleted
    await PlaylistStorage.toggleLikeSong('song-alive');
    await PlaylistStorage.toggleLikeSong('song-deleted');
    expect(await PlaylistStorage.isSongLiked('song-deleted')).toBe(true);

    // Setup playlist with both songs
    const playlist = await PlaylistStorage.createPlaylist('Party', undefined, undefined, [
      'song-alive',
      'song-deleted',
    ]);
    expect(playlist.songIds).toEqual(['song-alive', 'song-deleted']);

    // Prune with only 'song-alive' surviving
    await PlaylistStorage.pruneDeletedSongs(new Set(['song-alive']));

    // Verify liked songs
    expect(await PlaylistStorage.isSongLiked('song-alive')).toBe(true);
    expect(await PlaylistStorage.isSongLiked('song-deleted')).toBe(false);

    // Verify playlist songIds
    const playlists = await PlaylistStorage.getPlaylists();
    const updatedPl = playlists.find((p) => p.id === playlist.id);
    expect(updatedPl?.songIds).toEqual(['song-alive']);
  });

  test('reorders playlist songs correctly', async () => {
    const playlist = await PlaylistStorage.createPlaylist('Order Test', undefined, undefined, [
      'track-1',
      'track-2',
      'track-3',
    ]);
    expect(playlist.songIds).toEqual(['track-1', 'track-2', 'track-3']);

    // Move track-3 from index 2 to index 0
    await PlaylistStorage.reorderPlaylistSongs(playlist.id, 2, 0);

    const playlists = await PlaylistStorage.getPlaylists();
    const found = playlists.find((p) => p.id === playlist.id);
    expect(found?.songIds).toEqual(['track-3', 'track-1', 'track-2']);
  });
});

