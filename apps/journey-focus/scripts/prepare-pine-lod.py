"""Experimental CC0 pine LOD. Usage: python scripts/prepare-pine-lod.py TOOLPATH.

Only the pinned official gltfpack executable is accepted. No raster processing.
The active runtime model URL is deliberately outside this script's scope.
"""
import copy
import hashlib
import json
import pathlib
import shutil
import struct
import subprocess
import sys
import tempfile

APP = pathlib.Path(__file__).resolve().parent.parent
ROOT = APP / 'public/assets'
SOURCE = ROOT / 'pine_sapling_small'
TARGET = ROOT / 'pine_sapling_lod'
TOOL_SHA256 = 'a082a0db2332908133100332caeeddaa304afcf5e8094adc755ebdea8c720984'
ARCHIVE_SHA256 = 'f6e9c09d66af23da3da71b86f0652d2413e81c734e0aecd1cd3d0e6e6e8645c0'
FORBIDDEN = {'KHR_mesh_quantization', 'EXT_meshopt_compression', 'KHR_meshopt_compression', 'KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_texture_webp', 'EXT_mesh_gpu_instancing'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def inspect(model, folder):
    positions, triangles = [], 0
    for index in model['scenes'][model.get('scene', 0)]['nodes']:
        node = model['nodes'][index]
        if any(key in node for key in ('matrix', 'rotation', 'scale', 'translation', 'children')):
            raise ValueError('This preparation expects an untransformed single plant')
        for primitive in model['meshes'][node['mesh']]['primitives']:
            if primitive.get('mode', 4) != 4:
                raise ValueError('Expected triangles')
            accessor = model['accessors'][primitive['attributes']['POSITION']]
            if accessor['componentType'] != 5126 or accessor['type'] != 'VEC3':
                raise ValueError('Expected unquantized float positions')
            view = model['bufferViews'][accessor['bufferView']]
            data = (folder / model['buffers'][view['buffer']]['uri']).read_bytes()
            start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
            positions.extend(struct.unpack_from('<fff', data, start + i * view.get('byteStride', 12)) for i in range(accessor['count']))
            indices = model['accessors'][primitive['indices']]
            triangles += indices['count'] // 3
            if 'NORMAL' not in primitive['attributes'] or 'TEXCOORD_0' not in primitive['attributes']:
                raise ValueError('Required normals/UVs were lost')
    lower = [min(p[i] for p in positions) for i in range(3)]
    upper = [max(p[i] for p in positions) for i in range(3)]
    return {'triangles': triangles, 'boundsMin': lower, 'boundsMax': upper,
            'dimensionsMeters': [upper[i] - lower[i] for i in range(3)]}


def image_for_texture(model, index):
    return pathlib.PurePosixPath(model['images'][model['textures'][index]['source']]['uri']).name


def restore_materials(original, output):
    # The optimizer can omit MASK on JPEG materials; preserve source semantics.
    mapping = {i: next(j for j in range(len(output['textures'])) if image_for_texture(output, j) == image_for_texture(original, i))
               for i in range(len(original['textures']))}
    def remap(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                    child['index'] = mapping[child['index']]
                else:
                    remap(child)
        elif isinstance(value, list):
            for child in value:
                remap(child)
    by_name = {m['name']: m for m in original['materials']}
    restored = []
    for material in output['materials']:
        value = copy.deepcopy(by_name[material['name']])
        remap(value)
        restored.append(value)
    output['materials'] = restored


def main():
    tool = pathlib.Path(sys.argv[1]).resolve()
    if sha(tool.read_bytes()) != TOOL_SHA256:
        raise ValueError('Expected verified official gltfpack 1.3 Windows executable')
    original_bytes = (SOURCE / 'model.gltf').read_bytes()
    original = json.loads(original_bytes)
    before = inspect(original, SOURCE)
    selected = original['scenes'][original.get('scene', 0)]['nodes']
    if len(selected) != 1:
        raise ValueError('Expected one normalized source plant')
    source_node = copy.deepcopy(original['nodes'][selected[0]])
    input_model = copy.deepcopy(original)
    input_model['meshes'] = [original['meshes'][source_node['mesh']]]
    source_node['mesh'] = 0
    input_model['nodes'] = [source_node]
    input_model['scene'] = 0
    input_model['scenes'] = [{'nodes': [0]}]
    options = ['-si', '0.25', '-noq', '-km', '-tr']
    tmp_root = APP.parent.parent / 'tmp'
    tmp_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pine-lod-', dir=tmp_root) as temporary:
        work = pathlib.Path(temporary)
        # Local filenames avoid Unicode URI handling differences in native tools.
        for buffer in input_model['buffers']:
            name = pathlib.PurePosixPath(buffer['uri']).name
            shutil.copyfile(SOURCE / buffer['uri'], work / name)
            buffer['uri'] = name
        (work / 'selected.gltf').write_text(json.dumps(input_model), encoding='utf-8')
        result = subprocess.run([str(tool), '-i', str(work / 'selected.gltf'), '-o', str(work / 'model.gltf'), *options], check=True, capture_output=True, text=True)
        output = json.loads((work / 'model.gltf').read_text(encoding='utf-8'))
        if FORBIDDEN.intersection(output.get('extensionsUsed', []) + output.get('extensionsRequired', [])):
            raise ValueError('Output requires unsupported compressed/quantized extensions')
        restore_materials(original, output)
        after = inspect(output, work)
        if after['triangles'] > 40_000:
            raise ValueError('Triangle budget exceeded')
        deviation = [abs(after['dimensionsMeters'][i] - before['dimensionsMeters'][i]) / before['dimensionsMeters'][i] for i in range(3)]
        if max(deviation) > .01 or any(abs(after[key][i] - before[key][i]) > before['dimensionsMeters'][i] * .01 for key in ('boundsMin', 'boundsMax') for i in range(3)):
            raise ValueError('Geometry bounds changed by more than 1%')
        files = {}
        for image in output['images']:
            name = pathlib.PurePosixPath(image['uri']).name
            image['uri'] = 'textures/' + name
            files[image['uri']] = (SOURCE / image['uri']).read_bytes()
        for buffer in output['buffers']:
            files[buffer['uri']] = (work / buffer['uri']).read_bytes()
        files['model.gltf'] = json.dumps(output, separators=(',', ':')).encode()
        proof = {
            'status': 'experimental, not integrated by preparation', 'source': 'https://polyhaven.com/a/pine_sapling_small',
            'license': 'CC0-1.0', 'sourceModelSha256': sha(original_bytes),
            'tool': {'name': 'gltfpack', 'version': '1.3', 'binarySha256': TOOL_SHA256, 'archiveSha256': ARCHIVE_SHA256,
                     'release': 'https://github.com/zeux/meshoptimizer/releases/tag/v1.3',
                     'archive': 'https://github.com/zeux/meshoptimizer/releases/download/v1.3/gltfpack-windows.zip',
                     'options': options},
            'before': before, 'after': after, 'dimensionRelativeDeviation': deviation,
            'triangleRatio': after['triangles'] / before['triangles'],
            'changes': 'Pruned inactive variants, simplified selected mesh; restored original material properties with texture index remapping. Raster and binary source files untouched.',
            'originalTextureSha256': {name: sha(data) for name, data in files.items() if name.startswith('textures/')},
            'toolMessages': result.stderr.strip(),
        }
        files['provenance.json'] = json.dumps(proof, indent=2).encode()
        if sum(map(len, files.values())) > 8_000_000:
            raise ValueError('Asset exceeds 8 MB budget')
        entries = []
        for name, data in files.items():
            target = TARGET / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            entries.append({'path': TARGET.name + '/' + name, 'bytes': len(data), 'sha256': sha(data)})
    # Read latest catalog only when prepared output is ready to register.
    catalog_path = ROOT / 'catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    catalog['files'] = [f for f in catalog['files'] if not f['path'].startswith(TARGET.name + '/')] + entries
    catalog['sources'] = [s for s in catalog['sources'] if s['id'] != TARGET.name] + [{
        'id': TARGET.name, 'source': 'https://polyhaven.com/a/pine_sapling_small', 'license': 'CC0-1.0',
        'derivation': 'scripts/prepare-pine-lod.py; meshoptimizer gltfpack 1.3', 'metadataProof': TARGET.name + '/provenance.json',
    }]
    catalog_path.write_text(json.dumps(catalog, indent=2), encoding='utf-8')
    assert (SOURCE / 'model.gltf').read_bytes() == original_bytes
    print(json.dumps({'triangles': after['triangles'], 'bytes': sum(e['bytes'] for e in entries), 'dimensionRelativeDeviation': deviation, 'model': str(TARGET / 'model.gltf')}))


if __name__ == '__main__':
    main()
