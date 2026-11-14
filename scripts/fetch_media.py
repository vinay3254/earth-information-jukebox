#!/usr/bin/env python3
"""
Fetch and process media for Earth Information Jukebox from NASA GIBS.

Builds each track video from real NASA GIBS WMS daily frames:
  - WMS: https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi
  - global bbox -180,-90,180,90
  - 854x427 JPEG per frame
  - 90 daily frames (2024-08-01 to 2024-10-29)
  - assembled with ffmpeg into public/media/<id>.mp4 at 12 fps, H.264, no audio, faststart, <= 20MB
  - poster frame public/media/<id>.jpg (~10% duration)
  - credits.json: [{id, title, layer, dates, source: 'NASA GIBS', url}]

Layers:
  - nightlights: VIIRS_SNPP_DayNightBand_At_Sensor_Radiance (night lights)
  - ocean: GHRSST_L4_MUR_Sea_Surface_Temperature (daily SST)
  - lightning: MODIS_Terra_Thermal_Anomalies_All over VIIRS_Black_Marble (title: 'Active fires')
  - aerosols: MODIS_Combined_Value_Added_AOD over VIIRS_Black_Marble
"""

import concurrent.futures
from datetime import datetime, timedelta
import glob
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.parse
import urllib.request

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "raw"
FRAMES_DIR = RAW_DIR / "frames"
MEDIA_DIR = PROJECT_ROOT / "public" / "media"
CREDITS_PATH = MEDIA_DIR / "credits.json"

WMS_BASE = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
USER_AGENT = "EarthJukebox/1.0 (NASA Space Apps; https://github.com/earth-information-jukebox)"

NUM_FRAMES = 90
START_DATE = datetime(2024, 8, 1)
FPS = 12

TRACKS = [
    {
        "id": "nightlights",
        "title": "Night Lights (VIIRS Day/Night Band)",
        "layer": "VIIRS_SNPP_DayNightBand_At_Sensor_Radiance",
        "wms_layers": "VIIRS_SNPP_DayNightBand_At_Sensor_Radiance",
        "format": "image/jpeg",
    },
    {
        "id": "ocean",
        "title": "Sea Surface Temperature (GHRSST MUR)",
        "layer": "GHRSST_L4_MUR_Sea_Surface_Temperature",
        "wms_layers": "GHRSST_L4_MUR_Sea_Surface_Temperature",
        "format": "image/jpeg",
    },
    {
        "id": "lightning",
        "title": "Active fires",
        "layer": "MODIS_Terra_Thermal_Anomalies_All",
        "wms_layers": "VIIRS_Black_Marble,MODIS_Terra_Thermal_Anomalies_All",
        "format": "image/jpeg",
    },
    {
        "id": "aerosols",
        "title": "GEOS Aerosols (AOD)",
        "layer": "MODIS_Combined_Value_Added_AOD",
        "wms_layers": "VIIRS_Black_Marble,MODIS_Combined_Value_Added_AOD",
        "format": "image/jpeg",
    },
]


def make_wms_url(layers, date_str, fmt="image/jpeg", width=854, height=427):
    params = {
        "SERVICE": "WMS",
        "REQUEST": "GetMap",
        "VERSION": "1.1.1",
        "LAYERS": layers,
        "FORMAT": fmt,
        "SRS": "EPSG:4326",
        "BBOX": "-180,-90,180,90",
        "WIDTH": str(width),
        "HEIGHT": str(height),
        "TIME": date_str,
    }
    return f"{WMS_BASE}?{urllib.parse.urlencode(params)}"


def download_frame(url, dest_path, retries=3):
    if dest_path.exists() and dest_path.stat().st_size > 5000:
        return True

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest_path.with_suffix(".tmp")

    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=15) as resp, open(temp_path, "wb") as f_out:
                data = resp.read()
                if len(data) > 3000 and not data.startswith(b"<?xml") and not data.startswith(b"<ServiceException"):
                    f_out.write(data)
                    temp_path.replace(dest_path)
                    return True
        except Exception as e:
            if attempt == retries:
                print(f"Notice: Frame {dest_path.name} not available ({e})", file=sys.stderr)
            if temp_path.exists():
                temp_path.unlink()

    return False


