export function rawMotionName(clip, asset) {
  if(/^战术主角\s*·\s*拳击（Mixamo 绑定版）$/.test(clip.name))return 'Punching_Bag';
  if(/^战术主角\s*·\s*行走转身（Mixamo 绑定版）$/.test(clip.name))return 'Catwalk_Walk_Turn_180_Tight';
  const generic=(!clip.name||/^(?:Animation(?:\.\d+)?|Take\s*\d+|Default Take)$/i.test(clip.name)||/(?:^|\|)mixamo\.com(?:\||$)/i.test(clip.name));
  if(!generic)return clip.name;
  const filename=asset?.package?.entry?.split('/').pop()?.replace(/\.[^.]+$/,'');
  const fallback=asset?.name?.includes('拳击（Mixamo')?'Punching_Bag':asset?.name?.includes('行走转身（Mixamo')?'Catwalk_Walk_Turn_180_Tight':asset?.name||'未命名动作';
  const name=filename&&!/^(model|character)$/i.test(filename)?filename:fallback;
  return (asset?.metadata.animations?.length||0)>1?name+' · '+(clip.index+1):name;
}
export const motionKey = name => name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g,'');
export function motionName(raw='') {
  const known={Walking:'行走',Running:'奔跑',Punching_Bag:'拳击','Punching Bag':'拳击',Catwalk_Walk_Turn_180_Tight:'行走转身','Catwalk Walk Turn 180 Tight':'行走转身',TPose:'站立参考姿势',A_TPose:'站立参考姿势',Interact:'互动',Jog_Fwd_Loop:'向前慢跑',PickUp_Table:'拾取物品',Punch_Cross:'后手直拳',Punch_Jab:'前手直拳',Push_Loop:'推物体',Walk_Formal_Loop:'正式步行',Pistol_Reload:'手枪换弹',Pistol_Aim_Down:'手枪向下瞄准',Pistol_Aim_Up:'手枪向上瞄准',Pistol_Aim_Neutral:'手枪瞄准',Sitting_Enter:'坐下',Sitting_Exit:'站起',Spell_Simple_Enter:'施法准备',Spell_Simple_Exit:'结束施法',Spell_Simple_Idle_Loop:'施法待机',Spell_Simple_Shoot:'释放法术'};
  if(known[raw])return known[raw];
  if(raw.startsWith('longbow__')) {
    const names={fall_a_land_to_run_forward:'落地向前跑',fall_a_land_to_standing_idle_01:'落地站稳',fall_a_loop:'空中下落',standing_aim_overdraw:'拉弓瞄准',standing_aim_recoil:'放箭',standing_aim_walk_back:'瞄准后退',standing_aim_walk_forward:'瞄准前进',standing_aim_walk_left:'瞄准左移',standing_aim_walk_right:'瞄准右移',standing_block:'格挡',standing_death_backward_01:'向后倒地',standing_death_forward_01:'向前倒地',standing_disarm_bow:'收起弓',standing_dive_forward:'向前扑跃',standing_dodge_backward:'向后闪避',standing_dodge_forward:'向前闪避',standing_dodge_left:'向左闪避',standing_dodge_right:'向右闪避',standing_draw_arrow:'取箭',standing_equip_bow:'拿起弓',standing_idle_01:'持弓待机',standing_idle_02_looking:'持弓观察',standing_idle_03_examine:'检查弓',standing_melee_kick:'踢击',standing_melee_punch:'出拳',standing_react_small_from_front:'正面受击',standing_react_small_from_headshot:'头部受击',standing_run_back:'向后跑',standing_run_forward:'向前跑',standing_run_forward_stop:'跑步停下',standing_run_left:'向左跑',standing_run_right:'向右跑',standing_turn_90_left:'向左转身',standing_turn_90_right:'向右转身',standing_walk_back:'向后走',standing_walk_forward:'向前走',standing_walk_left:'向左走',standing_walk_right:'向右走',unarmed_idle_01:'空手待机'};
    const short=raw.slice(9);if(names[short])return '弓手 · '+names[short];
  }
  const words=[[/^UAL[12][_ -]?/g,''],[/T[-_ ]?Pose/gi,'站立参考姿势'],[/Hit_Chest/gi,'胸部受击'],[/Hit_Head/gi,'头部受击'],[/Fixing_Kneeling/gi,'跪姿修理'],[/Idle/gi,'待机'],[/Walking|Walk/gi,'行走'],[/Running|Run/gi,'奔跑'],[/Sprint/gi,'冲刺'],[/Jump/gi,'跳跃'],[/Punch/gi,'出拳'],[/Kick/gi,'踢击'],[/Death/gi,'倒地'],[/Roll/gi,'翻滚'],[/Attack/gi,'攻击'],[/Crouch/gi,'下蹲'],[/Aim/gi,'瞄准'],[/Shoot/gi,'射击'],[/Longbow/gi,'长弓'],[/Standing/gi,'站立'],[/Forward|Fwd/gi,'向前'],[/Backward|Bwd/gi,'后退'],[/Left/gi,'向左'],[/Right/gi,'向右'],[/Strafe/gi,'侧移'],[/Sword/gi,'剑'],[/Pistol/gi,'手枪'],[/Rifle/gi,'步枪'],[/Dance/gi,'跳舞'],[/Talking/gi,'说话'],[/Torch/gi,'持火把'],[/Driving/gi,'驾驶'],[/Sitting/gi,'坐姿'],[/Swimming|Swim/gi,'游泳'],[/Start/gi,'开始'],[/End/gi,'结束'],[/Land/gi,'落地'],[/_Loop/gi,''],[/[_-]+/g,' ']];
  return words.reduce((s,[pattern,value])=>s.replace(pattern,value),raw).trim();
}
export function motionCategory(label) {
  if(/行走|奔跑|冲刺|侧移|下蹲|跳跃|翻滚|游泳/.test(label))return '移动';
  if(/拳|踢|攻击|剑|枪|射击|长弓|瞄准|倒地|受击/.test(label))return '战斗';
  return '日常';
}
