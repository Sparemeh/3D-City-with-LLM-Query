import requests
import json
import os
import math

CACHE_FILE = os.path.join(os.path.dirname(__file__), 'buildings_cache.json')

# Downtown Calgary bounding box (4-5 city blocks)
BBOX = (51.042, -114.075, 51.048, -114.068)
LAT_REF = (BBOX[0] + BBOX[2]) / 2
LON_REF = (BBOX[1] + BBOX[3]) / 2


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


def _polygon_area(coords):
    """Shoelace formula for approximate area in square meters."""
    if len(coords) < 3:
        return 100.0
    scale = 111320.0
    cos_lat = math.cos(math.radians(LAT_REF))
    n = len(coords)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        xi = (coords[i][0] - LON_REF) * scale * cos_lat
        yi = (coords[i][1] - LAT_REF) * scale
        xj = (coords[j][0] - LON_REF) * scale * cos_lat
        yj = (coords[j][1] - LAT_REF) * scale
        area += xi * yj - xj * yi
    return abs(area) / 2.0


def fetch_buildings():
    """Fetch building data from OSM Overpass API for downtown Calgary."""
    overpass_url = 'https://overpass-api.de/api/interpreter'
    south, west, north, east = BBOX
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
        area = _polygon_area(footprint)
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


def get_cached_buildings():
    """Return buildings from cache if available, otherwise fetch and cache."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                data = json.load(f)
            if data:
                return data
        except (json.JSONDecodeError, IOError):
            pass

    buildings = fetch_buildings()

    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(buildings, f)
    except IOError:
        pass

    return buildings
