import {get,list,put,now,transaction} from './store.mjs';
import {modelLibrary} from '../shared/model-library.mjs';
import {requireModelName} from '../shared/model-name.mjs';

export function nameModel(body){
 const name=requireModelName(body.name),a=get('assets',body.modelId);
 const group=modelLibrary(list('assets')).find(g=>g.versions.some(v=>v.id===a?.id));
 if(!group)throw Error('请选择模型库中的模型');
 transaction(()=>{
  for(const version of group.versions){
   const prefix=version.modelName||group.name;
   const suffix=version.name.startsWith(prefix+' · ')?version.name.slice(prefix.length):'';
   put('assets',{...version,name:name+suffix,modelName:name,nameSource:'user',namedAt:now()});
  }
 });
 return {familyId:group.key,name,modelId:a.id,asset:get('assets',a.id)};
}
