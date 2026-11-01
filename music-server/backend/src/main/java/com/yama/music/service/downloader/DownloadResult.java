package com.yama.music.service.downloader;

import java.util.Collections;
import java.util.List;

public class DownloadResult {

    private boolean success;
    private String filePath;
    private List<String> allFiles;
    private String error;

    public DownloadResult() {
        this.allFiles = Collections.emptyList();
    }

    public static DownloadResult ok(String filePath, List<String> allFiles) {
        DownloadResult r = new DownloadResult();
        r.setSuccess(true);
        r.setFilePath(filePath);
        r.setAllFiles(allFiles != null ? allFiles : Collections.emptyList());
        return r;
    }

    public static DownloadResult fail(String error) {
        DownloadResult r = new DownloadResult();
        r.setSuccess(false);
        r.setError(error);
        return r;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public List<String> getAllFiles() {
        return allFiles;
    }

    public void setAllFiles(List<String> allFiles) {
        this.allFiles = allFiles;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
