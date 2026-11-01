package com.yama.music.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @Value("${yama.music.library-path:/music}")
    private String musicLibraryPath;

    @Value("${yama.music.artwork-path:/artwork}")
    private String artworkPath;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealth() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", Instant.now().toString());
        health.put("uptimeMs", ManagementFactory.getRuntimeMXBean().getUptime());
        
        File musicDir = new File(musicLibraryPath);
        health.put("musicDirectory", Map.of(
                "path", musicLibraryPath,
                "exists", musicDir.exists(),
                "isDirectory", musicDir.isDirectory(),
                "canRead", musicDir.canRead()
        ));

        File artworkDir = new File(artworkPath);
        health.put("artworkDirectory", Map.of(
                "path", artworkPath,
                "exists", artworkDir.exists(),
                "isDirectory", artworkDir.isDirectory(),
                "canWrite", artworkDir.canWrite()
        ));

        return ResponseEntity.ok(health);
    }
}
