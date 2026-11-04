"""Prepare an experimental leafy CC0 tree from checksum-verified tmp originals.

Usage: python scripts/prepare-leafy-tree-lod.py TOOLPATH [ORIGINAL_FOLDER]
Original files/metadata are kept in BAI/tmp, never copied into app dependencies.
Uses the same verified meshoptimizer helper as the experimental pine preparation.
"""
import hashlib
import json
import pathlib
import runpy
import subprocess
import sys
import tempfile

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / 'public/assets'
TARGET = ROOT / 'leafy_tree_lod'
HELPERS = runpy.run_path(str(APP / 'scripts/prepare-pine-lod.py'))


def main():
    tool = pathlib.Path(sys.argv[1]).resolve()
    source = pathlib.Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else APP.parent.parent / 'tmp/tree-small-02-original'
    sha = HELPERS['sha']
    if sha(tool.read_bytes()) != HELPERS['TOOL_SHA256']:
        raise ValueError('Expected official pinned gltfpack 1.3 Windows executable')
    metadata = json.loads((source / 'source-metadata.json').read_text())
    descriptor = metadata['gltf']
    jobs = {'model.gltf': descriptor, **descriptor['include']}
    if sum(info['size'] for info in jobs.values()) > 150_000_000:
        raise ValueError('Original source exceeds 150 MB cap')
    original_files = []
    for name, info in jobs.items():
        path = (source / name).resolve()
        if not path.is_relative_to(source.resolve()):
            raise ValueError('Unsafe source URI')
        data = path.read_bytes()
        if len(data) != info['size'] or hashlib.md5(data).hexdigest() != info['md5']:
            raise ValueError('Original provider checksum mismatch: ' + name)
        original_files.append({'path': name, 'bytes': len(data), 'sha256': sha(data), 'providerMd5': info['md5'], 'sourceUrl': info['url']})
    original = json.loads((source / 'model.gltf').read_text())
    if len(original['nodes']) != 1 or len(original['scenes'][original.get('scene', 0)]['nodes']) != 1:
        raise ValueError('Expected one unambiguous source tree')
    before = HELPERS['inspect'](original, source)
    options = ['-si', '0.025', '-se', '0.0045', '-sv', '-sp', '-noq', '-km', '-tr', '-kv']
    with tempfile.TemporaryDirectory(prefix='leafy-lod-', dir=APP.parent.parent / 'tmp') as temporary:
        work = pathlib.Path(temporary)
        subprocess.run([str(tool), '-i', str(source / 'model.gltf'), '-o', str(work / 'model.gltf'), *options], check=True)
        output = json.loads((work / 'model.gltf').read_text())
        if HELPERS['FORBIDDEN'].intersection(output.get('extensionsUsed', []) + output.get('extensionsRequired', [])):
            raise ValueError('Unsupported compressed/quantized output')
        if set(output.get('extensionsRequired', [])) - set(original.get('extensionsRequired', [])):
            raise ValueError('New required extensions are not permitted')
        # -kv retains both UV sets; -noq retains the source UV transform rather
        # than baking it. Restore exact source material values, including BLEND.
        HELPERS['restore_materials'](original, output)
        for primitive in output['meshes'][0]['primitives']:
            if 'TEXCOORD_1' not in primitive['attributes']:
                raise ValueError('Source UV1 coordinates were lost')
        after = HELPERS['inspect'](output, work)
        deviation = [abs(after['dimensionsMeters'][i] - before['dimensionsMeters'][i]) / before['dimensionsMeters'][i] for i in range(3)]
        if not 30_000 <= after['triangles'] < 60_000 or max(deviation) > .03:
            raise ValueError('Experimental 60k triangle/3% bounds budget exceeded')
        if any(abs(after[key][i] - before[key][i]) > before['dimensionsMeters'][i] * .03 for key in ('boundsMin', 'boundsMax') for i in range(3)):
            raise ValueError('Bounds endpoints moved beyond 3%')
        files = {}
        for image in output['images']:
            name = pathlib.PurePosixPath(image['uri']).name
            image['uri'] = 'textures/' + name
            files[image['uri']] = (source / image['uri']).read_bytes()
        for buffer in output['buffers']:
            files[buffer['uri']] = (work / buffer['uri']).read_bytes()
        files['model.gltf'] = json.dumps(output, separators=(',', ':')).encode()
        proof = {
            'status': 'experimental, not integrated by preparation',
            'source': 'https://polyhaven.com/a/tree_small_02', 'license': 'CC0-1.0',
            'providerMetadata': metadata, 'originalFiles': original_files,
            'tool': {'name': 'gltfpack', 'version': '1.3', 'binarySha256': HELPERS['TOOL_SHA256'],
                     'archiveSha256': HELPERS['ARCHIVE_SHA256'],
                     'release': 'https://github.com/zeux/meshoptimizer/releases/tag/v1.3', 'options': options},
            'before': before, 'after': after, 'dimensionRelativeDeviation': deviation,
            'acceptedExperimentalBoundsTolerance': .03,
            'triangleRatio': after['triangles'] / before['triangles'],
            'displayScaleForHeight8To10Meters': [8 / after['dimensionsMeters'][1], 10 / after['dimensionsMeters'][1]],
            'compatibilityNote': 'Preserves source KHR_texture_transform, UV0/UV1, BLEND, double-sided and normal-map materials. No new required extension. Old VWorld SDK UV-transform compatibility remains subject to visual verification.',
            'changes': 'Geometry simplified by official gltfpack; original raster bytes and exact source material properties retained. No geometry rescaling to conceal silhouette shrinkage.',
        }
        files['provenance.json'] = json.dumps(proof, indent=2).encode()
        if sum(map(len, files.values())) > 12_000_000:
            raise ValueError('Prepared asset exceeds 12 MB budget')
        entries = []
        for name, data in files.items():
            path = TARGET / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            entries.append({'path': TARGET.name + '/' + name, 'bytes': len(data), 'sha256': sha(data)})
    catalog_path = ROOT / 'catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    catalog['files'] = [f for f in catalog['files'] if not f['path'].startswith(TARGET.name + '/')] + entries
    catalog['sources'] = [s for s in catalog['sources'] if s['id'] != TARGET.name] + [{
        'id': TARGET.name, 'source': 'https://polyhaven.com/a/tree_small_02', 'license': 'CC0-1.0',
        'author': 'Rico Cilliers', 'derivation': 'scripts/prepare-leafy-tree-lod.py; official gltfpack 1.3',
        'metadataProof': TARGET.name + '/provenance.json',
    }]
    catalog_path.write_text(json.dumps(catalog, indent=2), encoding='utf-8')
    print(json.dumps({'triangles': after['triangles'], 'bytes': sum(f['bytes'] for f in entries), 'dimensionsMeters': after['dimensionsMeters'], 'dimensionRelativeDeviation': deviation, 'displayScale': proof['displayScaleForHeight8To10Meters']}))


if __name__ == '__main__':
    main()
