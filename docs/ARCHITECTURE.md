# YAMA Architecture & Design Specification

YAMA (Yet Another Music App) is a private, production-quality personal music streaming platform tailored for mobile clients, running against a Mac-hosted backend.

---

## 1. System Topology

The Mac acts as the central music server, housing all audio files and metadata. Clients interact with the backend either through the local home network or via a secure tunnel.

```
                         INTERNET
                            │
                            ▼
              ┌───────────────────────────┐
              │  Secure Tunnel / Local IP │
              │  (Cloudflare / Tailscale) │
              └─────────────┬─────────────┘
                            │ HTTPS / HTTP
                            ▼
              ┌───────────────────────────┐
              │         Mac Server        │
              │  ┌─────────────────────┐  │
              │  │   Docker Compose    │  │
              │  │ ┌─────────────────┐ │  │
              │  │ │  Spring Boot    │ │  │
              │  │ │  Backend :8080  │ │  │
              │  │ └────────┬────────┘ │  │
              │  │          │          │  │
              │  │ ┌────────▼────────┐ │  │
              │  │ │   PostgreSQL 16 │ │  │
              │  │ └─────────────────┘ │  │
              │  └──────────┬──────────┘  │
              │             │             │
              │     Host Directory Mounts │
              │     ├── ./music   -> /music (ro)
              │     └── ./artwork -> /artwork (rw)
              └─────────────┬─────────────┘
                            │
                            ▼
               ┌─────────────────────────┐
               │    React Native App     │
               │  (iOS & Android Mobile) │
               │                         │
               │  ┌───────────────────┐  │
               │  │ Section Engine    │  │
               │  ├───────────────────┤  │
               │  │ Download / Cache  │  │
               │  ├───────────────────┤  │
               │  │ Audio Player (AV) │  │
               │  └───────────────────┘  │
               └─────────────────────────┘
```

---

## 2. Low-Bandwidth Progressive Delivery & Caching Strategy

Because the server host operates under an upload bandwidth constraint (~5 Mbps), YAMA minimizes repeated server uploads:

```
                          FIRST PLAY
                              │
               User taps song (not in cache)
                              │
                              ▼
            ┌───────────────────────────────────┐
            │       Audio Stream Request        │
            │ GET /api/songs/{id}/stream        │
            │ (Range: bytes=0-1048576)          │
            └─────────────────┬─────────────────┘
                              │
                              ▼
               Spring Boot: 206 Partial Content
               Non-heap disk channel streaming
                              │
                              ▼
               Mobile player starts playback instantly
                              │
             ┌────────────────┴────────────────┐
             │                                 │
             ▼                                 ▼
      Audio plays                Background Downloader
                                 saves to /cache/{id}.ext.part
                                               │
                                               ▼
                                 Renamed to /cache/{id}.ext
                                 Index marked: isComplete = true
```

```
                        SUBSEQUENT PLAYS
                              │
                    User taps song again
                              │
                              ▼
                  CacheManager.isComplete?
                              │
                             YES
                              │
                              ▼
               Playback from local filesystem:
               file:///.../yama_music_cache/{id}.ext
                              │
                              ▼
               0 bytes transferred over network!
```

---

## 3. Section Playback Engine (Core MVP Feature)

The user can define discrete playback intervals per song (`playback_sections`).

### Example Configuration
- Song duration: `03:50` (230 seconds)
- Configured sections:
  1. `00:42 → 01:17` (Section 1)
  2. `02:05 → 02:38` (Section 2)
  3. `03:10 → 03:35` (Section 3)

### State Machine & Playhead Transitions
```
 00:00 (Track start)
   │
   ▼
[Initial Position Check] ──> Playhead < Section 1 start?
   │
   ▼ YES
Seek immediately to 00:42
   │
   ▼
Audio plays Section 1: 00:42 → 01:17
   │
   ▼
Playhead reaches 01:17 ────> Has next section?
   │
   ▼ YES
Instant Seek to Section 2 start: 02:05
   │
   ▼
Audio plays Section 2: 02:05 → 02:38
   │
   ▼
Playhead reaches 02:38 ────> Has next section?
   │
   ▼ YES
Instant Seek to Section 3 start: 03:10
   │
   ▼
Audio plays Section 3: 03:10 → 03:35
   │
   ▼
Playhead reaches 03:35 ────> Has next section?
   │
   ▼ NO (Final section completed)
Stop playback & mark track finished.
User NEVER hears audio outside configured sections!
```

### Manual Scrubbing / Seeking
- Seeking into an allowed interval `[start, end)`: Playback continues seamlessly.
- Seeking into a skipped region: Clamped forward to the start of the next upcoming section.
- Seeking past all sections: Finishes playback gracefully.

---

## 4. Backend Layered Architecture

```text
com.yama.music
│
├── config/
│   ├── WebConfig.java             # CORS & exposed streaming headers
│   └── SecurityConfig.java        # Security headers & future auth hooks
│
├── controller/
│   ├── HealthController.java      # /api/health with filesystem diagnostics
│   ├── SongController.java        # /api/songs, /api/songs/{id}, /artwork, /stream
│   ├── SectionController.java     # /api/songs/{id}/sections CRUD
│   └── LibraryController.java     # /api/library/scan
│
├── service/
│   ├── AudioStreamService.java    # HTTP Range Request streaming (206 Partial Content)
│   ├── LibraryScannerService.java # Filesystem walk, jaudiotagger ID3/Vorbis parsing
│   ├── ArtworkService.java        # Tag extraction -> Remote fallback -> Local disk cache
│   ├── SectionService.java        # Section validation and persistence
│   └── SongService.java           # Paginated search and retrieval
│
├── repository/
│   ├── SongRepository.java
│   └── PlaybackSectionRepository.java
│
├── entity/
│   ├── Song.java                  # Relational metadata schema
│   └── PlaybackSection.java       # Interval constraints (start < end <= duration)
│
├── dto/
│   ├── SongDto.java
│   ├── SectionDto.java
│   ├── CreateSectionRequest.java
│   └── ScanResultDto.java
│
└── exception/
    ├── GlobalExceptionHandler.java
    ├── ResourceNotFoundException.java
    └── InvalidSectionException.java
```

---

## 5. Security & Isolation Measures

1. **Path Traversal Prevention**: Audio streaming references records solely by validated UUIDs; files are looked up via database records whose absolute paths must reside inside the mounted `/music` tree.
2. **Audio Binary Isolation**: MP3, FLAC, and WAV binaries are strictly host-mounted (`./music:/music:ro`) and never stored in PostgreSQL.
3. **No Unbounded Memory Buffers**: Audio delivery streams directly from filesystem channels in discrete chunks (1MB maximum per range request), eliminating Out-Of-Memory risks on large audio files.
