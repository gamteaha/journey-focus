"""Blender 4.5: paint and rig the supplied mesh; never edit white_mesh.glb.
Run blender --background --factory-startup --python this_file -- --render
"""
import bpy
import json
import math
import sys
import numpy as np
from pathlib import Path
from mathutils import Vector, Quaternion

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PUBLIC = ROOT / 'apps/journey-focus/public/models'
REVIEW = ROOT / 'tmp/character-rig-review'
PUBLIC.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)
HEIGHT = 1.25
HIP = HEIGHT * .095
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(HERE / 'white_mesh.glb'))
model = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
model.name = 'FlameCharacter'
model.select_set(True)
bpy.context.view_layer.objects.active = model
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
points = [v.co.copy() for v in model.data.vertices]
lo = Vector([min(v[i] for v in points) for i in range(3)])
hi = Vector([max(v[i] for v in points) for i in range(3)])
scale = HEIGHT / (hi.z-lo.z)
for v in model.data.vertices:
    v.co = (v.co - Vector(((hi.x+lo.x)/2, (hi.y+lo.y)/2, lo.z))) * scale
for face in model.data.polygons:
    face.use_smooth = True
model.data.update()

def srgb(value):
    return value/12.92 if value <= .04045 else ((value+.055)/1.055)**2.4

materials = {}
for name, color in {
    'Flame':'315fc1', 'Suit':'263452', 'Ivory':'f7f6ef',
    'Cheeks':'ffda32', 'Eyes':'244689', 'Nose':'244781',
    'Trousers':'d4d9df', 'Mouth':'39465e',
}.items():
    rgb = tuple(srgb(int(color[i:i+2],16)/255) for i in (0,2,4))
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb,1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb,1)
    bsdf.inputs['Roughness'].default_value = .62 if name == 'Flame' else .78
    materials[name] = mat
model.data.materials.clear()
for mat in materials.values():
    model.data.materials.append(mat)
indices = {name:i for i,name in enumerate(materials)}

def ellipse(x,z,cx,cz,rx,rz):
    return ((x-cx)/rx)**2 + ((z-cz)/rz)**2 < 1

def width_at(z):
    samples = [(.30,.015),(.34,.11),(.40,.158),(.47,.17),(.53,.155),(.58,.125),(.63,.077),(.71,0)]
    for (a,x),(b,y) in zip(samples,samples[1:]):
        if a <= z <= b:
            return x+(y-x)*(z-a)/(b-a)
    return 0

def region(p):
    x,y,z = p / HEIGHT
    face_x = x + .012
    if z >= .295:
        if y < -.065:
            if ellipse(x,z,-.112,.636,.034,.038) or ellipse(x,z,.098,.636,.034,.038):
                return 'Ivory'
            if abs(face_x) < width_at(z):
                if any(ellipse(face_x,z,s*.108,.449,.043,.035) for s in (-1,1)):
                    return 'Cheeks'
                if any(ellipse(face_x,z,s*.061,.519,.027,.030) for s in (-1,1)):
                    return 'Eyes'
                if .025 < abs(face_x) < .103 and abs(z-(.548+.18*abs(face_x))) < .007:
                    return 'Eyes'
                if ellipse(face_x,z,0,.480,.019,.012):
                    return 'Nose'
                if abs(face_x) < .036 and abs(z-(.418+.007*(face_x/.036)**2)) < .0035:
                    return 'Mouth'
                return 'Ivory'
        return 'Flame'
    # The tail is behind the body, not the sleeve on the same side.
    if x > .055 and y > .06 and z < .18:
        return 'Flame'
    if z < .10:
        return 'Ivory' if z < .027 else 'Trousers'
    if z > .280 and abs(x) < .075:
        return 'Ivory'
    if abs(x) > .080 and .12 < z < .280:
        if .145 < z < .172:
            return 'Ivory' if (.150 < z < .154 or .162 < z < .166) else 'Suit'
        return 'Ivory'
    if .104 < z < .110:
        return 'Ivory'
    if y < -.025:
        if abs(x) < .0035 and any(abs(z-v) < .0035 for v in [.16,.19,.22,.25]):
            return 'Ivory'
        # Small varsity I on the original jacket's chest.
        if .036 < x < .056 and (.212 < z < .216 or .235 < z < .239 or (.043 < x < .049 and .212 < z < .239)):
            return 'Ivory'
    return 'Suit'

for face in model.data.polygons:
    center = sum((model.data.vertices[i].co for i in face.vertices),Vector()) / len(face.vertices)
    face.material_index = indices[region(center)]

