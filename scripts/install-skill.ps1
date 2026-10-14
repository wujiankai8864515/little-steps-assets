param([string]$BaseUrl='http://127.0.0.1:4380',[string]$DataRoot='',[switch]$Offline)
$ErrorActionPreference = 'Stop'
$workbenchRoot = Split-Path -Parent $PSScriptRoot
$skillSource = Join-Path $workbenchRoot 'skill'
Copy-Item -LiteralPath (Join-Path $workbenchRoot 'docs/系统全景与实施路线.md') -Destination (Join-Path $skillSource 'references/系统总览.md') -Force
Copy-Item -LiteralPath (Join-Path $workbenchRoot 'docs/三视角审核与采纳.md') -Destination (Join-Path $skillSource 'references/三视角审核与采纳.md') -Force
$skillHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$skillDestination = Join-Path $skillHome 'skills/asset-workbench'
$configFile = Join-Path $skillSource 'references/workbench.json'
$oldConfig = if(Test-Path -LiteralPath $configFile){Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json}else{$null}
if(-not $DataRoot){$DataRoot=if($oldConfig.dataRoot){$oldConfig.dataRoot}else{Join-Path $workbenchRoot 'data'}}
$DataRoot=[System.IO.Path]::GetFullPath($DataRoot)
if($Offline){
  if(-not (Test-Path -LiteralPath (Join-Path $DataRoot 'workbench.sqlite'))){throw '资产数据库不存在，请先恢复迁移包'}
  $libraryId=$oldConfig.libraryId
  if(-not $libraryId){throw '离线安装需要包内库身份配置；不可自行伪造库 ID'}
}else{
  $health=Invoke-RestMethod ($BaseUrl+'/api/health') -TimeoutSec 4
  if($health.name -ne 'asset-workbench' -or $health.protocolVersion -ne 2 -or -not $health.libraryId){throw '需要已启动的资产工坊协议 2 服务'}
  if([System.IO.Path]::GetFullPath($health.projectRoot) -ne [System.IO.Path]::GetFullPath($workbenchRoot) -or [System.IO.Path]::GetFullPath($health.dataRoot) -ne $DataRoot){throw '服务的程序/数据目录与本次安装不符'}
  $libraryId=$health.libraryId
}
$config=[ordered]@{projectRoot=$workbenchRoot.Replace('\','/');dataRoot=$DataRoot.Replace('\','/');baseUrl=$BaseUrl;protocolVersion=2;libraryId=$libraryId}
if($oldConfig.environment){$config.environment=$oldConfig.environment}
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configFile -Encoding utf8
New-Item -ItemType Directory -Path $skillDestination -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $skillSource 'SKILL.md') -Destination (Join-Path $skillDestination 'SKILL.md') -Force
foreach($folder in @('references','scripts')){
 $destination=Join-Path $skillDestination $folder
 New-Item -ItemType Directory -Path $destination -Force | Out-Null
 Get-ChildItem -LiteralPath (Join-Path $skillSource $folder) -File | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $destination $_.Name) -Force}
}
Write-Output ('已同步全局 Skill: '+$skillDestination)
Write-Output ('数据目录: '+$DataRoot+'；资产库: '+$libraryId)
