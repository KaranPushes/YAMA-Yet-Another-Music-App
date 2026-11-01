package com.yama.music.dto;

import java.util.ArrayList;
import java.util.List;

public class UnifiedSearchResponseDto {

    private List<SongDto> library = new ArrayList<>();
    private List<ExternalTrackDto> external = new ArrayList<>();

    public UnifiedSearchResponseDto() {}

    public UnifiedSearchResponseDto(List<SongDto> library, List<ExternalTrackDto> external) {
        this.library = library != null ? library : new ArrayList<>();
        this.external = external != null ? external : new ArrayList<>();
    }

    public List<SongDto> getLibrary() {
        return library;
    }

    public void setLibrary(List<SongDto> library) {
        this.library = library;
    }

    public List<ExternalTrackDto> getExternal() {
        return external;
    }

    public void setExternal(List<ExternalTrackDto> external) {
        this.external = external;
    }
}
