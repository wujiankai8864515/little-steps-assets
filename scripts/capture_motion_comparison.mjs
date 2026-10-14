// Render the current local workbench for visual inspection. Does not submit a packaging job.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'file:///C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const folder=path.resolve('data/previews/studio');fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  page.on('pageerror',e=>console.log('PAGE_ERROR '+e.message));
  page.on('console',m=>{if(m.type()==='error'||/No target node|Cannot bind|not found/i.test(m.text()))console.log('BROWSER '+m.text());});
  await page.addInitScript(()=>{localStorage.setItem('wb-page',JSON.stringify('motion'));localStorage.setItem('wb-model',JSON.stringify('0fe5dcdc-a54c-43ab-aab3-4b0248e7e422'));});
  await page.goto('http://127.0.0.1:4380/?ui=simple',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'预览行走',exact:true}).click();
  console.log('SOURCES '+JSON.stringify(await page.locator('.variant-option').allTextContents()));
  for(const [label,name] of [['通用女角色，行走','female-walk-comparison'],['通用男角色，行走','male-walk-comparison'],['长弓动作库，弓手 · 向前走','longbow-walk-comparison'],['战术主角 · 行走转身，行走转身','original-walk-comparison']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('.comparison-loading').waitFor({state:'hidden',timeout:45000});
    await page.locator('.compare-view .stage-message').first().waitFor({state:'hidden',timeout:15000});
    await page.getByRole('button',{name:'暂停对比',exact:true}).click();
    await page.getByRole('slider',{name:'对比播放进度'}).fill('0.62');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(folder,name+'.png'),fullPage:true});
    console.log('CAPTURED '+name);
    if(name==='female-walk-comparison'||name==='male-walk-comparison')await page.getByRole('button',{name:'选用这个版本',exact:true}).click();
  }
  await page.getByRole('button',{name:'通用男角色，行走',exact:true}).click();
  await page.locator('.comparison-loading').waitFor({state:'hidden',timeout:15000});
  await page.locator('.compare-view .stage-message').first().waitFor({state:'hidden',timeout:15000});
  await page.getByRole('button',{name:'暂停对比',exact:true}).click();
  await page.getByRole('slider',{name:'对比播放进度'}).fill('0.62');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(folder,'selected-motions-comparison.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(folder,'comparison-mobile.png'),fullPage:true});
} finally {await browser.close();}
