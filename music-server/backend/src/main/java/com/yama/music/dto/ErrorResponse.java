package com.yama.music.dto;

import java.time.Instant;
import java.util.List;

public record ErrorResponse(
        int status,
        String error,
        String message,
        List<String> details,
        String path,
        Instant timestamp
) {
    public ErrorResponse(int status, String error, String message, String path) {
        this(status, error, message, List.of(), path, Instant.now());
    }

    public ErrorResponse(int status, String error, String message, List<String> details, String path) {
        this(status, error, message, details, path, Instant.now());
    }
}
