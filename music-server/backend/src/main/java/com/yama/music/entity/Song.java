package com.yama.music.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "songs", indexes = {
        @Index(name = "idx_songs_file_path", columnList = "file_path", unique = true),
        @Index(name = "idx_songs_title", columnList = "title"),
        @Index(name = "idx_songs_artist", columnList = "artist"),
        @Index(name = "idx_songs_album", columnList = "album")
})
public class Song {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String artist;

    private String album;

    @Column(name = "album_artist")
    private String albumArtist;

    @Column(name = "track_number")
    private Integer trackNumber;

    @Column(nullable = false)
    private Double duration; // in seconds

    @Column(name = "file_path", nullable = false, unique = true, length = 1024)
    private String filePath;

    @Column(name = "file_size", nullable = false)
    private Long fileSize; // in bytes

    @Column(name = "file_format", nullable = false, length = 32)
    private String fileFormat; // e.g. mp3, flac, m4a

    @Column(name = "artwork_path", length = 1024)
    private String artworkPath;

    @Column(name = "producer", length = 512)
    private String producer;

    @Column(name = "last_modified")
    private Long lastModified;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "song", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("startSeconds ASC")
    private List<PlaybackSection> playbackSections = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Song() {}

    // Getters and Setters
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

    public String getAlbum() {
        return album;
    }

    public void setAlbum(String album) {
        this.album = album;
    }

    public String getAlbumArtist() {
        return albumArtist;
    }

    public void setAlbumArtist(String albumArtist) {
        this.albumArtist = albumArtist;
    }

    public Integer getTrackNumber() {
        return trackNumber;
    }

    public void setTrackNumber(Integer trackNumber) {
        this.trackNumber = trackNumber;
    }

    public Double getDuration() {
        return duration;
    }

    public void setDuration(Double duration) {
        this.duration = duration;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public String getFileFormat() {
        return fileFormat;
    }

    public void setFileFormat(String fileFormat) {
        this.fileFormat = fileFormat;
    }

    public String getArtworkPath() {
        return artworkPath;
    }

    public void setArtworkPath(String artworkPath) {
        this.artworkPath = artworkPath;
    }

    public Long getLastModified() {
        return lastModified;
    }

    public void setLastModified(Long lastModified) {
        this.lastModified = lastModified;
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

    public List<PlaybackSection> getPlaybackSections() {
        return playbackSections;
    }

    public void setPlaybackSections(List<PlaybackSection> playbackSections) {
        this.playbackSections = playbackSections;
    }

    public void addPlaybackSection(PlaybackSection section) {
        playbackSections.add(section);
        section.setSong(this);
    }

    public void removePlaybackSection(PlaybackSection section) {
        playbackSections.remove(section);
        section.setSong(null);
    }

    public String getProducer() {
        return producer;
    }

    public void setProducer(String producer) {
        this.producer = producer;
    }
}
