import { apiFetch } from './client';
import {
  DownloadJob,
  JobType,
  PlaylistPreview,
  UnifiedSearchResult,
} from '../types/download';

export async function createDownloadJob(
  type: JobType,
  query?: string,
  url?: string,
  title?: string,
  artist?: string,
  album?: string,
  artworkUrl?: string
): Promise<DownloadJob> {
  return apiFetch<DownloadJob>('/api/downloads', {
    method: 'POST',
    body: JSON.stringify({ type, query, url, title, artist, album, artworkUrl }),
  });
}

export async function getDownloadJobs(
  page: number = 0,
  size: number = 30
): Promise<DownloadJob[]> {
  return apiFetch<DownloadJob[]>(`/api/downloads?page=${page}&size=${size}`);
}

export async function getDownloadJobById(id: string): Promise<DownloadJob> {
  return apiFetch<DownloadJob>(`/api/downloads/${id}`);
}

export async function retryDownloadJob(id: string): Promise<DownloadJob> {
  return apiFetch<DownloadJob>(`/api/downloads/${id}/retry`, {
    method: 'POST',
  });
}

export async function cancelDownloadJob(id: string): Promise<DownloadJob> {
  return apiFetch<DownloadJob>(`/api/downloads/${id}/cancel`, {
    method: 'POST',
  });
}

export async function cancelDownloadItem(itemId: string): Promise<void> {
  return apiFetch<void>(`/api/downloads/items/${itemId}/cancel`, {
    method: 'POST',
  });
}

export async function clearDownloadHistory(): Promise<void> {
  return apiFetch<void>('/api/downloads/history', {
    method: 'DELETE',
  });
}

export async function previewPlaylist(url: string): Promise<PlaylistPreview> {
  return apiFetch<PlaylistPreview>('/api/downloads/playlist/preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function searchUnified(query: string): Promise<UnifiedSearchResult> {
  const q = encodeURIComponent(query.trim());
  return apiFetch<UnifiedSearchResult>(`/api/downloads/search?q=${q}`);
}
