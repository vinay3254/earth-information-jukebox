#!/usr/bin/env python3
"""
scripts/fetch_globe_textures.py

Fetches public-domain NASA Blue Marble and Black Marble textures,
resizes them to <= 4096x2048 and <= 4MB each, and records credits in
public/globe/credits.json.
"""

import json
import os
import sys
import urllib.request
from PIL import Image

# NASA GIBS WMS provides public domain Blue Marble and Black Marble in standard EPSG:4326 equirectangular projection
DAY_URLS = [
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&FORMAT=image/jpeg&TRANSPARENT=FALSE&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024",
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg",
    "https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography/57752_land_shallow_topo_2048.jpg",
]

NIGHT_URLS = [
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=VIIRS_Black_Marble&STYLES=&FORMAT=image/jpeg&TRANSPARENT=FALSE&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024",
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg",
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg",
]

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(REPO_ROOT, "public", "globe")
RAW_DIR = os.path.join(REPO_ROOT, "raw")


def download_first_successful(urls, destination):
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    headers = {"User-Agent": "EarthJukebox/1.0 (NASA Space Apps Challenge; +https://github.com)"}
    for url in urls:
        print(f"Trying to download from {url}...")
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=20) as resp, open(destination, "wb") as f:
                f.write(resp.read())
            print(f"Successfully downloaded {destination} from {url}")
            return url
        except Exception as e:
            print(f"Failed to download from {url}: {e}")
    raise RuntimeError(f"All URLs failed for {destination}")


def process_texture(raw_path, out_path, max_w=2048, max_h=1024, max_bytes=4 * 1024 * 1024):
    print(f"Processing texture: {raw_path} -> {out_path}")
    with Image.open(raw_path) as img:
        img = img.convert("RGB")
        w, h = img.size
        # Resize to power-of-two equirectangular (e.g. 2048x1024) if larger
        target_w = min(w, max_w)
        target_h = min(h, max_h)
        # Force 2:1 equirectangular aspect ratio standard for planetary spheres
        if target_w != w or target_h != h or (target_w != 2 * target_h):
            target_h = target_w // 2
            print(f"Resizing from {w}x{h} to {target_w}x{target_h}...")
            img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        quality = 90
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        img.save(out_path, format="JPEG", quality=quality, optimize=True)
        
        # Ensure <= 4MB
        size = os.path.getsize(out_path)
        while size > max_bytes and quality > 30:
            quality -= 10
            print(f"File size {size} > {max_bytes}, reducing quality to {quality}...")
            img.save(out_path, format="JPEG", quality=quality, optimize=True)
            size = os.path.getsize(out_path)

    print(f"Saved {out_path}: {target_w}x{target_h}, {size / 1024 / 1024:.2f} MB")
    return target_w, target_h, size


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    day_raw = os.path.join(RAW_DIR, "blue_marble_raw.jpg")
    night_raw = os.path.join(RAW_DIR, "black_marble_raw.jpg")

    day_out = os.path.join(OUTPUT_DIR, "blue_marble.jpg")
    night_out = os.path.join(OUTPUT_DIR, "black_marble.jpg")

    day_url = None
    night_url = None

    if not os.path.exists(day_raw) or os.path.getsize(day_raw) == 0:
        day_url = download_first_successful(DAY_URLS, day_raw)
    else:
        day_url = DAY_URLS[0]
        print(f"Using cached {day_raw}")

    if not os.path.exists(night_raw) or os.path.getsize(night_raw) == 0:
        night_url = download_first_successful(NIGHT_URLS, night_raw)
    else:
        night_url = NIGHT_URLS[0]
        print(f"Using cached {night_raw}")

    w_day, h_day, bytes_day = process_texture(day_raw, day_out, max_w=2048, max_h=1024)
    w_night, h_night, bytes_night = process_texture(night_raw, night_out, max_w=2048, max_h=1024)

    credits_data = {
        "textures": [
            {
                "id": "blue_marble_day",
                "file": "blue_marble.jpg",
                "title": "NASA Blue Marble: Next Generation (Land Surface, Shallow Water, Shaded Topography)",
                "source_url": day_url,
                "provider": "NASA Global Imagery Browse Services (GIBS) / NASA Earth Observatory / Goddard Space Flight Center",
                "credits": "Reto Stöckli, Robert Simmon, NASA GSFC, MODIS Land Group",
                "license": "Public Domain (NASA guideline: freely available for re-use)",
                "resolution": f"{w_day}x{h_day}",
                "size_bytes": bytes_day
            },
            {
                "id": "black_marble_night",
                "file": "black_marble.jpg",
                "title": "NASA Black Marble: Earth at Night (Suomi NPP / VIIRS Day-Night Band)",
                "source_url": night_url,
                "provider": "NASA Global Imagery Browse Services (GIBS) / NOAA / NASA GSFC",
                "credits": "NASA Earth Observatory / Miguel Román, NASA GSFC, Suomi NPP VIIRS team",
                "license": "Public Domain (NASA guideline: freely available for re-use)",
                "resolution": f"{w_night}x{h_night}",
                "size_bytes": bytes_night
            }
        ],
        "attribution_note": "NASA imagery and data are in the public domain and not copyrighted unless indicated otherwise."
    }

    credits_path = os.path.join(OUTPUT_DIR, "credits.json")
    with open(credits_path, "w", encoding="utf-8") as f:
        json.dump(credits_data, f, indent=2)

    print(f"Credits recorded in {credits_path}")


if __name__ == "__main__":
    main()
