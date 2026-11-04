"""Select one CC0 vegetation variant; keep original binary and textures."""
import hashlib
import json
import pathlib
root=pathlib.Path(__file__).resolve().parent.parent/'public/assets'
catalog=json.loads((root/'catalog.json').read_text(encoding='utf-8'))
for asset in ['pine_sapling_small','shrub_03']:
    target=root/asset/'model.gltf';data=json.loads(target.read_text(encoding='utf-8'))
    def height(index):
        node=data['nodes'][index];mesh=data['meshes'][node['mesh']]
        return max(data['accessors'][p['attributes']['POSITION']]['max'][1] for p in mesh['primitives'])
    candidates=[i for i,n in enumerate(data['nodes']) if 'mesh' in n]
    selected=max(candidates,key=height)
    data['scenes'][data.get('scene',0)]['nodes']=[selected]
    data['nodes'][selected].pop('translation',None)
    data.setdefault('extras',{})['journeyFocusNote']='Single CC0 variant selected; translation reset for ground placement. Original asset source listed in catalog.'
    target.write_text(json.dumps(data),encoding='utf-8')
    for entry in catalog['files']:
        if entry['path']==asset+'/model.gltf':
            entry.setdefault('originalSha256',entry['sha256']);entry['sha256']=hashlib.sha256(target.read_bytes()).hexdigest();entry['bytes']=target.stat().st_size
    print(json.dumps({'asset':asset,'selectedNode':selected,'heightMeters':height(selected)}))
(root/'catalog.json').write_text(json.dumps(catalog,indent=2),encoding='utf-8')
