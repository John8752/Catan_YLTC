import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { featureRef,tileDefinition } from "@catan/game-core/carcassonne";
import type { CarcassonneView, LegalPlacement } from "@catan/protocol/carcassonne";
import type { Region } from "@catan/game-core/carcassonne";
import { PLAYER_SVG_COLORS } from "../../../lib/player-palette.js";
import { featureAnchor } from "../TileArt.js";
import { box,clay,mesh,pawnModel,release,tileModel,UNIT } from "./models.js";

export interface SceneState {
  game:CarcassonneView;selected:LegalPlacement|null;rotation:number;meeple:string|null;step:"tile"|"meeple";busy:boolean;valid:boolean;inspected:Region|null;
}
export interface Target {id:string;kind:"candidate"|"meeple"|"cluster";x:number;y:number;label:string;placement?:LegalPlacement;count?:number;}
export interface SceneFrame {targets:Target[];zoom:number;azimuth:number;view:"perspective"|"top";allTilesVisible:boolean;tileCount:number;settled:boolean;}
interface Callbacks {frame:(frame:SceneFrame)=>void;inspect:(region:Region|null)=>void;select:(placement:LegalPlacement)=>void;meeple:(id:string)=>void;failure:()=>void;}
export interface Arena {update:(state:SceneState)=>void;fit:()=>void;focus:(x:number,y:number)=>void;zoom:(factor:number)=>void;top:()=>void;rotate:()=>void;dispose:()=>void;}

