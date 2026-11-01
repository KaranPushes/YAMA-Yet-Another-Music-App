package com.yama.music.service;

import com.yama.music.dto.CreateSectionRequest;
import com.yama.music.dto.SectionDto;
import com.yama.music.entity.PlaybackSection;
import com.yama.music.entity.Song;
import com.yama.music.exception.InvalidSectionException;
import com.yama.music.exception.ResourceNotFoundException;
import com.yama.music.mapper.SectionMapper;
import com.yama.music.repository.PlaybackSectionRepository;
import com.yama.music.repository.SongRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class SectionService {

    private final SongRepository songRepository;
    private final PlaybackSectionRepository sectionRepository;
    private final SectionMapper sectionMapper;

    public SectionService(SongRepository songRepository,
                          PlaybackSectionRepository sectionRepository,
                          SectionMapper sectionMapper) {
        this.songRepository = songRepository;
        this.sectionRepository = sectionRepository;
        this.sectionMapper = sectionMapper;
    }

    @Transactional(readOnly = true)
    public List<SectionDto> getSectionsForSong(UUID songId) {
        if (!songRepository.existsById(songId)) {
            throw new ResourceNotFoundException("Song not found with ID: " + songId);
        }
        return sectionRepository.findBySongIdOrderByStartSecondsAsc(songId).stream()
                .map(sectionMapper::toDto)
                .toList();
    }

    @Transactional
    public SectionDto addSection(UUID songId, CreateSectionRequest request) {
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with ID: " + songId));

        validateSectionTimes(song, request.startSeconds(), request.endSeconds());

        PlaybackSection section = new PlaybackSection(song, request.startSeconds(), request.endSeconds());
        PlaybackSection saved = sectionRepository.save(section);
        return sectionMapper.toDto(saved);
    }

    @Transactional
    public SectionDto updateSection(UUID songId, UUID sectionId, CreateSectionRequest request) {
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with ID: " + songId));

        PlaybackSection section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Playback section not found with ID: " + sectionId));

        if (!section.getSong().getId().equals(songId)) {
            throw new InvalidSectionException("Section does not belong to song: " + songId);
        }

        validateSectionTimes(song, request.startSeconds(), request.endSeconds());

        section.setStartSeconds(request.startSeconds());
        section.setEndSeconds(request.endSeconds());
        PlaybackSection updated = sectionRepository.save(section);
        return sectionMapper.toDto(updated);
    }

    @Transactional
    public void deleteSection(UUID songId, UUID sectionId) {
        PlaybackSection section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Playback section not found with ID: " + sectionId));

        if (!section.getSong().getId().equals(songId)) {
            throw new InvalidSectionException("Section does not belong to song: " + songId);
        }

        sectionRepository.delete(section);
    }

    private void validateSectionTimes(Song song, Double startSeconds, Double endSeconds) {
        if (startSeconds == null || endSeconds == null) {
            throw new InvalidSectionException("Start and end seconds must not be null");
        }
        if (startSeconds < 0) {
            throw new InvalidSectionException("Start seconds cannot be negative (" + startSeconds + ")");
        }
        if (endSeconds <= startSeconds) {
            throw new InvalidSectionException("End seconds (" + endSeconds + ") must be greater than start seconds (" + startSeconds + ")");
        }
        if (song.getDuration() != null && song.getDuration() > 0) {
            // Allow up to 1 second buffer in case of tag duration rounding
            if (startSeconds > song.getDuration() + 1.0) {
                throw new InvalidSectionException("Section start (" + startSeconds + "s) exceeds song duration (" + song.getDuration() + "s)");
            }
            if (endSeconds > song.getDuration() + 2.0) {
                throw new InvalidSectionException("Section end (" + endSeconds + "s) exceeds song duration (" + song.getDuration() + "s)");
            }
        }
    }
}
