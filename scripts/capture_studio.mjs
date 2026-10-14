import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const folder=path.resolve('data/previews/studio');fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1024},deviceScaleFactor:1});
  page.on('pageerror',e=>console.log('PAGE_ERROR '+e.message));
  await page.goto('http://127.0.0.1:4380/?ui=simple',{waitUntil:'networkidle'});
  await page.locator('.canvas-host canvas').waitFor({state:'visible'});
  await page.locator('.stage-message').waitFor({state:'hidden',timeout:30000});
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.screenshot({path:path.join(folder,'motion-desktop.png'),fullPage:true});
  for (const [name,file] of [['我的作品','library-desktop'],['生成模型','generate-desktop'],['导出图片','render-desktop']]) {
    await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
    if(name!=='生成模型')await page.locator('.stage-message').waitFor({state:'hidden',timeout:30000});
    await page.screenshot({path:path.join(folder,file+'.png'),fullPage:true});
  }
  await page.getByRole('navigation').getByRole('button',{name:'添加动作',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('.stage-message').waitFor({state:'hidden',timeout:30000});
  await page.screenshot({path:path.join(folder,'motion-mobile.png'),fullPage:true});
  console.log('PREVIEWS '+folder);
} finally {await browser.close();}
