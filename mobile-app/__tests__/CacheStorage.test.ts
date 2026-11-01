import { CacheStorage } from '../src/cache/CacheStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
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

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  deleteAsync: jest.fn(async () => {}),
  makeDirectoryAsync: jest.fn(async () => {}),
  documentDirectory: '/mock/documents/',
}));

describe('CacheStorage', () => {
  beforeEach(async () => {
    await CacheStorage.clearAll();
  });

  test('records and retrieves cached entries', async () => {
    await CacheStorage.setEntry({
      songId: 'song-123',
      localFilePath: '/path/to/song.mp3',
      downloadedBytes: 5000000,
      totalBytes: 5000000,
      downloadStatus: 'CACHED',
      lastAccessed: Date.now(),
      isComplete: true,
    });

    const entry = await CacheStorage.getEntry('song-123');
    expect(entry).not.toBeNull();
    expect(entry?.songId).toBe('song-123');
    expect(entry?.isComplete).toBe(true);
    expect(entry?.downloadStatus).toBe('CACHED');

    const stats = await CacheStorage.getStats();
    expect(stats.totalSongsCached).toBe(1);
    expect(stats.totalBytesUsed).toBe(5000000);
  });

  test('removes entry on demand', async () => {
    await CacheStorage.setEntry({
      songId: 'song-456',
      localFilePath: '/path/to/song456.mp3',
      downloadedBytes: 2000000,
      totalBytes: 2000000,
      downloadStatus: 'CACHED',
      lastAccessed: Date.now(),
      isComplete: true,
    });

    await CacheStorage.removeEntry('song-456');
    const entry = await CacheStorage.getEntry('song-456');
    expect(entry).toBeNull();

    const stats = await CacheStorage.getStats();
    expect(stats.totalSongsCached).toBe(0);
  });
});
