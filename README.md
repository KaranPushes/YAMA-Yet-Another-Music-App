# YAMA (Yet Another Music App) 🎵

> A mobile-first, personal music streaming application engineered for self-hosting on macOS with low upload bandwidth optimization, local offline caching, and custom playback-section skipping.

---

## Key Features

- 📱 **Mobile-First Experience**: Built with React Native & TypeScript for iOS and Android.
- ⚡ **Section-Aware Playback (Core Feature)**: Define custom playback intervals for any track (e.g. `00:42 → 01:17`, `02:05 → 02:38`). The player automatically jumps between allowed sections and skips everything else. Works seamlessly on both first play and cached offline play.
- 📡 **HTTP Range Request Streaming**: Backend delivers audio chunks via `206 Partial Content` without buffering entire files in RAM.
- 💾 **Intelligent Progressive Caching**: Songs stream progressively on first playback while downloading asynchronously to phone storage. Subsequent plays load from the local filesystem with zero server bandwidth.
- 🔍 **Automated Library Scanner**: Automatically parses ID3v1/ID3v2 tags, FLAC Vorbis comments, track numbers, and durations for MP3, FLAC, M4A, AAC, OGG, and WAV.
- 🎨 **Smart Artwork Handling**: Extracts embedded album covers; falls back to high-resolution remote artwork lookup; caches locally on host disk.
- 🐳 **One-Command Docker Setup**: Runs PostgreSQL 16 and Spring Boot on the Mac with host-mounted directories.

---

## Directory Structure

```text
.
├── docs/
│   └── ARCHITECTURE.md          # Complete architecture and state machine diagrams
├── music-server/
│   ├── docker-compose.yml       # Orchestrates PostgreSQL + Spring Boot backend
│   ├── .env                     # Local environment configuration
│   ├── .env.example             # Safe template
│   ├── music/                   # Mount for your audio files (.mp3, .flac, .wav, etc.)
│   ├── artwork/                 # Extracted / cached artwork directory
│   └── backend/                 # Spring Boot Java 21 REST API
│       ├── pom.xml
│       └── src/
└── mobile-app/                  # React Native TypeScript mobile client
    ├── App.tsx
    ├── app.json
    └── src/
        ├── api/                 # REST API client with configurable base URL
        ├── cache/               # Download manager & local cache registry
        ├── player/              # Audio playback & SectionPlaybackEngine
        ├── screens/             # Library, Player, SectionEditor, Settings
        └── components/          # MiniPlayer, ArtworkImage, SectionRangeVisualizer
```

---

## Quick Start Guide

### 1. Prerequisites

- **Docker Desktop**: Running on macOS.
- **Java 21+** & **Maven** (optional for local non-Docker development).
- **Node.js 18+** & **npm** for the React Native mobile app.

---

### 2. Start Backend & Database (Docker Compose)

1. Navigate to the server folder:
   ```bash
   cd "music-server"
   ```

2. Verify or edit `.env` (a ready-to-use `.env` is already created).

3. Launch PostgreSQL and Spring Boot backend:
   ```bash
   docker compose up -d
   ```

4. Verify health:
   ```bash
   curl http://localhost:8080/api/health
   ```
   You should receive:
   ```json
   {"status":"UP","musicDirectory":{"exists":true,"canRead":true},"artworkDirectory":{"exists":true,"canWrite":true}}
   ```

---

### 3. Adding Music & Scanning Library

1. Simply copy your audio files (`.mp3`, `.flac`, `.m4a`, `.wav`, etc.) directly into `music-server/music/`:
   ```bash
   cp ~/Downloads/*.mp3 "music-server/music/"
   ```

2. Trigger library scan:
   - **Via API**:
     ```bash
     curl -X POST http://localhost:8080/api/library/scan
     ```
   - **Or directly inside the mobile app**: Tap the **Scan** button in the Library screen header.

3. List discovered songs:
   ```bash
   curl http://localhost:8080/api/songs
   ```

---

### 4. Running the Mobile App

1. Navigate to `mobile-app`:
   ```bash
   cd "mobile-app"
   npm install
   ```

2. Run tests to verify the section playback engine:
   ```bash
   npm test
   ```

3. Launch Expo development server:
   ```bash
   npx expo start
   ```

4. Open on your device or simulator:
   - Press `i` to open in iOS Simulator.
   - Press `a` to open in Android Emulator.
   - Or scan the QR code with **Expo Go** on your physical iPhone or Android phone connected to the same Wi-Fi network.

---

### 5. Configuring Server Base URL in the App

In the mobile app:
1. Open the **Settings** tab.
2. Under **Backend Server Connection**:
   - If using **iOS Simulator**: `http://localhost:8080`
   - If using **Android Emulator**: `http://10.0.2.2:8080`
   - If using a **physical phone on the same Wi-Fi**: `http://<your-mac-lan-ip>:8080` (e.g. `http://192.168.1.50:8080`)
   - If using a **Secure Tunnel**: `https://your-tunnel-subdomain.trycloudflare.com`
3. Tap **Test Connection** to confirm connectivity, then tap **Save URL**.

