package com.yama.music.controller;

import com.yama.music.dto.*;
import com.yama.music.entity.DownloadJob;
import com.yama.music.entity.JobType;
import com.yama.music.entity.Song;
import com.yama.music.exception.ResourceNotFoundException;
import com.yama.music.mapper.SongMapper;
import com.yama.music.repository.DownloadJobRepository;
import com.yama.music.repository.SongRepository;
import com.yama.music.service.DownloadQueueService;
import com.yama.music.service.downloader.ExternalSearchResultItem;
import com.yama.music.service.downloader.MusicDownloader;
import com.yama.music.service.downloader.PlaylistResolveResult;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/downloads")
public class DownloadController {

    private final DownloadQueueService downloadQueueService;
    private final DownloadJobRepository downloadJobRepository;
    private final MusicDownloader musicDownloader;
    private final SongRepository songRepository;
    private final SongMapper songMapper;

    public DownloadController(DownloadQueueService downloadQueueService,
                              DownloadJobRepository downloadJobRepository,
                              MusicDownloader musicDownloader,
                              SongRepository songRepository,
                              SongMapper songMapper) {
        this.downloadQueueService = downloadQueueService;
        this.downloadJobRepository = downloadJobRepository;
        this.musicDownloader = musicDownloader;
        this.songRepository = songRepository;
        this.songMapper = songMapper;
    }

    @PostMapping
    public ResponseEntity<DownloadJobDto> createDownload(@Valid @RequestBody CreateDownloadRequest request) {
        DownloadJob job;
        if (request.getType() == JobType.PLAYLIST) {
            job = downloadQueueService.createPlaylistJob(request.getUrl());
        } else {
            job = downloadQueueService.createTrackJob(
                request.getQuery(),
                request.getUrl(),
                request.getTitle(),
                request.getArtist(),
                request.getAlbum(),
                request.getArtworkUrl()
            );
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(DownloadJobDto.fromEntity(job));
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    @GetMapping
    public ResponseEntity<List<DownloadJobDto>> getDownloadJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        List<DownloadJob> jobs = downloadJobRepository.findAllByOrderByCreatedAtDesc(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();

        List<DownloadJobDto> dtos = jobs.stream()
                .map(DownloadJobDto::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    @GetMapping("/{id}")
    public ResponseEntity<DownloadJobDto> getDownloadJobById(@PathVariable UUID id) {
        DownloadJob job = downloadJobRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Download job not found: " + id));
        return ResponseEntity.ok(DownloadJobDto.fromEntity(job));
    }

    @PostMapping("/{id}/retry")
    public ResponseEntity<DownloadJobDto> retryDownloadJob(@PathVariable UUID id) {
        DownloadJob job = downloadQueueService.retryJob(id);
        return ResponseEntity.ok(DownloadJobDto.fromEntity(job));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<DownloadJobDto> cancelDownloadJob(@PathVariable UUID id) {
        DownloadJob job = downloadQueueService.cancelJob(id);
        return ResponseEntity.ok(DownloadJobDto.fromEntity(job));
    }

    @PostMapping("/items/{itemId}/cancel")
    public ResponseEntity<Void> cancelDownloadItem(@PathVariable UUID itemId) {
        downloadQueueService.cancelItem(itemId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/history")
    public ResponseEntity<Void> clearHistory() {
        downloadQueueService.clearHistory();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/playlist/preview")
    public ResponseEntity<PlaylistPreviewDto> previewPlaylist(@RequestBody Map<String, String> payload) {
        String url = payload.get("url");
        if (url == null || url.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        PlaylistResolveResult result = musicDownloader.resolvePlaylist(url);
        List<PlaylistPreviewDto.TrackPreviewItem> trackPreviews = new ArrayList<>();
        int alreadyInLibrary = 0;

        for (PlaylistResolveResult.PlaylistTrackItem track : result.getTracks()) {
            Optional<Song> existing = songRepository.findFirstByTitleIgnoreCaseAndArtistIgnoreCase(track.getTitle(), track.getArtist());
            boolean inLibrary = existing.isPresent();
            UUID songId = existing.map(Song::getId).orElse(null);
            if (inLibrary) {
                alreadyInLibrary++;
            }
            trackPreviews.add(new PlaylistPreviewDto.TrackPreviewItem(
                    track.getTitle(),
                    track.getArtist(),
                    track.getUrl(),
                    track.getDuration(),
                    inLibrary,
                    songId
            ));
        }

        int missing = trackPreviews.size() - alreadyInLibrary;
        PlaylistPreviewDto dto = new PlaylistPreviewDto(
                result.getTitle(),
                trackPreviews.size(),
                alreadyInLibrary,
                missing,
                result.getArtworkUrl(),
                trackPreviews
        );
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/search")
    public ResponseEntity<UnifiedSearchResponseDto> searchUnified(@RequestParam String q) {
        if (q == null || q.isBlank()) {
            return ResponseEntity.ok(new UnifiedSearchResponseDto());
        }

        // 1. Search local library
        List<Song> localMatches = songRepository.searchSongs(q.trim(), PageRequest.of(0, 15)).getContent();
        List<SongDto> libraryDtos = localMatches.stream()
                .map(songMapper::toDto)
                .collect(Collectors.toList());

        // 2. Search external candidates via downloader
        List<ExternalSearchResultItem> externalItems = musicDownloader.searchExternal(q.trim());
        List<ExternalTrackDto> externalDtos = new ArrayList<>();

        for (ExternalSearchResultItem item : externalItems) {
            Optional<Song> existing = songRepository.findFirstByTitleIgnoreCaseAndArtistIgnoreCase(item.getTitle(), item.getArtist());
            boolean inLibrary = existing.isPresent();
            UUID songId = existing.map(Song::getId).orElse(null);

            externalDtos.add(new ExternalTrackDto(
                    item.getTitle(),
                    item.getArtist(),
                    item.getAlbum(),
                    item.getDuration(),
                    item.getArtworkUrl(),
                    item.getSourceQuery(),
                    inLibrary,
                    songId
            ));
        }

        return ResponseEntity.ok(new UnifiedSearchResponseDto(libraryDtos, externalDtos));
    }
}
