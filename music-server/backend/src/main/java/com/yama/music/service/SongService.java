package com.yama.music.service;

import com.yama.music.dto.PageResponse;
import com.yama.music.dto.SongDto;
import com.yama.music.entity.Song;
import com.yama.music.exception.ResourceNotFoundException;
import com.yama.music.mapper.SongMapper;
import com.yama.music.repository.SongRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class SongService {

    private final SongRepository songRepository;
    private final SongMapper songMapper;

    public SongService(SongRepository songRepository, SongMapper songMapper) {
        this.songRepository = songRepository;
        this.songMapper = songMapper;
    }

    @Transactional(readOnly = true)
    public PageResponse<SongDto> getSongs(String search, Pageable pageable) {
        Page<Song> page;
        if (search != null && !search.isBlank()) {
            page = songRepository.searchSongs(search.trim(), pageable);
        } else {
            page = songRepository.findAll(pageable);
        }
        return PageResponse.of(page.map(songMapper::toDto));
    }

    @Transactional(readOnly = true)
    public SongDto getSongById(UUID id) {
        return songRepository.findById(id)
                .map(songMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with ID: " + id));
    }
}