# Paint into an unwrapped atlas instead of assigning triangle-shaped colour
# boundaries. Every texel is evaluated from its original 3D surface position.
bpy.context.view_layer.objects.active = model
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.012)
bpy.ops.object.mode_set(mode='OBJECT')
palette = {name:np.array([int(color[i:i+2],16)/255 for i in (0,2,4)],dtype=np.float32) for name,color in {
    'Flame':'315fc1','Suit':'263452','Ivory':'f7f6ef','Cheeks':'ffda32','Eyes':'244689','Nose':'244781','Trousers':'d4d9df','Mouth':'39465e'
}.items()}

def paint(positions):
    x,y,z = (positions / HEIGHT).T
    xf = x+.012
    colors = np.tile(palette['Suit'],(len(x),1))
    def put(name,mask):
        colors[mask] = palette[name]
    put('Ivory',z<.027)
    put('Trousers',(z>=.027)&(z<.10))
    put('Ivory',(z>.280)&(np.abs(x)<.075))
    sleeve = (np.abs(x)>.080)&(z>.12)&(z<.280)
    put('Ivory',sleeve)
    put('Suit',sleeve&(z>.145)&(z<.172))
    put('Ivory',sleeve&(((z>.150)&(z<.154))|((z>.162)&(z<.166))))
    put('Ivory',(z>.104)&(z<.110))
    put('Ivory',(y<-.025)&(np.abs(x)<.0035)&np.any(np.abs(z[:,None]-np.array([.16,.19,.22,.25]))<.0035,axis=1))
    put('Ivory',(y<-.025)&(x>.036)&(x<.056)&(((z>.212)&(z<.216))|((z>.235)&(z<.239))|((x>.043)&(x<.049)&(z>.212)&(z<.239))))
    put('Flame',(x>.055)&(y>.06)&(z<.18))
    head = z>=.295
    put('Flame',head)
    front = head&(y<-.065)
    knots = np.array([.30,.34,.40,.47,.53,.58,.63,.71])
    values = np.array([.015,.11,.158,.17,.155,.125,.077,0])
    slopes = np.gradient(values,knots)
    segment = np.clip(np.searchsorted(knots,z)-1,0,len(knots)-2)
    span = knots[segment+1]-knots[segment]
    t = np.clip((z-knots[segment])/span,0,1)
    widths = (2*t**3-3*t**2+1)*values[segment]+(t**3-2*t**2+t)*span*slopes[segment]+(-2*t**3+3*t**2)*values[segment+1]+(t**3-t**2)*span*slopes[segment+1]
    widths[(z<knots[0])|(z>knots[-1])] = 0
    face = front&(np.abs(xf)<widths)
    put('Ivory',face)
    def ell(cx,cz,rx,rz):
        return ((x-cx)/rx)**2+((z-cz)/rz)**2<1
    put('Ivory',front&(ell(-.112,.636,.034,.038)|ell(.098,.636,.034,.038)))
    put('Cheeks',face&(ell(-.120,.449,.043,.035)|ell(.096,.449,.043,.035)))
    put('Eyes',face&(ell(-.073,.519,.027,.030)|ell(.049,.519,.027,.030)))
    put('Eyes',face&(np.abs(xf)>.025)&(np.abs(xf)<.103)&(np.abs(z-(.548+.18*np.abs(xf)))<.007))
    put('Nose',face&ell(-.012,.480,.019,.012))
    put('Mouth',face&(np.abs(xf)<.036)&(np.abs(z-(.418+.007*(xf/.036)**2))<.0035))
    # Small highlights stay with the eye pixels, rather than separate objects.
    put('Ivory',face&(ell(-.078,.530,.005,.005)|ell(.044,.530,.005,.005)))
    return colors

size = 2048
pixels = np.ones((size,size,4),dtype=np.float32)
pixels[:,:,:3] = palette['Flame']
filled = np.zeros((size,size),dtype=bool)
uvdata = model.data.uv_layers.active.data
for face in model.data.polygons:
    uv = np.array([uvdata[i].uv[:] for i in face.loop_indices],dtype=np.float64)*(size-1)
    xyz = np.array([model.data.vertices[i].co[:] for i in face.vertices],dtype=np.float64)
    low = np.maximum(0,np.floor(uv.min(axis=0)).astype(int))
    high = np.minimum(size-1,np.ceil(uv.max(axis=0)).astype(int))
    if np.any(high<low):
        continue
    yy,xx = np.mgrid[low[1]:high[1]+1,low[0]:high[0]+1]
    denominator = (uv[1,1]-uv[2,1])*(uv[0,0]-uv[2,0])+(uv[2,0]-uv[1,0])*(uv[0,1]-uv[2,1])
    if abs(denominator)<1e-10:
        continue
    a = ((uv[1,1]-uv[2,1])*(xx-uv[2,0])+(uv[2,0]-uv[1,0])*(yy-uv[2,1]))/denominator
    b = ((uv[2,1]-uv[0,1])*(xx-uv[2,0])+(uv[0,0]-uv[2,0])*(yy-uv[2,1]))/denominator
    c = 1-a-b
    inside = (a>=-1e-7)&(b>=-1e-7)&(c>=-1e-7)
    if not np.any(inside):
        continue
    world = a[inside,None]*xyz[0]+b[inside,None]*xyz[1]+c[inside,None]*xyz[2]
    pixels[yy[inside],xx[inside],:3] = paint(world)
    filled[yy[inside],xx[inside]] = True
