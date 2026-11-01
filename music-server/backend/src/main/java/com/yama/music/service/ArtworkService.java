package com.yama.music.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.tag.images.Artwork;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ArtworkService {

    private static final Logger log = LoggerFactory.getLogger(ArtworkService.class);

    private static final Pattern YT_VIDEO_ID_PATTERN = Pattern.compile("\"videoId\":\"([a-zA-Z0-9_-]{11})\"");

    @Value("${yama.music.artwork-path:/artwork}")
    private String artworkBasePath;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Attempts to extract embedded artwork from the AudioFile tag.
     * Returns the relative or absolute path of the saved artwork file if successful.
     */
    public Optional<String> extractEmbeddedArtwork(AudioFile audioFile, UUID songId) {
        if (audioFile == null || audioFile.getTag() == null) {
            return Optional.empty();
        }

        try {
            Artwork artwork = audioFile.getTag().getFirstArtwork();
            if (artwork != null && artwork.getBinaryData() != null && artwork.getBinaryData().length > 0) {
                ensureArtworkDirectoryExists();
                String ext = artwork.getMimeType() != null && artwork.getMimeType().contains("png") ? ".png" : ".jpg";
                String filename = songId.toString() + ext;
                Path targetPath = Paths.get(artworkBasePath, filename);

                Files.write(targetPath, artwork.getBinaryData());
                log.info("Extracted embedded artwork for song {} -> {}", songId, targetPath);
                return Optional.of(targetPath.toAbsolutePath().toString());
            }
        } catch (Exception e) {
            log.warn("Failed to extract embedded artwork for song {}: {}", songId, e.getMessage());
        }

        return Optional.empty();
    }

    /**
     * Primary remote lookup: iTunes Search API, with fallback to YouTube Music thumbnail lookup.
     */
    public Optional<String> fetchRemoteArtworkFallback(String artist, String title, UUID songId) {
        if (title == null || title.isBlank()) {
            return Optional.empty();
        }

        // 1. Try iTunes search first
        Optional<String> itunesArtwork = fetchItunesArtwork(artist, title, songId);
        if (itunesArtwork.isPresent()) {
            return itunesArtwork;
        }

        // 2. Fallback to YouTube thumbnail extraction
        return fetchYouTubeArtwork(artist, title, songId);
    }

    private Optional<String> fetchItunesArtwork(String artist, String title, UUID songId) {
        if (artist == null || artist.isBlank()) {
            return Optional.empty();
        }

        String cleanArtist = artist.trim().toLowerCase();
        if (cleanArtist.equals("unknown artist") || cleanArtist.equals("unknown") || cleanArtist.equals("various artists")) {
            return Optional.empty();
        }

        try {
            ensureArtworkDirectoryExists();
            String query = artist + " " + title;
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            URI uri = URI.create("https://itunes.apple.com/search?term=" + encodedQuery + "&entity=song&limit=3");

            HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setRequestProperty("User-Agent", "YAMA-Music-Server/1.0");

            if (conn.getResponseCode() == 200) {
                try (InputStream in = conn.getInputStream()) {
                    JsonNode root = objectMapper.readTree(in);
                    JsonNode results = root.path("results");
                    if (results.isArray() && !results.isEmpty()) {
                        String cleanTitle = title.trim().toLowerCase();
                        JsonNode matchedItem = null;

                        for (JsonNode item : results) {
                            String trackName = item.path("trackName").asText("").toLowerCase();
                            String itemArtist = item.path("artistName").asText("").toLowerCase();
                            if (trackName.contains(cleanTitle) || cleanTitle.contains(trackName)
                                    || itemArtist.contains(cleanArtist) || cleanArtist.contains(itemArtist)) {
                                matchedItem = item;
                                break;
                            }
                        }

                        if (matchedItem != null) {
                            String artworkUrl = matchedItem.path("artworkUrl100").asText();
                            if (artworkUrl != null && !artworkUrl.isBlank()) {
                                String highResUrl = artworkUrl.replace("100x100bb", "600x600bb");
                                String filename = songId.toString() + ".jpg";
                                Path targetPath = Paths.get(artworkBasePath, filename);

                                if (downloadAndSaveImage(highResUrl, targetPath)) {
                                    log.info("Successfully fetched iTunes artwork for song {} -> {}", songId, targetPath);
                                    return Optional.of(targetPath.toAbsolutePath().toString());
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("iTunes artwork lookup skipped/failed for '{} - {}': {}", artist, title, e.getMessage());
        }

        return Optional.empty();
    }

    /**
     * Searches YouTube for track video and downloads high-res thumbnail (maxresdefault or hqdefault).
     */
    public Optional<String> fetchYouTubeArtwork(String artist, String title, UUID songId) {
        try {
            ensureArtworkDirectoryExists();

            String cleanTitle = title.replace("_", " ").replaceAll("[^a-zA-Z0-9 ]", " ").replaceAll("\\s+", " ").trim();
            boolean hasKnownArtist = artist != null && !artist.isBlank() && !artist.toLowerCase().contains("unknown");
            String cleanArtist = hasKnownArtist ? artist.replace("_", " ").trim() + " " : "";
            String cleanQuery = cleanArtist + cleanTitle + " audio";

            String encoded = URLEncoder.encode(cleanQuery, StandardCharsets.UTF_8);
            URI searchUri = URI.create("https://www.youtube.com/results?search_query=" + encoded);

            HttpURLConnection conn = (HttpURLConnection) searchUri.toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

            if (conn.getResponseCode() == 200) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        Matcher matcher = YT_VIDEO_ID_PATTERN.matcher(line);
                        if (matcher.find()) {
                            String videoId = matcher.group(1);
                            log.info("Found YouTube video ID {} for song {} ({})", videoId, songId, cleanQuery);

                            String filename = songId.toString() + ".jpg";
                            Path targetPath = Paths.get(artworkBasePath, filename);

                            // Try maxresdefault.jpg first, fallback to hqdefault.jpg
                            String maxResUrl = "https://i.ytimg.com/vi/" + videoId + "/maxresdefault.jpg";
                            if (downloadAndSaveImage(maxResUrl, targetPath)) {
                                log.info("Successfully fetched high-res YouTube artwork for song {} -> {}", songId, targetPath);
                                return Optional.of(targetPath.toAbsolutePath().toString());
                            }

                            String hqThumbUrl = "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
                            if (downloadAndSaveImage(hqThumbUrl, targetPath)) {
                                log.info("Successfully fetched YouTube artwork for song {} -> {}", songId, targetPath);
                                return Optional.of(targetPath.toAbsolutePath().toString());
                            }
                            break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("YouTube artwork lookup failed for '{} - {}': {}", artist, title, e.getMessage());
        }

        return Optional.empty();
    }

    private boolean downloadAndSaveImage(String imageUrl, Path targetPath) {
        try {
            HttpURLConnection imgConn = (HttpURLConnection) URI.create(imageUrl).toURL().openConnection();
            imgConn.setConnectTimeout(4000);
            imgConn.setReadTimeout(4000);
            imgConn.setRequestProperty("User-Agent", "Mozilla/5.0");

            if (imgConn.getResponseCode() == 200) {
                try (InputStream imgIn = imgConn.getInputStream();
                     FileOutputStream out = new FileOutputStream(targetPath.toFile())) {
                    imgIn.transferTo(out);
                    return true;
                }
            }
        } catch (Exception e) {
            log.debug("Failed to download image from {}: {}", imageUrl, e.getMessage());
        }
        return false;
    }

    /**
     * Retrieves artwork file resource for serving.
     */
    public Optional<Resource> getArtworkResource(String artworkPath) {
        if (artworkPath == null || artworkPath.isBlank()) {
            return Optional.empty();
        }

        File file = new File(artworkPath);
        if (file.exists() && file.canRead()) {
            return Optional.of(new FileSystemResource(file));
        }
        return Optional.empty();
    }

    /**
     * Determines the MediaType for an artwork file.
     */
    public MediaType getArtworkMediaType(String artworkPath) {
        if (artworkPath != null && artworkPath.toLowerCase().endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        return MediaType.IMAGE_JPEG;
    }

    private void ensureArtworkDirectoryExists() {
        try {
            Files.createDirectories(Paths.get(artworkBasePath));
        } catch (Exception e) {
            log.error("Unable to create artwork directory {}: {}", artworkBasePath, e.getMessage());
        }
    }
}
