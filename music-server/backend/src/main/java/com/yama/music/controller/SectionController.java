package com.yama.music.controller;

import com.yama.music.dto.CreateSectionRequest;
import com.yama.music.dto.SectionDto;
import com.yama.music.service.SectionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/songs/{songId}/sections")
public class SectionController {

    private final SectionService sectionService;

    public SectionController(SectionService sectionService) {
        this.sectionService = sectionService;
    }

    @GetMapping
    public ResponseEntity<List<SectionDto>> getSections(@PathVariable UUID songId) {
        return ResponseEntity.ok(sectionService.getSectionsForSong(songId));
    }

    @PostMapping
    public ResponseEntity<SectionDto> addSection(
            @PathVariable UUID songId,
            @Valid @RequestBody CreateSectionRequest request) {
        SectionDto created = sectionService.addSection(songId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{sectionId}")
    public ResponseEntity<SectionDto> updateSection(
            @PathVariable UUID songId,
            @PathVariable UUID sectionId,
            @Valid @RequestBody CreateSectionRequest request) {
        SectionDto updated = sectionService.updateSection(songId, sectionId, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{sectionId}")
    public ResponseEntity<Void> deleteSection(
            @PathVariable UUID songId,
            @PathVariable UUID sectionId) {
        sectionService.deleteSection(songId, sectionId);
        return ResponseEntity.noContent().build();
    }
}
