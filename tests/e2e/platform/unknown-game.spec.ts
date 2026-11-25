import {expect,test} from "@playwright/test";
import {iPhone16BrowserAreaCases} from "../viewport-cases.js";

for(const device of [{name:"desktop",options:{viewport:{width:1280,height:800}}},...iPhone16BrowserAreaCases])test(`unknown game reports an error and returns to explicit selection ${device.name}`,async({browser})=>{
  const context=await browser.newContext(device.options);
  await context.addInitScript(()=>localStorage.setItem('catan-yltc-seat',JSON.stringify({roomId:'UNKNOWN',playerId:'p1',seatToken:'test'})));
  const page=await context.newPage(),errors:string[]=[],requests:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(new URL(r.url()).pathname));
  const badRoom={id:'UNKNOWN',gameId:'unregistered-game',matchId:null,revision:1,hostPlayerId:'p1',members:[],game:null};
  await page.route(/\/api\/rooms\/UNKNOWN\?/,r=>r.fulfill({json:badRoom}));
  await page.routeWebSocket(/\/ws\?roomId=UNKNOWN&/,r=>r.send(JSON.stringify({type:'room_state',room:badRoom})));
  try{
    await page.goto('/');
    await expect(page.getByText('未知游戏类型，请返回大厅选择游戏。',{exact:true})).toBeVisible();
    expect(requests.filter(p=>/\/games\/[^/]+\/(?:CatanTable|DrawGuessTable|CamelTable|CarcassonneTable)/.test(p))).toEqual([]);
    await page.getByRole('button',{name:'返回大厅选择游戏',exact:true}).click();
    await expect(page.getByRole('group',{name:'选择游戏',exact:true})).toBeVisible();
    await page.getByLabel('显示名称',{exact:true}).fill('明确选游戏');
    await page.getByRole('radio',{name:/骆驼大赛/}).check();
    const creation=page.waitForRequest(r=>new URL(r.url()).pathname==='/api/rooms'&&r.method()==='POST');
    await page.getByRole('button',{name:'创建骆驼大赛房间',exact:true}).click();
    expect((await creation).postDataJSON()).toMatchObject({gameId:'camel-up'});
    await expect(page.getByRole('button',{name:'开始骆驼大赛',exact:true})).toBeVisible();
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
