import os
import re
import glob
import json
import logging
import traceback
import urllib.request
from flask import Flask, request, jsonify
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("yama-downloader")

app = Flask(__name__)

MUSIC_DIR = os.getenv("MUSIC_DOWNLOAD_PATH", "/music")
SPOTIPY_CLIENT_ID = os.getenv("SPOTIPY_CLIENT_ID", "").strip()
SPOTIPY_CLIENT_SECRET = os.getenv("SPOTIPY_CLIENT_SECRET", "").strip()

os.makedirs(MUSIC_DIR, exist_ok=True)

def sanitize_filename(name):
    """Sanitize string for safe filenames across OS."""
    return re.sub(r'[\\/*?:"<>|]', "", name).strip()

def get_existing_audio_files():
    """Scan music directory for audio files and their modification times."""
    patterns = ["*.mp3", "*.flac", "*.m4a", "*.aac", "*.ogg", "*.wav"]
    found = {}
    for p in patterns:
        for f in glob.glob(os.path.join(MUSIC_DIR, "**", p), recursive=True):
            try:
                found[os.path.abspath(f)] = os.path.getmtime(f)
            except OSError:
                pass
    return found

def parse_spotify_url(url):
    """
    Scrape Spotify public embed data or oEmbed to extract clean metadata without requiring
    a paid Spotify Premium Developer API subscription.
    """
    # Fix common typos like spotiify -> spotify
    url = re.sub(r'https?://(?:open\.)?spoti+fy\.com', 'https://open.spotify.com', url, flags=re.IGNORECASE)
    clean_url = url.split("?")[0].strip("/")
    parts = clean_url.split("/")
    if len(parts) < 2:
        return None

    entity_type = parts[-2].lower()
    entity_id = parts[-1]

    if entity_type not in ["track", "album", "playlist"]:
        return None

    embed_url = f"https://open.spotify.com/embed/{entity_type}/{entity_id}"
    req = urllib.request.Request(
        embed_url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    )

    try:
        html = urllib.request.urlopen(req, timeout=12).read().decode("utf-8", errors="ignore")
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
        if match:
            data = json.loads(match.group(1))
            entity = data["props"]["pageProps"]["state"]["data"]["entity"]

            title = entity.get("title") or entity.get("name") or "Spotify Audio"
            subtitle = entity.get("subtitle") or ""
            artwork_url = ""

            # Extract high-res artwork if available
            visuals = entity.get("visualIdentity", {})
            images = visuals.get("image", [])
            if images and isinstance(images, list):
                artwork_url = images[-1].get("url", "")
            if not artwork_url and "coverArt" in entity:
                artwork_url = entity["coverArt"].get("sources", [{}])[0].get("url", "")

            tracks = []
            if "trackList" in entity and entity["trackList"]:
                for t in entity["trackList"]:
                    t_uri = t.get("uri", "")
                    t_id = t_uri.split(":")[-1] if t_uri else ""
                    t_title = t.get("title")
                    t_artist = t.get("subtitle") or subtitle
                    if t_title:
                        tracks.append({
                            "title": t_title,
                            "artist": t_artist,
                            "duration": round((t.get("duration") or 0) / 1000.0, 1),
                            "url": f"https://open.spotify.com/track/{t_id}" if t_id else ""
                        })
            else:
                # Single track entity
                artists_list = entity.get("artists", [])
                if artists_list and isinstance(artists_list, list):
                    artist_names = [a.get("name") for a in artists_list if a.get("name")]
                    if artist_names:
                        subtitle = ", ".join(artist_names)

                tracks.append({
                    "title": title,
                    "artist": subtitle,
                    "duration": round((entity.get("duration") or 0) / 1000.0, 1),
                    "url": clean_url
                })

            return {
                "type": entity_type,
                "title": title,
                "artist": subtitle,
                "artworkUrl": artwork_url,
                "tracks": tracks
            }
    except Exception as e:
        logger.warning(f"Failed embed scrape for {url}: {e}")

    # Fallback: Official Spotify oEmbed API (100% reliable, zero auth needed)
    try:
        oembed_url = f"https://open.spotify.com/oembed?url=https://open.spotify.com/{entity_type}/{entity_id}"
        resp = requests.get(oembed_url, timeout=8)
        if resp.status_code == 200:
            odata = resp.json()
            raw_title = odata.get("title", "")
            art = odata.get("thumbnail_url", "")

            # If title is in format "Title - Artist" or "Artist - Title"
            parsed_title = raw_title
            parsed_artist = "Various Artists"
            if " - " in raw_title:
                parts = raw_title.split(" - ", 1)
                parsed_title = parts[0].strip()
                parsed_artist = parts[1].strip()

            return {
                "type": entity_type,
                "title": parsed_title,
                "artist": parsed_artist,
                "artworkUrl": art,
                "tracks": [{
                    "title": parsed_title,
                    "artist": parsed_artist,
                    "duration": 0,
                    "url": clean_url
                }]
            }
    except Exception as oe:
        logger.warning(f"Spotify oEmbed fallback failed for {url}: {oe}")

    return None