---

### 6. Using Playback Sections (Special Feature)

1. In the app, tap any song to begin playback.
2. Tap the bottom miniplayer to expand to the full **Player Screen**.
3. Tap **Configure Playback Sections**.
4. In the **Section Editor**:
   - Listen to the track; when you reach the desired start time, tap **Set Current**.
   - When you reach the desired end time, tap **Set Current**.
   - Tap **Add Playback Section**.
   - You can define 1, 2, or multiple non-contiguous sections.
5. Return to the player:
   - The illuminated timeline displays your allowed sections.
   - When playback hits the end of section 1, it immediately skips to section 2.
   - When the final section completes, the track stops.
   - Toggle **Section-Only Playback** off at any time if you wish to hear the entire track.

---

### 7. Exposing Through a Secure Tunnel (Remote Access)

To listen to music from outside your home network without port forwarding:

#### Option A: Cloudflare Tunnel (Free & Instant)
```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8080
```
Copy the generated `https://xxxx.trycloudflare.com` URL and paste it into the YAMA mobile app Settings.

#### Option B: Tailscale (Private VPN)
Install Tailscale on your Mac and phone. Use your Mac's Tailscale IP (`http://100.x.y.z:8080`) in the mobile app.

---

## Music Acquisition & Savify Integration 🚀

YAMA features an integrated music acquisition engine powered by **Savify**. You can import individual songs or entire playlists directly from the mobile app into your server library without touching terminal commands or downloading audio to your phone.

### How It Works

```text
React Native Mobile App
          ↓  (Search query or Spotify / YouTube URL)
  Spring Boot REST API
          ↓  (Deduplication check against PostgreSQL)
  Asynchronous Download Queue
          ↓  (MusicDownloader abstraction)
  Savify / Downloader Container (Internal)
          ↓  (Audio download & metadata embedding)
  music-server/music/
          ↓  (Instant Single-File Scan)
  LibraryScannerService (Single Source of Truth)
          ↓  (ID3 tags, duration, artwork extracted)
  PostgreSQL & YAMA Library
          ↓
  Seamless Playback in Player
```

### Key Capabilities

1. **Search for Missing Songs**:
   - In the Home search bar, search for any track.
   - If the song is already in your library, tap **Play**.
   - If missing, it appears under **Not in YAMA** with a **+ Add to YAMA** button.
   - Tapping **+ Add to YAMA** queues an asynchronous server-side download.
2. **Paste Song Links**:
   - Tap **Add Music** and paste any supported song URL (Spotify, YouTube, etc.).
   - The server validates the request and downloads the track in the background.
3. **Import Playlists with Live Preview**:
   - Paste a playlist link and tap **Preview Playlist**.
   - The preview breaks down:
     - Total tracks in playlist
     - Number of tracks already in YAMA (automatically marked to skip)
     - Number of missing tracks to download
   - Tap **Download Missing Tracks** to queue only what you need.
4. **Downloads Dashboard**:
   - Open the **Downloads** tab to view queued, active, completed, and failed jobs.
   - Live progress bars and status badges update automatically.
   - If an individual track fails, the rest of the playlist continues uninterrupted, and a **Retry** button is available.
5. **Deduplication Protection**:
   - Existing tracks in YAMA are never re-downloaded.
   - Duplicate active downloads for the same target are automatically consolidated.
6. **Scanner as Source of Truth**:
   - Savify writes the audio file into `music-server/music/`.
   - `LibraryScannerService.scanSingleFile` immediately registers the track, extracts embedded artwork or performs high-res fallback lookup, and commits to PostgreSQL.

### Configuration (Optional Spotify Developer API)

Savify uses Spotify's Web API for metadata scraping. If you want rich Spotify metadata, add your free Spotify Developer credentials in `music-server/.env`:

```bash
SPOTIPY_CLIENT_ID=your_client_id_here
SPOTIPY_CLIENT_SECRET=your_client_secret_here
```

*(If credentials are not provided, the downloader automatically falls back so downloads never hard-fail).*

---

## Testing

### Backend Unit & Integration Tests
```bash
cd "music-server/backend"
./mvnw test
```
Tests include:
- `DownloadControllerTest`: Track download jobs, playlist preview, deduplication skipping, and unified search.
- `AudioStreamServiceTest`: HTTP Range Headers (`206 Partial Content`, byte boundaries)
- `SectionServiceTest`: Section constraints (`start >= 0`, `end > start`, duration limits)
- `SongControllerTest`: REST API endpoints and CRUD workflows
- `HealthControllerTest`: Diagnostic health status

### Mobile Tests
```bash
cd "mobile-app"
npm test
```
Tests include:
- `downloadApi.test.ts`: Unit tests for download jobs, playlist preview, retry, and unified search API client.
- `SectionPlaybackEngine.test.ts`: Complete coverage of zero sections, single section, multiple sections, seeking inside/outside, and end-of-track termination.
- `PlaylistStorage.test.ts`: Playlist creation, addition, deletion, and persistent state.
- `CacheStorage.test.ts`: Offline caching and eviction logic.

