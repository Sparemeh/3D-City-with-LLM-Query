import requests
import json
import os
import math

CACHE_DIR = os.path.dirname(__file__)

# Default downtown Calgary bounding box (~8-10 city blocks)
DEFAULT_BBOX = (51.040, -114.077, 51.050, -114.066)

# Maximum allowed bounding box spans (prevents huge OSM queries)
MAX_LAT_SPAN = 0.05   # ~5.5 km
MAX_LON_SPAN = 0.08   # ~5.5 km at Calgary's latitude


def _cache_file(bbox):
    """Return a cache filename unique to this bbox."""
    south, west, north, east = bbox
    tag = f'{south:.5f}_{west:.5f}_{north:.5f}_{east:.5f}'
    return os.path.join(CACHE_DIR, f'buildings_cache_{tag}.json')


def _get_zoning(building_type):
    bt = (building_type or '').lower()
    if bt in ('yes', 'apartments', 'residential'):
        return 'RC-G'
    if bt in ('commercial', 'retail', 'office'):
        return 'CC-X'
    if bt in ('industrial', 'warehouse'):
        return 'IB'
    if bt == 'hotel':
        return 'CC-MH'
    if bt == 'parking':
        return 'DC'
    return 'M-X1'


def _get_value_multiplier(zoning):
    multipliers = {
        'CC-X': 8000,
        'CC-MH': 7000,
        'RC-G': 4000,
        'IB': 3000,
        'DC': 2500,
        'M-X1': 5000,
    }
    return multipliers.get(zoning, 4000)


def _polygon_area(coords, lat_ref, lon_ref):
    """Shoelace formula for approximate area in square meters."""
    if len(coords) < 3:
        return 100.0
    scale = 111320.0
    cos_lat = math.cos(math.radians(lat_ref))
    n = len(coords)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        xi = (coords[i][0] - lon_ref) * scale * cos_lat
        yi = (coords[i][1] - lat_ref) * scale
        xj = (coords[j][0] - lon_ref) * scale * cos_lat
        yj = (coords[j][1] - lat_ref) * scale
        area += xi * yj - xj * yi
    return abs(area) / 2.0


def fetch_buildings(bbox=None):
    """Fetch building data from OSM Overpass API for the given bounding box.

    bbox is a tuple (south, west, north, east) of floats.
    Defaults to DEFAULT_BBOX when not provided.
    """
    if bbox is None:
        bbox = DEFAULT_BBOX
    south, west, north, east = bbox
    lat_ref = (south + north) / 2
    lon_ref = (west + east) / 2

    overpass_url = 'https://overpass-api.de/api/interpreter'
    query = f"""
[out:json][timeout:30];
(
  way["building"]({south},{west},{north},{east});
);
out body;
>;
out skel qt;
"""
    response = requests.post(overpass_url, data={'data': query}, timeout=40)
    response.raise_for_status()
    data = response.json()

    # Build node lookup: id -> (lon, lat)
    nodes = {}
    for element in data.get('elements', []):
        if element['type'] == 'node':
            nodes[element['id']] = (element['lon'], element['lat'])

    buildings = []
    for element in data.get('elements', []):
        if element['type'] != 'way':
            continue
        tags = element.get('tags', {})
        if 'building' not in tags:
            continue

        node_ids = element.get('nodes', [])
        footprint = [nodes[nid] for nid in node_ids if nid in nodes]
        if len(footprint) < 3:
            continue

        # Height
        height = 10.0
        if 'height' in tags:
            try:
                height = float(str(tags['height']).replace('m', '').strip())
            except ValueError:
                pass
        elif 'building:levels' in tags:
            try:
                height = float(tags['building:levels']) * 3.5
            except ValueError:
                pass

        # Name / address
        name = tags.get('name', '')
        housenumber = tags.get('addr:housenumber', '')
        street = tags.get('addr:street', '')
        if not name and (housenumber or street):
            name = f"{housenumber} {street}".strip()
        if not name:
            name = f"Building {element['id']}"

        address = f"{housenumber} {street}".strip() if (housenumber or street) else 'N/A'
        building_type = tags.get('building', 'yes')
        zoning = _get_zoning(building_type)
        area = _polygon_area(footprint, lat_ref, lon_ref)
        multiplier = _get_value_multiplier(zoning)
        assessed_value = round(height * area * multiplier / 1000, 2)

        # Center coordinates
        lats = [c[1] for c in footprint]
        lons = [c[0] for c in footprint]
        lat_center = sum(lats) / len(lats)
        lon_center = sum(lons) / len(lons)

        buildings.append({
            'id': str(element['id']),
            'properties': {
                'name': name,
                'address': address,
                'height': round(height, 1),
                'building_type': building_type,
                'zoning': zoning,
                'assessed_value': assessed_value,
                'lat': round(lat_center, 6),
                'lon': round(lon_center, 6),
                'footprint': footprint,
            }
        })

    return buildings


def get_buildings(bbox=None):
    """Return buildings from cache if available, otherwise fetch and cache.

    bbox is a tuple (south, west, north, east). Uses DEFAULT_BBOX when None.
    """
    if bbox is None:
        bbox = DEFAULT_BBOX
    cache_file = _cache_file(bbox)

    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f:
                data = json.load(f)
            if data:
                return data
        except (json.JSONDecodeError, IOError):
            pass

    buildings = fetch_buildings(bbox)

    try:
        with open(cache_file, 'w') as f:
            json.dump(buildings, f)
    except IOError:
        pass

    return buildings


# Keep old name as an alias so any existing callers still work
def get_cached_buildings():
    return get_buildings()