def extract_producer_from_info(info_dict):
    """Extract producer/composer from candidate or downloaded metadata."""
    if not info_dict:
        return None

    # 1. Direct tag fields
    for field in ["composer", "music", "producer"]:
        val = info_dict.get(field)
        if val and isinstance(val, str) and val.strip():
            return val.strip()

    # 2. Look for producer patterns in video description
    desc = info_dict.get("description") or ""
    patterns = [
        r"(?:Produced by|Producer|Music Producer|Music by|Beats by|Music Produced by|Composition|Composer)\s*[:\-–]\s*([^\n\r,\.]+)",
        r"(?:Prod\.?\s*by|Beats?\s*by)\s*([^\n\r,\.]+)",
    ]
    for pat in patterns:
        m = re.search(pat, desc, re.IGNORECASE)
        if m and m.group(1):
            prod = m.group(1).strip()
            # Strip brackets and clean up
            prod = re.sub(r"[\[\]\(\)]", "", prod).strip()
            if prod and len(prod) < 80 and not prod.lower().startswith("http"):
                return prod

    return None

def embed_id3_tags(file_path, title, artist, album=None, artwork_url=None, producer=None):
    """Embed ID3 tags, producer/composer, and cover art into newly downloaded mp3 using mutagen."""
    try:
        import mutagen
        from mutagen.easyid3 import EasyID3
        from mutagen.id3 import ID3, APIC, TCOM, TXXX

        try:
            audio = EasyID3(file_path)
        except mutagen.id3.ID3NoHeaderError:
            audio = mutagen.File(file_path, easy=True)
            audio.add_tags()

        if title:
            audio["title"] = title
        if artist:
            audio["artist"] = artist
        if album:
            audio["album"] = album
        if producer:
            try:
                audio["composer"] = producer
            except Exception:
                pass
        audio.save()

        # Save ID3 tags including TXXX:Producer and TCOM
        id3 = ID3(file_path)
        if producer:
            try:
                id3.add(TCOM(encoding=3, text=[producer]))
                id3.add(TXXX(encoding=3, desc="Producer", text=[producer]))
                id3.add(TXXX(encoding=3, desc="PRODUCER", text=[producer]))
            except Exception as e:
                logger.warning(f"Could not add producer ID3 frames: {e}")

        # Embed cover art if provided
        if artwork_url and artwork_url.startswith("http"):
            try:
                resp = requests.get(artwork_url, timeout=10)
                if resp.status_code == 200:
                    id3.add(APIC(
                        encoding=3,
                        mime="image/jpeg",
                        type=3,
                        desc="Cover",
                        data=resp.content
                    ))
                    logger.info(f"Embedded cover art into {file_path}")
            except Exception as e:
                logger.warning(f"Could not download artwork for embedding: {e}")

        id3.save(v2_version=3)
    except Exception as e:
        logger.warning(f"Could not tag file {file_path} with mutagen: {e}")

