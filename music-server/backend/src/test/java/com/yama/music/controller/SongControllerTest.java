package com.yama.music.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yama.music.dto.CreateSectionRequest;
import com.yama.music.entity.PlaybackSection;
import com.yama.music.entity.Song;
import com.yama.music.repository.PlaybackSectionRepository;
import com.yama.music.repository.SongRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SongControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SongRepository songRepository;

    @Autowired
    private PlaybackSectionRepository sectionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Song testSong;

    @BeforeEach
    void setUp() {
        sectionRepository.deleteAll();
        songRepository.deleteAll();

        testSong = new Song();
        testSong.setTitle("Starboy");
        testSong.setArtist("The Weeknd");
        testSong.setAlbum("Starboy");
        testSong.setDuration(230.0);
        testSong.setFilePath("/music/starboy.mp3");
        testSong.setFileSize(8000000L);
        testSong.setFileFormat("mp3");
        testSong = songRepository.save(testSong);
    }

    @Test
    @DisplayName("Should retrieve paginated songs")
    void testGetSongs() throws Exception {
        mockMvc.perform(get("/api/songs")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].title").value("Starboy"))
                .andExpect(jsonPath("$.content[0].artist").value("The Weeknd"));
    }

    @Test
    @DisplayName("Should create, retrieve, and delete playback sections via REST API")
    void testSectionLifecycle() throws Exception {
        // 1. Create section
        CreateSectionRequest request = new CreateSectionRequest(15.0, 45.0);
        String responseContent = mockMvc.perform(post("/api/songs/" + testSong.getId() + "/sections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.startSeconds").value(15.0))
                .andExpect(jsonPath("$.endSeconds").value(45.0))
                .andReturn().getResponse().getContentAsString();

        PlaybackSection savedSection = sectionRepository.findAll().get(0);

        // 2. Get sections
        mockMvc.perform(get("/api/songs/" + testSong.getId() + "/sections"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].startSeconds").value(15.0));

        // 3. Delete section
        mockMvc.perform(delete("/api/songs/" + testSong.getId() + "/sections/" + savedSection.getId()))
                .andExpect(status().isNoContent());

        // 4. Verify deleted
        mockMvc.perform(get("/api/songs/" + testSong.getId() + "/sections"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}
