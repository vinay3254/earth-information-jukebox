"""Yearly GRACE / GRACE-FO groundwater (total water storage) for each HEARTH place.

    python tools/fetch-grace.py

Source: NASA JPL GRACE and GRACE-FO mascon solution RL06.3 v04 with Coastal
Resolution Improvement (PO.DAAC collection TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4),
variable lwe_thickness = liquid water equivalent thickness, in cm, relative to
the 2004-2009 mean. One NetCDF file covers April 2002 onwards.

The file needs a NASA Earthdata Login token. It is read from the
EARTHDATA_TOKEN environment variable, or from ~/.earthdata-token. The token is
never written into the repository. The downloaded file is cached in
~/.cache/hearth-data/ (outside the repository).

Output: assets/data/grace-annual.json with, per place, the annual mean of the
monthly values at the nearest 0.5 degree grid cell. Years with fewer than six
monthly solutions (2002 starts in April; the GRACE to GRACE-FO gap runs from
mid 2017 to mid 2018) are left as null rather than averaged from a few months.
tools/fetch-real-nasa-data.mjs merges this file into src/regions.js.

Needs Python 3 with numpy and h5py.
"""

import json
import os
import pathlib
import subprocess
import sys
import urllib.request
from datetime import date, timedelta

import h5py
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path.home() / '.cache' / 'hearth-data'
FILE = CACHE / 'GRCTellus.JPL.MSCNv04CRI.nc'
URL = ('https://archive.podaac.earthdata.nasa.gov/podaac-ops-cumulus-protected/'
       'TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4/'
       'GRCTellus.JPL.200204_202609.GLO.RL06.3M.MSCNv04CRI.nc')
OUT = ROOT / 'assets' / 'data' / 'grace-annual.json'
MIN_MONTHS = 6
LAST_YEAR = 2025


def token():
    value = os.environ.get('EARTHDATA_TOKEN')
    if not value:
        path = pathlib.Path.home() / '.earthdata-token'
        if path.exists():
            value = path.read_text(encoding='utf8').strip()
    if not value:
        sys.exit('No Earthdata token: set EARTHDATA_TOKEN or create ~/.earthdata-token')
    return value


def download():
    if FILE.exists() and FILE.stat().st_size > 20_000_000:
        return
    CACHE.mkdir(parents=True, exist_ok=True)
    print('Downloading GRACE mascon file (about 44 MB)...')
    request = urllib.request.Request(URL, headers={'Authorization': f'Bearer {token()}'})
    with urllib.request.urlopen(request, timeout=600) as response, open(FILE, 'wb') as out:
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)


def places():
    # Read names and coordinates straight from src/regions.js via Node.
    script = ("import('./src/regions.js').then(m => console.log(JSON.stringify("
              "m.REGIONS.map(r => ({ id: r.id, lat: r.lat, lon: r.lon })))))")
    result = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT,
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def main():
    download()
    with h5py.File(FILE, 'r') as nc:
        lat = nc['lat'][:]
        lon = nc['lon'][:]
        time = nc['time'][:]
        lwe = nc['lwe_thickness']
        fill = lwe.attrs.get('_FillValue')
        fill = None if fill is None else float(np.asarray(fill).ravel()[0])
        units = lwe.attrs.get('units', b'cm')
        units = units.decode() if isinstance(units, bytes) else str(units)
        epoch = date(2002, 1, 1)  # time units: days since 2002-01-01
        years = np.array([(epoch + timedelta(days=float(t))).year for t in time])

        land = nc['land_mask'][:] > 0
        scale = nc['scale_factor'][:].astype(float)
        out = {}
        for place in places():
            i = int(np.abs(lat - place['lat']).argmin())
            j = int(np.abs(lon - (place['lon'] % 360)).argmin())
            moved = False
            if not land[i, j]:
                # Over the sea GRACE measures ocean-bottom pressure, not water
                # stored on land: use the nearest land cell instead.
                ii, jj = np.nonzero(land)
                dlon = np.minimum(np.abs(lon[jj] - lon[j]), 360 - np.abs(lon[jj] - lon[j]))
                k = int(np.argmin((lat[ii] - lat[i]) ** 2 + (dlon * np.cos(np.radians(lat[i]))) ** 2))
                i, j, moved = int(ii[k]), int(jj[k]), True
            series = lwe[:, i, j].astype(float)
            if fill is not None:
                series[series == fill] = np.nan
            # JPL's land-hydrology scale factor for the CRI solution.
            factor = scale[i, j]
            if np.isfinite(factor) and factor > -9999:
                series = series * factor
            annual = {}
            for year in range(2002, LAST_YEAR + 1):
                values = series[(years == year) & np.isfinite(series)]
                annual[str(year)] = round(float(values.mean()), 2) if len(values) >= MIN_MONTHS else None
            out[place['id']] = {'cell': [float(lat[i]), float(lon[j])], 'nearestLand': moved, 'annual': annual}
            print(f"{place['id']:24s} cell {lat[i]:.2f},{lon[j]:.2f}  "
                  f"2003 {annual['2003']}  2024 {annual['2024']}")

    OUT.write_text(json.dumps({
        'source': 'NASA JPL GRACE/GRACE-FO mascon RL06.3 v04 CRI (PO.DAAC TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4), lwe_thickness',
        'units': f'{units}, liquid water equivalent, relative to the 2004-2009 mean',
        'method': f'annual mean of monthly solutions at the nearest 0.5 deg land cell, times the JPL land-hydrology scale factor; null when fewer than {MIN_MONTHS} months',
        'places': out
    }, indent=1), encoding='utf8')
    print(f'Wrote {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
