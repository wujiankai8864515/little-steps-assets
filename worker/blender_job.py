import bpy,sys,json,os,math,traceback
from mathutils import Vector

def event(stage,done=0,total=0):
 print('WB:'+json.dumps(dict(stage=stage,done=done,total=total),ensure_ascii=False),flush=True)

def load(p):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 ext=os.path.splitext(p)[1].lower()
 if ext in ('.glb','.gltf'): bpy.ops.import_scene.gltf(filepath=p)
 elif ext=='.fbx': bpy.ops.import_scene.fbx(filepath=p,automatic_bone_orientation=False)
 elif ext=='.obj': bpy.ops.wm.obj_import(filepath=p)
 elif ext=='.bvh': bpy.ops.import_anim.bvh(filepath=p)
 else: raise ValueError('不支持此格式')
 for arm in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
  arm['workbenchBoneNames']=[b.name for b in arm.data.bones]
 return list(bpy.context.scene.objects),list(bpy.data.actions)

def export_glb(out):
 params=dict(filepath=out,export_format='GLB',export_animations=True,export_skins=True,export_extras=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True)
 supported=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
 bpy.ops.export_scene.gltf(**{k:v for k,v in params.items() if k in supported})

def set_action(objects,actions,clip):
 # bpy.data.actions sorts names; its order is not the source GLB animation order.
 matches=[a for a in actions if a.name==clip['name']]
 if not matches:matches=[a for a in actions if a.name.startswith(clip['name']+'_') or a.name.startswith(clip['name']+'.')]
 if len(matches)!=1:
  if len(actions)==1:matches=actions
  else:raise ValueError('无法唯一匹配动作名称：'+clip['name'])
 action=matches[0]
 arms=[o for o in objects if o.type=='ARMATURE']
 if len(arms)!=1: raise ValueError('序列帧目前需要一个角色骨架，请拆分多角色场景')
 arm=arms[0];ad=arm.animation_data_create()
 for track in ad.nla_tracks: track.mute=True
 ad.action=action
 if hasattr(action,'slots') and len(action.slots): ad.action_slot=action.slots[0]
 return action,arm

def camera_setup(center,span,azimuth):
 scene=bpy.context.scene
 d=Vector((math.sin(math.radians(azimuth)),-math.cos(math.radians(azimuth)),.38)).normalized()
 bpy.ops.object.camera_add(location=center+d*span*3)
 cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=span*1.22;scene.camera=cam
 for loc,power,size in [((2,-3,4),700,4),((-3,-1,2),350,3),((1,3,3),600,3)]:
  bpy.ops.object.light_add(type='AREA',location=center+Vector(loc)*span/2);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size*span/2;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
 scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.36,.4,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
 return cam

