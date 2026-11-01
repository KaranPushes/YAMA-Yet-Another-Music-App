package com.yama.music.dto;

import java.util.UUID;

public record SectionDto(
        UUID id,
        UUID songId,
        Double startSeconds,
        Double endSeconds
) {}
