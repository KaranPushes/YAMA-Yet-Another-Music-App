package com.yama.music.repository;

import com.yama.music.entity.DownloadJob;
import com.yama.music.entity.DownloadStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DownloadJobRepository extends JpaRepository<DownloadJob, UUID> {

    @EntityGraph(attributePaths = {"items"})
    Page<DownloadJob> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = {"items"})
    Optional<DownloadJob> findById(UUID id);

    @EntityGraph(attributePaths = {"items"})
    List<DownloadJob> findTop50ByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"items"})
    @org.springframework.data.jpa.repository.Query("SELECT j FROM DownloadJob j WHERE j.queryOrUrl = :target AND j.status IN :statuses")
    Optional<DownloadJob> findFirstByQueryOrUrlAndStatusIn(
            @org.springframework.data.repository.query.Param("target") String target,
            @org.springframework.data.repository.query.Param("statuses") List<DownloadStatus> statuses
    );
}
