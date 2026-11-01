package com.yama.music.controller;

import com.yama.music.dto.ScanResultDto;
import com.yama.music.service.LibraryScannerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/library")
public class LibraryController {

    private final LibraryScannerService libraryScannerService;

    public LibraryController(LibraryScannerService libraryScannerService) {
        this.libraryScannerService = libraryScannerService;
    }

    @PostMapping("/scan")
    public ResponseEntity<ScanResultDto> triggerScan() {
        ScanResultDto result = libraryScannerService.scanLibrary();
        return ResponseEntity.ok(result);
    }
}
