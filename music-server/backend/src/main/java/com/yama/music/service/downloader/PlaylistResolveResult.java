package com.yama.music.service.downloader;

import java.util.ArrayList;
import java.util.List;

public class PlaylistResolveResult {

    private String title;
    private int totalTracks;
    private String artworkUrl;
    private List<PlaylistTrackItem> tracks = new ArrayList<>();

    public PlaylistResolveResult() {}

    public PlaylistResolveResult(String title, int totalTracks, List<PlaylistTrackItem> tracks) {
        this.title = title;
        this.totalTracks = totalTracks;
        this.tracks = tracks;
    }

    public PlaylistResolveResult(String title, int totalTracks, String artworkUrl, List<PlaylistTrackItem> tracks) {
        this.title = title;
        this.totalTracks = totalTracks;
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

    public List<PlaylistTrackItem> getTracks() {
        return tracks;
    }

    public void setTracks(List<PlaylistTrackItem> tracks) {
        this.tracks = tracks;
    }

    public static class PlaylistTrackItem {
        private String title;
        private String artist;
        private String url;
        private double duration;

        public PlaylistTrackItem() {}

        public PlaylistTrackItem(String title, String artist, String url, double duration) {
            this.title = title;
            this.artist = artist;
            this.url = url;
            this.duration = duration;
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
    }
}
