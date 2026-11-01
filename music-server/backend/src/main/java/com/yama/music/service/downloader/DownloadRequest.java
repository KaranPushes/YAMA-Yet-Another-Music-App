package com.yama.music.service.downloader;

public class DownloadRequest {

    private String query;
    private String url;
    private String title;
    private String artist;
    private String album;
    private String artworkUrl;
    private Double duration;

    public DownloadRequest() {}

    public DownloadRequest(String query, String url) {
        this.query = query;
        this.url = url;
    }

    public static DownloadRequest ofQuery(String query) {
        return new DownloadRequest(query, null);
    }

    public static DownloadRequest ofUrl(String url) {
        return new DownloadRequest(null, url);
    }

    public static DownloadRequest ofTrack(String query, String url, String title, String artist, Double duration) {
        DownloadRequest req = new DownloadRequest(query, url);
        req.setTitle(title);
        req.setArtist(artist);
        req.setDuration(duration);
        return req;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
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

    public String getArtworkUrl() {
        return artworkUrl;
    }

    public void setArtworkUrl(String artworkUrl) {
        this.artworkUrl = artworkUrl;
    }

    public Double getDuration() {
        return duration;
    }

    public void setDuration(Double duration) {
        this.duration = duration;
    }

    public String getTarget() {
        if (url != null && !url.isBlank()) {
            return url;
        }
        return query;
    }
}
