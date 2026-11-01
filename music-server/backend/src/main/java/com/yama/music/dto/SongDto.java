package com.yama.music.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SongDto(
        UUID id,
        String title,
        String artist,
        String album,
        String albumArtist,
        Integer trackNumber,
        Double duration,
        Long fileSize,
        String fileFormat,
        boolean hasArtwork,
        String artworkUrl,
        String streamUrl,
        String producer,
        List<SectionDto> sections,
        Instant createdAt,
        Instant updatedAt
) {}
