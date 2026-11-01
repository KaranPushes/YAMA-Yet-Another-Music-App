package com.yama.music.service.downloader;

import java.util.List;

public interface MusicDownloader {

    DownloadResult download(DownloadRequest request);

    PlaylistResolveResult resolvePlaylist(String playlistUrl);

    List<ExternalSearchResultItem> searchExternal(String query);
}
