import {hash} from './glb.mjs';
export const planSelectionKey=p=>hash(JSON.stringify({modelId:p?.modelId||null,motions:(p?.motions||[]).map(m=>({key:m.key,ref:m.selectedRef||null,required:m.required!==false})),constraints:p?.constraints||{}}));
