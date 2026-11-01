package com.yama.music.entity;

public enum DownloadStatus {
    QUEUED,
    DOWNLOADING,
    PROCESSING,
    SCANNING,
    COMPLETED,
    FAILED,
    SKIPPED,
    PARTIALLY_COMPLETED,
    CANCELLED
}