def fetch_high_res_album_artwork(title, artist):
    """Query iTunes Search API to fetch high-resolution square album/EP cover art instead of YouTube video thumbnails."""
    if not title:
        return None, None
    try:
        clean_t = re.sub(r'(?i)\s*[\(\[](?:official|music|video|audio|lyrics|hd|4k|remastered)[^\)\]]*[\)\]]', '', title).strip()
        query = f"{clean_t} {artist}".strip() if artist and artist != "Various" else clean_t
        resp = requests.get("https://itunes.apple.com/search", params={"term": query, "entity": "song", "limit": 1}, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            if results:
                art = results[0].get("artworkUrl100", "").replace("100x100bb", "600x600bb")
                album = results[0].get("collectionName")
                if art:
                    logger.info(f"Retrieved official high-res album/EP cover art for '{title}' by '{artist}' from iTunes: {art}")
                    return art, album
    except Exception as e:
        logger.debug(f"iTunes high-res artwork search failed for '{title}': {e}")
    return None, None

def download_audio_query(query, title_meta=None, artist_meta=None, album_meta=None, artwork_url=None, expected_duration=None):
    """Download audio track via yt-dlp with candidate scoring, duration validation, and metadata embedding."""
    import yt_dlp

    selected_url = None

    if query.startswith("http://") or query.startswith("https://"):
        # Direct URL (e.g. YouTube video URL)
        try:
            with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True, "no_warnings": True}) as ydl:
                info = ydl.extract_info(query, download=False)
                cand_dur = info.get("duration") or 0
                if expected_duration and cand_dur > max(expected_duration + 60, 600):
                    logger.warning(f"Rejecting direct URL {query}: duration {cand_dur}s exceeds expected {expected_duration}s")
                    return None
                elif not expected_duration and cand_dur > 900:
                    logger.warning(f"Rejecting direct URL {query}: duration {cand_dur}s exceeds 15 minutes limit")
                    return None
                selected_url = query
        except Exception as e:
            logger.warning(f"Could not inspect direct URL {query}: {e}")
            selected_url = query
    else:
        # Search YouTube candidates
        if artist_meta and title_meta:
            clean_search = f"{artist_meta} - {title_meta}"
        else:
            clean_search = query

        search_terms = [
            f"ytsearch8:{clean_search} official audio",
            f"ytsearch8:{clean_search}"
        ]

        candidates = []
        with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True, "no_warnings": True}) as ydl:
            for st in search_terms:
                try:
                    res = ydl.extract_info(st, download=False)
                    for e in (res.get("entries", []) or []):
                        if e and e.get("id"):
                            candidates.append(e)
                    if len(candidates) >= 5:
                        break
                except Exception as ex:
                    logger.warning(f"Candidate search error for '{st}': {ex}")

        # Filter and score candidates
        best_candidate = None
        best_score = -999

        disallowed_mix_words = [
            "full album", "full album mix", "compilation", "all songs",
            "1 hour", "2 hour", "3 hour", "10 hour", "jukebox", "mega mix",
            "non stop", "discography"
        ]

        title_lower = (title_meta or query).lower()
        artist_lower = (artist_meta or "").lower()

        for cand in candidates:
            cand_dur = cand.get("duration") or 0
            cand_title = (cand.get("title") or "").lower()
            cand_uploader = (cand.get("uploader") or cand.get("channel") or "").lower()

            # Rule 1: Exclude compilation/album mixes unless query explicitly requested it
            has_mix_word = any(mw in cand_title for mw in disallowed_mix_words if mw not in title_lower)
            if has_mix_word:
                logger.info(f"Skipping candidate '{cand_title}': contains mix/compilation keyword")
                continue

            # Rule 2: Duration filter
            if expected_duration and expected_duration > 0:
                diff = abs(cand_dur - expected_duration)
                if diff > 50:
                    logger.info(f"Skipping candidate '{cand_title}': duration {cand_dur}s vs expected {expected_duration}s (diff {diff}s > 50s)")
                    continue
                if cand_dur > 900:
                    continue
            else:
                # If expected duration is unknown, cap at 12 minutes (720s) to avoid full albums
                if cand_dur > 720:
                    logger.info(f"Skipping candidate '{cand_title}': duration {cand_dur}s exceeds 12min limit")
                    continue
                if cand_dur < 30:
                    continue

            # Rule 3: Relevance scoring
            score = 0

            # Proximity to expected duration (up to +20 points)
            if expected_duration and expected_duration > 0:
                diff = abs(cand_dur - expected_duration)
                score += max(0, int(20 - diff / 2))

            # Topic channel (YouTube Music auto-generated studio audio)
            if " - topic" in cand_uploader or "topic" in cand_uploader:
                score += 30

            # Official audio / official video
            if "official audio" in cand_title or "official music video" in cand_title:
                score += 15
            elif "audio" in cand_title:
                score += 8

            # Uploader matches artist
            if artist_lower and (artist_lower in cand_uploader or cand_uploader in artist_lower):
                score += 20

            # Title keyword matches
            if title_lower:
                title_words = [w for w in title_lower.split() if len(w) > 2]
                matched_words = sum(1 for w in title_words if w in cand_title)
                if title_words:
                    score += int(20 * (matched_words / len(title_words)))

            # Penalties for covers, reactions, or live concerts
            if "reaction" in cand_title:
                score -= 100
            if "cover" in cand_title and "cover" not in title_lower:
                score -= 40
            if "live" in cand_title and "live" not in title_lower:
                score -= 25
            if "remix" in cand_title and "remix" not in title_lower:
                score -= 20

            logger.info(f"Candidate: '{cand.get('title')}' (dur: {cand_dur}s, uploader: '{cand.get('uploader')}') -> score: {score}")

            if score > best_score:
                best_score = score
                best_candidate = cand

        if not best_candidate or best_score < 5:
            logger.warning(f"No acceptable YouTube candidate found for '{clean_search}' (expected duration: {expected_duration}s). Skipping to avoid wrong audio.")
            return None

        selected_url = best_candidate.get("webpage_url") or best_candidate.get("url") or f"https://www.youtube.com/watch?v={best_candidate.get('id')}"
        logger.info(f"Selected best candidate: '{best_candidate.get('title')}' (score: {best_score}) -> {selected_url}")

    clean_filename = sanitize_filename(f"{artist_meta or 'Audio'} - {title_meta or query}")
    if len(clean_filename) > 120:
        clean_filename = clean_filename[:120]
    out_tmpl = os.path.join(MUSIC_DIR, f"{clean_filename}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_tmpl,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "320",
            }
        ],
        "quiet": False,
        "no_warnings": True,
        "noplaylist": True,
    }

    logger.info(f"Downloading verified audio from: {selected_url}")
    download_info = None
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        download_info = ydl.extract_info(selected_url, download=True)

    extracted_producer = extract_producer_from_info(download_info)
    if not extracted_producer and 'best_candidate' in locals() and best_candidate:
        extracted_producer = extract_producer_from_info(best_candidate)
    if extracted_producer:
        logger.info(f"Discovered producer for '{title_meta or query}': {extracted_producer}")

    expected_mp3 = os.path.join(MUSIC_DIR, f"{clean_filename}.mp3")
    if os.path.exists(expected_mp3):
        if not artwork_url or "ytimg.com" in artwork_url or "ggpht.com" in artwork_url or "youtube.com" in artwork_url:
            high_res_art, high_res_album = fetch_high_res_album_artwork(title_meta or query, artist_meta)
            if high_res_art:
                artwork_url = high_res_art
                if not album_meta:
                    album_meta = high_res_album
        embed_id3_tags(expected_mp3, title_meta or query, artist_meta, album_meta, artwork_url, producer=extracted_producer)
        return expected_mp3

    return None

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "UP",
        "service": "yama-downloader",
        "music_dir": MUSIC_DIR,
        "spotify_credentials_configured": bool(SPOTIPY_CLIENT_ID and SPOTIPY_CLIENT_SECRET)
    })

