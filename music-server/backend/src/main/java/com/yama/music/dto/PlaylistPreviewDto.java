package com.yama.music.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PlaylistPreviewDto {

    private String title;
    private int totalTracks;
    private int alreadyInLibraryCount;
    private int missingCount;
    private String artworkUrl;
    private List<TrackPreviewItem> tracks = new ArrayList<>();

    public PlaylistPreviewDto() {}

    public PlaylistPreviewDto(String title, int totalTracks, int alreadyInLibraryCount, int missingCount, List<TrackPreviewItem> tracks) {
        this.title = title;
        this.totalTracks = totalTracks;
        this.alreadyInLibraryCount = alreadyInLibraryCount;
        this.missingCount = missingCount;
        this.tracks = tracks;
    }

    public PlaylistPreviewDto(String title, int totalTracks, int alreadyInLibraryCount, int missingCount, String artworkUrl, List<TrackPreviewItem> tracks) {
        this.title = title;
        this.totalTracks = totalTracks;
        this.alreadyInLibraryCount = alreadyInLibraryCount;
        this.missingCount = missingCount;
        this.artworkUrl = artworkUrl;
        this.tracks = tracks;
    }

    public String getArtworkUrl() {
        return artworkUrl;
    }

    public void setArtworkUrl(String artworkUrl) {
        this.artworkUrl = artworkUrl;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getTotalTracks() {
        return totalTracks;
    }

    public void setTotalTracks(int totalTracks) {
        this.totalTracks = totalTracks;
    }

    public int getAlreadyInLibraryCount() {
        return alreadyInLibraryCount;
    }

    public void setAlreadyInLibraryCount(int alreadyInLibraryCount) {
        this.alreadyInLibraryCount = alreadyInLibraryCount;
    }

    public int getMissingCount() {
        return missingCount;
    }

    public void setMissingCount(int missingCount) {
        this.missingCount = missingCount;
    }

    public List<TrackPreviewItem> getTracks() {
        return tracks;
    }

    public void setTracks(List<TrackPreviewItem> tracks) {
        this.tracks = tracks;
    }

    public static class TrackPreviewItem {
        private String title;
        private String artist;
        private String url;
        private double duration;
        private boolean alreadyInLibrary;
        private UUID songId;

        public TrackPreviewItem() {}

        public TrackPreviewItem(String title, String artist, String url, double duration, boolean alreadyInLibrary, UUID songId) {
            this.title = title;
            this.artist = artist;
            this.url = url;
            this.duration = duration;
            this.alreadyInLibrary = alreadyInLibrary;
            this.songId = songId;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getArtist() {
            return artist;
        }

        public void setArtist(String artist) {
            this.artist = artist;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }

        public double getDuration() {
            return duration;
        }

        public void setDuration(double duration) {
            this.duration = duration;
        }

        public boolean isAlreadyInLibrary() {
            return alreadyInLibrary;
        }

        public void setAlreadyInLibrary(boolean alreadyInLibrary) {
            this.alreadyInLibrary = alreadyInLibrary;
        }

        public UUID getSongId() {
            return songId;
        }

        public void setSongId(UUID songId) {
            this.songId = songId;
        }
    }
}
