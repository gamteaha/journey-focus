"""Prepare CC0 files only. Never reads keys or VWorld data."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'public/assets'
HEADERS = {'User-Agent': 'JourneyFocus/0.1 (local student prototype)'}


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
        return response.read()


def main():
    jobs, sources = [], []
    for asset in ['pine_sapling_small', 'shrub_03']:
        metadata = json.loads(fetch('https://api.polyhaven.com/files/' + asset))
        item = metadata['gltf']['1k']['gltf']
        jobs.append((asset + '/model.gltf', item))
        for name, info in item['include'].items():
            jobs.append((asset + '/' + name, info))
        sources.append({'id': asset, 'source': 'https://polyhaven.com/a/' + asset, 'license': 'CC0-1.0'})
    for asset, stem in [('clay_roof_tiles_02', 'roof'), ('plastered_wall_02', 'wall')]:
        metadata = json.loads(fetch('https://api.polyhaven.com/files/' + asset))
        for kind, suffix in [('diff', 'color'), ('nor_gl', 'normal')]:
            key = next(k for k in metadata if k.lower() == kind or k.lower().endswith('_' + kind) or (kind == 'diff' and k.lower() == 'diffuse'))
            files = metadata[key]['1k']
            info = files.get('jpg') or files.get('png')
            extension = info['url'].split('.')[-1]
            jobs.append((f'house/{stem}-{suffix}.{extension}', info))
        sources.append({'id': asset, 'source': 'https://polyhaven.com/a/' + asset, 'license': 'CC0-1.0'})

    def download(job):
        relative, info = job
        target = ROOT / relative
        if target.is_file() and hashlib.md5(target.read_bytes()).hexdigest() == info.get('md5'):
            data = target.read_bytes()
        else:
            data = fetch(info['url'])
            if info.get('md5') and hashlib.md5(data).hexdigest() != info['md5']:
                raise ValueError('Asset checksum mismatch: ' + relative)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        return {'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        files = list(pool.map(download, jobs))
    manifest = {'license': 'CC0-1.0', 'licenseUrl': 'https://polyhaven.com/license', 'sources': sources, 'files': files}
    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / 'catalog.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'files': len(files), 'bytes': sum(f['bytes'] for f in files)}))


if __name__ == '__main__':
    main()