for _ in range(5):
    old = filled.copy()
    for axis,offset in [(0,1),(0,-1),(1,1),(1,-1)]:
        available = np.roll(old,offset,axis=axis)&~filled
        pixels[available] = np.roll(pixels,offset,axis=axis)[available]
        filled[available] = True
image = bpy.data.images.new('Flame character paint',width=size,height=size,alpha=True)
image.colorspace_settings.name = 'sRGB'
image.pixels.foreach_set(pixels.ravel())
image.filepath_raw = str(HERE / 'blue-flame-basecolor.png')
image.file_format = 'PNG'
image.save()
image.pack()
for mat in materials.values():
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (1,1,1,1)
    texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    mat.node_tree.links.new(texture.outputs['Color'],bsdf.inputs['Base Color'])

# One armature, hand-authored normalized weights, at most four influences.
data = bpy.data.armatures.new('FlameSkeleton')
rig = bpy.data.objects.new('FlameRig',data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
model.select_set(False)
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')

def bone(name, head, tail, parent=None):
    b = data.edit_bones.new(name)
    b.head = Vector(head) * HEIGHT
    b.tail = Vector(tail) * HEIGHT
    if parent:
        b.parent = data.edit_bones[parent]
    return b

bone('Root',(0,0,0),(0,0,.04))
bone('Hips',(0,0,.095),(0,0,.15),'Root')
bone('Spine',(0,0,.15),(0,0,.285),'Hips')
bone('Head',(0,0,.285),(0,0,.72),'Spine')
for sign,side in [(-1,'R'),(1,'L')]:
    bone('UpperArm.'+side,(sign*.085,0,.269),(sign*.122,0,.193),'Spine')
    bone('Forearm.'+side,(sign*.122,0,.193),(sign*.128,-.004,.133),'UpperArm.'+side)
    bone('Thigh.'+side,(sign*.034,0,.095),(sign*.040,-.003,.053),'Hips')
    bone('Shin.'+side,(sign*.040,-.003,.053),(sign*.043,-.01,.015),'Thigh.'+side)
bone('Tail',(.08,.025,.115),(.23,.06,.15),'Hips')
bpy.ops.object.mode_set(mode='OBJECT')
rig['avatarHeight'] = HEIGHT
rig['avatarHipHeight'] = HIP
rig['sourceModel'] = 'user-supplied white_mesh.glb'
rig['rigVersion'] = 1
model.parent = rig
modifier = model.modifiers.new('Flame armature','ARMATURE')
modifier.object = rig
modifier.use_deform_preserve_volume = False
groups = {b.name:model.vertex_groups.new(name=b.name) for b in data.bones}

def clamp(v):
    return max(0,min(1,v))

def smooth(v):
    t = clamp(v)
    return t*t*(3-2*t)

for vertex in model.data.vertices:
    x,y,z = vertex.co / HEIGHT
    side = 'L' if x >= 0 else 'R'
    if z > .31:
        weights = {'Head':1}
    elif z > .278:
        head = smooth((z-.278)/.032)
        weights = {'Head':head,'Spine':1-head}
    elif y > .045 and .045 < z < .18:
        t = smooth((x-.055)/.05)*smooth((y-.05)/.03)
        weights = {'Tail':t,'Hips':1-t}
    elif z < .115:
        limb = smooth((.117-z)/.035)
        knee = smooth((.067-z)/.028)
        weights = {'Hips':1-limb,'Thigh.'+side:limb*(1-knee),'Shin.'+side:limb*knee}
    else:
        arm = smooth((abs(x)-.070)/.035)*smooth((.298-z)/.035)*smooth((z-.105)/.030)
        elbow = smooth((.207-z)/.035)
        spine = smooth((z-.13)/.05)
        weights = {'Hips':(1-arm)*(1-spine),'Spine':(1-arm)*spine,'UpperArm.'+side:arm*(1-elbow),'Forearm.'+side:arm*elbow}
    weights = {k:v for k,v in weights.items() if v > .00001}
    total = sum(weights.values())
    for name,value in weights.items():
        groups[name].add([vertex.index],value/total,'REPLACE')

# Rotate about the character's width axis in each bone's rest coordinates.
def rotate(name, angle, axis=(1,0,0)):
    b = rig.pose.bones[name]
    local = b.bone.matrix_local.to_quaternion().inverted() @ Vector(axis)
    b.rotation_quaternion = Quaternion(local,angle)

def reset_pose():
    for b in rig.pose.bones:
        b.rotation_mode = 'QUATERNION'
        b.rotation_quaternion = Quaternion()
        b.location = (0,0,0)
        b.scale = (1,1,1)

rig.animation_data_create()
actions = {}
for name,frames in [('Idle',range(1,32,3)),('Walk',range(1,26,2)),('Sit',[1,13])]:
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    actions[name] = action
    for frame in frames:
        reset_pose()
        if name == 'Walk':
            phase = (frame-1)/24*2*math.pi
            for i,side in enumerate(['L','R']):
                swing = math.sin(phase+i*math.pi)*.48
                rotate('Thigh.'+side,swing)
                rotate('Shin.'+side,max(0,-swing)*.65)
                rotate('UpperArm.'+side,-swing*.30)
                rotate('Forearm.'+side,-.06)
            rig.pose.bones['Root'].location.z = abs(math.sin(phase))*HEIGHT*.006
            rotate('Tail',math.sin(phase)*.08,axis=(0,0,1))
        elif name == 'Sit':
            for side in ['L','R']:
                rotate('Thigh.'+side,-math.pi/2)
                rotate('Shin.'+side,math.pi/2)
                rotate('UpperArm.'+side,-.10)
                rotate('Forearm.'+side,-.08)
        else:
            phase = (frame-1)/30*2*math.pi
            rotate('Spine',math.sin(phase)*.008)
            rotate('Head',math.sin(phase)*.009,axis=(0,0,1))
        for b in rig.pose.bones:
            b.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=b.name)
            b.keyframe_insert(data_path='location',frame=frame,group=b.name)

