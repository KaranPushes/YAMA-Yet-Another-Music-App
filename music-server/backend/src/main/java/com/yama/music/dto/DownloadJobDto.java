package com.yama.music.dto;

import com.yama.music.entity.DownloadJob;
import com.yama.music.entity.DownloadStatus;
import com.yama.music.entity.JobType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

public class DownloadJobDto {

    private UUID id;
    private JobType type;
    private String source;
    private String queryOrUrl;
    private String title;
    private DownloadStatus status;
    private int totalItems;
    private int completedItems;
    private int failedItems;
    private Instant createdAt;
    private Instant updatedAt;
    private List<DownloadItemDto> items = new ArrayList<>();

    public DownloadJobDto() {}

    public static DownloadJobDto fromEntity(DownloadJob job) {
        DownloadJobDto dto = new DownloadJobDto();
        dto.setId(job.getId());
        dto.setType(job.getType());
        dto.setSource(job.getSource());
        dto.setQueryOrUrl(job.getQueryOrUrl());
        dto.setTitle(job.getTitle());
        dto.setStatus(job.getStatus());
        dto.setTotalItems(job.getTotalItems());
        dto.setCompletedItems(job.getCompletedItems());
        dto.setFailedItems(job.getFailedItems());
        dto.setCreatedAt(job.getCreatedAt());
        dto.setUpdatedAt(job.getUpdatedAt());
        if (job.getItems() != null) {
            dto.setItems(job.getItems().stream()
                    .map(DownloadItemDto::fromEntity)
                    .collect(Collectors.toList()));
        }
        return dto;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public JobType getType() {
        return type;
    }

    public void setType(JobType type) {
        this.type = type;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getQueryOrUrl() {
        return queryOrUrl;
    }

    public void setQueryOrUrl(String queryOrUrl) {
        this.queryOrUrl = queryOrUrl;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public DownloadStatus getStatus() {
        return status;
    }

    public void setStatus(DownloadStatus status) {
        this.status = status;
    }

    public int getTotalItems() {
        return totalItems;
    }

    public void setTotalItems(int totalItems) {
        this.totalItems = totalItems;
    }

    public int getCompletedItems() {
        return completedItems;
    }

    public void setCompletedItems(int completedItems) {
        this.completedItems = completedItems;
    }

    public int getFailedItems() {
        return failedItems;
    }

    public void setFailedItems(int failedItems) {
        this.failedItems = failedItems;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<DownloadItemDto> getItems() {
        return items;
    }

    public void setItems(List<DownloadItemDto> items) {
        this.items = items;
    }
}
