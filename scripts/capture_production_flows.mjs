// Produce actual UI and GIF previews from the local page, without uploading anything to Mixamo.
import fs from 'node:fs';import path from 'node:path';
import {chromium} from 'file:///C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const folder=path.resolve('data/previews/studio');fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page,progressTimer;
try {
 page=await browser.newPage({viewport:{width:1600,height:1060},deviceScaleFactor:1});
 page.on('pageerror',e=>console.log('PAGE_ERROR '+e.message));
 page.on('console',m=>{if(m.type()==='error')console.log('BROWSER '+m.text());});
 page.on('response',async r=>{if(r.url().endsWith('/api/render-view')&&r.request().method()==='POST'){const j=await r.json();console.log('GIF_JOB '+JSON.stringify({id:j.id,frames:j.params?.frameCount,cacheKey:j.params?.cacheKey,error:j.error}));}});
 await page.addInitScript(()=>{localStorage.setItem('wb-model',JSON.stringify('0fe5dcdc-a54c-43ab-aab3-4b0248e7e422'));localStorage.removeItem('wb-frame-views');});
 await page.goto('http://127.0.0.1:4380/?panel=mixamo',{waitUntil:'networkidle'});
 await page.getByRole('dialog').waitFor({state:'visible'});
 await page.screenshot({path:path.join(folder,'mixamo-entry.png'),fullPage:true});
 await page.goto('http://127.0.0.1:4380/?panel=frames',{waitUntil:'domcontentloaded'});
 progressTimer=setInterval(async()=>{const status=await page.locator('.frame-progress').textContent().catch(()=>'');if(status)console.log('FRAME_PROGRESS '+status);},8000);
 await page.getByRole('button',{name:'确认构图，生成 GIF',exact:true}).click();
 await page.getByText('当前构图已生成 GIF',{exact:true}).waitFor({state:'visible',timeout:60000});
 await page.locator('.frame-gif-stage img').waitFor({state:'visible'});
 await page.screenshot({path:path.join(folder,'frames-current-view.png'),fullPage:true});
 console.log('CAPTURED default GIF');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'保存并下载序列帧',exact:true}).click();
 const download=await downloaded;await download.saveAs(path.join(folder,'operative-current-view-sprites.zip'));console.log('SAVED '+download.suggestedFilename());
 await page.getByRole('button',{name:'侧面',exact:true}).click();
 await page.getByRole('button',{name:'放大角色',exact:true}).click();
 await page.getByRole('button',{name:'确认构图，生成 GIF',exact:true}).click();
 await page.getByText('当前构图已生成 GIF',{exact:true}).waitFor({state:'visible',timeout:60000});
 await page.screenshot({path:path.join(folder,'frames-side-zoom.png'),fullPage:true});
 console.log('CAPTURED side zoom GIF');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(folder,'frames-mobile.png'),fullPage:true});
} catch(e){if(page){console.log('PAGE_STATE '+(await page.locator('.frame-progress').textContent().catch(()=>'')));await page.screenshot({path:path.join(folder,'frames-interrupted.png'),fullPage:true}).catch(()=>{});}throw e;}finally{clearInterval(progressTimer);await browser.close();}
