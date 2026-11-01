package com.yama.music.service;

import com.yama.music.entity.Song;
import com.yama.music.exception.ResourceNotFoundException;
import com.yama.music.repository.SongRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AudioStreamServiceTest {

    @Mock
    private SongRepository songRepository;

    @InjectMocks
    private AudioStreamService audioStreamService;

    @TempDir
    Path tempDir;

    private UUID songId;
    private Song testSong;
    private File audioFile;

    @BeforeEach
    void setUp() throws IOException {
        songId = UUID.randomUUID();
        audioFile = tempDir.resolve("test_song.mp3").toFile();
        try (FileOutputStream out = new FileOutputStream(audioFile)) {
            // Write 5000 bytes of dummy audio data
            byte[] data = new byte[5000];
            out.write(data);
        }

        testSong = new Song();
        testSong.setId(songId);
        testSong.setTitle("Test Audio");
        testSong.setArtist("Test Artist");
        testSong.setFilePath(audioFile.getAbsolutePath());
        testSong.setFileSize(5000L);
        testSong.setFileFormat("mp3");
        testSong.setDuration(120.0);
    }

    @Test
    @DisplayName("Should return 206 Partial Content with Accept-Ranges for range request")
    void testRangeRequestStreaming() throws IOException {
        when(songRepository.findById(songId)).thenReturn(Optional.of(testSong));

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.RANGE, "bytes=100-500");

        ResponseEntity<?> response = audioStreamService.getAudioStreamRegion(songId, headers);

        assertNotNull(response);
        assertEquals(HttpStatus.PARTIAL_CONTENT, response.getStatusCode());
        assertEquals("bytes", response.getHeaders().getFirst(HttpHeaders.ACCEPT_RANGES));
        assertEquals("audio/mpeg", response.getHeaders().getContentType().toString());

        assertTrue(response.getBody() instanceof ResourceRegion);
        ResourceRegion region = (ResourceRegion) response.getBody();
        assertNotNull(region);
        assertEquals(100, region.getPosition());
        assertEquals(401, region.getCount());
    }

    @Test
    @DisplayName("Should return 200 OK with full FileSystemResource when no range header is supplied")
    void testNoRangeHeaderStreaming() throws IOException {
        when(songRepository.findById(songId)).thenReturn(Optional.of(testSong));

        HttpHeaders headers = new HttpHeaders();
        ResponseEntity<?> response = audioStreamService.getAudioStreamRegion(songId, headers);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("bytes", response.getHeaders().getFirst(HttpHeaders.ACCEPT_RANGES));
        assertEquals(5000L, response.getHeaders().getContentLength());
        assertNotNull(response.getBody());
    }

    @Test
    @DisplayName("Should throw ResourceNotFoundException for unknown song ID")
    void testUnknownSongStream() {
        when(songRepository.findById(songId)).thenReturn(Optional.empty());

        HttpHeaders headers = new HttpHeaders();
        assertThrows(ResourceNotFoundException.class, () -> audioStreamService.getAudioStreamRegion(songId, headers));
    }
}
