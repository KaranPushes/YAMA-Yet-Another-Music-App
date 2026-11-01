package com.yama.music.repository;

import com.yama.music.entity.Song;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SongRepository extends JpaRepository<Song, UUID> {

    Optional<Song> findByFilePath(String filePath);

    @Query("SELECT s FROM Song s WHERE " +
           "LOWER(s.title) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(s.artist) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(s.album) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Song> searchSongs(@Param("search") String search, Pageable pageable);

    boolean existsByFilePath(String filePath);

    Optional<Song> findFirstByTitleIgnoreCaseAndArtistIgnoreCase(String title, String artist);

    boolean existsByTitleIgnoreCaseAndArtistIgnoreCase(String title, String artist);
}
