package com.yama.music.service;

import com.yama.music.entity.*;
import com.yama.music.repository.DownloadItemRepository;
import com.yama.music.repository.DownloadJobRepository;
import com.yama.music.repository.SongRepository;
import com.yama.music.service.downloader.*;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

@Service
public class DownloadQueueService {

    private static final Logger log = LoggerFactory.getLogger(DownloadQueueService.class);

    private final DownloadJobRepository downloadJobRepository;
    private final DownloadItemRepository downloadItemRepository;
    private final SongRepository songRepository;
    private final MusicDownloader musicDownloader;
    private final LibraryScannerService libraryScannerService;

    private final ExecutorService queueExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "yama-download-worker");
        t.setDaemon(true);
        return t;
    });

    private final BlockingQueue<UUID> pendingItemIds = new LinkedBlockingQueue<>();
    private volatile boolean running = true;

    public DownloadQueueService(DownloadJobRepository downloadJobRepository,
                                DownloadItemRepository downloadItemRepository,
                                SongRepository songRepository,
                                MusicDownloader musicDownloader,
                                LibraryScannerService libraryScannerService) {
        this.downloadJobRepository = downloadJobRepository;
        this.downloadItemRepository = downloadItemRepository;
        this.songRepository = songRepository;
        this.musicDownloader = musicDownloader;
        this.libraryScannerService = libraryScannerService;
    }

    @PostConstruct
    public void init() {
        // Recover any pending items from database on startup
        List<DownloadItem> pending = downloadItemRepository.findByStatus(DownloadStatus.QUEUED);
        for (DownloadItem item : pending) {
            pendingItemIds.offer(item.getId());
        }
        log.info("Initialized DownloadQueueService with {} queued items", pending.size());

        // Start background worker loop
        queueExecutor.submit(this::processQueueLoop);
    }

    @PreDestroy
    public void shutdown() {
        running = false;
        queueExecutor.shutdownNow();
    }

    @Transactional
    public DownloadJob createTrackJob(String query, String url, String title, String artist, String album, String artworkUrl) {
        String target = (url != null && !url.isBlank()) ? url.trim() : (query != null ? query.trim() : "");
        String source = (url != null && !url.isBlank()) ? "URL" : "QUERY";

        String displayTitle = target;
        if (title != null && !title.isBlank()) {
            displayTitle = (artist != null && !artist.isBlank() && !artist.equalsIgnoreCase("Various"))
                    ? title.trim() + " - " + artist.trim()
                    : title.trim();
        }

        // Check if identical active job is already queued/downloading
        List<DownloadStatus> activeStatuses = List.of(
                DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING,
                DownloadStatus.PROCESSING, DownloadStatus.SCANNING
        );
        Optional<DownloadJob> existingJob = downloadJobRepository.findFirstByQueryOrUrlAndStatusIn(target, activeStatuses);
        if (existingJob.isPresent()) {
            log.info("Job already active for target: {}", target);
            return existingJob.get();
        }

        DownloadJob job = new DownloadJob();
        job.setType(JobType.TRACK);
        job.setSource(source);
        job.setQueryOrUrl(target);
        job.setTitle(displayTitle);
        job.setTotalItems(1);
        job.setStatus(DownloadStatus.QUEUED);
        DownloadJob savedJob = downloadJobRepository.save(job);

        DownloadItem item = new DownloadItem();
        item.setJob(savedJob);
        item.setSourceUrl(url);
        item.setTitle(title != null && !title.isBlank() ? title.trim() : target);
        item.setArtist(artist != null && !artist.isBlank() ? artist.trim() : "Various");
        item.setStatus(DownloadStatus.QUEUED);
        item.setProgress(0);

        // Check if track already exists in YAMA library (deduplication!)
        Optional<Song> existingSong = Optional.empty();
        if (title != null && !title.isBlank() && artist != null && !artist.isBlank()) {
            existingSong = songRepository.findFirstByTitleIgnoreCaseAndArtistIgnoreCase(title.trim(), artist.trim());
        }
        if (existingSong.isEmpty()) {
            existingSong = songRepository.findFirstByTitleIgnoreCaseAndArtistIgnoreCase(target, "Various");
        }
        if (existingSong.isEmpty() && !target.startsWith("http")) {
            existingSong = songRepository.searchSongs(target, org.springframework.data.domain.PageRequest.of(0, 1))
                    .getContent().stream().findFirst();
        }

        if (existingSong.isPresent()) {
            log.info("Track '{}' already exists in YAMA library. Marking as SKIPPED.", target);
            item.setStatus(DownloadStatus.SKIPPED);
            item.setProgress(100);
            item.setSongId(existingSong.get().getId());
            item.setCompletedAt(Instant.now());
            DownloadItem savedItem = downloadItemRepository.save(item);

            savedJob.setCompletedItems(1);
            savedJob.setStatus(DownloadStatus.COMPLETED);
            savedJob.getItems().add(savedItem);
            return downloadJobRepository.save(savedJob);
        }

        DownloadItem savedItem = downloadItemRepository.save(item);
        savedJob.getItems().add(savedItem);
        pendingItemIds.offer(savedItem.getId());

        return savedJob;
    }

    @Transactional
    public DownloadJob createTrackJob(String query, String url) {
        return createTrackJob(query, url, null, null, null, null);
    }

    private String cleanTrackTitle(String title) {
        if (title == null) return "";
        return title.replaceAll("(?i)\\s*[\\[\\(](?:official|music|video|audio|lyrics|hd|4k|remastered|feat\\.[^\\)\\]]*|ft\\.[^\\)\\]]*)[^\\]\\)]*[\\]\\)]", "")
                    .trim();
    }

    private String cleanArtistName(String artist) {
        if (artist == null) return "";
        return artist.replaceAll("(?i)\\s*-\\s*topic", "").trim();
    }

    private boolean isFuzzyTrackMatch(Song song, String cleanTitle, String cleanArtist) {
        if (song.getTitle() == null) return false;
        String sTitle = cleanTrackTitle(song.getTitle()).toLowerCase();
        String tTitle = cleanTitle.toLowerCase();
        if (sTitle.equals(tTitle) || sTitle.contains(tTitle) || tTitle.contains(sTitle)) {
            if (cleanArtist.isBlank() || cleanArtist.equalsIgnoreCase("Various")) return true;
            String sArtist = (song.getArtist() != null ? song.getArtist() : "").toLowerCase();
            String tArtist = cleanArtist.toLowerCase();
            return sArtist.contains(tArtist) || tArtist.contains(sArtist);
        }
        return false;
    }

    @Transactional
    public DownloadJob createPlaylistJob(String playlistUrl) {
        // First resolve playlist
        PlaylistResolveResult preview = musicDownloader.resolvePlaylist(playlistUrl);
        log.info("Creating playlist job for '{}' with {} tracks", preview.getTitle(), preview.getTotalTracks());

        DownloadJob job = new DownloadJob();
        job.setType(JobType.PLAYLIST);
        job.setSource("URL");
        job.setQueryOrUrl(playlistUrl);
        job.setTitle(preview.getTitle());
        job.setTotalItems(preview.getTracks().size());
        job.setStatus(DownloadStatus.QUEUED);
        DownloadJob savedJob = downloadJobRepository.save(job);

        int completedCount = 0;
        for (PlaylistResolveResult.PlaylistTrackItem t : preview.getTracks()) {
            DownloadItem item = new DownloadItem();
            item.setJob(savedJob);
            item.setTitle(t.getTitle());
            item.setArtist(t.getArtist());
            item.setSourceUrl(t.getUrl());

            // Check if track already exists in YAMA library with normalization
            Optional<Song> existingSong = songRepository.findFirstByTitleIgnoreCaseAndArtistIgnoreCase(t.getTitle(), t.getArtist());
            if (existingSong.isEmpty()) {
                String cleanTitle = cleanTrackTitle(t.getTitle());
                String cleanArtist = cleanArtistName(t.getArtist());
                existingSong = songRepository.findFirstByTitleIgnoreCaseAndArtistIgnoreCase(cleanTitle, cleanArtist);
                if (existingSong.isEmpty()) {
                    existingSong = songRepository.searchSongs(cleanTitle, org.springframework.data.domain.PageRequest.of(0, 5))
                            .getContent().stream()
                            .filter(s -> isFuzzyTrackMatch(s, cleanTitle, cleanArtist))
                            .findFirst();
                }
            }

            if (existingSong.isPresent()) {
                log.info("Playlist track '{} - {}' already in YAMA repository. Marking SKIPPED.", t.getTitle(), t.getArtist());
                item.setStatus(DownloadStatus.SKIPPED);
                item.setProgress(100);
                item.setSongId(existingSong.get().getId());
                item.setCompletedAt(Instant.now());
                completedCount++;
            } else {
                item.setStatus(DownloadStatus.QUEUED);
                item.setProgress(0);
            }

            DownloadItem savedItem = downloadItemRepository.save(item);
            savedJob.getItems().add(savedItem);

            if (savedItem.getStatus() == DownloadStatus.QUEUED) {
                pendingItemIds.offer(savedItem.getId());
            }
        }

        savedJob.setCompletedItems(completedCount);
        if (completedCount == preview.getTracks().size()) {
            savedJob.setStatus(DownloadStatus.COMPLETED);
        }
        return downloadJobRepository.save(savedJob);
    }

    @Transactional
    public DownloadJob retryJob(UUID jobId) {
        DownloadJob job = downloadJobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        List<DownloadItem> items = downloadItemRepository.findByJobIdOrderByCreatedAtAsc(jobId);
        int queuedCount = 0;
        for (DownloadItem item : items) {
            if (item.getStatus() == DownloadStatus.FAILED) {
                item.setStatus(DownloadStatus.QUEUED);
                item.setErrorMessage(null);
                item.setProgress(0);
                downloadItemRepository.save(item);
                pendingItemIds.offer(item.getId());
                queuedCount++;
            }
        }

        if (queuedCount > 0) {
            job.setStatus(DownloadStatus.QUEUED);
            downloadJobRepository.save(job);
        }
        return job;
    }

    @Transactional
    public DownloadJob cancelJob(UUID jobId) {
        DownloadJob job = downloadJobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));

        List<DownloadItem> items = downloadItemRepository.findByJobIdOrderByCreatedAtAsc(jobId);
        int completedCount = 0;

        for (DownloadItem item : items) {
            if (item.getStatus() == DownloadStatus.COMPLETED) {
                completedCount++;
                continue; // Preserve already completed songs and files!
            }

            if (item.getStatus() == DownloadStatus.QUEUED || item.getStatus() == DownloadStatus.DOWNLOADING || item.getStatus() == DownloadStatus.PROCESSING) {
                item.setStatus(DownloadStatus.CANCELLED);
                item.setErrorMessage("Stopped by user");
                item.setCompletedAt(Instant.now());
                downloadItemRepository.save(item);
                pendingItemIds.remove(item.getId());

                // Cleanup partial file on disk if any
                if (item.getFilePath() != null) {
                    File f = new File(item.getFilePath());
                    if (f.exists()) {
                        f.delete();
                    }
                }
            }
        }

        job.setStatus(completedCount > 0 ? DownloadStatus.PARTIALLY_COMPLETED : DownloadStatus.CANCELLED);
        job.setCompletedItems(completedCount);
        return downloadJobRepository.save(job);
    }

    @Transactional
    public DownloadItem cancelItem(UUID itemId) {
        DownloadItem item = downloadItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + itemId));

        if (item.getStatus() == DownloadStatus.COMPLETED) {
            // Already downloaded and in library, do not delete on cancel
            return item;
        }

        item.setStatus(DownloadStatus.CANCELLED);
        item.setErrorMessage("Stopped by user");
        item.setCompletedAt(Instant.now());
        pendingItemIds.remove(item.getId());

        if (item.getFilePath() != null) {
            File f = new File(item.getFilePath());
            if (f.exists()) {
                f.delete();
            }
        }

        DownloadItem saved = downloadItemRepository.save(item);
        updateJobFinalStatus(item.getJob());
        return saved;
    }

    @Transactional
    public void clearHistory() {
        List<DownloadJob> allJobs = downloadJobRepository.findAll();
        List<DownloadStatus> finishedStatuses = List.of(
                DownloadStatus.COMPLETED,
                DownloadStatus.CANCELLED,
                DownloadStatus.FAILED,
                DownloadStatus.PARTIALLY_COMPLETED
        );
        for (DownloadJob job : allJobs) {
            if (finishedStatuses.contains(job.getStatus())) {
                downloadJobRepository.delete(job);
            }
        }
        log.info("Cleared completed, cancelled, and failed download jobs from history.");
    }

    private void processQueueLoop() {
        while (running) {
            try {
                UUID itemId = pendingItemIds.poll(1, TimeUnit.SECONDS);
                if (itemId != null) {
                    processItem(itemId);
                } else {
                    // Check if there are any orphaned or unqueued QUEUED items in the DB
                    List<DownloadItem> pending = downloadItemRepository.findByStatus(DownloadStatus.QUEUED);
                    for (DownloadItem pi : pending) {
                        if (!pendingItemIds.contains(pi.getId())) {
                            pendingItemIds.offer(pi.getId());
                        }
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("Unexpected error in download queue loop: {}", e.getMessage(), e);
            }
        }
    }

    @Transactional
    public void processItem(UUID itemId) {
        Optional<DownloadItem> itemOpt = downloadItemRepository.findById(itemId);
        int retries = 0;
        while (itemOpt.isEmpty() && retries < 5) {
            try {
                Thread.sleep(200);
            } catch (InterruptedException ignored) {}
            itemOpt = downloadItemRepository.findById(itemId);
            retries++;
        }

        if (itemOpt.isEmpty()) {
            log.warn("Item {} not found in database after retries, skipping", itemId);
            return;
        }

        DownloadItem item = itemOpt.get();
        if (item.getStatus() != DownloadStatus.QUEUED) {
            return;
        }

        DownloadJob job = item.getJob();
        if (job.getStatus() == DownloadStatus.CANCELLED) {
            item.setStatus(DownloadStatus.CANCELLED);
            item.setErrorMessage("Job was cancelled");
            downloadItemRepository.save(item);
            return;
        }

        log.info("Processing download item: {} - {} (Job: {})", item.getTitle(), item.getArtist(), job.getId());

        // Update to DOWNLOADING
        item.setStatus(DownloadStatus.DOWNLOADING);
        item.setProgress(15);
        downloadItemRepository.save(item);

        if (job.getStatus() == DownloadStatus.QUEUED) {
            job.setStatus(DownloadStatus.DOWNLOADING);
            downloadJobRepository.save(job);
        }

        try {
            // Build request
            DownloadRequest req;
            if (item.getSourceUrl() != null && !item.getSourceUrl().isBlank()) {
                req = DownloadRequest.ofUrl(item.getSourceUrl());
            } else {
                String query = item.getTitle();
                if (item.getArtist() != null && !item.getArtist().equalsIgnoreCase("Various")) {
                    query = item.getTitle() + " " + item.getArtist();
                }
                req = DownloadRequest.ofQuery(query);
            }
            req.setTitle(item.getTitle());
            req.setArtist(item.getArtist());

            // Execute acquisition via Savify abstraction
            DownloadResult result = musicDownloader.download(req);

            // Re-check item and job status in case user cancelled while downloading was running!
            itemOpt = downloadItemRepository.findById(itemId);
            if (itemOpt.isEmpty()) {
                if (result.getFilePath() != null) {
                    new File(result.getFilePath()).delete();
                }
                return;
            }
            item = itemOpt.get();
            job = item.getJob();

            if (item.getStatus() == DownloadStatus.CANCELLED || job.getStatus() == DownloadStatus.CANCELLED) {
                log.info("Download item {} or job {} was cancelled during execution. Deleting audio file: {}",
                        itemId, job.getId(), result.getFilePath());
                if (result.getFilePath() != null) {
                    File f = new File(result.getFilePath());
                    if (f.exists()) {
                        f.delete();
                    }
                }
                return;
            }

            if (!result.isSuccess() || result.getFilePath() == null) {
                markItemFailed(item, job, result.getError() != null ? result.getError() : "Downloader produced no audio file");
                return;
            }

            // Downloader succeeded, now scan into YAMA library
            item.setStatus(DownloadStatus.SCANNING);
            item.setProgress(85);
            item.setFilePath(result.getFilePath());
            downloadItemRepository.save(item);

            File downloadedFile = new File(result.getFilePath());
            Optional<Song> scannedSong = libraryScannerService.scanSingleFile(downloadedFile);

            if (scannedSong.isEmpty()) {
                // Fallback to library rescan
                log.warn("Single file scan did not register song, triggering full library scan fallback");
                libraryScannerService.scanLibrary();
                scannedSong = songRepository.findByFilePath(downloadedFile.getAbsolutePath());
            }

            if (scannedSong.isPresent()) {
                Song song = scannedSong.get();
                item.setStatus(DownloadStatus.COMPLETED);
                item.setProgress(100);
                item.setSongId(song.getId());
                item.setTitle(song.getTitle());
                item.setArtist(song.getArtist());
                item.setCompletedAt(Instant.now());
                downloadItemRepository.save(item);

                job.setCompletedItems(job.getCompletedItems() + 1);
                updateJobFinalStatus(job);
                log.info("Successfully acquired and scanned: {} - {} into YAMA Library", song.getTitle(), song.getArtist());
            } else {
                markItemFailed(item, job, "File downloaded to " + result.getFilePath() + " but scanner could not register song");
            }

        } catch (Exception e) {
            log.error("Failed to process download item {}: {}", itemId, e.getMessage(), e);
            markItemFailed(item, job, e.getMessage());
        }
    }

    private void markItemFailed(DownloadItem item, DownloadJob job, String error) {
        item.setStatus(DownloadStatus.FAILED);
        item.setErrorMessage(error);
        item.setCompletedAt(Instant.now());
        downloadItemRepository.save(item);

        job.setFailedItems(job.getFailedItems() + 1);
        updateJobFinalStatus(job);
    }

    private void updateJobFinalStatus(DownloadJob job) {
        int total = job.getTotalItems();
        int completed = job.getCompletedItems();
        int failed = job.getFailedItems();

        if (completed + failed >= total) {
            if (failed == 0) {
                job.setStatus(DownloadStatus.COMPLETED);
            } else if (completed > 0) {
                job.setStatus(DownloadStatus.PARTIALLY_COMPLETED);
            } else {
                job.setStatus(DownloadStatus.FAILED);
            }
        }
        downloadJobRepository.save(job);
    }
}
