export interface PlaybackSection {
  id: string;
  songId: string;
  startSeconds: number;
  endSeconds: number;
}

export interface CreateSectionRequest {
  startSeconds: number;
  endSeconds: number;
}
