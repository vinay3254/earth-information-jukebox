#!/usr/bin/env python3
"""
Fetch and process media for Earth Information Jukebox.

SVS IDs:
  - nightlights: 5313
  - ocean: 3912
  - lightning: 5011
  - aerosols: 5669 (substituting 4582 if 5669 has no video)

Per design spec:
  - Downloads from NASA SVS API (or fallback archive/cache if geo-blocked/offline)
  - Picks smallest mp4 >= 720p (or best available), preferring flat equirectangular maps
  - ffmpeg:
    - scale to max 854 width
    - strip audio (-an)
    - trim to <= 90s duration
    - CRF tuned so file <= 20 MB
    - -movflags +faststart
    - poster jpg from ~10% into video
  - Writes public/media/credits.json
  - Idempotent (skips existing valid files)
  - Verifies with ffprobe (size <= 20MB, width <= 854, no audio)
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

TRACK_CONFIGS = [
    {
        "id": "nightlights",
        "svs_id": 5313,
        "default_title": "Night Lights 2012–2023",
        "known_fallback_url": "https://web.archive.org/web/20250201223034id_/https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4",
        "archive_api_snap": "https://web.archive.org/web/20260509132852id_/https://svs.gsfc.nasa.gov/api/5313",
    },
    {
        "id": "ocean",
        "svs_id": 3912,
        "default_title": "Sea Surface Currents & Temperature",
        "known_fallback_url": "https://web.archive.org/web/20241215034210id_/https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_sst_flow.m4v",
        "archive_api_snap": "https://web.archive.org/web/20260207150706id_/https://svs.gsfc.nasa.gov/api/3912",
    },
    {
        "id": "lightning",
        "svs_id": 5011,
        "default_title": "ISS Lightning 2017–2023",
        "known_fallback_url": "https://web.archive.org/web/20250402150601id_/https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sphere_07312023.mp4",
        "archive_api_snap": "https://web.archive.org/web/20260516234534id_/https://svs.gsfc.nasa.gov/api/5011",
    },
    {
        "id": "aerosols",
        "svs_id": 5669,
        "substitute_svs_id": 4582,
        "default_title": "GEOS Aerosols",
        "known_fallback_url": "https://web.archive.org/web/20250112022922id_/https://svs.gsfc.nasa.gov/vis/a000000/a004500/a004582/gmao_aerosols.mp4",
        "archive_api_snap": "https://web.archive.org/web/20241026183821id_/https://svs.gsfc.nasa.gov/api/4582",
    },
]

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "raw"
MEDIA_DIR = PROJECT_ROOT / "public" / "media"
CREDITS_PATH = MEDIA_DIR / "credits.json"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def fetch_url(url, timeout=10):
    """Fetch URL with curl or urllib, returning bytes."""
    # Use curl first because curl supports HTTP/2 and modern TLS handshakes
    cmd = ["curl", "-s", "-L", "--max-time", str(timeout), "-A", USER_AGENT, url]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        if res.stdout:
            return res.stdout
    except Exception:
        pass

    # Urllib fallback
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_svs_metadata(svs_id, archive_snap=None):
    """
    Fetch SVS metadata.
    1. Try local cache in raw/<id>.json
    2. Try direct SVS API
    3. Try Wayback archive snapshot
    """
    local_cached = RAW_DIR / f"{svs_id}.json"
    if local_cached.exists() and local_cached.stat().st_size > 100:
        try:
            with open(local_cached, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Try direct SVS API
    for url in [f"https://svs.gsfc.nasa.gov/api/{svs_id}/", f"https://svs.gsfc.nasa.gov/api/{svs_id}"]:
        try:
            data_bytes = fetch_url(url, timeout=5)
            if data_bytes:
                data = json.loads(data_bytes.decode("utf-8"))
                with open(local_cached, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                return data
        except Exception:
            pass

    # Try Wayback snapshot
    if archive_snap:
        try:
            data_bytes = fetch_url(archive_snap, timeout=15)
            if data_bytes:
                data = json.loads(data_bytes.decode("utf-8"))
                with open(local_cached, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                return data
        except Exception as e:
            print(f"Warning: Failed to fetch archive snapshot {archive_snap}: {e}", file=sys.stderr)

    raise RuntimeError(f"Could not fetch metadata for SVS ID {svs_id}")


def extract_media_candidates(node, candidates=None):
    if candidates is None:
        candidates = []

    if isinstance(node, dict):
        url = node.get("url") or node.get("file_url") or node.get("download_url") or ""
        filename = node.get("filename") or os.path.basename(url.split("?")[0])
        media_type = (node.get("media_type") or node.get("type") or "").lower()

        is_video = (
            media_type == "movie"
            or url.lower().endswith((".mp4", ".m4v", ".mov", ".webm"))
            or filename.lower().endswith((".mp4", ".m4v", ".mov", ".webm"))
        )

        if is_video and url:
            desc = " ".join([
                str(node.get("description") or ""),
                str(node.get("caption") or ""),
                str(node.get("title") or ""),
                str(node.get("label") or ""),
                str(node.get("format") or ""),
                filename,
                url
            ]).lower()

            width = node.get("width") or 0
            height = node.get("height") or 0
            size = node.get("size") or node.get("filesize") or 0

            if not height:
                m_res = re.search(r"(\d{3,4})p", desc)
                if m_res:
                    height = int(m_res.group(1))
                else:
                    m_dim = re.search(r"(\d{3,4})x(\d{3,4})", desc)
                    if m_dim:
                        width = int(m_dim.group(1))
                        height = int(m_dim.group(2))
                    elif "4k" in desc or "2160" in desc:
                        height = 2160
                    elif "1080" in desc:
                        height = 1080
                    elif "720" in desc:
                        height = 720
                    elif "540" in desc or "480" in desc:
                        height = 480

            full_url = url
            if full_url.startswith("//"):
                full_url = "https:" + full_url
            elif full_url.startswith("/"):
                full_url = "https://svs.gsfc.nasa.gov" + full_url

            candidates.append({
                "url": full_url,
                "filename": filename,
                "width": int(width or 0),
                "height": int(height or 0),
                "size": int(size or 0),
                "desc": desc,
                "node": node
            })

        for v in node.values():
            extract_media_candidates(v, candidates)
    elif isinstance(node, list):
        for item in node:
            extract_media_candidates(item, candidates)

    return candidates


def score_candidate(cand):
    """
    Score candidate videos.
    - Prefer flat equirectangular map-style over globe / 3D
    - Prefer mp4 >= 720p (smallest mp4 >= 720p)
    - Penalize ProRes / massive gigabyte master files
    """
    score = 1000
    desc = cand["desc"]
    url = cand["url"].lower()
    height = cand["height"]
    size = cand["size"]

    flat_indicators = ["flat", "equirectangular", "plate_carree", "cylindrical", "map", "linear"]
    globe_indicators = ["globe", "3d", "sphere", "spinning", "rotating"]

    is_flat = any(w in desc for w in flat_indicators)
    is_globe = any(w in desc for w in globe_indicators)

    if is_flat and not is_globe:
        score += 2000
    elif is_globe and not is_flat:
        score -= 1000

    if url.endswith(".mp4"):
        score += 600
    elif url.endswith(".m4v"):
        score += 400
    elif url.endswith(".webm"):
        score += 200
    elif url.endswith(".mov"):
        score += 100

    if height == 720:
        score += 800
    elif height == 1080:
        score += 600
    elif 480 <= height < 720:
        score += 400
    elif height > 1080:
        score += 300
    elif height > 0:
        score += 200
    else:
        score += 100

    if "prores" in desc:
        score -= 2000
    if size > 400 * 1024 * 1024:
        score -= 1000
    elif 10 * 1024 * 1024 <= size <= 150 * 1024 * 1024:
        score += 300

    return score


def download_video(url, fallback_url, target_path):
    """Download video with curl (supports resume, progress, HTTP/2)."""
    target_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = target_path.with_suffix(".tmp")

    urls_to_try = [url]
    if fallback_url and fallback_url != url:
        urls_to_try.append(fallback_url)

    success = False
    for try_url in urls_to_try:
        print(f"Downloading from: {try_url}")
        # Run curl
        cmd = [
            "curl", "-L",
            "--connect-timeout", "10",
            "--max-time", "180",
            "--retry", "2",
            "-A", USER_AGENT,
            "-o", str(temp_path),
            try_url
        ]
        res = subprocess.run(cmd)
        if res.returncode == 0 and temp_path.exists() and temp_path.stat().st_size > 100000:
            temp_path.replace(target_path)
            size_mb = target_path.stat().st_size / (1024 * 1024)
            print(f"Successfully downloaded {target_path.name} ({size_mb:.2f} MB)")
            success = True
            break
        else:
            print(f"Download attempt failed for {try_url}", file=sys.stderr)
            if temp_path.exists():
                temp_path.unlink()

    if not success:
        raise RuntimeError(f"Failed to download video to {target_path}")


def get_video_info(path):
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", str(path)
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    return json.loads(res.stdout)


def process_video_and_poster(raw_path, out_mp4_path, out_poster_path):
    """
    scale to max 854 wide,
    strip audio (-an),
    trim to <= 90 s,
    CRF tuned so file <= 20 MB,
    -movflags +faststart.
    Writes poster jpg from ~10% into video.
    """
    out_mp4_path.parent.mkdir(parents=True, exist_ok=True)

    crf = 23
    print(f"Encoding {raw_path.name} -> {out_mp4_path.name} (crf={crf}) ...")
    cmd = [
        "ffmpeg", "-y",
        "-i", str(raw_path),
        "-t", "90",
        "-vf", "scale='min(854,iw)':-2",
        "-an",
        "-c:v", "libx264",
        "-crf", str(crf),
        "-preset", "medium",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(out_mp4_path)
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    size = out_mp4_path.stat().st_size
    max_size = 20 * 1024 * 1024
    if size > max_size:
        print(f"File size {size} bytes exceeds 20MB. Re-encoding with crf=28 ...")
        cmd_re = [
            "ffmpeg", "-y",
            "-i", str(raw_path),
            "-t", "90",
            "-vf", "scale='min(854,iw)':-2",
            "-an",
            "-c:v", "libx264",
            "-crf", "28",
            "-preset", "medium",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(out_mp4_path)
        ]
        subprocess.run(cmd_re, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    info = get_video_info(out_mp4_path)
    duration = float(info.get("format", {}).get("duration", 10.0))
    poster_time = max(1.0, duration * 0.10)

    print(f"Generating poster for {out_mp4_path.name} at t={poster_time:.2f}s ...")
    cmd_poster = [
        "ffmpeg", "-y",
        "-ss", f"{poster_time:.2f}",
        "-i", str(out_mp4_path),
        "-vframes", "1",
        "-q:v", "2",
        str(out_poster_path)
    ]
    subprocess.run(cmd_poster, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def format_credits(metadata):
    raw_credits = metadata.get("credits") or []
    if isinstance(raw_credits, str):
        return raw_credits
    if isinstance(raw_credits, list):
        names = []
        for c in raw_credits:
            if isinstance(c, str):
                names.append(c)
            elif isinstance(c, dict):
                role = c.get("role")
                people = c.get("people")
                if isinstance(people, list):
                    p_names = [p.get("name") for p in people if isinstance(p, dict) and p.get("name")]
                    if p_names:
                        names.append(f"{role}: {', '.join(p_names)}")
                else:
                    name = c.get("name") or c.get("person") or c.get("creator")
                    if name and role:
                        names.append(f"{name} ({role})")
                    elif name:
                        names.append(name)
        if names:
            return "; ".join(names)
    return metadata.get("studio") or "NASA's Scientific Visualization Studio"


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    credits_list = []
    if CREDITS_PATH.exists():
        try:
            with open(CREDITS_PATH, "r", encoding="utf-8") as f:
                credits_list = json.load(f)
        except Exception:
            credits_list = []

    credits_by_id = {c["id"]: c for c in credits_list if isinstance(c, dict) and "id" in c}

    for cfg in TRACK_CONFIGS:
        track_id = cfg["id"]
        svs_id = cfg["svs_id"]
        substitute_id = cfg.get("substitute_svs_id")
        target_mp4 = MEDIA_DIR / f"{track_id}.mp4"
        target_jpg = MEDIA_DIR / f"{track_id}.jpg"
        raw_mp4 = RAW_DIR / f"{track_id}_raw.mp4"

        print(f"\n==========================================")
        print(f"Processing track: {track_id} (Target SVS ID: {svs_id})")
        print(f"==========================================")

        # Check if 5669 has video or if we need substitution
        active_svs_id = svs_id
        substitution_info = None

        try:
            metadata = fetch_svs_metadata(svs_id, cfg.get("archive_api_snap"))
            candidates = extract_media_candidates(metadata)
        except Exception as e:
            metadata = None
            candidates = []

        if not candidates and substitute_id:
            print(f"Notice: SVS ID {svs_id} has no usable video. Per design spec, substituting with SVS ID {substitute_id}.")
            substitution_info = f"SVS {svs_id} contains only still images; substituted with SVS {substitute_id} per design spec."
            active_svs_id = substitute_id
            metadata = fetch_svs_metadata(substitute_id, cfg.get("archive_api_snap"))
            candidates = extract_media_candidates(metadata)

        if not candidates and not cfg.get("known_fallback_url"):
            raise RuntimeError(f"No usable video candidates found for {track_id}")

        title = (metadata.get("title") if metadata else None) or cfg["default_title"]
        svs_url = f"https://svs.gsfc.nasa.gov/{active_svs_id}/"
        credits_str = format_credits(metadata) if metadata else "NASA Scientific Visualization Studio"

        if candidates:
            candidates.sort(key=score_candidate, reverse=True)
            best = candidates[0]
            print(f"Found {len(candidates)} candidates. Selected: {best['filename']} (score={score_candidate(best)})")
            selected_url = best["url"]
        else:
            selected_url = cfg["known_fallback_url"]
            print(f"Using known fallback video URL for {track_id}: {selected_url}")

        # Download raw if needed
        if not raw_mp4.exists() or raw_mp4.stat().st_size < 100000:
            download_video(selected_url, cfg.get("known_fallback_url"), raw_mp4)
        else:
            size_mb = raw_mp4.stat().st_size / (1024 * 1024)
            print(f"Raw video already exists: {raw_mp4.name} ({size_mb:.2f} MB)")

        # Process video & poster if needed
        needs_encoding = not target_mp4.exists() or not target_jpg.exists()
        if not needs_encoding:
            try:
                info = get_video_info(target_mp4)
                v_stream = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
                a_stream = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
                size_mb = target_mp4.stat().st_size / (1024 * 1024)
                if size_mb > 20.0 or (v_stream and int(v_stream["width"]) > 854) or a_stream is not None:
                    needs_encoding = True
            except Exception:
                needs_encoding = True

        if needs_encoding:
            process_video_and_poster(raw_mp4, target_mp4, target_jpg)
        else:
            print(f"Valid encoded video and poster already exist for {track_id}.")

        credit_entry = {
            "id": track_id,
            "svs_id": active_svs_id,
            "title": title,
            "url": svs_url,
            "credits": credits_str,
            "source_file": selected_url
        }
        if substitution_info:
            credit_entry["original_svs_id"] = svs_id
            credit_entry["substitution_note"] = substitution_info

        credits_by_id[track_id] = credit_entry

    final_credits = [credits_by_id[c["id"]] for c in TRACK_CONFIGS if c["id"] in credits_by_id]
    with open(CREDITS_PATH, "w", encoding="utf-8") as f:
        json.dump(final_credits, f, indent=2)
    print(f"\nWrote credits to {CREDITS_PATH}")

    # ffprobe verification
    print("\n" + "=" * 50)
    print("Verification Summary (ffprobe)")
    print("=" * 50)
    all_ok = True
    for cfg in TRACK_CONFIGS:
        track_id = cfg["id"]
        target_mp4 = MEDIA_DIR / f"{track_id}.mp4"
        target_jpg = MEDIA_DIR / f"{track_id}.jpg"

        if not target_mp4.exists() or not target_jpg.exists():
            print(f"ERROR: {track_id} output files missing!")
            all_ok = False
            continue

        size_mb = target_mp4.stat().st_size / (1024 * 1024)
        info = get_video_info(target_mp4)
        v_stream = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
        a_stream = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
        duration = float(info.get("format", {}).get("duration", 0.0))

        width = int(v_stream["width"]) if v_stream else 0
        height = int(v_stream["height"]) if v_stream else 0
        has_audio = a_stream is not None

        is_valid = (size_mb <= 20.0) and (width <= 854) and (not has_audio) and (duration <= 90.5)
        status = "PASS" if is_valid else "FAIL"
        if not is_valid:
            all_ok = False

        print(f"[{status}] {track_id}.mp4:")
        print(f"       size: {size_mb:.2f} MB (limit <= 20 MB)")
        print(f"       resolution: {width}x{height} (limit width <= 854)")
        print(f"       duration: {duration:.2f}s (limit <= 90s)")
        print(f"       audio streams: {1 if has_audio else 0} (limit == 0)")
        print(f"       poster: {target_jpg.name} ({target_jpg.stat().st_size // 1024} KB)")

    if not all_ok:
        print("\nVerification FAILED!", file=sys.stderr)
        sys.exit(1)

    print("\nAll media files successfully created and verified against contracts!")


if __name__ == "__main__":
    main()
