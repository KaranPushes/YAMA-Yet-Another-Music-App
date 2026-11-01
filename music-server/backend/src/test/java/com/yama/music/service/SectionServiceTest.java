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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SectionServiceTest {

    @Mock
    private SongRepository songRepository;

    @Mock
    private PlaybackSectionRepository sectionRepository;

    private SectionService sectionService;

    private Song testSong;
    private UUID songId;

    @BeforeEach
    void setUp() {
        sectionService = new SectionService(songRepository, sectionRepository, new SectionMapper());
        songId = UUID.randomUUID();
        testSong = new Song();
        testSong.setId(songId);
        testSong.setTitle("Blinding Lights");
        testSong.setArtist("The Weeknd");
        testSong.setDuration(200.0); // 200 seconds
    }

    @Test
    @DisplayName("Should successfully add a valid playback section")
    void testAddValidSection() {
        when(songRepository.findById(songId)).thenReturn(Optional.of(testSong));
        when(sectionRepository.save(any(PlaybackSection.class))).thenAnswer(invocation -> {
            PlaybackSection s = invocation.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });

        CreateSectionRequest request = new CreateSectionRequest(42.0, 77.0);
        SectionDto result = sectionService.addSection(songId, request);

        assertNotNull(result);
        assertEquals(42.0, result.startSeconds());
        assertEquals(77.0, result.endSeconds());
        assertEquals(songId, result.songId());
        verify(sectionRepository, times(1)).save(any(PlaybackSection.class));
    }

    @Test
    @DisplayName("Should reject section when endSeconds <= startSeconds")
    void testRejectEndLessThanStart() {
        when(songRepository.findById(songId)).thenReturn(Optional.of(testSong));

        CreateSectionRequest request = new CreateSectionRequest(50.0, 30.0);
        assertThrows(InvalidSectionException.class, () -> sectionService.addSection(songId, request));

        CreateSectionRequest equalTimes = new CreateSectionRequest(50.0, 50.0);
        assertThrows(InvalidSectionException.class, () -> sectionService.addSection(songId, equalTimes));
    }

    @Test
    @DisplayName("Should reject section when startSeconds is negative")
    void testRejectNegativeStartSeconds() {
        when(songRepository.findById(songId)).thenReturn(Optional.of(testSong));

        CreateSectionRequest request = new CreateSectionRequest(-5.0, 30.0);
        assertThrows(InvalidSectionException.class, () -> sectionService.addSection(songId, request));
    }

    @Test
    @DisplayName("Should reject section exceeding song duration")
    void testRejectExceedingDuration() {
        when(songRepository.findById(songId)).thenReturn(Optional.of(testSong));

        CreateSectionRequest request = new CreateSectionRequest(10.0, 250.0); // duration is 200
        assertThrows(InvalidSectionException.class, () -> sectionService.addSection(songId, request));
    }

    @Test
    @DisplayName("Should throw ResourceNotFoundException for non-existent song")
    void testSongNotFound() {
        when(songRepository.findById(songId)).thenReturn(Optional.empty());

        CreateSectionRequest request = new CreateSectionRequest(10.0, 20.0);
        assertThrows(ResourceNotFoundException.class, () -> sectionService.addSection(songId, request));
    }
}
