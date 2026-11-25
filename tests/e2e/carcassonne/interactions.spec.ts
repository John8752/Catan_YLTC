import { mkdir } from "node:fs/promises";
import { expect,test } from "@playwright/test";
import { primaryPhoneCases } from "../viewport-cases.js";
import { chooseCandidate,fixture,openFixture } from "./fixtures.js";

test('keyboard region controls highlight field, road and city in the 3D scene',async({browser})=>{
  const run=await openFixture(browser,1440,900,fixture());
  try{
    await run.page.getByRole('button',{name:'地形',exact:true}).click();
    for(const kind of ['field','road','city']){
      const region=run.page.locator(`[data-feature-kind="${kind}"]`).first();await region.focus();
      await expect(run.page.locator('[data-region-detail]')).toContainText(({field:'田地',road:'道路',city:'城市'} as Record<string,string>)[kind]!);
      await run.page.screenshot({path:`output/playwright/carcassonne/focus-${kind}.png`,scale:'css',animations:'disabled'});
    }
  }finally{await run.context.close();}
});

test('invalid rotation, retry receipts and camera movement stay safe @primary-phone',async({browser})=>{
  const size=primaryPhoneCases[1]!,room=fixture(),run=await openFixture(browser,size.width,size.height,room,size.options);
  try{
    const {page}=run;await chooseCandidate(page);
    const preview=page.locator('[data-carc-preview]');
    await page.getByRole('button',{name:'旋转板块',exact:true}).click();
    await expect(preview).toHaveAttribute('data-valid','false');
    await expect(page.getByRole('button',{name:'放在这里',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'旋转板块',exact:true}).click();
    await expect(preview).toHaveAttribute('data-valid','true');
    await page.getByRole('button',{name:'放在这里',exact:true}).click();
    await page.getByRole('button',{name:'选择道路 r0',exact:true}).click();
    const ids:string[]=[];let accepted=false;
    await page.route(/\/carcassonne\/commands$/,async(route)=>{
      const body=route.request().postDataJSON();ids.push(body.commandId);
      if(ids.length===1){await route.abort('failed');return;}
      accepted=true;
      const c=body.command,tile={id:`${c.x},${c.y}`,type:room.game!.currentTile!,x:c.x,y:c.y,rotation:c.rotation};
      await route.fulfill({json:{...room,revision:room.revision+1,game:{...room.game!,revision:room.game!.revision+1,currentTile:'B',board:[...room.game!.board,tile],meeples:[...room.game!.meeples,{playerId:'p1',tileId:tile.id,featureId:c.meeple}],phase:{kind:'turn',playerId:'p2',turn:2},placements:[]}}});
    });
    await page.getByRole('button',{name:'完成回合',exact:true}).click();
    await expect(page.getByRole('button',{name:'重试提交',exact:true})).toBeEnabled();
    await expect(preview).toHaveCount(1);
    await page.getByRole('button',{name:'重试提交',exact:true}).click();
    await expect(page.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-tile-count','2');
    expect(accepted).toBe(true);expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
    expect(run.errors).toEqual([]);
  }finally{await run.context.close();}
});

test('region inspection, new scores and fresh matches do not replay old effects @primary-phone',async({browser})=>{
  const size=primaryPhoneCases[1]!,room=fixture('midgame'),run=await openFixture(browser,size.width,size.height,room,size.options);
  try{
    const {page}=run;
    await expect(page.locator('.carc-score-notice')).toHaveCount(0);
    await page.getByRole('button',{name:'地形',exact:true}).click();
    await page.getByRole('button',{name:/^查看田地 /}).first().press('Enter');
    await expect(page.locator('[data-region-detail]')).toContainText('田地');
    await expect(page.locator('[data-region-detail]')).toContainText('座完成城市');
    await page.getByRole('button',{name:'关闭区域详情',exact:true}).click();
    const old=room.game!,entry={id:old.scores.length+1,kind:'city' as const,points:4,playerIds:['p1'],tileIds:['0,0'],final:false};
    run.push({...room,revision:room.revision+1,game:{...old,revision:old.revision+1,scores:[...old.scores,entry]}});
    await expect(page.locator('.carc-score-notice')).toContainText('+4');
    const fresh=fixture();run.push({...fresh,revision:room.revision+2,matchId:'fresh-match',game:{...fresh.game!,id:'fresh-match'}});
    await expect(page.locator('.carc-score-notice')).toHaveCount(0);
    await expect(page.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-tile-count','1');
    await expect(page.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-camera-view','perspective');
    await expect(page.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-camera-size','1');
    expect(run.errors).toEqual([]);
  }finally{await run.context.close();}
});

for(const size of [primaryPhoneCases[1]!,{name:'desktop',width:1440,height:900,options:{}}])test(`review captures show relief, pawn placement and region detail at ${size.name}`,async({browser})=>{
  const run=await openFixture(browser,size.width,size.height,fixture('midgame'),size.options);
  try{
    const {page}=run;await mkdir('output/playwright/carcassonne',{recursive:true});
    await page.getByRole('button',{name:'定位最新落子',exact:true}).click();
    await page.getByRole('button',{name:'放大地图',exact:true}).click();
    await expect.poll(async()=>Number(await page.locator('[data-carc-renderer="ready"]').getAttribute('data-camera-size'))).toBeGreaterThan(1.5);
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`output/playwright/carcassonne/detail-${size.width}.png`,scale:'css',animations:'disabled'});
    await page.getByRole('button',{name:'查看全图',exact:true}).click();
    await chooseCandidate(page);
    await page.getByRole('button',{name:'定位当前预览',exact:true}).click();
    await page.getByRole('button',{name:'放在这里',exact:true}).click();
    const choices=page.getByRole('button',{name:/^选择(城市|道路|田地|修道院) /});
    if(await choices.count())await choices.first().click();
    await expect(page.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-camera-settled','true');
    await expect(page.getByRole('button',{name:'完成回合',exact:true})).toBeInViewport({ratio:1});
    await page.screenshot({path:`output/playwright/carcassonne/pawn-${size.width}.png`,scale:'css',animations:'disabled'});
    expect(run.errors).toEqual([]);
  }finally{await run.context.close();}
});
