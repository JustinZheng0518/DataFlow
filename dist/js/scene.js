/** Canvas view adapter. Rendering only; interaction returns semantic station IDs. */
const COLORS={floor:'#e0c6a2',seam:'#d5b893',wood:'#ba8055',top:'#ecd8b2',front:'#b98255',side:'#a97149',green:'#4c6b50'};
export function drawFood(ctx,x,y,scale,dish,time=0){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const a=dish.ingredients;
 if(dish.type==='pizza'){
  ctx.fillStyle='#ffffff';ctx.beginPath();ctx.ellipse(0,8,72,38,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e0dfd0';ctx.lineWidth=2;ctx.stroke();
  if(a.includes('dough')){ctx.fillStyle=dish.burned?'#654633':'#dfab61';ctx.beginPath();ctx.ellipse(0,0,63,33,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=dish.burned?'#493628':a.includes('sauce')?'#c65936':'#f1ce92';ctx.beginPath();ctx.ellipse(0,-2,55,27,0,0,Math.PI*2);ctx.fill();
   if(a.includes('mozzarella')){ctx.fillStyle=dish.burned?'#725235':dish.cooked?'#f4cc69':'#f0df9b';ctx.beginPath();ctx.ellipse(0,-3,50,24,0,0,Math.PI*2);ctx.fill();for(let i=0;i<12;i++){let t=i*2.4;ctx.fillStyle='#dfad59';ctx.beginPath();ctx.ellipse(Math.cos(t)*(14+i*2),Math.sin(t)*(6+i),2.5,1.5,0,0,Math.PI*2);ctx.fill();}}
   if(a.includes('pepperoni'))for(const [px,py] of [[-25,-10],[4,-17],[27,-7],[-13,9],[17,10],[-38,2]]){ctx.fillStyle=dish.burned?'#502d20':'#ad4130';ctx.beginPath();ctx.ellipse(px,py,8,5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e08251';ctx.beginPath();ctx.ellipse(px+2,py-1,1.5,1,0,0,Math.PI*2);ctx.fill();}
   if(a.includes('mushroom'))for(const [px,py] of [[-26,-7],[0,-16],[22,-5],[-10,10],[28,9]]){ctx.fillStyle='#997357';ctx.beginPath();ctx.ellipse(px,py,7,4,0,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#ede1bb';ctx.fillRect(px-2,py,4,5);}
  }
 }else{
  ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(0,26,65,28,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e0dfd0';ctx.stroke();let level=18;
  for(const id of a){if(id==='bunBottom'){ctx.fillStyle='#c98c48';ctx.beginPath();ctx.ellipse(0,level,47,19,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e8b96b';ctx.beginPath();ctx.ellipse(0,level-5,47,16,0,0,Math.PI*2);ctx.fill();level-=10;}
   if(id==='patty'){ctx.fillStyle='#694129';ctx.beginPath();ctx.ellipse(0,level,49,17,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#865535';ctx.beginPath();ctx.ellipse(0,level-5,49,14,0,0,Math.PI*2);ctx.fill();for(let i=0;i<5;i++){ctx.strokeStyle='#593623';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-32+i*14,level-11);ctx.lineTo(-20+i*14,level-1);ctx.stroke();}level-=12;}
   if(id==='cheese'){ctx.fillStyle='#edbd42';ctx.beginPath();ctx.moveTo(-48,level);ctx.lineTo(7,level-18);ctx.lineTo(48,level);ctx.lineTo(0,level+13);ctx.closePath();ctx.fill();level-=5;}
   if(id==='lettuce'){ctx.fillStyle='#79a64c';ctx.beginPath();for(let i=0;i<22;i++){let t=i/22*Math.PI*2;let rx=i%2?48:54;ctx.lineTo(Math.cos(t)*rx,level+Math.sin(t)*14);}ctx.closePath();ctx.fill();level-=7;}
   if(id==='tomato'){ctx.fillStyle='#d96641';ctx.beginPath();ctx.ellipse(0,level,45,14,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ef9464';ctx.beginPath();ctx.ellipse(0,level-3,37,9,0,0,Math.PI*2);ctx.fill();level-=7;}
   if(id==='bunTop'){ctx.fillStyle='#b5793d';ctx.beginPath();ctx.ellipse(0,level,49,17,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e1a654';ctx.beginPath();ctx.ellipse(0,level-9,49,26,0,Math.PI,Math.PI*2);ctx.lineTo(49,level-3);ctx.quadraticCurveTo(0,level+18,-49,level-3);ctx.closePath();ctx.fill();ctx.fillStyle='#f9df9d';for(const [px,py] of [[-24,-14],[-5,-23],[15,-19],[31,-11],[-13,-8],[9,-6]]){ctx.save();ctx.translate(px,level+py);ctx.rotate(.6);ctx.fillRect(-2,-1,5,2);ctx.restore();}level-=24;}
  }
 }
 if(dish.cooked&&!dish.burned){ctx.strokeStyle='#fff8dfaa';ctx.lineWidth=2;for(let i=0;i<3;i++){let sy=-42-Math.sin(time*2+i)*4;ctx.beginPath();ctx.moveTo(-18+i*18,sy);ctx.bezierCurveTo(-25+i*18,sy-9,-10+i*18,sy-15,-18+i*18,sy-23);ctx.stroke();}}
 ctx.restore();
}
export class KitchenScene{
 constructor(canvas,onAction){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onAction=onAction;this.hotspots=[];this.hover=null;this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);canvas.addEventListener('pointermove',e=>{let p=this.pointer(e);let h=this.hotspots.find(h=>Math.hypot(p.x-h.x,p.y-h.y)<h.radius);this.hover=h?.id??null;canvas.style.cursor=h?'pointer':'default';});canvas.addEventListener('pointerleave',()=>this.hover=null);canvas.addEventListener('click',e=>{let p=this.pointer(e);let h=this.hotspots.find(h=>Math.hypot(p.x-h.x,p.y-h.y)<h.radius);if(h)this.onAction(h.id);});}
 pointer(e){let r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/this.scale-this.offsetX,y:(e.clientY-r.top)/this.scale-this.offsetY};}
 resize(){let r=this.canvas.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);this.canvas.width=r.width*d;this.canvas.height=r.height*d;this.dpr=d;this.width=r.width;this.height=r.height;this.scale=Math.min(r.width/960,r.height/530);this.offsetX=(r.width/this.scale-960)/2;this.offsetY=(r.height/this.scale-530)/2;}
 point(x,y,z=0){return[430+(x-y)*42,122+(x+y)*21-z];}
 poly(points,color,stroke){let c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.8;c.stroke();}}
 iso(points,color,stroke){this.poly(points.map(p=>this.point(...p)),color,stroke);}
 box(x,y,w,d,h,z=0,top=COLORS.top,front=COLORS.front,side=COLORS.side){this.iso([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top);this.iso([[x+w,y,z+h],[x+w,y+d,z+h],[x+w,y+d,z],[x+w,y,z]],side);this.iso([[x,y+d,z+h],[x+w,y+d,z+h],[x+w,y+d,z],[x,y+d,z]],front);}
 ellipse(x,y,rx,ry,color){let c=this.ctx;c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
 label(x,y,text,id,active){let c=this.ctx;c.save();c.font='11px system-ui';let w=c.measureText(text).width+28;c.fillStyle=active||this.hover===id?'#284d36':'#fffff6e8';c.beginPath();c.roundRect(x-w/2,y-12,w,25,7);c.fill();c.fillStyle=active||this.hover===id?'#fff':'#5e7656';c.textAlign='center';c.fillText(text,x,y+4);c.restore();this.hotspots.push({id,x,y:y-20,radius:50});}
 render(s,time){if(!this.width)return;let c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);c.scale(this.scale,this.scale);c.translate(this.offsetX,this.offsetY);this.hotspots=[];
  c.fillStyle='#d9e3d5';c.fillRect(-this.offsetX,-this.offsetY,this.width/this.scale,this.height/this.scale);
  // A cutaway kitchen, built from the same small isometric primitives.
  this.ellipse(493,415,364,70,'#c2cdb77a');
  this.iso([[0,0,0],[11,0,0],[11,8,0],[0,8,0]],COLORS.floor);
  for(let x=0;x<11;x++)for(let y=0;y<8;y++)this.iso([[x,y,0],[x+1,y,0],[x+1,y+1,0],[x,y+1,0]],(x+y)%2?'#e0c6a2':'#e8d1b0','#d8c09e');
  this.iso([[0,0,0],[11,0,0],[11,0,125],[0,0,125]],'#f5f0da');this.iso([[0,0,0],[0,8,0],[0,8,125],[0,0,125]],'#eae7d1');
  this.iso([[0,0,60],[11,0,60],[11,0,70],[0,0,70]],'#d4ddc5');this.iso([[0,0,60],[0,8,60],[0,8,70],[0,0,70]],'#c7d2b9');
  for(let x=0;x<11;x++){this.iso([[x,0,0],[x+1,0,0],[x+1,0,53],[x,0,53]],'#e6e9d3','#d1d8c3');}
  // Back wall signage, shelf and sunlit window.
  c.save();let sign=this.point(5.2,0,100);c.translate(...sign);c.transform(1,.5,0,1,0,0);c.fillStyle='#496a4a';c.font='bold 27px Georgia';c.textAlign='center';c.fillText('SIZZLE',0,0);c.font='7px system-ui';c.fillText('GOOD FOOD. GOOD MOOD.',0,14);c.restore();
  this.iso([[0,2.0,76],[0,4.5,76],[0,4.5,122],[0,2.0,122]],'#92b8a0');this.iso([[0,2.15,80],[0,4.35,80],[0,4.35,118],[0,2.15,118]],'#c6e0cd');this.iso([[0,3.1,80],[0,3.3,80],[0,3.3,118],[0,3.1,118]],'#f8f1d6');this.iso([[0,2.15,98],[0,4.35,98],[0,4.35,101],[0,2.15,101]],'#f8f1d6');
  this.box(.15,5.9,1.25,1.05,100,0,'#eef1dc','#aebba1','#91a68e');this.box(.12,5.85,1.31,1.12,3,100,'#ced7c0','#b7c5ac','#a3b496');
  let fh=this.point(.8,7,48);c.strokeStyle='#718a6b';c.lineWidth=3;c.beginPath();c.moveTo(fh[0]-10,fh[1]-18);c.lineTo(fh[0]-10,fh[1]-2);c.stroke();this.iso([[.2,6.91,60],[1.35,6.91,60]],'#ddd');
  // Back worktops.
  this.box(.7,.5,9.8,1.6,44,0,'#c8cdb7','#9eae91','#8b9c80');this.box(.62,.42,10,1.78,7,44,'#f4ecd4','#d9ccab','#c3b994');
  for(let x=1;x<10;x+=1.7){let p=this.point(x,2.13,25);c.strokeStyle='#75886b';c.lineWidth=2;c.beginPath();c.moveTo(p[0]-8,p[1]);c.lineTo(p[0]+14,p[1]+11);c.stroke();}
  // Griddle and oven with legible cooking states.
  this.box(1.1,.7,2.05,1.2,9,51,'#52605a','#3f4c45','#303b35');this.box(1.25,.85,1.7,.85,3,60,'#383d34','#242c24','#242c24');
  for(let i=0;i<6;i++){let p=this.point(1.4+i*.22,1,64),q=this.point(1.4+i*.22,1.65,64);c.strokeStyle='#606c59';c.lineWidth=2;c.beginPath();c.moveTo(...p);c.lineTo(...q);c.stroke();}
  if(s.grill){let p=this.point(2,1.35,68);this.ellipse(...p,19,10,s.grill.burned?'#322c25':'#875736');if(s.grill.elapsed>=5)this.steam(p[0],p[1]-7,time);}
  this.box(4.15,.58,2.2,1.4,53,51,'#c6cdb5','#96a48c','#869a7c');this.iso([[4.42,1.99,59],[6.08,1.99,59],[6.08,1.99,90],[4.42,1.99,90]],s.oven?'#6b4731':'#394e3c');this.iso([[4.7,2,65],[5.9,2,65],[5.9,2,83],[4.7,2,83]],s.oven?'#dc9454':'#50614a');
  let oh=this.point(5.2,2.01,95);c.strokeStyle='#e5e7d1';c.lineWidth=3;c.beginPath();c.moveTo(oh[0]-20,oh[1]-10);c.lineTo(oh[0]+20,oh[1]+10);c.stroke();
  if(s.oven&&s.oven.elapsed>=7){let p=this.point(5.3,1.3,112);this.steam(...p,time);}
  this.box(7.4,.78,1.65,1.1,3,51,'#9cae9e','#859b89','#718b78');this.box(7.65,.94,1.2,.7,1,54,'#617f73','#617f73','#617f73');let tap=this.point(8.1,.75,72);c.strokeStyle='#bdc9b7';c.lineWidth=5;c.beginPath();c.moveTo(tap[0],tap[1]+15);c.lineTo(tap[0],tap[1]-8);c.quadraticCurveTo(tap[0]+8,tap[1]-16,tap[0]+14,tap[1]-6);c.stroke();
  // Dish shelf and a plant.
  this.box(8.3,.06,2,.3,4,102,'#a8b697','#718663','#718663');for(let i=0;i<3;i++){let p=this.point(8.75+i*.45,.19,109);this.ellipse(...p,13,6,'#fff9e4');}this.plant(10.03,1.12,53);
  // Center island, with two independent prep surfaces.
  this.box(2.5,3.8,5.9,2.25,46,0,'#e8d4ad','#bf895d','#a2714c');this.box(2.4,3.72,6.1,2.4,8,46,'#f2e0be','#d2b48a','#c8ab7f');
  for(let x=3;x<8;x+=1.7){this.iso([[x,6.055,8],[x+1.3,6.055,8],[x+1.3,6.055,39],[x,6.055,39]],'#c38b5d','#b37b52');let p=this.point(x+.6,6.07,30);c.strokeStyle='#976440';c.lineWidth=2;c.beginPath();c.moveTo(p[0]-10,p[1]-5);c.lineTo(p[0]+10,p[1]+5);c.stroke();}
  this.box(2.85,4.05,2.15,1.5,3,54,s.station==='pizza'?'#e9bb78':'#dfbd8d','#c79b67','#c79b67');this.box(5.65,4.05,2.15,1.5,3,54,s.station==='burger'?'#e9bb78':'#dfbd8d','#c79b67','#c79b67');
  let p=this.point(3.9,4.8,63);drawFood(c,...p,.57,s.pizza,time);let b=this.point(6.75,4.8,63);drawFood(c,...b,.57,s.burger,time);
  // Ingredient tubs on the countertop.
  for(const [x,color] of [[3,'#d36d48'],[3.8,'#ecd28b'],[4.6,'#a94834'],[6,'#88a654'],[6.8,'#cc7050'],[7.6,'#edc354']]){this.box(x,3.8,.53,.5,6,54,'#d4d9c3','#afba9e','#a1b095');this.box(x+.07,3.86,.4,.37,1,60,color,color,color);}
  // Pots, bottles and herb accents.
  this.box(.9,3.25,.65,.65,44,0,'#ddd5b8','#c3b597','#ac9e83');this.plant(1.2,3.55,46);
  for(const [x,col] of [[9.6,'#d4844a'],[10.1,'#8ba568']]){let a=this.point(x,1.1,54);c.fillStyle=col;c.beginPath();c.roundRect(a[0]-6,a[1]-18,12,22,3);c.fill();c.fillStyle='#e2d5ae';c.fillRect(a[0]-3,a[1]-24,6,7);}
  this.box(9.1,5.4,1.05,1.05,38,0,'#c1a272','#ab885d','#95784f');this.box(9.5,5.4,.12,.15,34,38,'#987c51','#987c51','#987c51');this.box(9.3,6.6,1.05,.7,24,0,'#718e61','#597a4c','#486f41');
  // Pendant lights.
  for(const [x,y] of [[3.7,3.6],[6.8,3.6]]){let lp=this.point(x,y,185);c.strokeStyle='#879575';c.lineWidth=2;c.beginPath();c.moveTo(lp[0],lp[1]-50);c.lineTo(lp[0],lp[1]);c.stroke();this.ellipse(lp[0],lp[1]+4,24,11,'#697f5d');c.fillStyle='#7d956b';c.beginPath();c.moveTo(lp[0]-24,lp[1]+3);c.quadraticCurveTo(lp[0],lp[1]-30,lp[0]+24,lp[1]+3);c.fill();this.ellipse(lp[0],lp[1]+5,20,7,'#eedcb0');}
  let gl=this.point(2,1.3,75),ov=this.point(5.25,1.2,124);this.label(gl[0]-18,gl[1]-20,s.grill?(s.grill.elapsed>=5?'Collect patty':'Grilling…'):'Griddle','grill',false);this.label(ov[0]+5,ov[1]-20,s.oven?(s.oven.elapsed>=7?'Collect pizza':'Baking…'):'Oven','oven',false);
  let pl=this.point(3.85,6.15,2),bl=this.point(6.7,6.15,2);this.label(pl[0],pl[1]+12,'Pizza prep','pizza',s.station==='pizza');this.label(bl[0],bl[1]+12,'Burger prep','burger',s.station==='burger');
 }
 steam(x,y,t){let c=this.ctx;c.save();c.strokeStyle='#fffbedaa';c.lineWidth=2;for(let i=0;i<3;i++){let sy=y-Math.sin(t*2+i)*4;c.beginPath();c.moveTo(x-12+i*12,sy);c.bezierCurveTo(x-20+i*12,sy-10,x-3+i*12,sy-17,x-12+i*12,sy-29);c.stroke();}c.restore();}
 plant(x,y,z){let p=this.point(x,y,z),c=this.ctx;this.ellipse(p[0],p[1],15,7,'#ca9161');c.fillStyle='#cfa377';c.beginPath();c.moveTo(p[0]-15,p[1]);c.lineTo(p[0]-10,p[1]+17);c.lineTo(p[0]+10,p[1]+17);c.lineTo(p[0]+15,p[1]);c.fill();for(let i=0;i<6;i++){let t=i*1.1;c.save();c.translate(p[0],p[1]-5);c.rotate(t);this.ellipse(0,-12,5,15,i%2?'#789b63':'#5e8a5a');c.restore();}}
}
