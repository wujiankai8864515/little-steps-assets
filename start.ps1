$ErrorActionPreference='Stop'
$skillHome=if($env:CODEX_HOME){$env:CODEX_HOME}else{Join-Path $env:USERPROFILE '.codex'}
$entry=Join-Path $skillHome 'skills/asset-workbench/scripts/workbench.mjs'
if(-not(Test-Path -LiteralPath $entry)){$entry=Join-Path $PSScriptRoot 'skill/scripts/workbench.mjs'}
$output=& node $entry open
if($LASTEXITCODE -ne 0){throw '资产工坊未能打开；请查看上面的具体原因'}
$info=$output | ConvertFrom-Json
Write-Output ('资产工坊: '+$info.url)
if($info.reused){Write-Output '已有制作任务，继续使用同一服务。'}
Start-Process $info.url
