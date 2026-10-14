"""One process owns observed quotes. Stdout is JSON RPC; credentials never leave it."""
import sys,os,json,contextlib
from pathlib import Path
runtime=Path(sys.argv[1]);sys.path.insert(0,str(runtime/'core'/'runtime'))
credentials=Path.home()/'.config'/'lux3d'/'credentials.json'
if credentials.exists():
 c=json.loads(credentials.read_text(encoding='utf-8-sig'))
 for region,var in [('international','LUX3D_GLOBAL_API_KEY'),('cn','LUX3D_CN_API_KEY')]:
  if c.get('apiKeys',{}).get(region):os.environ[var]=c['apiKeys'][region]
import lux3d_client as api
from commerce_client import CommerceClient
from workflow_contracts import SubmissionIntent,billable_request,canonical_digest
from asset_uploader import upload_file
client=CommerceClient(source=1);quotes={}

def handle(cmd,args):
 region=args.get('region','international')
 if cmd=='balance':
  a=client.get_account(region=region)
  return {k:a.get(k) for k in ['availableCredits','snapshotAt','memberType']}
 if cmd=='quote':
  request=dict(args['request']);request['region']=region
  paths=request.pop('imagePaths',[])
  if paths:
   urls=[upload_file(p,region=region)['url'] for p in paths]
   if request['operation']=='image-to-3d':request['imgs']=urls
   else:request['img']=urls[0]
  account=client.get_account(region=region);call=billable_request(request);q=client.create_quote(region=region,unique_id=account['uniqueId'],items={'1':call})
  quotes[q['quoteId']]=dict(request=request,account=account,quote=q,call=call)
  return dict(id=q['quoteId'],credits=q['estimatedCreditsTotal'],expiresAt=q['expiresAt'])
 if cmd=='submit':
  record=quotes.pop(args['quoteId'],None)
  if not record:raise ValueError('报价已失效，请刷新报价')
  a=record['account'];q=record['quote'];request=record['request'];region=request['region']
  intent=SubmissionIntent(account_ref=a['accountRef'],source=1,step_id=args['jobId'],attempt_id=args['jobId'],request_key=args['jobId'],operation=request['operation'],region=region,unique_id=a['uniqueId'],quote_id=q['quoteId'],request_digest=canonical_digest(record['call']),estimated_credits=q['estimatedCreditsTotal'],retry_count=0)
  check=client.verify_submission(intent)
  if not check.verified:raise ValueError('报价上下文已变化，请重新获取报价')
  body={k:v for k,v in request.items() if k not in {'operation','region'}}
  fn=api.create_image_to_3d_task if request['operation']=='image-to-3d' else api.create_text_to_3d_task
  task_id=fn(region=region,**body)
  return dict(taskId=str(task_id))
 if cmd=='poll':
  t=api.get_task(args['taskId'],region=region);result=dict(status=t.get('status'))
  if t.get('status')==3:
   outputs=api.parse_task_outputs(t)
   url=outputs.get('glb') if isinstance(outputs,dict) else (outputs if isinstance(outputs,str) and '.glb' in outputs.lower() else None)
   if not url:raise ValueError('任务完成但没有找到 GLB 输出，请在官方任务页查看')
   api.download_model(url,args['output']);result['downloaded']=True
  return result
 raise ValueError('未知平台操作')

for line in sys.stdin:
 try:
  msg=json.loads(line)
  with contextlib.redirect_stdout(sys.stderr):result=handle(msg['cmd'],msg.get('args',{}))
  print(json.dumps(dict(id=msg['id'],result=result),ensure_ascii=False),flush=True)
 except Exception as exc:
  # Runtime exceptions may embed signed URLs or response payloads: expose only safe codes.
  error=getattr(exc,'code',None) or (str(exc) if isinstance(exc,ValueError) else type(exc).__name__)
  print(json.dumps(dict(id=msg.get('id'),error=error),ensure_ascii=False),flush=True)
