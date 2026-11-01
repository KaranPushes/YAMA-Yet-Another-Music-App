package com.yama.music.repository;

import com.yama.music.entity.DownloadItem;
import com.yama.music.entity.DownloadStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DownloadItemRepository extends JpaRepository<DownloadItem, UUID> {

    List<DownloadItem> findByJobIdOrderByCreatedAtAsc(UUID jobId);

    Optional<DownloadItem> findFirstByStatusOrderByCreatedAtAsc(DownloadStatus status);

    boolean existsByTitleIgnoreCaseAndArtistIgnoreCaseAndStatusIn(
            String title, String artist, List<DownloadStatus> statuses
    );

    List<DownloadItem> findByStatus(DownloadStatus status);
}
