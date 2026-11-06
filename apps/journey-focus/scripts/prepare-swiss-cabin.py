"""Blender 4.5: prepare the supplied monorail as a separate Swiss prototype cabin.
Run blender --background --python scripts/prepare-swiss-cabin.py -- <download-folder>
Source files are never modified. This is not an authentic Bernina vehicle model.
"""
import bpy, pathlib, zipfile, sys, json, hashlib
from mathutils import Vector

app=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path(sys.argv[sys.argv.index('--')+1])
work=app.parents[1]/'tmp'/'swiss-cabin-source';work.mkdir(parents=True,exist_ok=True)
output=app/'public'/'models'/'swiss';output.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(source/'textures.zip') as archive:
 for entry in archive.infolist():
  if entry.is_dir():continue
  target=(work/entry.filename).resolve()
  if not target.is_relative_to(work.resolve()):raise ValueError('Invalid archive path')
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(entry))
for filename in ['train_monorail_TS.obj','train_monorail_TS.mtl']:(work/filename).write_bytes((source/filename).read_bytes())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(work/'train_monorail_TS.obj'))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.update()
mesh=obj.data;world=obj.matrix_world.copy();parent=list(range(len(mesh.vertices)))
def root(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
for edge in mesh.edges:
 a,b=edge.vertices;parent[root(a)]=root(b)
groups={}
for vertex in mesh.vertices:groups.setdefault(root(vertex.index),[]).append(world@vertex.co)
parts=[]
for points in groups.values():
 parts.append({'n':len(points),'lo':[min(p[i] for p in points) for i in range(3)],'hi':[max(p[i] for p in points) for i in range(3)]})
backs=[p for p in parts if p['n']==172 and p['lo'][1]<-.6 and p['hi'][1]<0 and p['lo'][0]>-5.4 and p['hi'][0]<3.4]
cushions=[p for p in parts if p['n']==132 and p['lo'][1]<-.6 and p['hi'][1]<0 and p['lo'][0]>-5.4 and p['hi'][0]<3.4 and .3<p['lo'][2]<p['hi'][2]<.75]
if len(cushions)!=13:raise ValueError('Source seat topology changed; recalibrate before exporting')
def convert(p):return Vector((-p[1]*1.25,(p[0]+1)*1.25,(p[2]-.21525)*1.25))
seats=[]
for index,p in enumerate(sorted(cushions,key=lambda p:-p['lo'][0])):
 center=[(p['lo'][i]+p['hi'][i])/2 for i in range(3)]
 back=min(backs,key=lambda b:abs((b['lo'][0]+b['hi'][0])/2-center[0]));heading=0 if (back['lo'][0]+back['hi'][0])/2>center[0] else 3.141592653589793
 point=convert(center);seats.append({'id':f'R{index+1:02}','x':round(point.x,5),'y':round((p['hi'][2]-.21525)*1.25,5),'z':round(-point.y,5),'heading':heading})
for vertex in mesh.vertices:vertex.co=convert(world@vertex.co)
obj.matrix_world.identity();obj.name='SwissPrototype_Monorail'
for material in bpy.data.materials:
 material.use_nodes=True;nodes=material.node_tree.nodes;nodes.clear();output_node=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeBsdfPrincipled');material.node_tree.links.new(shader.outputs['BSDF'],output_node.inputs['Surface']);shader.inputs['Roughness'].default_value=.72
 stem={'Monorail':'monorail','air_cond':'air_cond','lights':'lights'}.get(material.name)
 if stem:
  image=bpy.data.images.load(str(work/'textures'/(stem+'_diffuse.png')),check_existing=True)
  if max(image.size)>2048:image.scale(2048,2048)
  tex=nodes.new('ShaderNodeTexImage');tex.image=image;material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
 else:
  shader.inputs['Base Color'].default_value=(.78,.87,.88,.12);shader.inputs['Alpha'].default_value=.12;shader.inputs['Roughness'].default_value=.2
  material.surface_render_method='DITHERED'
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'monorail-cabin.glb'),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
meta={'name':'Supplied monorail · Swiss prototype cabin','authenticBerninaVehicle':False,'floorY':0,'aisleHalfWidth':.22,'aisleMinZ':-5.15,'aisleMaxZ':5.25,'seats':seats,'sourceFiles':{name:hashlib.sha256((source/name).read_bytes()).hexdigest() for name in ['train_monorail_TS.obj','train_monorail_TS.mtl','train_monorail_TS.fbx','textures.zip']},'note':'Right window seats calibrated from supplied cushion geometry. Display scale is not a surveyed dimension.'}
(output/'seats.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print('SWISS EXPORT',len(seats),'seats,', (output/'monorail-cabin.glb').stat().st_size,'bytes')
