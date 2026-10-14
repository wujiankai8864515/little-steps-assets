export function requireModelName(value){
 const name=typeof value==='string'?value.trim():'';
 if(!name||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw Object.assign(Error('请先填写 1–60 字的模型名称'),{code:'MODEL_NAME_REQUIRED',nextAction:{instruction:'使用用户指定的模型名称填写 name；模型名称与工作台名称分别保存。'}});
 return name;
}
