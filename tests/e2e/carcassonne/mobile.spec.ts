import { mkdir } from "node:fs/promises";
import { expect,test } from "@playwright/test";
import { primaryPhoneCases, viewportCase } from "../viewport-cases.js";
import { chooseCandidate,fixture,openFixture } from "./fixtures.js";

const sizes=[...primaryPhoneCases,{...viewportCase(412,915),name:'large Android portrait',options:{isMobile:true,hasTouch:true,deviceScaleFactor:2.625}},viewportCase(1440,900)];
for(const size of sizes)test(`portrait table, placement and disclosures fit ${size.name}`,async({browser})=>{
  const run=await openFixture(browser,size.width,size.height,fixture(),size.options);
  try{
    const {page}=run;
    await expect(page.locator('[data-carc-player]')).toHaveCount(5);
    expect(await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth+1,y:document.documentElement.scrollHeight>innerHeight+1}))).toEqual({x:false,y:false});
    const map=await page.locator('[data-carc-map]').boundingBox();expect(map!.height).toBeGreaterThan(200);
    await chooseCandidate(page);
    await expect(page.locator('[data-carc-preview]')).toHaveCount(1);
    // Choose the server-projected initial orientation, then test the pawn phase.
    await page.getByRole('button',{name:'放在这里',exact:true}).click();
    await expect(page.getByRole('button',{name:'完成回合',exact:true})).toBeInViewport({ratio:1});
    await page.getByRole('button',{name:'不放随从',exact:true}).click();
    await page.getByRole('button',{name:'返回',exact:true}).click();
    await expect(page.getByRole('button',{name:'旋转板块',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'游戏规则',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeInViewport({ratio:1});
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    await page.getByRole('button',{name:'计分记录',exact:true}).click();
    await expect(page.getByText('尚未有区域完成，先铺出第一段风景。')).toBeVisible();
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    await mkdir('output/playwright/carcassonne',{recursive:true});
    await page.screenshot({path:`output/playwright/carcassonne/table-${size.width}x${size.height}.png`,scale:'css',animations:'disabled'});
    expect(run.errors).toEqual([]);
  }finally{await run.context.close();}
});
for(const kind of ['midgame','horizontal','vertical'] as const)test(`late ${kind} map remains navigable @primary-phone`,async({browser})=>{
  const size=primaryPhoneCases.find((c)=>c.name.includes('iPhone 16 portrait browser-area'))!;
  const run=await openFixture(browser,size.width,size.height,fixture(kind),size.options);
  try{
    const {page}=run;
    await expect(page.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-all-tiles-visible','true');
    await page.getByRole('button',{name:'查看全图',exact:true}).click();
    const map=page.locator('[data-carc-renderer="ready"]'),before=Number(await map.getAttribute('data-camera-size'));
    await page.getByRole('button',{name:'定位最新落子',exact:true}).click();
    await expect.poll(async()=>Number(await map.getAttribute('data-camera-size'))).toBeGreaterThanOrEqual(1);
    if(kind!=='midgame')expect(Number(await map.getAttribute('data-camera-size'))).toBeGreaterThan(before);
    const zoomed=Number(await map.getAttribute('data-camera-size'));
    const box=(await map.boundingBox())!,session=await run.context.newCDPSession(page),cx=box.x+box.width/2,cy=box.y+box.height/2;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:cx-25,y:cy},{id:2,x:cx+25,y:cy}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:cx-45,y:cy},{id:2,x:cx+45,y:cy}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(async()=>Number(await map.getAttribute('data-camera-size'))).toBeGreaterThan(zoomed);
    await expect(page.locator('[data-carc-preview]')).toHaveCount(0);
    await page.getByRole('button',{name:'查看全图',exact:true}).click();
    const markers=await page.locator('[data-carc-cluster]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
    for(let i=0;i<markers.length;i++)for(let j=i+1;j<markers.length;j++){const a=markers[i]!,b=markers[j]!;expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true);}
    await page.screenshot({path:`output/playwright/carcassonne/late-${kind}.png`,scale:'css',animations:'disabled'});
    if(kind==='midgame'){await chooseCandidate(page);await expect(page.locator('[data-carc-preview]')).toHaveCount(1);}
    expect(run.errors).toEqual([]);await session.detach();
  }finally{await run.context.close();}
});
test('browser bars, safe areas and reduced motion preserve map and actions @primary-phone',async({browser})=>{
  const full=primaryPhoneCases[0]!,area=primaryPhoneCases[1]!;
  const run=await openFixture(browser,full.width,full.height,fixture(),full.options);
  try{
    for(const size of [area,full]){
      await run.page.setViewportSize({width:size.width,height:size.height});
      await run.page.locator('[data-carc-game]').evaluate((e)=>{(e as HTMLElement).style.padding='59px 8px 34px';});
      await expect(run.page.getByRole('button',{name:'游戏规则',exact:true})).toBeInViewport({ratio:1});
      const map=(await run.page.locator('[data-carc-map]').boundingBox())!,dock=(await run.page.locator('[data-carc-dock]').boundingBox())!;
      expect(map.height).toBeGreaterThan(170);expect(dock.y+dock.height).toBeLessThanOrEqual(size.height-34+1);
      expect(await run.page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1)).toBe(false);
    }
    await run.page.emulateMedia({reducedMotion:'reduce'});
    expect(await run.page.locator('.carc-tool svg').first().evaluate((e)=>Number.parseFloat(getComputedStyle(e).transitionDuration))).toBeLessThanOrEqual(.001);
  }finally{await run.context.close();}
});
