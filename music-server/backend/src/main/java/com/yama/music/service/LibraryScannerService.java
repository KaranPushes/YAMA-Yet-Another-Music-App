package com.yama.music.service;

import com.yama.music.dto.ScanResultDto;
import com.yama.music.entity.Song;
import com.yama.music.repository.SongRepository;
import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.audio.AudioHeader;
import org.jaudiotagger.tag.FieldKey;
import org.jaudiotagger.tag.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Stream;

@Service
public class LibraryScannerService {

    private static final Logger log = LoggerFactory.getLogger(LibraryScannerService.class);

    @Value("${yama.music.library-path:/music}")
    private String musicLibraryPath;

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            "mp3", "flac", "m4a", "aac", "ogg", "wav"
    );

    private final SongRepository songRepository;
    private final ArtworkService artworkService;

    public LibraryScannerService(SongRepository songRepository, ArtworkService artworkService) {
        this.songRepository = songRepository;
        this.artworkService = artworkService;
    }

    @Transactional
    public ScanResultDto scanLibrary() {
        long startTime = System.currentTimeMillis();
        log.info("Starting music library scan at path: {}", musicLibraryPath);

        Path rootPath = Paths.get(musicLibraryPath);
        if (!Files.exists(rootPath) || !Files.isDirectory(rootPath)) {
            log.warn("Music library path does not exist or is not a directory: {}", musicLibraryPath);
            return new ScanResultDto(0, 0, 0, 0, 0, System.currentTimeMillis() - startTime);
        }

        long scannedFiles = 0;
        long addedSongs = 0;
        long updatedSongs = 0;
        long failedFiles = 0;

        Set<String> discoveredFilePaths = new HashSet<>();

        try (Stream<Path> stream = Files.walk(rootPath)) {
            List<Path> audioFiles = stream
                    .filter(Files::isRegularFile)
                    .filter(this::isSupportedAudioFile)
                    .toList();

            scannedFiles = audioFiles.size();
            log.info("Found {} potential audio files in library", scannedFiles);

            for (Path filePath : audioFiles) {
                String absolutePath = filePath.toAbsolutePath().toString();
                discoveredFilePaths.add(absolutePath);

                try {
                    File file = filePath.toFile();
                    long lastModified = file.lastModified();
                    long fileSize = file.length();

                    Optional<Song> existingOpt = songRepository.findByFilePath(absolutePath);
                    if (existingOpt.isPresent()) {
                        Song existing = existingOpt.get();
                        // Check if existing song is missing artwork or artwork file was deleted
                        if (existing.getArtworkPath() == null || existing.getArtworkPath().isBlank()
                                || !new File(existing.getArtworkPath()).exists()) {
                            Optional<String> remoteArt = artworkService.fetchRemoteArtworkFallback(
                                    existing.getArtist(), existing.getTitle(), existing.getId()
                            );
                            if (remoteArt.isPresent()) {
                                existing.setArtworkPath(remoteArt.get());
                                songRepository.save(existing);
                                updatedSongs++;
                            }
                        }

                        if (existing.getLastModified() != null && existing.getLastModified() == lastModified
                                && existing.getFileSize() != null && existing.getFileSize() == fileSize) {
                            // File unchanged, skip re-parsing
                            continue;
                        }
                        // File modified, re-parse and update
                        if (processSongFile(file, existing)) {
                            updatedSongs++;
                        } else {
                            failedFiles++;
                        }
                    } else {
                        // New song
                        Song newSong = new Song();
                        if (processSongFile(file, newSong)) {
                            addedSongs++;
                        } else {
                            failedFiles++;
                        }
                    }
                } catch (Exception e) {
                    log.error("Unexpected error processing file {}: {}", absolutePath, e.getMessage());
                    failedFiles++;
                }
            }
        } catch (IOException e) {
            log.error("Failed to scan directory {}: {}", musicLibraryPath, e.getMessage(), e);
        }

        // Detect missing / deleted files from disk
        long deletedSongs = removeMissingSongs(discoveredFilePaths);

        long duration = System.currentTimeMillis() - startTime;
        log.info("Library scan completed in {} ms: {} scanned, {} added, {} updated, {} deleted, {} failed",
                duration, scannedFiles, addedSongs, updatedSongs, deletedSongs, failedFiles);

        return new ScanResultDto(scannedFiles, addedSongs, updatedSongs, deletedSongs, failedFiles, duration);
    }

    @Transactional
    public Optional<Song> scanSingleFile(File file) {
        if (file == null || !file.exists() || !file.isFile() || !isSupportedAudioFile(file.toPath())) {
            log.warn("Invalid audio file for single scan: {}", file);
            return Optional.empty();
        }

        String absolutePath = file.getAbsolutePath();
        Optional<Song> existingOpt = songRepository.findByFilePath(absolutePath);
        Song song = existingOpt.orElseGet(Song::new);

        boolean success = processSongFile(file, song);
        if (success) {
            log.info("Successfully scanned and registered single audio file: {}", absolutePath);
            return songRepository.findByFilePath(absolutePath);
        } else {
            log.warn("Failed to process single audio file: {}", absolutePath);
            return Optional.empty();
        }
    }

    private boolean processSongFile(File file, Song song) {
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTag();
            AudioHeader header = audioFile.getAudioHeader();

            String ext = getFileExtension(file.getName()).toLowerCase();
            song.setFilePath(file.getAbsolutePath());
            song.setFileSize(file.length());
            song.setLastModified(file.lastModified());
            song.setFileFormat(ext);

            // Duration
            if (header != null) {
                song.setDuration((double) header.getTrackLength());
            } else {
                song.setDuration(0.0);
            }

            // Metadata extraction with fallbacks
            String title = null;
            String artist = null;
            String album = null;
            String albumArtist = null;
            String producer = null;
            Integer trackNumber = null;

            if (tag != null) {
                title = tag.getFirst(FieldKey.TITLE);
                artist = tag.getFirst(FieldKey.ARTIST);
                album = tag.getFirst(FieldKey.ALBUM);
                albumArtist = tag.getFirst(FieldKey.ALBUM_ARTIST);
                try {
                    producer = tag.getFirst(FieldKey.PRODUCER);
                } catch (Exception ignored) {}
                if (producer == null || producer.isBlank()) {
                    try {
                        producer = tag.getFirst(FieldKey.COMPOSER);
                    } catch (Exception ignored) {}
                }
                String trackStr = tag.getFirst(FieldKey.TRACK);
                if (trackStr != null && !trackStr.isBlank()) {
                    try {
                        // May be in "1" or "1/12" format
                        if (trackStr.contains("/")) {
                            trackStr = trackStr.substring(0, trackStr.indexOf("/"));
                        }
                        trackNumber = Integer.parseInt(trackStr.trim());
                    } catch (NumberFormatException ignored) {}
                }
            }

            // Fallbacks if title or artist is empty
            if (title == null || title.isBlank()) {
                title = stripExtension(file.getName());
            }
            if (artist == null || artist.isBlank()) {
                artist = "Unknown Artist";
            }
            if (album == null || album.isBlank()) {
                album = "Unknown Album";
            }

            song.setTitle(title.trim());
            song.setArtist(artist.trim());
            song.setAlbum(album.trim());
            song.setAlbumArtist(albumArtist != null && !albumArtist.isBlank() ? albumArtist.trim() : artist.trim());
            song.setProducer(producer != null && !producer.isBlank() ? producer.trim() : null);
            song.setTrackNumber(trackNumber);

            // Save song first to ensure it has an ID
            Song savedSong = songRepository.save(song);

            // Artwork processing
            if (savedSong.getArtworkPath() == null || savedSong.getArtworkPath().isBlank()) {
                Optional<String> embeddedArt = artworkService.extractEmbeddedArtwork(audioFile, savedSong.getId());
                if (embeddedArt.isPresent()) {
                    savedSong.setArtworkPath(embeddedArt.get());
                    songRepository.save(savedSong);
                } else {
                    // Try fallback remote lookup
                    Optional<String> remoteArt = artworkService.fetchRemoteArtworkFallback(
                            savedSong.getArtist(), savedSong.getTitle(), savedSong.getId()
                    );
                    if (remoteArt.isPresent()) {
                        savedSong.setArtworkPath(remoteArt.get());
                        songRepository.save(savedSong);
                    }
                }
            }

            return true;
        } catch (Exception e) {
            log.warn("Failed to parse audio file {}: {}", file.getAbsolutePath(), e.getMessage());
            return false;
        }
    }

    private long removeMissingSongs(Set<String> activePaths) {
        List<Song> allSongs = songRepository.findAll();
        long deletedCount = 0;
        for (Song song : allSongs) {
            if (!activePaths.contains(song.getFilePath()) && !new File(song.getFilePath()).exists()) {
                log.info("Removing deleted song from library: {}", song.getFilePath());
                songRepository.delete(song);
                deletedCount++;
            }
        }
        return deletedCount;
    }

    private boolean isSupportedAudioFile(Path path) {
        String filename = path.getFileName().toString();
        String ext = getFileExtension(filename).toLowerCase();
        return SUPPORTED_EXTENSIONS.contains(ext);
    }

    private String getFileExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < filename.length() - 1) {
            return filename.substring(dotIndex + 1);
        }
        return "";
    }

    private String stripExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0) {
            return filename.substring(0, dotIndex);
        }
        return filename;
    }
}
