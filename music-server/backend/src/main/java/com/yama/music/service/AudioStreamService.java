package com.yama.music.service;

import com.yama.music.entity.Song;
import com.yama.music.exception.ResourceNotFoundException;
import com.yama.music.repository.SongRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.*;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Service
public class AudioStreamService {

    private static final Logger log = LoggerFactory.getLogger(AudioStreamService.class);

    // Default chunk size 1MB for range requests if unbounded end is requested
    private static final long DEFAULT_CHUNK_SIZE = 1024 * 1024;

    private final SongRepository songRepository;

    public AudioStreamService(SongRepository songRepository) {
        this.songRepository = songRepository;
    }

    public ResponseEntity<ResourceRegion> getAudioStreamRegion(UUID songId, HttpHeaders headers) throws IOException {
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new ResourceNotFoundException("Song not found with ID: " + songId));

        File file = new File(song.getFilePath());
        if (!file.exists() || !file.canRead()) {
            log.error("Audio file does not exist on disk for song {}: {}", songId, song.getFilePath());
            throw new ResourceNotFoundException("Audio file not accessible on server");
        }

        FileSystemResource resource = new FileSystemResource(file);
        long contentLength = file.length();
        MediaType mediaType = getMediaTypeForFormat(song.getFileFormat());

        List<HttpRange> ranges = headers.getRange();
        if (ranges == null || ranges.isEmpty()) {
            // Full file request using full-span ResourceRegion -> 200 OK
            ResourceRegion region = new ResourceRegion(resource, 0, contentLength);
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .contentLength(contentLength)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .body(region);
        }

        // Range request -> 206 Partial Content
        HttpRange range = ranges.get(0);
        long start = range.getRangeStart(contentLength);
        long end = range.getRangeEnd(contentLength);
        long rangeLength = end - start + 1;

        ResourceRegion region = new ResourceRegion(resource, start, rangeLength);

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .contentType(mediaType)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .body(region);
    }

    public MediaType getMediaTypeForFormat(String format) {
        if (format == null) {
            return MediaType.parseMediaType("audio/mpeg");
        }
        return switch (format.toLowerCase()) {
            case "flac" -> MediaType.parseMediaType("audio/flac");
            case "m4a" -> MediaType.parseMediaType("audio/mp4");
            case "aac" -> MediaType.parseMediaType("audio/aac");
            case "ogg" -> MediaType.parseMediaType("audio/ogg");
            case "wav" -> MediaType.parseMediaType("audio/wav");
            default -> MediaType.parseMediaType("audio/mpeg");
        };
    }
}
