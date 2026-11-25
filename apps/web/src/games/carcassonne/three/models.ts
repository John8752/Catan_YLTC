import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { tileDefinition } from "@catan/game-core/carcassonne";
import { featureShape } from "../tile-geometry.js";

const loader = new SVGLoader();
const pathCache=new Map<string,T.ShapePath[]>();
export const UNIT = 2;
export function clay(color: string) { return new T.MeshStandardMaterial({color, roughness:.88, metalness:0}); }
export function mesh(geometry:T.BufferGeometry, material:T.Material, parent:T.Object3D, x=0,y=0,z=0) {
  const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export function box(parent:T.Object3D,color:string,w:number,h:number,d:number,x=0,y=0,z=0,r=.025) {
  return mesh(new RoundedBoxGeometry(w,h,d,1,r),clay(color),parent,x,y,z);
}
function shapes(path:string) {
  let paths=pathCache.get(path);if(!paths){paths=loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`).paths;pathCache.set(path,paths);}return paths;
}
function surface(parent:T.Object3D,path:string,color:string,height:number,depth:number) {
  const group=new T.Group(); parent.add(group);
  for(const p of shapes(path))for(const s of p.toShapes()){
    const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:10});
    // SVG positive Y is map south (+Z), extrusion rises along world Y.
    g.rotateX(Math.PI/2);g.scale(.02,1,.02);g.translate(-1,height+depth,-1);
    mesh(g,clay(color),group);
  }
  return group;
}
function house(parent:T.Object3D,x:number,z:number,size=.28,roof="#aa5239",tower=false){
  const h=tower?.5:.26;
  box(parent,"#eddbb4",size,h,size*.83,x,.18+h/2,z,.012);
  const roofMesh=mesh(new T.ConeGeometry(size*.81,tower?.3:.22,4),clay(roof),parent,x,.18+h+.1,z);
  roofMesh.rotation.y=Math.PI/4;roofMesh.scale.z=tower?1:.82;
  box(parent,"#504d3e",.055,.09,.012,x,.24+h*.4,z+size*.42,.002);
  if(tower)box(parent,"#746b53",.075,.11,.012,x,.18+h*.74,z+size*.42,.002);
}
function tree(parent:T.Object3D,x:number,z:number,size=.23){
  mesh(new T.CylinderGeometry(.025,.034,.16,5),clay("#8b6a42"),parent,x,.18,z);
  const leaves=mesh(new T.IcosahedronGeometry(size,0),clay("#557c46"),parent,x,.32,z);leaves.scale.set(.8,1.2,.8);
  mesh(new T.IcosahedronGeometry(size*.63,0),clay("#86a457"),parent,x+.06,.42,z-.015);
}
function contains(path:string,x:number,y:number){
  const points=shapes(path)[0]!.subPaths[0]!.getPoints(24);let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i]!,b=points[j]!;if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}
  return inside;
}
/** All decoration is original geometry. Only the public projection supplies connectivity/legality. */
export function tileModel(type:string,highlight:readonly string[]=[]){
  const root=new T.Group(),terrain=new T.Group();root.add(terrain);
  box(root,"#b69d70",1.985,.19,1.985,0,-.045,0,.035);
  box(root,"#78974f",1.975,.065,1.975,0,.075,0,.022);
  const def=tileDefinition(type);
  for(const f of def.features){
    if(f.kind!=="field")continue;
    const s=featureShape(type,f),g=surface(terrain,s.path,highlight.includes(f.id)?"#e9c967":"#78974f",.108,.002);
    g.userData.feature=f.id;
    // Keep a clear disk around every follower anchor, including the lying farmer.
    const candidates=[[18,18],[82,18],[18,82],[82,82],[22,50],[78,50]];
    const spot=candidates.find(([x,y])=>{
      if(!contains(s.path,x!,y!)||Math.hypot(x!-s.x,y!-s.y)<27)return false;
      return def.features.every(other=>{
        const v=featureShape(type,other);
        if(other.kind==='city'){
          let px=x!,py=y!;for(let i=0;i<(4-v.rotation/90)%4;i++)[px,py]=[100-py,px];
          return !contains(v.path,px,py);
        }
        if(other.kind==='road')return shapes(v.path)[0]!.subPaths[0]!.getPoints(30).every(p=>Math.hypot(p.x-x!,p.y-y!)>12);
        if(other.kind==='field')return Math.hypot(x!-v.x,y!-v.y)>27;
        return other.kind!=='monastery'||Math.hypot(x!-50,y!-48)>34;
      });
    });
    if(spot)tree(g,(spot[0]!-50)*.02,(spot[1]!-50)*.02,.13);
  }
  for(const f of def.features){
    if(f.kind!=="road")continue;
    const s=featureShape(type,f),g=new T.Group();g.userData.feature=f.id;terrain.add(g);
    const path=shapes(s.path)[0]!.subPaths[0]!,points=path.getPoints(20);
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3((p.x-50)*.02,.124,(p.y-50)*.02)));
    const road=mesh(new T.TubeGeometry(curve,Math.max(8,points.length),.12,5,false),clay(highlight.includes(f.id)?"#f2d16e":"#d9c297"),g);
    road.scale.y=.18;
    // Restore flattened tube's elevation while keeping exact road-edge joins.
    road.position.y=.106;
    const line=mesh(new T.TubeGeometry(curve,Math.max(8,points.length),.012,3,false),clay("#efdfb8"),g);line.scale.y=.2;line.position.y=.118;
  }
  for(const f of def.features){
    if(f.kind!=="city")continue;
    const s=featureShape(type,f),g=surface(terrain,s.path,highlight.includes(f.id)?"#edcc73":"#cbb890",.11,.055);
    g.userData.feature=f.id;g.rotation.y=-s.rotation*Math.PI/180;
    const outline=shapes(s.path)[0]!.subPaths[0]!.getPoints(24);
    // Walls only follow the city's inland boundary. Matching city edges stay open.
    for(let i=1;i<outline.length;i++){
      const a=outline[i-1]!,b=outline[i]!;
      if((a.x===0&&b.x===0)||(a.x===100&&b.x===100)||(a.y===0&&b.y===0)||(a.y===100&&b.y===100))continue;
      const ax=(a.x-50)*.02,az=(a.y-50)*.02,bx=(b.x-50)*.02,bz=(b.y-50)*.02,len=Math.hypot(bx-ax,bz-az);
      if(len<.015)continue;
      const wall=box(g,"#e4d1aa",len+.018,.23,.085,(ax+bx)/2,.25,(az+bz)/2,.008);wall.rotation.y=-Math.atan2(bz-az,bx-ax);
      const count=Math.max(1,Math.ceil(len/.16));
      for(let j=0;j<count;j++){const t=(j+.5)/count;box(g,"#f0dfbd",.07,.06,.1,ax+(bx-ax)*t,.395,az+(bz-az)*t,.006);}
    }
    const x=(s.x-50)*.02,z=(s.y-50)*.02;
    const sites=[[x-.52,z-.035],[x+.52,z-.035],[x+.52,z-.3],[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7],[-.7,0],[.7,0],[0,-.7],[0,.7]];
    const used:{x:number;z:number}[]=[];
    for(const [sx,sz]of sites){
      if(used.length>=(f.ports.length>1?3:2)||Math.hypot(sx!-x,sz!-z)<.39||used.some(p=>Math.hypot(p.x-sx!,p.z-sz!)<.32))continue;
      if(![-.14,.14].every(dx=>[-.14,.14].every(dz=>contains(s.path,(sx!+dx+1)*50,(sz!+dz+1)*50))))continue;
      house(g,sx!,sz!,.22,used.length===1?"#b46a42":"#aa5239",used.length===2);used.push({x:sx!,z:sz!});
    }
    if(f.shields){
      const banner=box(g,"#527c9e",.16,.2,.025,x+.32,.39,z,.012);
      box(banner,"#f4da8d",.025,.14,.012,0,0,.02,.001);box(banner,"#f4da8d",.11,.025,.012,0,.025,.02,.001);
    }
  }
  if(def.features.some(f=>f.kind==="monastery")){
    const g=new T.Group();g.userData.feature="m0";terrain.add(g);
    surface(g,"M22 25H88V75H22Z",highlight.includes("m0")?"#eac768":"#cbbb95",.11,.035);
    house(g,.52,.16,.36,"#81554b");house(g,.52,-.3,.2,"#6e5445",true);
    box(g,"#e8d7af",.035,.23,.04,.52,1.02,-.3,.004);box(g,"#e8d7af",.14,.035,.04,.52,1.055,-.3,.004);
  }
  return root;
}
export function pawnModel(color:string,farmer=false){
  const shape=new T.Shape();
  shape.moveTo(-.17,0);shape.lineTo(-.06,.2);shape.lineTo(-.2,.23);shape.lineTo(-.23,.35);shape.lineTo(-.1,.38);
  shape.bezierCurveTo(-.13,.64,.13,.64,.1,.38);shape.lineTo(.23,.35);shape.lineTo(.2,.23);shape.lineTo(.06,.2);shape.lineTo(.17,0);shape.lineTo(.02,0);shape.lineTo(0,.12);shape.lineTo(-.02,0);shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth:.14,steps:1,bevelEnabled:true,bevelThickness:.025,bevelSize:.022,bevelSegments:2,curveSegments:8});
  geometry.translate(0,farmer?-.28:0,-.07);const g=new T.Group();mesh(geometry,clay(color),g);g.scale.setScalar(.82);
  g.position.y=.13;
  if(farmer){g.rotation.x=-Math.PI/2;g.rotation.z=Math.PI/2;g.position.y=.189;}
  return g;
}
export function release(root:T.Object3D){
  root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});
  root.removeFromParent();
}