/** Merge static pieces by feature and material, retaining real raycast metadata. */
function batch(root:T.Group){
  root.updateMatrixWorld(true);
  const batches=new Map<string,{geometry:T.BufferGeometry[];material:T.Material;feature:string|undefined}>();
  root.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    let parent:T.Object3D|null=o,feature:string|undefined;
    while(parent&&parent!==root){if(parent.userData.feature){feature=parent.userData.feature;break;}parent=parent.parent;}
    const material=o.material as T.MeshStandardMaterial,key=`${feature??"base"}/${material.color.getHexString()}`;
    let b=batches.get(key);if(!b){b={geometry:[],material:material.clone(),feature};batches.set(key,b);}
    b.geometry.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
  });
  release(root);const result=new T.Group();
  for(const b of batches.values()){
    const merged=mergeGeometries(b.geometry,false);b.geometry.forEach(g=>g.dispose());
    if(merged){const m=mesh(merged,b.material,result);m.userData.feature=b.feature;}else b.material.dispose();
  }
  return result;
}
export function createArena(container:HTMLElement,initial:SceneState,callbacks:Callbacks):Arena {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"low-power"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.setClearColor("#b9cdb2");renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
  const canvas=renderer.domElement;canvas.className="h-full w-full touch-none outline-none";
  canvas.setAttribute("aria-label","三维卡卡颂地图，单指拖动，双指缩放；方向键平移，加减键缩放");canvas.tabIndex=0;container.append(canvas);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-5,5,5,-5,.1,2500);
  // Orthographic size is independent of distance. Stay above the whole fitted
  // ground even at minimum zoom so the foreground never crosses the near plane.
  camera.position.copy(new T.Vector3(7,13,12).normalize().multiplyScalar(400));camera.lookAt(0,0,0);
  const stage=container.parentElement!;
  const controls=new OrbitControls(camera,stage);controls.target.set(0,0,0);controls.enableDamping=false;
  controls.screenSpacePanning=false;controls.minPolarAngle=.03;controls.maxPolarAngle=1.1;controls.minZoom=.045;controls.maxZoom=4.5;
  controls.mouseButtons.LEFT=T.MOUSE.PAN;controls.mouseButtons.RIGHT=T.MOUSE.ROTATE;
  controls.touches.ONE=T.TOUCH.PAN;controls.touches.TWO=T.TOUCH.DOLLY_PAN;controls.zoomSpeed=.8;
  scene.add(new T.HemisphereLight("#fff4d7","#63734f",2));
  const light=new T.DirectionalLight("#ffe6b7",2.6);light.position.set(-8,18,10);light.castShadow=true;
  light.shadow.mapSize.set(1536,1536);light.shadow.normalBias=.045;light.shadow.bias=-.0002;
  light.shadow.camera.left=-12;light.shadow.camera.right=12;light.shadow.camera.top=12;light.shadow.camera.bottom=-12;light.shadow.camera.far=75;
  light.shadow.radius=3;scene.add(light,light.target);scene.add(new T.AmbientLight("#dbe9cf",.45));
  const ground=mesh(new T.PlaneGeometry(1200,1200),clay("#95b28e"),scene,0,-.15,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  const tiles=new Map<string,{group:T.Group;signature:string}>(),pieces=new T.Group(),ghosts=new T.Group();scene.add(pieces,ghosts);
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const raycaster=new T.Raycaster(),pointer=new T.Vector2();
  let state=initial,width=1,height=1,disposed=false,dirty=true,raf=0,view:"perspective"|"top"="perspective",first=true;
  let targetWorld:{target:Omit<Target,"x"|"y">;point:T.Vector3}[]=[],previousBoard=new Set(initial.game.board.map(t=>t.id));
  const arrivals=new Map<T.Group,number>();let previewGroup:T.Group|null=null,previewSignature="",previewAngle=0;
  const pawnArrivals=new Map<T.Group,{start:number;floor:number;tile:T.Group|null}>();
  let previousPawns=new Set(initial.game.meeples.map(m=>`${m.tileId}/${m.featureId}/${m.playerId}`)),previousPreviewPawn="",screenTargets:Target[]=[],lastFrame:SceneFrame|null=null;
  let flight:{start:number;from:T.Vector3;to:T.Vector3;targetFrom:T.Vector3;targetTo:T.Vector3;zoomFrom:number;zoomTo:number}|null=null;
  let gesture:{x:number;y:number;moved:boolean}|null=null,activePointers=new Set<number>();
  function invalidate(){dirty=true;}
  function repositionLight(){light.position.set(controls.target.x-8,18,controls.target.z+10);light.target.position.copy(controls.target);light.target.updateMatrixWorld();}
  controls.addEventListener("change",()=>{repositionLight();invalidate();});
  function setPose(x:number,z:number,zoom:number){const delta=new T.Vector3(x,0,z).sub(controls.target);camera.position.add(delta);controls.target.add(delta);camera.zoom=T.MathUtils.clamp(zoom,.045,4.5);camera.updateProjectionMatrix();controls.update();invalidate();}
  function flyTo(position:T.Vector3,target:T.Vector3,zoom=camera.zoom){
    if(lastFrame)callbacks.frame({...lastFrame,settled:false});
    if(reduced.matches){camera.position.copy(position);controls.target.copy(target);camera.zoom=zoom;camera.updateProjectionMatrix();controls.update();invalidate();return;}
    flight={start:performance.now(),from:camera.position.clone(),to:position,targetFrom:controls.target.clone(),targetTo:target,zoomFrom:camera.zoom,zoomTo:zoom};invalidate();
  }
  controls.addEventListener("start",()=>{flight=null;});
  function projection(point:T.Vector3){const p=point.clone().project(camera);return{x:(p.x+1)*width/2,y:(1-p.y)*height/2};}
  function overview(){const a=projection(controls.target),b=projection(controls.target.clone().add(new T.Vector3(UNIT,0,0))),c=projection(controls.target.clone().add(new T.Vector3(0,0,UNIT)));return Math.min(Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(a.x-c.x,a.y-c.y))<52;}
  function projectedTargets(){
    const projected=targetWorld.map(({target,point})=>({...target,...projection(point)}));
    if(!overview())return projected;
    const result:Target[]=projected.filter(t=>t.kind!=="candidate"),clusters:Target[][]=[];
    for(const target of projected.filter(t=>t.kind==="candidate")){
      const near=clusters.find(group=>Math.hypot(group[0]!.x-target.x,group[0]!.y-target.y)<60);
      if(near)near.push(target);else clusters.push([target]);
    }
    for(const group of clusters){const first=group[0]!;result.push({...first,id:`cluster-${first.id}`,kind:"cluster",label:`放大选择附近 ${group.length} 个落点`,count:group.length});}
    return result;
  }
  function bounds(){return state.game.board.concat(state.selected&&state.game.currentTile?[{...state.selected,type:state.game.currentTile,id:"preview"}]:[]);}
  function fit(){
    const board=bounds(),minX=Math.min(...board.map(t=>t.x))*UNIT-1,maxX=Math.max(...board.map(t=>t.x))*UNIT+1,minZ=Math.min(...board.map(t=>t.y))*UNIT-1,maxZ=Math.max(...board.map(t=>t.y))*UNIT+1;
    setPose((minX+maxX)/2,(minZ+maxZ)/2,1);camera.updateMatrixWorld();
    const corners=[new T.Vector3(minX,0,minZ),new T.Vector3(maxX,0,minZ),new T.Vector3(maxX,1,maxZ),new T.Vector3(minX,1,maxZ)];
    const p=corners.map(projection),spanX=Math.max(...p.map(v=>v.x))-Math.min(...p.map(v=>v.x)),spanY=Math.max(...p.map(v=>v.y))-Math.min(...p.map(v=>v.y));
    camera.zoom=T.MathUtils.clamp(Math.min((width-56)/spanX,(height-138)/spanY),.045,board.length===1?1:4.5);camera.updateProjectionMatrix();controls.update();invalidate();
  }
  function focus(x:number,y:number){const target=new T.Vector3(x*UNIT,0,y*UNIT),position=camera.position.clone().add(target.clone().sub(controls.target));flyTo(position,target,Math.min(2.2,Math.max(1,height/270)));}
  function clear(group:T.Group){while(group.children.length)release(group.children[0]!);}
  function update(next:SceneState){
    state=next;const {game}=next;
    const refs=next.inspected?[...next.inspected.refs,...game.regions.filter(r=>next.inspected!.completedCityIds.includes(r.id)).flatMap(r=>r.refs)]:[];
    const currentIds=new Set(game.board.map(t=>t.id));
    for(const [id,entry]of tiles)if(!currentIds.has(id)){release(entry.group);tiles.delete(id);}
    for(const tile of game.board){
      const selected=refs.filter(r=>r.startsWith(`${tile.id}/`)).map(r=>r.slice(tile.id.length+1)),signature=`${tile.type}/${tile.rotation}/${selected.join()}`;
      const old=tiles.get(tile.id);if(old?.signature===signature)continue;if(old){arrivals.delete(old.group);release(old.group);}
      const g=batch(tileModel(tile.type,selected));g.position.set(tile.x*UNIT,0,tile.y*UNIT);g.rotation.y=-tile.rotation*Math.PI/2;g.userData.tile=tile.id;
      scene.add(g);tiles.set(tile.id,{group:g,signature});
      if(!previousBoard.has(tile.id)&&!reduced.matches)arrivals.set(g,performance.now());
    }
    previousBoard=currentIds;clear(pieces);clear(ghosts);pawnArrivals.clear();targetWorld=[];
    for(const pawn of game.meeples){
      const tile=game.board.find(t=>t.id===pawn.tileId)!;const a=featureAnchor(tile.type,pawn.featureId,tile.rotation),player=game.players.find(p=>p.id===pawn.playerId)!;
      const g=pawnModel(PLAYER_SVG_COLORS[player.color],pawn.featureId.startsWith("f")),kind=tileDefinition(tile.type).features.find(f=>f.id===pawn.featureId)!.kind;
      g.position.x=tile.x*UNIT+(a.x-50)*.02;g.position.z=tile.y*UNIT+(a.y-50)*.02;g.position.y+=kind==='city'?.055:kind==='monastery'?.035:0;pieces.add(g);
      if(!previousPawns.has(`${pawn.tileId}/${pawn.featureId}/${pawn.playerId}`)&&!reduced.matches)pawnArrivals.set(g,{start:performance.now(),floor:g.position.y,tile:tiles.get(pawn.tileId)!.group});
    }
    previousPawns=new Set(game.meeples.map(m=>`${m.tileId}/${m.featureId}/${m.playerId}`));
    const active=game.phase.kind==="turn"&&game.phase.playerId===game.you.id,preview=active?next.selected:null;
    if(active&&next.step==="tile"){
      const cells=[...new Map(game.placements.map(p=>[`${p.x},${p.y}`,p])).values()];
      for(const cell of cells){
        if(preview?.x===cell.x&&preview.y===cell.y)continue;
        const match=game.placements.find(p=>p.x===cell.x&&p.y===cell.y&&p.rotation===((next.rotation%4)+4)%4)??cell;
        const plate=box(ghosts,"#aabd83",1.91,.025,1.91,cell.x*UNIT,-.075,cell.y*UNIT,.035);plate.material.transparent=true;plate.material.opacity=.55;plate.castShadow=false;plate.userData.placement=match;
        // Four little corner brackets sit on the tabletop rather than a screen-space grid.
        for(const sx of [-1,1])for(const sz of [-1,1]){box(ghosts,"#67805b",.24,.015,.035,cell.x*UNIT+sx*.8,-.053,cell.y*UNIT+sz*.8,.005);box(ghosts,"#67805b",.035,.015,.24,cell.x*UNIT+sx*.8,-.053,cell.y*UNIT+sz*.8,.005);}
        targetWorld.push({target:{id:`${cell.x},${cell.y}`,kind:"candidate",label:`落点 ${cell.x},${cell.y}`,placement:match},point:new T.Vector3(cell.x*UNIT,.12,cell.y*UNIT)});
      }
    }
    if(preview&&game.currentTile){
      const signature=`${game.currentTile}/${preview.x}/${preview.y}/${next.meeple}/${next.valid}`;
      if(signature!==previewSignature){if(previewGroup)release(previewGroup);previewGroup=new T.Group();
        const halo=box(previewGroup,next.valid?"#efd07a":"#cc735e",2.07,.065,2.07,0,-.025,0,.04);halo.castShadow=false;
        previewGroup.add(batch(tileModel(game.currentTile,next.meeple?[next.meeple]:[])));scene.add(previewGroup);previewSignature=signature;
      }
      previewGroup!.position.set(preview.x*UNIT,.14,preview.y*UNIT);
      if(next.step==="meeple")for(const id of preview.meepleOptions){const a=featureAnchor(game.currentTile,id,next.rotation);targetWorld.push({target:{id,kind:"meeple",label:`在预览板块放置随从 ${id}`},point:new T.Vector3(preview.x*UNIT+(a.x-50)*.02,.72,preview.y*UNIT+(a.y-50)*.02)});}
      if(next.meeple&&preview.meepleOptions.includes(next.meeple)){const own=game.players.find(p=>p.id===game.you.id)!,a=featureAnchor(game.currentTile,next.meeple,next.rotation),g=pawnModel(PLAYER_SVG_COLORS[own.color],next.meeple.startsWith("f")),kind=tileDefinition(game.currentTile).features.find(f=>f.id===next.meeple)!.kind;
        g.position.x=preview.x*UNIT+(a.x-50)*.02;g.position.z=preview.y*UNIT+(a.y-50)*.02;g.position.y+=.14+(kind==='city'?.055:kind==='monastery'?.035:0);pieces.add(g);
        const key=`${preview.x}/${preview.y}/${next.meeple}/${next.rotation}`;
        if(key!==previousPreviewPawn&&!reduced.matches)pawnArrivals.set(g,{start:performance.now(),floor:g.position.y,tile:null});previousPreviewPawn=key;
      }else previousPreviewPawn="";
    }else{previousPreviewPawn="";if(previewGroup){release(previewGroup);previewGroup=null;previewSignature="";}}
    if(first&&width>1){first=false;if(game.board.length>1)fit();}invalidate();
  }
  function frame(){
    if(disposed)return;raf=requestAnimationFrame(frame);
    let moving=false;const now=performance.now();
    if(flight){const t=Math.min(1,(now-flight.start)/320),ease=reduced.matches?1:1-Math.pow(1-t,4);camera.position.lerpVectors(flight.from,flight.to,ease);controls.target.lerpVectors(flight.targetFrom,flight.targetTo,ease);camera.zoom=T.MathUtils.lerp(flight.zoomFrom,flight.zoomTo,ease);camera.updateProjectionMatrix();controls.update();moving=true;if(t===1||reduced.matches)flight=null;}
    for(const[g,start]of arrivals){const t=Math.min(1,(now-start)/380);g.position.y=reduced.matches?0:.85*Math.pow(1-t,3);if(t===1)arrivals.delete(g);moving=true;}
    for(const[g,arrival]of pawnArrivals){const t=reduced.matches?1:Math.min(1,(now-arrival.start)/360),tileLift=arrival.tile?.position.y??0;g.position.y=arrival.floor+tileLift+.55*Math.pow(1-t,3);if(t===1&&tileLift<.0001){g.position.y=arrival.floor;pawnArrivals.delete(g);}moving=true;}
    if(previewGroup){const desired=-state.rotation*Math.PI/2,difference=desired-previewAngle;previewAngle=reduced.matches?desired:previewAngle+difference*.23;previewGroup.rotation.y=previewAngle;if(Math.abs(difference)>.001)moving=true;}
    if(!dirty&&!moving)return;dirty=false;
    renderer.render(scene,camera);
    screenTargets=projectedTargets();
    const visible=state.game.board.every(t=>[-1,1].every(dx=>[-1,1].every(dz=>{const p=projection(new T.Vector3(t.x*UNIT+dx,.2,t.y*UNIT+dz));return p.x>=8&&p.x<=width-8&&p.y>=25&&p.y<=height-64;})));
    lastFrame={targets:screenTargets,zoom:camera.zoom,azimuth:controls.getAzimuthalAngle(),view,allTilesVisible:visible,tileCount:tiles.size,settled:!moving};callbacks.frame(lastFrame);
    if(moving)dirty=true;
  }
  function resize(){const r=container.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);camera.left=-5*width/height;camera.right=5*width/height;camera.top=5;camera.bottom=-5;camera.updateProjectionMatrix();renderer.setSize(width,height,false);if(first){first=false;if(state.game.board.length>1)fit();}invalidate();}
  function down(e:PointerEvent){activePointers.add(e.pointerId);if(activePointers.size>1&&gesture)gesture.moved=true;else gesture={x:e.clientX,y:e.clientY,moved:false};}
  function move(e:PointerEvent){if(gesture&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>5)gesture.moved=true;}
  function up(e:PointerEvent){
    activePointers.delete(e.pointerId);if(!gesture||gesture.moved||activePointers.size||e.button!==0)return;
    const r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
    const nearest=screenTargets.map(t=>({...t,distance:Math.hypot(t.x-px,t.y-py)})).sort((a,b)=>a.distance-b.distance)[0];
    if(nearest&&nearest.distance<=24&&!state.busy){const t=nearest;if(t.kind==="candidate"&&t.placement)callbacks.select(t.placement);else if(t.kind==="cluster"&&t.placement)focus(t.placement.x,t.placement.y);else if(t.kind==="meeple")callbacks.meeple(t.id);gesture=null;return;}
    pointer.set(px/width*2-1,-py/height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects([...tiles.values()].map(t=>t.group),true)[0];
    if(hit){let o:T.Object3D|null=hit.object,feature:string|undefined,tile:string|undefined;while(o){feature??=o.userData.feature;tile??=o.userData.tile;o=o.parent;}
      callbacks.inspect(tile&&feature?state.game.regions.find(r=>r.refs.includes(featureRef(tile,feature)))??null:null);
    }else{const target=raycaster.intersectObject(ghosts,true).find(h=>h.object.userData.placement);if(target&&!state.busy){const p=target.object.userData.placement as LegalPlacement;if(overview())focus(p.x,p.y);else callbacks.select(p);}else callbacks.inspect(null);}
    gesture=null;
  }
  function cancel(e:PointerEvent){activePointers.delete(e.pointerId);if(gesture)gesture.moved=true;}
  function key(e:KeyboardEvent){const step=1/camera.zoom;let dx=0,dz=0;if(e.key==="ArrowLeft")dx=-step;else if(e.key==="ArrowRight")dx=step;else if(e.key==="ArrowUp")dz=-step;else if(e.key==="ArrowDown")dz=step;else if(e.key==="+"||e.key==="="){e.preventDefault();setPose(controls.target.x,controls.target.z,camera.zoom*1.2);return;}else if(e.key==="-"){e.preventDefault();setPose(controls.target.x,controls.target.z,camera.zoom/1.2);return;}else return;e.preventDefault();setPose(controls.target.x+dx,controls.target.z+dz,camera.zoom);}
  function lost(e:Event){e.preventDefault();callbacks.failure();}
  stage.addEventListener("pointerdown",down);stage.addEventListener("pointermove",move);stage.addEventListener("pointerup",up);stage.addEventListener("pointercancel",cancel);canvas.addEventListener("keydown",key);canvas.addEventListener("webglcontextlost",lost);
  const observer=new ResizeObserver(resize);observer.observe(container);resize();update(initial);frame();
  return{update,fit:()=>{flight=null;fit();if(lastFrame)callbacks.frame({...lastFrame,settled:false});},focus,zoom:factor=>flyTo(camera.position.clone(),controls.target.clone(),T.MathUtils.clamp(camera.zoom*factor,.045,4.5)),top:()=>{
    view=view==="top"?"perspective":"top";const offset=(view==="top"?new T.Vector3(0,20,.01):new T.Vector3(7,13,12)).normalize().multiplyScalar(400);flyTo(controls.target.clone().add(offset),controls.target.clone());
  },rotate:()=>{const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new T.Vector3(0,1,0),Math.PI/4);flyTo(controls.target.clone().add(offset),controls.target.clone());},dispose:()=>{
    disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();stage.removeEventListener("pointerdown",down);stage.removeEventListener("pointermove",move);stage.removeEventListener("pointerup",up);stage.removeEventListener("pointercancel",cancel);canvas.removeEventListener("keydown",key);canvas.removeEventListener("webglcontextlost",lost);scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});light.shadow.dispose();renderer.dispose();canvas.remove();
  }};
}