@app.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"results": []})

    results = []
    # 1. iTunes Search API (fast, reliable, high-res covers, zero auth needed)
    try:
        itunes_url = "https://itunes.apple.com/search"
        resp = requests.get(itunes_url, params={"term": query, "entity": "song", "limit": 10}, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            for item in data.get("results", []):
                title = item.get("trackName") or item.get("collectionName")
                artist = item.get("artistName")
                album = item.get("collectionName")
                art_url = item.get("artworkUrl100", "").replace("100x100bb", "600x600bb")
                duration = round(item.get("trackTimeMillis", 0) / 1000.0, 1)
                if title and artist:
                    results.append({
                        "title": title,
                        "artist": artist,
                        "album": album or "Single",
                        "duration": duration,
                        "artworkUrl": art_url,
                        "sourceQuery": f"{title} {artist}"
                    })
    except Exception as e:
        logger.warning(f"iTunes search failed: {e}")

    # 2. Fallback to yt-dlp search if iTunes returned empty
    if not results:
        try:
            import yt_dlp
            ydl_opts = {
                "extract_flat": True,
                "quiet": True,
                "skip_download": True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"ytsearch5:{query}", download=False)
                for entry in info.get("entries", []) or []:
                    title = entry.get("title", "")
                    uploader = entry.get("uploader", "Unknown Artist")
                    results.append({
                        "title": title,
                        "artist": uploader,
                        "album": "Web",
                        "duration": entry.get("duration", 0),
                        "artworkUrl": entry.get("thumbnail", ""),
                        "sourceQuery": entry.get("url") or f"{title} {uploader}"
                    })
        except Exception as e:
            logger.warning(f"yt-dlp search failed: {e}")

    return jsonify({"results": results})

@app.route("/playlist/resolve", methods=["POST"])
def resolve_playlist():
    data = request.get_json(force=True, silent=True) or {}
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    logger.info(f"Resolving playlist: {url}")

    # Case A: Spotify URL (album, playlist, or track)
    if "open.spotify.com" in url or "spotify:" in url:
        spotify_data = parse_spotify_url(url)
        if spotify_data and spotify_data.get("tracks"):
            logger.info(f"Resolved Spotify {spotify_data['type']}: '{spotify_data['title']}' with {len(spotify_data['tracks'])} tracks")
            return jsonify({
                "title": spotify_data["title"],
                "totalTracks": len(spotify_data["tracks"]),
                "artworkUrl": spotify_data.get("artworkUrl"),
                "tracks": spotify_data["tracks"]
            })

    # Case B: YouTube or other playlist URL
    try:
        import yt_dlp
        ydl_opts = {
            "extract_flat": True,
            "quiet": True,
            "skip_download": True,
            "ignoreerrors": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            playlist_title = info.get("title", "Imported Playlist")
            playlist_art = info.get("thumbnail")
            tracks = []
            for entry in info.get("entries", []) or []:
                if not entry:
                    continue
                t_title = entry.get("title")
                t_artist = entry.get("artist") or entry.get("uploader") or entry.get("creator") or "Unknown Artist"
                t_url = entry.get("url") or entry.get("webpage_url") or ""
                t_duration = entry.get("duration") or 0.0
                if not playlist_art and entry.get("thumbnail"):
                    playlist_art = entry.get("thumbnail")
                if t_title:
                    tracks.append({
                        "title": t_title,
                        "artist": t_artist,
                        "url": t_url,
                        "duration": t_duration
                    })

            if not tracks:
                # Single video fallback
                title = info.get("title", "Track")
                artist = info.get("artist") or info.get("uploader") or "Unknown Artist"
                if not playlist_art and info.get("thumbnail"):
                    playlist_art = info.get("thumbnail")
                tracks.append({
                    "title": title,
                    "artist": artist,
                    "url": url,
                    "duration": info.get("duration") or 0.0
                })

            return jsonify({
                "title": playlist_title,
                "totalTracks": len(tracks),
                "artworkUrl": playlist_art,
                "tracks": tracks
            })
    except Exception as e:
        logger.error(f"Failed to resolve playlist {url}: {e}")
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

@app.route("/download", methods=["POST"])
def download():
    data = request.get_json(force=True, silent=True) or {}
    query = data.get("query", "").strip()
    url = data.get("url", "").strip()
    target = url if url else query

    if not target:
        return jsonify({"error": "Missing 'query' or 'url'"}), 400

    logger.info(f"Download request received for target: {target}")
    before_files = get_existing_audio_files()

    title_meta = data.get("title") or None
    artist_meta = data.get("artist") or None
    album_meta = data.get("album") or None
    artwork_url = data.get("artworkUrl") or None
    expected_duration = None
    if data.get("duration"):
        try:
            expected_duration = float(data.get("duration"))
        except (ValueError, TypeError):
            expected_duration = None

    search_query = target

    # If it is a Spotify link, resolve metadata first!
    if "open.spotify.com" in target or "spotify:" in target:
        sp = parse_spotify_url(target)
        if sp and sp.get("tracks"):
            first_track = sp["tracks"][0]
            title_meta = first_track.get("title") or title_meta
            artist_meta = first_track.get("artist") or artist_meta
            album_meta = sp.get("title") or album_meta
            artwork_url = sp.get("artworkUrl") or artwork_url
            if first_track.get("duration"):
                expected_duration = float(first_track["duration"])
            search_query = f"{title_meta} {artist_meta}"
            logger.info(f"Resolved Spotify target to search query: '{search_query}' (expected duration: {expected_duration}s)")
    elif artist_meta and title_meta:
        search_query = f"{title_meta} {artist_meta}"

    if not artwork_url or "ytimg.com" in artwork_url or "ggpht.com" in artwork_url or "youtube.com" in artwork_url:
        high_res_art, high_res_album = fetch_high_res_album_artwork(title_meta or target, artist_meta)
        if high_res_art:
            artwork_url = high_res_art
            if not album_meta:
                album_meta = high_res_album

    created_file = None
    # 1. Try audio acquisition
    try:
        created_file = download_audio_query(
            query=search_query,
            title_meta=title_meta,
            artist_meta=artist_meta,
            album_meta=album_meta,
            artwork_url=artwork_url,
            expected_duration=expected_duration
        )
    except Exception as e:
        logger.warning(f"Audio download attempt failed: {e}")

    # Detect newly created files
    after_files = get_existing_audio_files()
    new_files = [f for f in after_files if f not in before_files or after_files[f] > before_files.get(f, 0)]

    if created_file and os.path.exists(created_file):
        if created_file not in new_files:
            new_files.append(created_file)
    elif not new_files:
        return jsonify({
            "success": False,
            "error": f"Failed to acquire audio file for target '{target}'."
        }), 500

    primary_file = new_files[0]
    logger.info(f"Successfully downloaded audio file: {primary_file}")
    return jsonify({
        "success": True,
        "filePath": primary_file,
        "allFiles": new_files
    })

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    logger.info(f"Starting YAMA Downloader service on port {port}, saving to {MUSIC_DIR}")
    app.run(host="0.0.0.0", port=port)
