"""Fetch one small CC0 Poly Haven plant; retain original buffers/textures."""
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'public/assets'
ASSET = 'shrub_sorrel_01'
HEADERS = {'User-Agent': 'JourneyFocus/0.1 (local student prototype)'}
LIMIT = 10_000_000


def fetch(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('api.polyhaven.com', 'dl.polyhaven.org'):
        raise ValueError('Only official provider URLs are allowed')
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
        data = response.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ValueError('File exceeds asset budget')
    return data


def main():
    metadata_url = 'https://api.polyhaven.com/assets?t=models'
    asset = json.loads(fetch(metadata_url))[ASSET]
    files_url = 'https://api.polyhaven.com/files/' + ASSET
    descriptor = json.loads(fetch(files_url))['gltf']['1k']['gltf']
    jobs = {'model.gltf': descriptor, **descriptor['include']}
    if sum(info['size'] for info in jobs.values()) > LIMIT:
        raise ValueError('Asset exceeds 10 MB budget')
    downloads = {}
    for name, info in jobs.items():
        relative = pathlib.PurePosixPath(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe provider relative path')
        data = fetch(info['url'])
        if len(data) != info['size'] or hashlib.md5(data).hexdigest() != info['md5']:
            raise ValueError('Provider checksum mismatch: ' + name)
        downloads[name] = data
    model = json.loads(downloads['model.gltf'])
    # Variant d has the fullest leafy clump: 990 triangles rather than a stem.
    selected = next(i for i, node in enumerate(model['nodes']) if node.get('name') == ASSET + '_d')
    node = model['nodes'][selected]
    primitives = model['meshes'][node['mesh']]['primitives']
    if any(p.get('mode', 4) != 4 for p in primitives):
        raise ValueError('Expected triangle primitives')
    triangles = sum(model['accessors'][p['indices']]['count'] // 3 for p in primitives)
    if triangles > 20_000:
        raise ValueError('Selected plant exceeds triangle budget')
    positions = [model['accessors'][p['attributes']['POSITION']] for p in primitives]
    lower = [min(p['min'][axis] for p in positions) for axis in range(3)]
    upper = [max(p['max'][axis] for p in positions) for axis in range(3)]
    # Reuse one mesh three times. Each plant's minimum Y remains exactly zero;
    # the original variant nodes are retained but not in the active scene.
    clump_nodes, clump_lower, clump_upper = [], [], []
    for index, (x, z, scale) in enumerate([(-.025, -.015, .85), (.025, -.012, 1), (0, .025, .92)]):
        translation = [x, -lower[1] * scale, z]
        clump_nodes.append(len(model['nodes']))
        model['nodes'].append({
            'name': ASSET + '_clump_' + str(index + 1), 'mesh': node['mesh'],
            'translation': translation, 'scale': [scale, scale, scale],
        })
        clump_lower.append([lower[axis] * scale + translation[axis] for axis in range(3)])
        clump_upper.append([upper[axis] * scale + translation[axis] for axis in range(3)])
    combined_lower = [min(bounds[axis] for bounds in clump_lower) for axis in range(3)]
    combined_upper = [max(bounds[axis] for bounds in clump_upper) for axis in range(3)]
    model['scenes'][model.get('scene', 0)]['nodes'] = clump_nodes
    model.setdefault('extras', {})['journeyFocusNote'] = 'Three leafy plants reuse variant d mesh; original binary/textures retained. Each translation places minimum Y on ground.'
    original_hash = hashlib.sha256(downloads['model.gltf']).hexdigest()
    downloads['model.gltf'] = json.dumps(model, separators=(',', ':')).encode()
    proof = {
        'metadataUrl': metadata_url, 'filesUrl': files_url, 'providerMetadata': asset,
        'providerGltf': descriptor, 'selectedNode': selected, 'selectedName': node['name'],
        'selectedPlantTriangles': triangles, 'clumpTriangles': triangles * len(clump_nodes),
        'selectedPlantBoundsMin': lower, 'selectedPlantBoundsMax': upper,
        'clumpNodes': clump_nodes, 'boundsMin': combined_lower, 'boundsMax': combined_upper,
        'dimensionsMeters': [combined_upper[i] - combined_lower[i] for i in range(3)],
        'suggestedDisplayScale': [6, 10],
        'note': 'Combined bounds from glTF POSITION accessors transformed by each active node scale/translation. Scale 6-10 is an artistic preview size, not a geographic measurement.',
    }
    downloads['provenance.json'] = json.dumps(proof, indent=2).encode()
    if sum(map(len, downloads.values())) > LIMIT:
        raise ValueError('Prepared asset exceeds 10 MB budget')
    entries = []
    for name, data in downloads.items():
        path = ROOT / ASSET / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        entry = {'path': ASSET + '/' + name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        if name == 'model.gltf':
            entry['originalSha256'] = original_hash
        if name in jobs:
            entry['sourceUrl'] = jobs[name]['url']
            entry['providerMd5'] = jobs[name]['md5']
        entries.append(entry)
    catalog_path = ROOT / 'catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    catalog['sources'] = [s for s in catalog['sources'] if s['id'] != ASSET] + [{
        'id': ASSET, 'source': 'https://polyhaven.com/a/' + ASSET,
        'license': 'CC0-1.0', 'author': 'Rico Cilliers',
        'metadataProof': ASSET + '/provenance.json',
    }]
    catalog['files'] = [f for f in catalog['files'] if not f['path'].startswith(ASSET + '/')] + entries
    catalog_path.write_text(json.dumps(catalog, indent=2), encoding='utf-8')
    print(json.dumps({'asset': ASSET, 'files': len(entries), 'bytes': sum(e['bytes'] for e in entries), 'selectedPlantTriangles': triangles, 'clumpTriangles': proof['clumpTriangles'], 'dimensionsMeters': proof['dimensionsMeters']}))


if __name__ == '__main__':
    main()
