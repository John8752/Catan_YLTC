import { expect,test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { CarcassonneRoomView,PlaceCommand } from "../../../packages/protocol/src/carcassonne/index.js";
import type { RoomSession } from "../../../packages/protocol/src/platform/index.js";

test('two isolated browsers place, recover a seat, finish and start a fresh match',async({browser,request})=>{
  const host=(await request.post('/api/rooms',{data:{playerName:'甲',gameId:'carcassonne'}})).json<RoomSession>();
  const h=await host,g=await(await request.post(`/api/rooms/${h.roomId}/join`,{data:{playerName:'乙'}})).json<RoomSession>();
  const contexts=await Promise.all([h,g].map(async(s)=>{const c=await browser.newContext({viewport:{width:440,height:763},hasTouch:true,isMobile:true});await c.addInitScript((seat)=>localStorage.setItem('catan-yltc-seat',JSON.stringify(seat)),{roomId:s.roomId,playerId:s.playerId,seatToken:s.seatToken});return c;}));
  const pages=await Promise.all(contexts.map((c)=>c.newPage()));
  const errors:string[]=[];pages.forEach(p=>p.on('pageerror',e=>errors.push(e.message)));
  try{
    await Promise.all(pages.map((p)=>p.goto('/')));
    await expect(pages[0]!.getByRole('heading',{name:'等待朋友入座',exact:true})).toBeVisible();
    await mkdir('output/playwright/carcassonne',{recursive:true});
    await pages[0]!.screenshot({path:'output/playwright/carcassonne/lobby-440.png',scale:'css',animations:'disabled'});
    await pages[0]!.getByRole('button',{name:'开始拼城',exact:true}).click();
    await expect(pages[1]!.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-tile-count','1');
    await pages[0]!.locator('[data-carc-candidate]').first().click();
    await pages[0]!.getByRole('button',{name:'放在这里',exact:true}).click();
    const followers=pages[0]!.getByRole('button',{name:/^选择(城市|道路|田地|修道院) /});
    if(await followers.count())await followers.first().click();else await pages[0]!.getByRole('button',{name:'不放随从',exact:true}).click();
    await pages[0]!.getByRole('button',{name:'完成回合',exact:true}).click();
    await expect(pages[1]!.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-tile-count','2');
    await pages[0]!.reload();await expect(pages[0]!.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-tile-count','2');
    const sessions=[h,g];let lastMatch:string|null=null;
    for(let i=0;i<71;i++){
      let room=await(await request.get(`/api/rooms/${h.roomId}?seatToken=${h.seatToken}`)).json<CarcassonneRoomView>();
      const game=room.game!;lastMatch=game.id;if(game.phase.kind==='finished')break;
      const actor=sessions.find((s)=>game.phase.kind==='turn'&&s.playerId===game.phase.playerId)!;
      room=await(await request.get(`/api/rooms/${h.roomId}?seatToken=${actor.seatToken}`)).json<CarcassonneRoomView>();
      const p=room.game!.placements[0]!,command:PlaceCommand={type:'place',matchId:game.id,turn:game.phase.turn,...p,meeple:p.meepleOptions[0]??null};
      // Protocol coordinates only; do not send projection-only fields back to a strict command DTO.
      const response=await request.post(`/api/rooms/${h.roomId}/carcassonne/commands`,{data:{seatToken:actor.seatToken,commandId:`browser-move-${i}`,command:{type:command.type,matchId:command.matchId,turn:command.turn,x:command.x,y:command.y,rotation:command.rotation,meeple:command.meeple}}});
      expect(response.ok()).toBe(true);
    }
    await expect(pages[0]!.getByText('这片风景，有了归属')).toBeVisible();
    await expect(pages[1]!.getByText('这片风景，有了归属')).toBeVisible();
    await pages[0]!.getByRole('button',{name:'查看全图',exact:true}).click();
    await pages[0]!.screenshot({path:'output/playwright/carcassonne/finished-440.png',scale:'css',animations:'disabled'});
    await pages[0]!.getByRole('button',{name:'再来一局',exact:true}).click();
    await expect(pages[1]!.getByRole('heading',{name:'等待朋友入座',exact:true})).toBeVisible();
    await pages[0]!.getByRole('button',{name:'开始拼城',exact:true}).click();
    const fresh=await(await request.get(`/api/rooms/${h.roomId}?seatToken=${h.seatToken}`)).json<CarcassonneRoomView>();
    expect(fresh.matchId).not.toBe(lastMatch);
    await expect(pages[0]!.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-tile-count','1');
    expect(errors).toEqual([]);
  }finally{for(const c of contexts)await c.close();await request.delete(`/api/rooms/${h.roomId}`,{data:{seatToken:h.seatToken}});}
});
