// CLI and MCP derive their command list from this single registry.
export const commandDefinitions={
 library:['POST','catalog/library'],state:['GET','state'],settings:['GET','settings'],search:['POST','catalog/search'],inspect:['POST','catalog/inspect'],
 plan:['POST','plan'],'plan-status':['GET',b=>'plans/'+encodeURIComponent(b.id)],
 plans:['POST','plans/search'],'motion-quality':['POST','motion-quality'],'quote-status':['GET',b=>'quotes/'+encodeURIComponent(b.quoteId)],handoff:['POST','handoff'],
 import:['POST','import-path'],preview:['POST','motion-preview'],'preview-status':['GET',b=>'motion-previews/'+encodeURIComponent(b.id)],
 'model-name':['POST','models/name'],'rig-adopt':['POST','rigging/adopt'],compose:['POST','compose'],'remove-motions':['POST','remove-motions'],
 frames:['POST','frames'],render:['POST','render'],'save-view':['POST','frame-presets'],'view-cache':['POST','render-view/lookup'],
 'sprite-preview':['POST','sprite-preview'],'group-sprites':['POST','sprite-sets'],'sprite-set':['GET',b=>'sprite-sets/'+encodeURIComponent(b.id)],'sprite-playback':['POST',b=>'sprite-sets/'+encodeURIComponent(b.id)+'/playback'],
 'asset-flow':['POST','asset-flow'],'flow-layout':['POST','asset-flow/layout'],
 'workspace-name':['POST','workspace/name'],'workspace-draft':['POST','workspace/draft'],'workspace-select':['POST','workspace/select'],'workspace-selection':['POST','workspace/selection'],'workspace-compose':['POST','workspace/compose'],'workspace-complete':['POST','workspace/complete'],'workspace-export':['POST','workspace/export'],'workspace-onion':['POST','workspace/onion'],
 'onion-preview':['POST','onion-preview'],'review-options':['GET','frame-review-options'],'review-frames':['POST','frame-reviews'],'review-status':['GET',b=>'frame-reviews/'+encodeURIComponent(b.id)],'review-result':['POST',b=>'frame-reviews/'+encodeURIComponent(b.id)+'/decision'],
 'save-frames':['POST',b=>'render-view/'+encodeURIComponent(b.id)+'/save'],upload:['POST','prepare-upload'],
 'generation-draft':['POST','generation/draft'],quote:['POST','quote'],submit:['POST','submit'],profile:['POST','profiles'],
 job:['GET',b=>'jobs/'+encodeURIComponent(b.id)],wait:['GET',b=>'jobs/'+encodeURIComponent(b.id)],
 cancel:['POST',b=>'jobs/'+encodeURIComponent(b.id)+'/cancel'],retry:['POST',b=>'jobs/'+encodeURIComponent(b.id)+'/retry'],
 quality:['POST',b=>'assets/'+encodeURIComponent(b.id)+'/quality'],role:['POST',b=>'assets/'+encodeURIComponent(b.id)+'/role'],
 annotate:['POST',b=>'assets/'+encodeURIComponent(b.id)+'/annotations'],resume:['POST',b=>'jobs/'+encodeURIComponent(b.id)+'/resume-remote']
};
export const commandNames=Object.keys(commandDefinitions);