def fetch_track_frames(track_cfg):
    track_id = track_cfg["id"]
    track_frames_dir = FRAMES_DIR / track_id
    track_frames_dir.mkdir(parents=True, exist_ok=True)

    dates = [(START_DATE + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(NUM_FRAMES)]
    tasks = []

    print(f"Fetching {NUM_FRAMES} frames for '{track_id}' ({track_cfg['title']}) ...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        for idx, d in enumerate(dates):
            dest_file = track_frames_dir / f"frame_{idx:04d}.jpg"
            url = make_wms_url(track_cfg["wms_layers"], d, track_cfg["format"])
            tasks.append(executor.submit(download_frame, url, dest_file))

        completed = 0
        for future in concurrent.futures.as_completed(tasks):
            if future.result():
                completed += 1

    print(f"Downloaded/verified {completed}/{NUM_FRAMES} frames for '{track_id}'.")
    if completed < NUM_FRAMES * 0.8:
        raise RuntimeError(f"Too few valid frames for {track_id} ({completed}/{NUM_FRAMES})")


def get_video_info(path):
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", str(path)
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    return json.loads(res.stdout)


def assemble_video_and_poster(track_id):
    track_frames_dir = FRAMES_DIR / track_id
    out_mp4 = MEDIA_DIR / f"{track_id}.mp4"
    out_jpg = MEDIA_DIR / f"{track_id}.jpg"

    frame_files = sorted(track_frames_dir.glob("frame_*.jpg"))
    if not frame_files:
        raise RuntimeError(f"No frames found for {track_id} in {track_frames_dir}")

    # Build sequential concat list
    concat_file = track_frames_dir / "frames.txt"
    frame_duration = 1.0 / FPS
    with open(concat_file, "w") as f:
        for p in frame_files:
            f.write(f"file '{p.resolve()}'\n")
            f.write(f"duration {frame_duration:.4f}\n")
        f.write(f"file '{frame_files[-1].resolve()}'\n")

    print(f"Assembling {out_mp4.name} with ffmpeg ({len(frame_files)} frames @ {FPS} fps) ...")
    cmd_encode = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_file),
        "-vf", "scale=854:426,fps=12",
        "-r", str(FPS),
        "-c:v", "libx264",
        "-crf", "22",
        "-preset", "medium",
        "-pix_fmt", "yuv420p",
        "-an",
        "-movflags", "+faststart",
        str(out_mp4)
    ]
    subprocess.run(cmd_encode, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    size = out_mp4.stat().st_size
    max_size = 20 * 1024 * 1024
    if size > max_size:
        print(f"Size {size} > 20MB. Re-encoding with crf=28 ...")
        cmd_re = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_file),
            "-vf", "scale=854:426,fps=12",
            "-r", str(FPS),
            "-c:v", "libx264",
            "-crf", "28",
            "-preset", "medium",
            "-pix_fmt", "yuv420p",
            "-an",
            "-movflags", "+faststart",
            str(out_mp4)
        ]
        subprocess.run(cmd_re, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    # Extract poster at ~10% duration
    info = get_video_info(out_mp4)
    duration = float(info.get("format", {}).get("duration", 7.5))
    poster_time = max(0.5, duration * 0.10)

    print(f"Extracting poster {out_jpg.name} at t={poster_time:.2f}s ...")
    cmd_poster = [
        "ffmpeg", "-y",
        "-ss", f"{poster_time:.2f}",
        "-i", str(out_mp4),
        "-vframes", "1",
        "-q:v", "2",
        str(out_jpg)
    ]
    subprocess.run(cmd_poster, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def is_track_valid(track_id):
    target_mp4 = MEDIA_DIR / f"{track_id}.mp4"
    target_jpg = MEDIA_DIR / f"{track_id}.jpg"
    if not target_mp4.exists() or not target_jpg.exists():
        return False
    try:
        size_mb = target_mp4.stat().st_size / (1024 * 1024)
        if size_mb > 20.0 or target_jpg.stat().st_size < 1000:
            return False
        info = get_video_info(target_mp4)
        v_stream = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
        a_stream = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
        if not v_stream or int(v_stream["width"]) > 854 or a_stream is not None:
            return False
        r_frame_rate = v_stream.get("r_frame_rate", "")
        if r_frame_rate != "12/1":
            return False
        return True
    except Exception:
        return False


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    date_range_str = f"{START_DATE.strftime('%Y-%m-%d')} to {(START_DATE + timedelta(days=NUM_FRAMES - 1)).strftime('%Y-%m-%d')}"

    credits_list = []

    for track in TRACKS:
        track_id = track["id"]
        print(f"\n==========================================")
        print(f"Processing track: {track_id}")
        print(f"==========================================")

        # Download frames and assemble video/poster
        if not is_track_valid(track_id):
            fetch_track_frames(track)
            assemble_video_and_poster(track_id)
        else:
            print(f"Valid video and poster already exist for {track_id}. Skipping re-assembly.")

        credits_list.append({
            "id": track_id,
            "title": track["title"],
            "layer": track["layer"],
            "dates": date_range_str,
            "source": "NASA GIBS",
            "url": "https://gibs.earthdata.nasa.gov",
            "credits": "NASA Global Imagery Browse Services (GIBS) / EOSDIS",
            "source_file": make_wms_url(track["wms_layers"], START_DATE.strftime("%Y-%m-%d")),
        })

    with open(CREDITS_PATH, "w", encoding="utf-8") as f:
        json.dump(credits_list, f, indent=2)
    print(f"\nWrote credits to {CREDITS_PATH}")

    # ffprobe verification
    print("\n" + "=" * 50)
    print("Verification Summary (ffprobe)")
    print("=" * 50)
    all_ok = True
    for track in TRACKS:
        track_id = track["id"]
        target_mp4 = MEDIA_DIR / f"{track_id}.mp4"
        target_jpg = MEDIA_DIR / f"{track_id}.jpg"

        size_mb = target_mp4.stat().st_size / (1024 * 1024)
        info = get_video_info(target_mp4)
        v_stream = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
        a_stream = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
        duration = float(info.get("format", {}).get("duration", 0.0))

        width = int(v_stream["width"]) if v_stream else 0
        height = int(v_stream["height"]) if v_stream else 0
        has_audio = a_stream is not None

        r_frame_rate = v_stream.get("r_frame_rate", "12/1") if v_stream else ""
        fps = eval(r_frame_rate) if "/" in r_frame_rate else float(r_frame_rate)

        is_valid = (size_mb <= 20.0) and (width <= 854) and (not has_audio) and (duration <= 90.0) and (r_frame_rate == "12/1")
        status = "PASS" if is_valid else "FAIL"
        if not is_valid:
            all_ok = False

        print(f"[{status}] {track_id}.mp4:")
        print(f"       size: {size_mb:.2f} MB (limit <= 20 MB)")
        print(f"       resolution: {width}x{height} (limit <= 854x480)")
        print(f"       duration: {duration:.2f}s at {fps:.1f} fps (r_frame_rate={r_frame_rate})")
        print(f"       audio streams: {1 if has_audio else 0} (limit == 0)")
        print(f"       poster: {target_jpg.name} ({target_jpg.stat().st_size // 1024} KB)")

    if not all_ok:
        print("\nVerification FAILED!", file=sys.stderr)
        sys.exit(1)

    print("\nAll media files successfully created and verified against contracts!")


if __name__ == "__main__":
    main()
