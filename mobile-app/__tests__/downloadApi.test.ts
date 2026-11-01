import {
  createDownloadJob,
  getDownloadJobs,
  getDownloadJobById,
  retryDownloadJob,
  cancelDownloadJob,
  cancelDownloadItem,
  clearDownloadHistory,
  previewPlaylist,
  searchUnified,
} from '../src/api/downloadApi';
import * as client from '../src/api/client';

jest.mock('../src/api/client');

describe('downloadApi', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('createDownloadJob should send POST request with job parameters', async () => {
    const mockJob = { id: 'job-1', type: 'TRACK', status: 'QUEUED', totalItems: 1 };
    (client.apiFetch as jest.Mock).mockResolvedValueOnce(mockJob);

    const result = await createDownloadJob('TRACK', 'Blinding Lights');

    expect(client.apiFetch).toHaveBeenCalledWith('/api/downloads', {
      method: 'POST',
      body: JSON.stringify({ type: 'TRACK', query: 'Blinding Lights', url: undefined }),
    });
    expect(result).toEqual(mockJob);
  });

  it('getDownloadJobs should fetch jobs with pagination parameters', async () => {
    const mockJobs = [{ id: 'job-1', status: 'COMPLETED' }];
    (client.apiFetch as jest.Mock).mockResolvedValueOnce(mockJobs);

    const result = await getDownloadJobs(0, 10);

    expect(client.apiFetch).toHaveBeenCalledWith('/api/downloads?page=0&size=10');
    expect(result).toEqual(mockJobs);
  });

  it('getDownloadJobById should fetch single job by ID', async () => {
    const mockJob = { id: 'job-123', status: 'DOWNLOADING' };
    (client.apiFetch as jest.Mock).mockResolvedValueOnce(mockJob);

    const result = await getDownloadJobById('job-123');

    expect(client.apiFetch).toHaveBeenCalledWith('/api/downloads/job-123');
    expect(result).toEqual(mockJob);
  });

  it('retryDownloadJob should send POST to /retry endpoint', async () => {
    const mockJob = { id: 'job-123', status: 'QUEUED' };
    (client.apiFetch as jest.Mock).mockResolvedValueOnce(mockJob);

    const result = await retryDownloadJob('job-123');

    expect(client.apiFetch).toHaveBeenCalledWith('/api/downloads/job-123/retry', {
      method: 'POST',
    });
    expect(result).toEqual(mockJob);
  });

  it('previewPlaylist should send POST with playlist url', async () => {
    const mockPreview = {
      title: 'Workout Mix',
      totalTracks: 20,
      alreadyInLibraryCount: 5,
      missingCount: 15,
      tracks: [],
    };
    (client.apiFetch as jest.Mock).mockResolvedValueOnce(mockPreview);

    const result = await previewPlaylist('https://spotify.com/playlist/123');

    expect(client.apiFetch).toHaveBeenCalledWith('/api/downloads/playlist/preview', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://spotify.com/playlist/123' }),
    });
    expect(result).toEqual(mockPreview);
  });

  it('searchUnified should query /api/downloads/search?q=...', async () => {
    const mockSearchResult = { library: [], external: [] };
    (client.apiFetch as jest.Mock).mockResolvedValueOnce(mockSearchResult);

    const result = await searchUnified('Levitating Dua Lipa');

    expect(client.apiFetch).toHaveBeenCalledWith(
      `/api/downloads/search?q=${encodeURIComponent('Levitating Dua Lipa')}`
    );
    expect(result).toEqual(mockSearchResult);
  });

  it('cancelDownloadJob should send POST to /cancel endpoint', async () => {
    const mockJob = { id: 'job-123', status: 'CANCELLED' };
    (client.apiFetch as jest.Mock).mockResolvedValueOnce(mockJob);

    const result = await cancelDownloadJob('job-123');

    expect(client.apiFetch).toHaveBeenCalledWith('/api/downloads/job-123/cancel', {
      method: 'POST',
    });
    expect(result).toEqual(mockJob);
  });

  it('cancelDownloadItem should send POST to /items/{id}/cancel', async () => {
    (client.apiFetch as jest.Mock).mockResolvedValueOnce(undefined);

    await cancelDownloadItem('item-456');

    expect(client.apiFetch).toHaveBeenCalledWith('/api/downloads/items/item-456/cancel', {
      method: 'POST',
    });
  });

  it('clearDownloadHistory should send DELETE to /api/downloads/history', async () => {
    (client.apiFetch as jest.Mock).mockResolvedValueOnce(undefined);

    await clearDownloadHistory();

    expect(client.apiFetch).toHaveBeenCalledWith('/api/downloads/history', {
      method: 'DELETE',
    });
  });
});