def run(cfg):
 event('读取模型');objects,actions=load(cfg['input']);mode=cfg['mode'];out=cfg['output'];os.makedirs(out,exist_ok=True)
 if mode=='import':
  # Imported takes may share names. Exporter preserves each actual action, no synthetic motion.
  event('封装模型与动作');export_glb(os.path.join(out,'model.glb'));return dict(file='model.glb')
 if mode=='mixamo':
  for ob in objects:
   if ob.animation_data: ob.animation_data_clear()
   if ob.type=='ARMATURE': ob.data.pose_position='REST'
  if cfg.get('unrigged',True):
   for ob in objects:
    if ob.type=='MESH':
     matrix=ob.matrix_world.copy();ob.parent=None;ob.matrix_world=matrix
     for mod in list(ob.modifiers):
      if mod.type=='ARMATURE':ob.modifiers.remove(mod)
     ob.vertex_groups.clear()
   for ob in list(objects):
    if ob.type=='ARMATURE':bpy.data.objects.remove(ob,do_unlink=True)
  bpy.ops.object.select_all(action='DESELECT')
  for ob in bpy.context.scene.objects:
   if ob.type in {'MESH','ARMATURE'}:ob.select_set(True)
  event('导出上传文件');bpy.ops.export_scene.fbx(filepath=os.path.join(out,'upload.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},add_leaf_bones=False,bake_anim=False,path_mode='COPY',embed_textures=cfg.get('textures',False),axis_forward='-Z',axis_up='Y');return dict(file='upload.fbx')
 if mode=='render':
  scene=bpy.context.scene;source_fps=scene.render.fps/scene.render.fps_base;settings=cfg['settings'];fps=int(settings.get('fps',24));size=int(settings.get('size',512));loop=bool(settings.get('loop',False));scene.render.fps=fps
  scene.render.engine='CYCLES'
  scene.cycles.samples=16;scene.cycles.use_denoising=True
  # CPU rendering also works on hosts without compatible GPU drivers.
  try:
   prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
   for device in prefs.devices:device.use=device.type!='CPU'
   if any(d.use for d in prefs.devices):scene.cycles.device='GPU'
  except Exception:pass
  scene.render.resolution_x=scene.render.resolution_y=size;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX'
  chosen=cfg['clips'];schedule=[];mins=Vector((float('inf'),)*3);maxs=Vector((float('-inf'),)*3)
  angle=math.radians(float(settings.get('azimuth',0)));direction=Vector((math.sin(angle),-math.cos(angle),.38)).normalized();right=Vector((math.cos(angle),math.sin(angle),0));up=direction.cross(right);screen_min=[float('inf')]*2;screen_max=[float('-inf')]*2
  if not chosen:raise ValueError('请选择至少一个动作')
  for clip in chosen:
   action,arm=set_action(objects,actions,clip);start,end=action.frame_range;duration=clip['duration'];count=max(1,math.ceil(duration*fps));times=[i/fps for i in range(count)]
   if not loop and (not times or abs(times[-1]-duration)>1e-5):times.append(duration)
   schedule.append(dict(clip=clip,times=times,start=float(start),end=float(end)))
  total=sum(len(s['times']) for s in schedule)
  if total>720:raise ValueError('一次最多渲染 720 帧，请减少片段或帧率')
  scanned=0
  for seg in schedule:
   action,arm=set_action(objects,actions,seg['clip'])
   for sec in seg['times']:
    frame=sec*source_fps;scene.frame_set(int(frame),subframe=frame-int(frame));dg=bpy.context.evaluated_depsgraph_get()
    for ob in objects:
     if ob.type=='MESH':
      ev=ob.evaluated_get(dg)
      for corner in ev.bound_box:
       pt=ev.matrix_world@Vector(corner)
       for k in range(3):mins[k]=min(mins[k],pt[k]);maxs[k]=max(maxs[k],pt[k])
       for k,axis in enumerate((right,up)):screen_min[k]=min(screen_min[k],pt.dot(axis));screen_max[k]=max(screen_max[k],pt.dot(axis))
    scanned+=1
   event('计算统一取景',scanned,total)
  if not all(math.isfinite(v) for v in mins):raise ValueError('这个资产没有可渲染的网格')
  center=right*((screen_min[0]+screen_max[0])/2)+up*((screen_min[1]+screen_max[1])/2)+direction*((mins+maxs)/2).dot(direction);span=max(screen_max[0]-screen_min[0],screen_max[1]-screen_min[1],.1);cam=camera_setup(center,span,float(settings.get('azimuth',0)));done=0;meta=dict(fps=fps,size=size,loop=loop,rootMotion='preserved',camera=dict(location=list(cam.location),rotation=list(cam.rotation_euler),scale=cam.data.ortho_scale),worldOrigin=[0,0,0],pivot=[.5-center.dot(right)/cam.data.ortho_scale,.5+center.dot(up)/cam.data.ortho_scale],clips=[])
  for si,seg in enumerate(schedule):
   action,arm=set_action(objects,actions,seg['clip']);folder=f'clip_{si:02d}';os.makedirs(os.path.join(out,folder),exist_ok=True);frames=[]
   for fi,sec in enumerate(seg['times']):
    frame=sec*source_fps;scene.frame_set(int(frame),subframe=frame-int(frame));name=f'{folder}/{fi:04d}.png';scene.render.filepath=os.path.join(out,name);bpy.ops.render.render(write_still=True);frames.append(dict(file=name,time=sec));done+=1;event('渲染透明序列帧',done,total)
   meta['clips'].append(dict(name=seg['clip']['name'],duration=seg['clip']['duration'],frames=frames))
  json.dump(meta,open(os.path.join(out,'frames.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2);bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'scene.blend'));return dict(file='frames.json')
 raise ValueError('未知处理类型')

try:
 cfg=json.load(open(sys.argv[sys.argv.index('--')+1],encoding='utf-8-sig'));result=run(cfg);json.dump(result,open(os.path.join(cfg['output'],'result.json'),'w'),ensure_ascii=False);print('WB:'+json.dumps({'stage':'处理完成'}),flush=True)
except Exception as exc:
 print('WB_ERROR:'+str(exc),flush=True);traceback.print_exc();sys.exit(1)
