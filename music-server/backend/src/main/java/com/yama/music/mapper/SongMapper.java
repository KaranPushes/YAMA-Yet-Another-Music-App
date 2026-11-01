package com.yama.music.mapper;

import com.yama.music.dto.SectionDto;
import com.yama.music.dto.SongDto;
import com.yama.music.entity.Song;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class SongMapper {

    private final SectionMapper sectionMapper;

    public SongMapper(SectionMapper sectionMapper) {
        this.sectionMapper = sectionMapper;
    }

    public SongDto toDto(Song song) {
        if (song == null) {
            return null;
        }

        List<SectionDto> sections = Collections.emptyList();
        if (song.getPlaybackSections() != null && !song.getPlaybackSections().isEmpty()) {
            sections = song.getPlaybackSections().stream().map(sectionMapper::toDto).toList();
        }

        boolean hasArtwork = song.getArtworkPath() != null && !song.getArtworkPath().isBlank();
        String songIdStr = song.getId().toString();
        String artworkUrl = "/api/songs/" + songIdStr + "/artwork";
        String streamUrl = "/api/songs/" + songIdStr + "/stream";

        return new SongDto(
                song.getId(),
                song.getTitle(),
                song.getArtist(),
                song.getAlbum(),
                song.getAlbumArtist(),
                song.getTrackNumber(),
                song.getDuration(),
                song.getFileSize(),
                song.getFileFormat(),
                hasArtwork,
                artworkUrl,
                streamUrl,
                song.getProducer(),
                sections,
                song.getCreatedAt(),
                song.getUpdatedAt()
        );
    }
}
