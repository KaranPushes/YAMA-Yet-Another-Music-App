package com.yama.music.controller;

import com.yama.music.dto.PageResponse;
import com.yama.music.dto.SongDto;
import com.yama.music.entity.Song;
import com.yama.music.exception.ResourceNotFoundException;
import com.yama.music.repository.SongRepository;
import com.yama.music.service.ArtworkService;
import com.yama.music.service.AudioStreamService;
import com.yama.music.service.SongService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/songs")
public class SongController {

    private final SongService songService;
    private final ArtworkService artworkService;
    private final AudioStreamService audioStreamService;
    private final SongRepository songRepository;

    public SongController(SongService songService,
                          ArtworkService artworkService,
                          AudioStreamService audioStreamService,
                          SongRepository songRepository) {
        this.songService = songService;
        this.artworkService = artworkService;
        this.audioStreamService = audioStreamService;
        this.songRepository = songRepository;
    }

    @GetMapping
    public ResponseEntity<PageResponse<SongDto>> getSongs(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 30, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(songService.getSongs(search, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SongDto> getSongById(@PathVariable UUID id) {
        return ResponseEntity.ok(songService.getSongById(id));
    }

    @GetMapping("/{id}/artwork")
    public ResponseEntity<Resource> getSongArtwork(@PathVariable UUID id) {
        Song song = songRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with ID: " + id));

        // If artwork path is missing or file does not exist on disk, attempt on-demand fetch from YouTube/iTunes
        if (song.getArtworkPath() == null || song.getArtworkPath().isBlank()
                || !new java.io.File(song.getArtworkPath()).exists()) {
            java.util.Optional<String> remoteArt = artworkService.fetchRemoteArtworkFallback(
                    song.getArtist(), song.getTitle(), song.getId()
            );
            if (remoteArt.isPresent()) {
                song.setArtworkPath(remoteArt.get());
                songRepository.save(song);
            }
        }

        if (song.getArtworkPath() == null || song.getArtworkPath().isBlank()) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = artworkService.getArtworkResource(song.getArtworkPath())
                .orElseThrow(() -> new ResourceNotFoundException("Artwork file not found on disk"));

        MediaType mediaType = artworkService.getArtworkMediaType(song.getArtworkPath());

        return ResponseEntity.ok()
                .contentType(mediaType)
                .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic())
                .body(resource);
    }

    @GetMapping("/{id}/stream")
    public ResponseEntity<ResourceRegion> streamSong(
            @PathVariable UUID id,
            @RequestHeader HttpHeaders headers) throws IOException {
        return audioStreamService.getAudioStreamRegion(id, headers);
    }
}
