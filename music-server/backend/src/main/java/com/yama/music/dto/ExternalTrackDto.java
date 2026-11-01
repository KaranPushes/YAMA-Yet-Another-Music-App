package com.yama.music.dto;

import java.util.UUID;

public class ExternalTrackDto {

    private String title;
    private String artist;
    private String album;
    private double duration;
    private String artworkUrl;
    private String sourceQuery;
    private boolean alreadyInLibrary;
    private UUID songId;

    public ExternalTrackDto() {}

    public ExternalTrackDto(String title, String artist, String album, double duration,
                            String artworkUrl, String sourceQuery, boolean alreadyInLibrary, UUID songId) {
        this.title = title;
        this.artist = artist;
        this.album = album;
        this.duration = duration;
        this.artworkUrl = artworkUrl;
        this.sourceQuery = sourceQuery;
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
