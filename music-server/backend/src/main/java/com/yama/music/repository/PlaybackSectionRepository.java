package com.yama.music.repository;

import com.yama.music.entity.PlaybackSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PlaybackSectionRepository extends JpaRepository<PlaybackSection, UUID> {

    List<PlaybackSection> findBySongIdOrderByStartSecondsAsc(UUID songId);

    void deleteBySongId(UUID songId);
}
