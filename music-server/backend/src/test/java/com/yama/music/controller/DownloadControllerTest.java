package com.yama.music.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yama.music.dto.CreateDownloadRequest;
import com.yama.music.entity.*;
import com.yama.music.repository.DownloadItemRepository;
import com.yama.music.repository.DownloadJobRepository;
import com.yama.music.repository.SongRepository;
import com.yama.music.service.downloader.DownloadResult;
import com.yama.music.service.downloader.ExternalSearchResultItem;
import com.yama.music.service.downloader.MusicDownloader;
import com.yama.music.service.downloader.PlaylistResolveResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DownloadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DownloadJobRepository downloadJobRepository;

    @Autowired
    private DownloadItemRepository downloadItemRepository;

    @Autowired
    private SongRepository songRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MusicDownloader musicDownloader;

    @BeforeEach
    void setUp() {
        downloadItemRepository.deleteAll();
        downloadJobRepository.deleteAll();
        songRepository.deleteAll();
    }

    @Test
    @DisplayName("Should create track download job asynchronously")
    void testCreateTrackDownloadJob() throws Exception {
        when(musicDownloader.download(any())).thenReturn(DownloadResult.ok("/music/test.mp3", List.of("/music/test.mp3")));

        CreateDownloadRequest req = new CreateDownloadRequest(JobType.TRACK, "Blinding Lights The Weeknd", null);

        mockMvc.perform(post("/api/downloads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.type").value("TRACK"))
                .andExpect(jsonPath("$.status", isOneOf("QUEUED", "DOWNLOADING", "SCANNING", "COMPLETED")))
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    @DisplayName("Should detect duplicate and mark as SKIPPED if song is already in YAMA library")
    void testDuplicateTrackSkipped() throws Exception {
        Song existingSong = new Song();
        existingSong.setTitle("Blinding Lights");
        existingSong.setArtist("The Weeknd");
        existingSong.setAlbum("After Hours");
        existingSong.setDuration(200.0);
        existingSong.setFilePath("/music/blinding_lights.mp3");
        existingSong.setFileSize(5000000L);
        existingSong.setFileFormat("mp3");
        songRepository.save(existingSong);

        CreateDownloadRequest req = new CreateDownloadRequest(JobType.TRACK, "Blinding Lights", null);

        mockMvc.perform(post("/api/downloads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completedItems").value(1))
                .andExpect(jsonPath("$.items[0].status").value("SKIPPED"));
    }

    @Test
    @DisplayName("Should preview playlist comparing existing and missing tracks")
    void testPreviewPlaylist() throws Exception {
        // Save 1 existing track
        Song existingSong = new Song();
        existingSong.setTitle("Song One");
        existingSong.setArtist("Artist A");
        existingSong.setAlbum("Album");
        existingSong.setDuration(180.0);
        existingSong.setFilePath("/music/song1.mp3");
        existingSong.setFileSize(4000000L);
        existingSong.setFileFormat("mp3");
        songRepository.save(existingSong);

        PlaylistResolveResult mockResult = new PlaylistResolveResult(
                "Workout Playlist",
                2,
                List.of(
                        new PlaylistResolveResult.PlaylistTrackItem("Song One", "Artist A", "https://url1", 180.0),
                        new PlaylistResolveResult.PlaylistTrackItem("Song Two", "Artist B", "https://url2", 210.0)
                )
        );
        when(musicDownloader.resolvePlaylist("https://playlist.url")).thenReturn(mockResult);

        mockMvc.perform(post("/api/downloads/playlist/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("url", "https://playlist.url"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Workout Playlist"))
                .andExpect(jsonPath("$.totalTracks").value(2))
                .andExpect(jsonPath("$.alreadyInLibraryCount").value(1))
                .andExpect(jsonPath("$.missingCount").value(1))
                .andExpect(jsonPath("$.tracks[0].alreadyInLibrary").value(true))
                .andExpect(jsonPath("$.tracks[1].alreadyInLibrary").value(false));
    }

    @Test
    @DisplayName("Should return unified search results with library and external candidates")
    void testUnifiedSearch() throws Exception {
        Song localSong = new Song();
        localSong.setTitle("Levitating");
        localSong.setArtist("Dua Lipa");
        localSong.setAlbum("Future Nostalgia");
        localSong.setDuration(203.0);
        localSong.setFilePath("/music/levitating.mp3");
        localSong.setFileSize(6000000L);
        localSong.setFileFormat("mp3");
        songRepository.save(localSong);

        when(musicDownloader.searchExternal("Levitating")).thenReturn(List.of(
                new ExternalSearchResultItem("Levitating", "Dua Lipa", "Future Nostalgia", 203.0, "https://art.jpg", "Levitating Dua Lipa"),
                new ExternalSearchResultItem("Levitating (Remix)", "Dua Lipa ft. DaBaby", "Single", 203.0, "https://art2.jpg", "Levitating DaBaby")
        ));

        mockMvc.perform(get("/api/downloads/search")
                        .param("q", "Levitating"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.library", hasSize(1)))
                .andExpect(jsonPath("$.library[0].title").value("Levitating"))
                .andExpect(jsonPath("$.external", hasSize(2)))
                .andExpect(jsonPath("$.external[0].alreadyInLibrary").value(true))
                .andExpect(jsonPath("$.external[1].alreadyInLibrary").value(false));
    }
}
