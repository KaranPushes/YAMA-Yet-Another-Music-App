package com.yama.music.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CreateSectionRequest(
        @NotNull(message = "Start seconds must not be null")
        @PositiveOrZero(message = "Start seconds must be zero or positive")
        Double startSeconds,

        @NotNull(message = "End seconds must not be null")
        Double endSeconds
) {}
