package com.yama.music.mapper;

import com.yama.music.dto.SectionDto;
import com.yama.music.entity.PlaybackSection;
import org.springframework.stereotype.Component;

@Component
public class SectionMapper {

    public SectionDto toDto(PlaybackSection section) {
        if (section == null) {
            return null;
        }
        return new SectionDto(
                section.getId(),
                section.getSong() != null ? section.getSong().getId() : null,
                section.getStartSeconds(),
                section.getEndSeconds()
        );
    }
}
