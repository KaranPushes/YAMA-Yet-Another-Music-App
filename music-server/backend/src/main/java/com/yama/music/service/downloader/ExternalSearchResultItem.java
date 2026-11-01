package com.yama.music.service.downloader;

public class ExternalSearchResultItem {

    private String title;
    private String artist;
    private String album;
    private double duration;
    private String artworkUrl;
    private String sourceQuery;

    public ExternalSearchResultItem() {}

    public ExternalSearchResultItem(String title, String artist, String album, double duration, String artworkUrl, String sourceQuery) {
        this.title = title;
        this.artist = artist;
        this.album = album;
        this.duration = duration;
        this.artworkUrl = artworkUrl;
        this.sourceQuery = sourceQuery;
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

    public String getAlbum() {
        return album;
    }

    public void setAlbum(String album) {
        this.album = album;
    }

    public double getDuration() {
        return duration;
    }

    public void setDuration(double duration) {
        this.duration = duration;
    }

    public String getArtworkUrl() {
        return artworkUrl;
    }

    public void setArtworkUrl(String artworkUrl) {
        this.artworkUrl = artworkUrl;
    }

    public String getSourceQuery() {
        return sourceQuery;
    }

    public void setSourceQuery(String sourceQuery) {
        this.sourceQuery = sourceQuery;
    }
}
