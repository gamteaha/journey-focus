"""Own geometry with CC0 wall/roof textures; no image manipulation."""
import hashlib
import json
import math
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'public/assets'


def main():
    groups = [[] for _ in range(5)]

    def quad(points, normal, material, repeat=(1, 1)):
        for i in [0, 1, 2, 0, 2, 3]:
            groups[material].append((*points[i], *normal, *[(0, 0), (repeat[0], 0), repeat, (0, repeat[1])][i]))

    def box(x, y, z, w, h, d, material):
        a, b, c, e, f, g = x-w/2, x+w/2, y, y+h, z-d/2, z+d/2
        quad([(a,c,g),(b,c,g),(b,e,g),(a,e,g)],(0,0,1),material,(w/2,h/2))
        quad([(b,c,f),(a,c,f),(a,e,f),(b,e,f)],(0,0,-1),material,(w/2,h/2))
        quad([(b,c,g),(b,c,f),(b,e,f),(b,e,g)],(1,0,0),material,(d/2,h/2))
        quad([(a,c,f),(a,c,g),(a,e,g),(a,e,f)],(-1,0,0),material,(d/2,h/2))
        quad([(a,e,g),(b,e,g),(b,e,f),(a,e,f)],(0,1,0),material,(w/2,d/2))
        quad([(a,c,f),(b,c,f),(b,c,g),(a,c,g)],(0,-1,0),material)

    box(0,0,0,9,3.5,7,0)
    rise, half_width, depth = 2.1, 5.0, 4.0
    n = math.hypot(rise, half_width)
    quad([(-half_width,3.5,depth),(0,5.6,depth),(0,5.6,-depth),(-half_width,3.5,-depth)],(-rise/n,half_width/n,0),1,(2.7,4))
    quad([(0,5.6,depth),(half_width,3.5,depth),(half_width,3.5,-depth),(0,5.6,-depth)],(rise/n,half_width/n,0),1,(2.7,4))
    for z, normal, indices in [(3.5,(0,0,1),[0,1,2]),(-3.5,(0,0,-1),[1,0,2])]:
        ps=[(-4.5,3.5,z),(4.5,3.5,z),(0,5.6,z)]
        for i in indices: groups[0].append((*ps[i],*normal,*[(0,0),(4.5,0),(2.25,1.05)][i]))
    for z in [-3.54,3.54]:
        for x in [-2.8,2.8]:
            box(x,1.25,z,1.7,1.45,.12,2)
            box(x,1.35,z+(0.08 if z>0 else -.08),1.48,1.2,.04,3)
            box(x,1.35,z+(0.12 if z>0 else -.12),.06,1.2,.03,2)
            box(x,1.9,z+(0.12 if z>0 else -.12),1.48,.06,.03,2)
    box(0,.04,3.57,1.25,2.65,.18,2)
    box(0,0,4.1,2.8,.18,1.7,4)
    binary=bytearray();views=[];accessors=[];primitives=[]
    for material, vertices in enumerate(groups):
        if not vertices: continue
        offset=len(binary)
        for v in vertices: binary.extend(struct.pack('<8f',*v))
        views.append({'buffer':0,'byteOffset':offset,'byteLength':len(vertices)*32,'byteStride':32,'target':34962})
        attrs={}
        for name, component_offset, size in [('POSITION',0,3),('NORMAL',12,3),('TEXCOORD_0',24,2)]:
            acc={'bufferView':len(views)-1,'byteOffset':component_offset,'componentType':5126,'count':len(vertices),'type':'VEC'+str(size)}
            if name=='POSITION':
                acc['min']=[min(v[i] for v in vertices) for i in range(3)];acc['max']=[max(v[i] for v in vertices) for i in range(3)]
            attrs[name]=len(accessors);accessors.append(acc)
        primitives.append({'attributes':attrs,'material':material,'mode':4})
    images=[{'uri':next((ROOT/'house').glob(stem+'.*')).name} for stem in ['wall-color','wall-normal','roof-color','roof-normal']]
    def textured(color, normal):return {'pbrMetallicRoughness':{'baseColorTexture':{'index':color},'metallicFactor':0,'roughnessFactor':.85},'normalTexture':{'index':normal,'scale':.75}}
    materials=[textured(0,1),textured(2,3)]
    for color, roughness in [([.16,.14,.11,1],.8),([.17,.28,.30,1],.25),([.38,.37,.31,1],.95)]:
        materials.append({'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':0,'roughnessFactor':roughness}})
    gltf={'asset':{'version':'2.0','generator':'Journey Focus own pilot house geometry'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':primitives}],'buffers':[{'uri':'house.bin','byteLength':len(binary)}],'bufferViews':views,'accessors':accessors,'images':images,'textures':[{'source':i,'sampler':0} for i in range(4)],'samplers':[{'wrapS':10497,'wrapT':10497,'magFilter':9729,'minFilter':9987}],'materials':materials}
    target=ROOT/'house';target.mkdir(parents=True,exist_ok=True)
    (target/'house.bin').write_bytes(binary)
    (target/'house.gltf').write_text(json.dumps(gltf),encoding='utf-8')
    catalog=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))
    catalog['files']=[f for f in catalog['files'] if f['path'] not in ['house/house.bin','house/house.gltf']]
    for filename in ['house.bin','house.gltf']:
        data=(target/filename).read_bytes();catalog['files'].append({'path':'house/'+filename,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    catalog['sources']=[s for s in catalog['sources'] if s['id']!='journey-focus-house']
    catalog['sources'].append({'id':'journey-focus-house','source':'scripts/build-scenery-house.py','license':'project-owned geometry; CC0 textures listed separately'})
    (ROOT/'catalog.json').write_text(json.dumps(catalog,indent=2),encoding='utf-8')
    print(json.dumps({'houseTriangles':sum(len(g) for g in groups)//3,'binaryBytes':len(binary)}))


if __name__=='__main__':main()
