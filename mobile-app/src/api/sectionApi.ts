import { apiFetch } from './client';
import { PlaybackSection, CreateSectionRequest } from '../types/section';

export async function fetchSections(songId: string): Promise<PlaybackSection[]> {
  return apiFetch<PlaybackSection[]>(`/api/songs/${songId}/sections`);
}

export async function createSection(
  songId: string,
  startSeconds: number,
  endSeconds: number
): Promise<PlaybackSection> {
  const body: CreateSectionRequest = { startSeconds, endSeconds };
  return apiFetch<PlaybackSection>(`/api/songs/${songId}/sections`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateSection(
  songId: string,
  sectionId: string,
  startSeconds: number,
  endSeconds: number
): Promise<PlaybackSection> {
  const body: CreateSectionRequest = { startSeconds, endSeconds };
  return apiFetch<PlaybackSection>(`/api/songs/${songId}/sections/${sectionId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteSection(songId: string, sectionId: string): Promise<void> {
  return apiFetch<void>(`/api/songs/${songId}/sections/${sectionId}`, {
    method: 'DELETE',
  });
}
