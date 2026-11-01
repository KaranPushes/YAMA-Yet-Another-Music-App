package com.yama.music.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "download_jobs", indexes = {
        @Index(name = "idx_download_jobs_status", columnList = "status"),
        @Index(name = "idx_download_jobs_created_at", columnList = "created_at")
})
public class DownloadJob {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private JobType type;

    @Column(nullable = false, length = 32)
    private String source; // "QUERY" or "URL"

    @Column(name = "query_or_url", nullable = false, length = 2048)
    private String queryOrUrl;

    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DownloadStatus status;

    @Column(name = "total_items", nullable = false)
    private int totalItems = 0;

    @Column(name = "completed_items", nullable = false)
    private int completedItems = 0;

    @Column(name = "failed_items", nullable = false)
    private int failedItems = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "job", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("createdAt ASC")
    @JsonManagedReference
    private List<DownloadItem> items = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        if (this.status == null) {
            this.status = DownloadStatus.QUEUED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public DownloadJob() {}

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

    public List<DownloadItem> getItems() {
        return items;
    }

    public void setItems(List<DownloadItem> items) {
        this.items = items;
    }

    public void addItem(DownloadItem item) {
        items.add(item);
        item.setJob(this);
    }
}
