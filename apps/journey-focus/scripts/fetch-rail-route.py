"""Fetch a small OSM rail dataset; never downloads VWorld assets or reads keys.

The generated route data is derived from OpenStreetMap, licensed ODbL 1.0.
This is a horizontal centerline candidate, not a surveyed operational track.
"""
import datetime
import heapq
import json
import math
import pathlib
import urllib.request

SOURCE = 'https://api.openstreetmap.org/api/0.6/map.json?bbox=127.585,37.801,127.637,37.835'


def distance(a, b):
    latitude = math.radians((a['lat'] + b['lat']) / 2)
    return math.hypot((a['lon'] - b['lon']) * math.cos(latitude), a['lat'] - b['lat']) * 111195


def main():
    request = urllib.request.Request(SOURCE, headers={'User-Agent': 'JourneyFocus-Prototype/0.1'})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = json.load(response)
    nodes = {e['id']: e for e in data['elements'] if e['type'] == 'node'}
    ways = [e for e in data['elements'] if e['type'] == 'way'
            and e.get('tags', {}).get('railway') == 'rail'
            and e.get('tags', {}).get('name:en') == 'Gyeongchun Line'
            and not e.get('tags', {}).get('service')]
    graph = {}
    for way in ways:
        for a, b in zip(way['nodes'], way['nodes'][1:]):
            if a not in nodes or b not in nodes:
                continue
            length = distance(nodes[a], nodes[b])
            for start, end in [(a, b), (b, a)]:
                graph.setdefault(start, []).append((end, length, way['id'], way['tags'].get('tunnel') == 'yes'))
    station_a = {'lon': 127.58933, 'lat': 37.830779}
    station_b = {'lon': 127.634146, 'lat': 37.805723}
    starts = sorted(graph, key=lambda n: distance(nodes[n], station_a))[:8]
    ends = set(sorted(graph, key=lambda n: distance(nodes[n], station_b))[:8])
    best = None
    for start in starts:
        queue = [(0, start)]
        costs, previous = {start: 0}, {}
        while queue:
            cost, node = heapq.heappop(queue)
            if cost > costs[node]:
                continue
            for neighbor, length, way_id, tunnel in graph[node]:
                new_cost = cost + length
                if new_cost < costs.get(neighbor, math.inf):
                    costs[neighbor] = new_cost
                    previous[neighbor] = (node, way_id, tunnel)
                    heapq.heappush(queue, (new_cost, neighbor))
        for end in ends:
            if end not in costs:
                continue
            start_offset, end_offset = distance(nodes[start], station_a), distance(nodes[end], station_b)
            if max(start_offset, end_offset) > 200:
                continue
            score = costs[end] + 10 * (start_offset + end_offset)
            if best is None or score < best[0]:
                best = (score, start, end, previous, start_offset, end_offset)
    if best is None:
        raise RuntimeError('No connected rail path within 200m of both stations')
    _, start, end, previous, start_offset, end_offset = best
    edges = []
    cursor = end
    while cursor != start:
        prior, way_id, tunnel = previous[cursor]
        edges.append((prior, cursor, way_id, tunnel))
        cursor = prior
    edges.reverse()
    points = [{'lon': nodes[start]['lon'], 'lat': nodes[start]['lat'], 'tunnel': edges[0][3]}]
    for a, b, way_id, tunnel in edges:
        points[-1]['tunnel'] = tunnel
        points.append({'lon': nodes[b]['lon'], 'lat': nodes[b]['lat'], 'tunnel': tunnel})
    result = {
        'id': 'baegyangri-gangchon-osm', 'from': '\ubc31\uc591\ub9ac', 'to': '\uac15\ucd0c',
        'geometry': 'osm-rail', 'license': 'ODbL-1.0',
        'attribution': '\u00a9 OpenStreetMap contributors',
        'copyrightUrl': 'https://www.openstreetmap.org/copyright',
        'licenseUrl': 'https://opendatacommons.org/licenses/odbl/1-0/',
        'source': SOURCE,
        'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'wayIds': sorted({edge[2] for edge in edges}),
        'endpointOffsetsMeters': [round(start_offset, 1), round(end_offset, 1)],
        'note': 'Horizontal rail centerline candidate only; elevation, direction of travel and tunnels not field-verified. Tunnel segments use above-ground viewing.',
        'points': points,
    }
    output = pathlib.Path(__file__).resolve().parent.parent / 'public/data/baegyangri-gangchon.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'points': len(points), 'wayIds': result['wayIds'],
                      'tunnelSegments': sum(e[3] for e in edges), 'offsetMeters': result['endpointOffsetsMeters']}))


if __name__ == '__main__':
    main()
