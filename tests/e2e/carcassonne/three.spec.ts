import {expect,test} from "@playwright/test";
import {primaryPhoneCases} from "../viewport-cases.js";
import {fixture,openFixture} from "./fixtures.js";

test('real 3D camera, canvas picking and dragging from a candidate work on a phone',async({browser})=>{
  const size=primaryPhoneCases[1]!,run=await openFixture(browser,size.width,size.height,fixture(),size.options);
  try{
    const {page}=run,map=page.locator('[data-carc-renderer="ready"]'),canvas=map.locator('canvas');
    expect(await canvas.evaluate(c=>(c as HTMLCanvasElement).getContext('webgl2')!==null)).toBe(true);
    const angle=Number(await map.getAttribute('data-camera-azimuth'));
    await page.getByRole('button',{name:'旋转地图视角',exact:true}).click();
    await expect(map).toHaveAttribute('data-camera-settled','true');
    expect(Number(await map.getAttribute('data-camera-azimuth'))).not.toBe(angle);
    await page.getByRole('button',{name:'俯视地图',exact:true}).click();
    await expect(map).toHaveAttribute('data-camera-view','top');await expect(map).toHaveAttribute('data-camera-settled','true');
    const b=(await canvas.boundingBox())!;await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
    await expect(page.locator('[data-region-detail]')).toContainText('田地');
    await page.getByRole('button',{name:'关闭区域详情',exact:true}).click();
    await page.getByRole('button',{name:'恢复立体视角',exact:true}).click();await expect(map).toHaveAttribute('data-camera-view','perspective');await expect(map).toHaveAttribute('data-camera-settled','true');
    const candidate=page.locator('[data-carc-candidate]').first(),c=(await candidate.boundingBox())!;
    await page.mouse.move(c.x+c.width/2,c.y+c.height/2);await page.mouse.down();await page.mouse.move(c.x+c.width/2+45,c.y+c.height/2+30,{steps:8});await page.mouse.up();
    await expect(page.locator('[data-carc-preview]')).toHaveCount(0);
    await page.getByRole('button',{name:'查看全图',exact:true}).click();
    await page.locator('[data-carc-candidate]').first().press('Enter');await expect(page.locator('[data-carc-preview]')).toHaveCount(1);
    expect(run.errors).toEqual([]);
  }finally{await run.context.close();}
});

for(const mode of ['unavailable','context-loss'] as const)test(`3D ${mode} preserves placement in the compatibility map`,async({browser})=>{
  const size=primaryPhoneCases[1]!,run=await openFixture(browser,size.width,size.height,fixture(),size.options,mode==='unavailable'?'compatibility':'ready');
  try{
    const {page}=run;
    if(mode==='context-loss')expect(await page.locator('[data-carc-renderer="ready"] canvas').evaluate(c=>{
      const ext=(c as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context');ext?.loseContext();return Boolean(ext);
    })).toBe(true);
    await expect(page.locator('[data-carc-renderer="compatibility"]')).toBeVisible();
    await expect(page.getByText('当前设备使用兼容地图')).toBeVisible();
    await page.locator('[data-carc-candidate]').first().click();await expect(page.locator('[data-carc-preview]')).toHaveCount(1);
    await page.getByRole('button',{name:'放在这里',exact:true}).click();await expect(page.getByRole('button',{name:'完成回合',exact:true})).toBeEnabled();
    expect(run.errors).toEqual([]);
  }finally{await run.context.close();}
});
