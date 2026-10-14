import bpy, sys, json, math, os
from mathutils import Vector

config=json.load(open(sys.argv[sys.argv.index('--')+1],encoding='utf-8-sig'))
for asset in config:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=asset['input'])
    objects=list(bpy.context.scene.objects)
    for ob in objects:
        if ob.animation_data:ob.animation_data_clear()
        if ob.type=='ARMATURE':ob.data.pose_position='REST'
    bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    points=[]
    for ob in objects:
        if ob.type!='MESH':continue
        evaluated=ob.evaluated_get(depsgraph);mesh=evaluated.to_mesh()
        points.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
        evaluated.to_mesh_clear()
    if not points:continue
    low=Vector([min(p[i] for p in points) for i in range(3)])
    high=Vector([max(p[i] for p in points) for i in range(3)])
    center=(low+high)/2
    span=max(high-low)
    direction=Vector((.22,-1,.16)).normalized()
    bpy.ops.object.camera_add(location=center+direction*span*3)
    camera=bpy.context.object
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=span*1.08
    scene=bpy.context.scene;scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
        for device in prefs.devices:device.use=device.type!='CPU'
        if any(d.use for d in prefs.devices):scene.cycles.device='GPU'
    except Exception:pass
    scene.world=bpy.data.worlds.new('Preview');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.38,.4,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    for offset,power in [((2,-3,4),650),((-3,-1,2),280),((1,3,3),450)]:
        bpy.ops.object.light_add(type='AREA',location=center+Vector(offset)*span/2)
        light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=span*2
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=scene.render.resolution_y=320;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX';scene.render.filepath=asset['output']
    bpy.ops.render.render(write_still=True)
    # Imported bind bounds can include unused space. Frame the visible render,
    # then render again with the adjusted camera; never alter model geometry.
    preview=bpy.data.images.load(asset['output'],check_existing=False)
    pixels=list(preview.pixels);width,height=preview.size
    visible=[i for i in range(width*height) if pixels[i*4+3]>.03]
    if visible:
        xmin=min(i%width for i in visible);xmax=max(i%width for i in visible)
        ymin=min(i//width for i in visible);ymax=max(i//width for i in visible)
        basis=camera.rotation_euler.to_quaternion()
        offset_x=((xmin+xmax+1)/2/width-.5)*camera.data.ortho_scale
        offset_y=((ymin+ymax+1)/2/height-.5)*camera.data.ortho_scale
        camera.location+=(basis@Vector((1,0,0)))*offset_x+(basis@Vector((0,1,0)))*offset_y
        camera.data.ortho_scale*=max((xmax-xmin+1)/width,(ymax-ymin+1)/height)*1.16
        bpy.ops.render.render(write_still=True)
    bpy.data.images.remove(preview)
    print('POSTER '+asset['id'],flush=True)
