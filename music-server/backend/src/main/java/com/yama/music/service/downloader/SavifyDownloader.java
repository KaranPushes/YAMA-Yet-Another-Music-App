package com.yama.music.service.downloader;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.*;

@Service
public class SavifyDownloader implements MusicDownloader {

    private static final Logger log = LoggerFactory.getLogger(SavifyDownloader.class);

    private final String downloaderUrl;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public SavifyDownloader(@Value("${yama.downloader.url:http://downloader:5000}") String downloaderUrl,
                            RestTemplateBuilder restTemplateBuilder,
                            ObjectMapper objectMapper) {
        this.downloaderUrl = downloaderUrl.endsWith("/") ? downloaderUrl.substring(0, downloaderUrl.length() - 1) : downloaderUrl;
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofMinutes(10)) // Allow sufficient time for track downloading
                .build();
        this.objectMapper = objectMapper;
    }

    @Override
    public DownloadResult download(DownloadRequest request) {
        String url = downloaderUrl + "/download";
        log.info("Sending download request to Savify service: {} (query: {}, url: {})",
                url, request.getQuery(), request.getUrl());

        Map<String, Object> body = new HashMap<>();
        if (request.getQuery() != null && !request.getQuery().isBlank()) {
            body.put("query", request.getQuery());
        }
        if (request.getUrl() != null && !request.getUrl().isBlank()) {
            body.put("url", request.getUrl());
        }
        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            body.put("title", request.getTitle());
        }
        if (request.getArtist() != null && !request.getArtist().isBlank()) {
            body.put("artist", request.getArtist());
        }
        if (request.getAlbum() != null && !request.getAlbum().isBlank()) {
            body.put("album", request.getAlbum());
        }
        if (request.getArtworkUrl() != null && !request.getArtworkUrl().isBlank()) {
            body.put("artworkUrl", request.getArtworkUrl());
        }
        if (request.getDuration() != null && request.getDuration() > 0) {
            body.put("duration", request.getDuration());
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                boolean success = root.path("success").asBoolean(false);
                if (success) {
                    String filePath = root.path("filePath").asText(null);
                    List<String> allFiles = new ArrayList<>();
                    if (root.has("allFiles") && root.get("allFiles").isArray()) {
                        for (JsonNode f : root.get("allFiles")) {
                            allFiles.add(f.asText());
                        }
                    }
                    return DownloadResult.ok(filePath, allFiles);
                } else {
                    String err = root.path("error").asText("Unknown downloader failure");
                    return DownloadResult.fail(err);
                }
            } else {
                return DownloadResult.fail("Downloader responded with status " + response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("Error communicating with Savify downloader service at {}: {}", url, e.getMessage());
            return DownloadResult.fail("Savify downloader service communication error: " + e.getMessage());
        }
    }

    @Override
    public PlaylistResolveResult resolvePlaylist(String playlistUrl) {
        String url = downloaderUrl + "/playlist/resolve";
        log.info("Resolving playlist metadata at: {}", url);

        Map<String, String> body = Map.of("url", playlistUrl);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String title = root.path("title").asText("Imported Playlist");
                int totalTracks = root.path("totalTracks").asInt(0);
                List<PlaylistResolveResult.PlaylistTrackItem> tracks = new ArrayList<>();

                if (root.has("tracks") && root.get("tracks").isArray()) {
                    for (JsonNode t : root.get("tracks")) {
                        tracks.add(new PlaylistResolveResult.PlaylistTrackItem(
                                t.path("title").asText("Unknown Title"),
                                t.path("artist").asText("Unknown Artist"),
                                t.path("url").asText(""),
                                t.path("duration").asDouble(0.0)
                        ));
                    }
                }

                String artworkUrl = root.hasNonNull("artworkUrl") ? root.path("artworkUrl").asText() : null;
                return new PlaylistResolveResult(title, totalTracks, artworkUrl, tracks);
            }
        } catch (Exception e) {
            log.error("Failed to resolve playlist at {}: {}", url, e.getMessage());
        }

        return new PlaylistResolveResult("Playlist", 0, Collections.emptyList());
    }

    @Override
    public List<ExternalSearchResultItem> searchExternal(String query) {
        if (query == null || query.isBlank()) {
            return Collections.emptyList();
        }

        String url = downloaderUrl + "/search?q=" + query;
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                List<ExternalSearchResultItem> list = new ArrayList<>();
                if (root.has("results") && root.get("results").isArray()) {
                    for (JsonNode item : root.get("results")) {
                        list.add(new ExternalSearchResultItem(
                                item.path("title").asText(""),
                                item.path("artist").asText(""),
                                item.path("album").asText(""),
                                item.path("duration").asDouble(0.0),
                                item.path("artworkUrl").asText(""),
                                item.path("sourceQuery").asText(query)
                        ));
                    }
                }
                return list;
            }
        } catch (Exception e) {
            log.warn("External search via downloader failed: {}", e.getMessage());
        }

        return Collections.emptyList();
    }
}
