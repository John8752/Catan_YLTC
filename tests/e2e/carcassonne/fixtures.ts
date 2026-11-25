import { createCarcassonne, executeCarcassonne, legalPlacements, previewPlacement, type CarcassonneState } from "../../../packages/game-core/src/carcassonne/index.js";
import { projectCarcassonne, type CarcassonneRoomView } from "../../../packages/protocol/src/carcassonne/index.js";
import { PLAYER_COLORS } from "../../../packages/game-core/src/primitives/index.js";
import { expect, type Browser, type BrowserContextOptions, type Page,type WebSocketRoute } from "@playwright/test";

const players=Array.from({length:5},(_,i)=>({id:`p${i+1}`,name:i===1?'很长很长的城墙建造者甲乙丙丁':'朋友'+(i+1),color:PLAYER_COLORS[i]!}));
export function fixture(kind:'opening'|'midgame'|'horizontal'|'vertical'='opening'):CarcassonneRoomView {
  let state=createCarcassonne('layout-match',players,918);
  if(kind==='midgame')for(let i=0;i<42&&state.phase.kind==='turn';i++){
    const options=legalPlacements(state.board,state.currentTile!),p=options[(i*7)%options.length]!;
    const preview=previewPlacement(state,state.phase.playerId,p);
    state=executeCarcassonne(state,state.phase.playerId,{type:'place',matchId:state.id,turn:state.phase.turn,...p,meeple:preview.meepleOptions[i%(preview.meepleOptions.length+1)]??null});
  }
  if(kind==='horizontal'||kind==='vertical')state={...state,board:Array.from({length:45},(_,i)=>({id:kind==='horizontal'?`${i},0`:`0,${i}`,type:'U',x:kind==='horizontal'?i:0,y:kind==='vertical'?i:0,rotation:kind==='horizontal'?1:0})),currentTile:'U',deck:Array.from({length:26},()=>'E')};
  state={...state,phase:{kind:'turn',playerId:'p1',turn:state.board.length}};
  return roomFor(state);
}
export function roomFor(state:CarcassonneState):CarcassonneRoomView{return{id:'LAYOUT',gameId:'carcassonne',matchId:state.id,hostPlayerId:'p1',revision:state.revision,members:players.map((p)=>({...p,isHost:p.id==='p1'})),game:projectCarcassonne(state,'p1')};}
export async function openFixture(browser:Browser,width:number,height:number,room:CarcassonneRoomView,options:BrowserContextOptions={},renderer:'ready'|'compatibility'='ready'){
  const context=await browser.newContext({viewport:{width,height},...options});
  await context.addInitScript(()=>localStorage.setItem('catan-yltc-seat',JSON.stringify({roomId:'LAYOUT',playerId:'p1',seatToken:'test'})));
  if(renderer==='compatibility')await context.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind:string,...args:unknown[]){return kind==='webgl2'||kind==='webgl'?null:Reflect.apply(original,this,[kind,...args]);} as typeof original;
  });
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',(e)=>errors.push(e.message));
  await page.route(/\/api\/rooms\/LAYOUT\?/,r=>r.fulfill({json:room}));
  let socket:WebSocketRoute|undefined;
  await page.routeWebSocket(/\/ws\?/,r=>{socket=r;r.send(JSON.stringify({type:'room_state',room}));});
  await page.goto('/');
  if(renderer==='ready')await expect(page.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-tile-count',String(room.game!.board.length));
  else await expect(page.locator('[data-carc-tile]')).toHaveCount(room.game!.board.length);
  return{context,page,errors,push:(next:CarcassonneRoomView)=>socket!.send(JSON.stringify({type:'room_state',room:next}))};
}
export async function chooseCandidate(page:Page){
  await expect(page.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-camera-settled','true');
  await expect(page.locator('[data-carc-cluster],[data-carc-candidate]').first()).toBeVisible();
  if(await page.locator('[data-carc-cluster]').count()){
    await page.locator('[data-carc-cluster]').first().click();
    await expect(page.locator('[data-carc-renderer="ready"]')).toHaveAttribute('data-camera-settled','true');
    await expect(page.locator('[data-carc-preview]')).toHaveCount(0);
  }
  await page.locator('[data-carc-candidate]').first().click();
}
