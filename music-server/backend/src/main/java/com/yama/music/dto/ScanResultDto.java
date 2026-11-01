package com.yama.music.dto;

public record ScanResultDto(
        long scannedFiles,
        long addedSongs,
        long updatedSongs,
        long deletedSongs,
        long failedFiles,
        long durationMs
) {}
