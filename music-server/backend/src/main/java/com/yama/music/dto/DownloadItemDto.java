package com.yama.music.dto;

import com.yama.music.entity.DownloadItem;
import com.yama.music.entity.DownloadStatus;
import java.time.Instant;
import java.util.UUID;

public class DownloadItemDto {

    private UUID id;
    private String title;
    private String artist;
    private String sourceUrl;
    private DownloadStatus status;
    private int progress;
    private UUID songId;
    private String errorMessage;
    private Instant createdAt;
    private Instant completedAt;

    public DownloadItemDto() {}

    public static DownloadItemDto fromEntity(DownloadItem item) {
        DownloadItemDto dto = new DownloadItemDto();
        dto.setId(item.getId());
        dto.setTitle(item.getTitle());
        dto.setArtist(item.getArtist());
        dto.setSourceUrl(item.getSourceUrl());
        dto.setStatus(item.getStatus());
        dto.setProgress(item.getProgress());
        dto.setSongId(item.getSongId());
        dto.setErrorMessage(item.getErrorMessage());
        dto.setCreatedAt(item.getCreatedAt());
        dto.setCompletedAt(item.getCompletedAt());
        return dto;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public DownloadStatus getStatus() {
        return status;
    }

    public void setStatus(DownloadStatus status) {
        this.status = status;
    }

    public int getProgress() {
        return progress;
    }

    public void setProgress(int progress) {
        this.progress = progress;
    }

    public UUID getSongId() {
        return songId;
    }

    public void setSongId(UUID songId) {
        this.songId = songId;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }
}
