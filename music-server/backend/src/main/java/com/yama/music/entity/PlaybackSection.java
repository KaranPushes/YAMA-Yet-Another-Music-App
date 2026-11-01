package com.yama.music.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "playback_sections", indexes = {
        @Index(name = "idx_sections_song_id", columnList = "song_id")
})
public class PlaybackSection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    @JsonIgnore
    private Song song;

    @Column(name = "start_seconds", nullable = false)
    private Double startSeconds;

    @Column(name = "end_seconds", nullable = false)
    private Double endSeconds;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
    }

    public PlaybackSection() {}

    public PlaybackSection(Song song, Double startSeconds, Double endSeconds) {
        this.song = song;
        this.startSeconds = startSeconds;
        this.endSeconds = endSeconds;
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Song getSong() {
        return song;
    }

    public void setSong(Song song) {
        this.song = song;
    }

    public Double getStartSeconds() {
        return startSeconds;
    }

    public void setStartSeconds(Double startSeconds) {
        this.startSeconds = startSeconds;
    }

    public Double getEndSeconds() {
        return endSeconds;
    }

    public void setEndSeconds(Double endSeconds) {
        this.endSeconds = endSeconds;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
