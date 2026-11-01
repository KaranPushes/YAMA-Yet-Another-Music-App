package com.yama.music.dto;

import com.yama.music.entity.JobType;
import jakarta.validation.constraints.NotNull;

public class CreateDownloadRequest {

    @NotNull
    private JobType type; // TRACK or PLAYLIST

    private String query;

    private String url;

    private String title;

    private String artist;

    private String album;

    private String artworkUrl;

    public CreateDownloadRequest() {}

    public CreateDownloadRequest(JobType type, String query, String url) {
        this.type = type;
        this.query = query;
        this.url = url;
    }

    public JobType getType() {
        return type;
    }

    public void setType(JobType type) {
        this.type = type;
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
}
