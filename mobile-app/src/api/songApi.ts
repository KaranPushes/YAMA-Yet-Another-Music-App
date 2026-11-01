import { apiFetch, getApiBaseUrl } from './client';
import { Song, PageResponse } from '../types/song';

export interface ScanResult {
  scannedFiles: number;
  addedSongs: number;
  updatedSongs: number;
  deletedSongs: number;
  failedFiles: number;
  durationMs: number;
}

export async function fetchSongs(
  search?: string,
  page: number = 0,
  size: number = 50
): Promise<PageResponse<Song>> {
  const params = new URLSearchParams();
  if (search && search.trim()) {
    params.append('search', search.trim());
  }
  params.append('page', page.toString());
  params.append('size', size.toString());

  return apiFetch<PageResponse<Song>>(`/api/songs?${params.toString()}`);
}

export async function fetchSongById(id: string): Promise<Song> {
  return apiFetch<Song>(`/api/songs/${id}`);
}

export async function getFullArtworkUrl(songId: string): Promise<string> {
  const baseUrl = await getApiBaseUrl();
  return `${baseUrl}/api/songs/${songId}/artwork`;
}

export async function getFullStreamUrl(songId: string): Promise<string> {
  const baseUrl = await getApiBaseUrl();
  return `${baseUrl}/api/songs/${songId}/stream`;
}

export async function triggerLibraryScan(): Promise<ScanResult> {
  return apiFetch<ScanResult>('/api/library/scan', {
    method: 'POST',
  });
}