scene = bpy.context.scene
scene.render.fps = 24
rig.animation_data.action = actions['Idle']
scene.frame_set(1)
reset_pose()
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
model.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(PUBLIC / 'blue-flame.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_extras=True)

report = {'height':HEIGHT,'hipHeight':HIP,'triangles':sum(len(p.vertices)-2 for p in model.data.polygons),'bones':list(groups),'actions':list(actions),'materials':list(materials),'source':'white_mesh.glb','output':'apps/journey-focus/public/models/blue-flame.glb'}
with (HERE / 'rig-info.json').open('w',encoding='utf8') as handle:
    json.dump(report,handle,ensure_ascii=False,indent=2)

# Editable .blend plus optional real 3D renders of the exported design.
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.render.resolution_x = 768
scene.render.resolution_y = 896
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('Studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.12,.15,.20,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7
scene.view_settings.view_transform = 'AgX'
def aim(obj,target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(-3,-4,5),400,4),('Fill',(4,-2,3),220,3),('Rim',(0,3,4),500,3)]:
    lamp = bpy.data.lights.new(name,'AREA')
    lamp.energy = power
    lamp.shape = 'DISK'
    lamp.size = size
    obj = bpy.data.objects.new(name,lamp)
    scene.collection.objects.link(obj)
    obj.location = pos
    aim(obj,(0,0,HEIGHT*.5))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008))
floor = bpy.context.object
floor.name = 'Studio floor'
mat = bpy.data.materials.new('Studio ground')
mat.diffuse_color = (.15,.18,.23,1)
floor.data.materials.append(mat)
camera_data = bpy.data.cameras.new('Review camera')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = HEIGHT*1.28
camera = bpy.data.objects.new('Review camera',camera_data)
scene.collection.objects.link(camera)
camera.location = (0,-4,HEIGHT*.56)
aim(camera,(0,0,HEIGHT*.50))
scene.camera = camera
rig.animation_data.action = actions['Idle']
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
model.select_set(True)
bpy.context.view_layer.objects.active = model
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'blue-flame-rigged.blend'))
if '--render' in sys.argv or '--render-sit' in sys.argv:
    for name,action,frame,pos in [('01-painted-front','Idle',1,(0,-4,HEIGHT*.56)),('02-walking','Walk',7,(2.5,-4,HEIGHT*.70)),('03-seated','Sit',13,(2.5,-4,HEIGHT*.65))]:
        if '--render-sit' in sys.argv and action != 'Sit':
            continue
        rig.animation_data.action = actions[action]
        scene.frame_set(frame)
        camera.location = pos
        aim(camera,(0,0,HEIGHT*.50))
        scene.render.filepath = str(REVIEW / (name+'.png'))
        bpy.ops.render.render(write_still=True)
print('CHARACTER_READY '+json.dumps(report))
