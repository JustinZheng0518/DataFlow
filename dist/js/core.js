/**
 * Sizzle Kitchen game domain. No DOM, rendering or input dependencies.
 * Desktop, touch and future XR adapters dispatch the same semantic actions.
 * All time is supplied through tick(seconds), allowing pause and deterministic tests.
 */
export const INGREDIENTS = {
 dough:{name:'Dough',icon:'🫓'}, sauce:{name:'Tomato sauce',icon:'🥫'}, mozzarella:{name:'Mozzarella',icon:'🧀'}, pepperoni:{name:'Pepperoni',icon:'🥓'}, mushroom:{name:'Mushroom',icon:'🍄'},
 bunBottom:{name:'Bottom bun',icon:'🍞'}, patty:{name:'Cooked patty',icon:'🥩'}, cheese:{name:'Cheese',icon:'🧀'}, lettuce:{name:'Lettuce',icon:'🥬'}, tomato:{name:'Tomato',icon:'🍅'}, bunTop:{name:'Top bun',icon:'🍔'}
};
export const RECIPES = [
 {id:'margherita',name:'Margherita Pizza',type:'pizza',price:42,ingredients:['dough','sauce','mozzarella'],description:'Dough · Tomato sauce · Mozzarella'},
 {id:'pepperoni',name:'Pepperoni Pizza',type:'pizza',price:48,ingredients:['dough','sauce','mozzarella','pepperoni'],description:'Classic pizza with pepperoni'},
 {id:'mushroom',name:'Mushroom Pizza',type:'pizza',price:46,ingredients:['dough','sauce','mozzarella','mushroom'],description:'Classic pizza with mushrooms'},
 {id:'classic',name:'Classic Burger',type:'burger',price:32,ingredients:['bunBottom','patty','lettuce','tomato','bunTop'],description:'Bun · patty · lettuce · tomato'},
 {id:'cheeseburger',name:'Cheeseburger',type:'burger',price:36,ingredients:['bunBottom','patty','cheese','lettuce','bunTop'],description:'Bun · patty · cheese · lettuce'},
 {id:'doublecheese',name:'Tomato Cheeseburger',type:'burger',price:38,ingredients:['bunBottom','patty','cheese','tomato','bunTop'],description:'Bun · patty · cheese · tomato'}
];
const dish = type => ({type,ingredients:[],cooked:false,burned:false});
export class KitchenGame {
 constructor({random=Math.random}={}) { this.random=random; this.listeners=new Set(); this.reset('practice'); }
 subscribe(fn){this.listeners.add(fn); return ()=>this.listeners.delete(fn);}
 emit(){for(const fn of this.listeners)fn(this.state);}
 reset(mode='practice'){
  this.state={mode,paused:false,ended:false,remaining:180,elapsed:0,station:'pizza',orders:[],selectedOrder:null,nextId:1,score:0,revenue:0,served:0,missed:0,combo:0,pizza:dish('pizza'),burger:dish('burger'),oven:null,grill:null,pattyReady:false,message:'Welcome, chef! Pick a ticket and start prepping.',messageType:'info',event:'reset'};
  this.addOrder(RECIPES[0]);this.addOrder(RECIPES[4]);this.addOrder(RECIPES[1]);this.state.selectedOrder=this.state.orders[0].id;this.emit();
 }
 addOrder(recipe){let s=this.state; if(s.orders.length>=3)return; const r=recipe??RECIPES[Math.floor(this.random()*RECIPES.length)];s.orders.push({id:s.nextId++,recipeId:r.id,remaining:95,total:95});}
 get recipe(){return RECIPES.find(r=>r.id===this.state.orders.find(o=>o.id===this.state.selectedOrder)?.recipeId);}
 say(message,type='info',event='action'){Object.assign(this.state,{message,messageType:type,event});}
 dispatch(action){let s=this.state;if(action.type==='RESET'){this.reset(action.mode);return;}
  if(action.type==='PAUSE'){if(!s.ended){s.paused=!s.paused;this.emit();}return;}
  if(s.paused||s.ended)return;
  switch(action.type){
   case 'SELECT_ORDER':{let o=s.orders.find(o=>o.id===action.id);if(o){s.selectedOrder=o.id;s.station=RECIPES.find(r=>r.id===o.recipeId).type;this.say('Follow the ticket recipe. The oven and griddle can work at the same time.');}break;}
   case 'SELECT_STATION':if(['pizza','burger'].includes(action.station)){s.station=action.station;this.say(action.station==='pizza'?'Pizza station ready.':'Burger station ready. Start by grilling a patty.');}break;
   case 'ADD':this.addIngredient(action.ingredient);break;
   case 'BAKE':{if(s.oven){this.say('The oven is busy. Collect the pizza before baking another.','error');break;}let p=s.pizza;if(!['dough','sauce','mozzarella'].every(i=>p.ingredients.includes(i))){this.say('Add dough, tomato sauce, and mozzarella before baking.','error');break;}if(p.cooked){this.say('This pizza is already baked and ready to serve.','error');break;}s.oven={dish:p,elapsed:0,duration:7};s.pizza=dish('pizza');this.say('Pizza in the oven! Collect it in 7 seconds.','info','cook');break;}
   case 'GRILL':if(s.grill||s.pattyReady){this.say('Collect or use the previous patty first.','error');}else{s.grill={elapsed:0,duration:5,burned:false};this.say('The patty is sizzling. Collect it in 5 seconds.','info','cook');}break;
   case 'COLLECT_OVEN':{let o=s.oven;if(!o){this.say('There is no pizza in the oven yet.','error');break;}if(o.elapsed<o.duration){this.say('The pizza is not ready yet. Give it a little longer.','error');break;}if(s.pizza.ingredients.length){this.say('The pizza counter is occupied. Clear it before collecting your pizza.','error');break;}s.pizza={...o.dish,cooked:true,burned:o.dish.burned};s.oven=null;s.station='pizza';this.say(s.pizza.burned?'The pizza burnt. Clear the counter and try again.':'Fresh out of the oven! Check the ticket, then serve.',s.pizza.burned?'error':'success','ready');break;}
   case 'COLLECT_GRILL':{let g=s.grill;if(!g){this.say('Click Grill a patty first.','error');break;}if(g.elapsed<g.duration){this.say('The patty is not ready yet. Give it a little longer.','error');break;}s.grill=null;if(g.burned){this.say('The patty burnt and was discarded. Grill another one.','error');}else{s.pattyReady=true;s.station='burger';this.say('Patty ready! Click Cooked patty to add it to your burger.','success','ready');}break;}
   case 'CLEAR':s[s.station]=dish(s.station);this.say('Counter cleared. Ready for a fresh start.');break;
   case 'SERVE':this.serve();break;
  }this.emit();
 }
 addIngredient(id){const s=this.state,p=s[s.station],pizza=s.station==='pizza',allowed=pizza?['dough','sauce','mozzarella','pepperoni','mushroom']:['bunBottom','patty','cheese','lettuce','tomato','bunTop'];
  if(!allowed.includes(id))return;
  if(p.cooked||p.burned){this.say('You cannot add toppings after baking. Serve the pizza or clear the counter.','error');return;}
  if(p.ingredients.includes(id)){this.say('You have already added that ingredient.','error');return;}
  if(!p.ingredients.length&&id!==(pizza?'dough':'bunBottom')){this.say(pizza?'Start with the dough.':'Start with a bottom bun.','error');return;}
  if(pizza&&id!=='dough'&&id!=='sauce'&&!p.ingredients.includes('sauce')){this.say('Add tomato sauce before the other toppings.','error');return;}
  if(!pizza&&p.ingredients.includes('bunTop')){this.say('The burger is closed. Serve it or start over.','error');return;}
  if(id==='bunTop'&&!p.ingredients.includes('patty')){this.say('Add the cooked patty first.','error');return;}
  if(id==='patty'&&!s.pattyReady){this.say('No cooked patty yet. Grill one, then collect it.','error');return;}
  if(id==='patty')s.pattyReady=false;p.ingredients.push(id);this.say(`Added ${INGREDIENTS[id].name.toLowerCase()}.`,'info','ingredient');
 }
 serve(){let s=this.state,r=this.recipe,p=s[s.station];if(!r){this.say('Select a ticket before serving.','error');return;}
  if(r.type!==s.station){this.say('This station does not match the selected ticket.','error');return;}
  if(p.burned){this.say('Burnt food cannot be served. Make a fresh dish.','error');return;}
  if(!r.ingredients.every(i=>p.ingredients.includes(i))||p.ingredients.length!==r.ingredients.length){this.say('The ingredients do not match. Check for missing or extra toppings.','error');return;}
  if(r.type==='pizza'&&!p.cooked){this.say('The pizza needs baking. Put it in the oven first.','error');return;}
  const o=s.orders.find(o=>o.id===s.selectedOrder);s.combo++;const bonus=s.mode==='practice'?0:Math.round(o.remaining/o.total*20);s.score+=100+bonus+Math.min(s.combo-1,5)*10;s.revenue+=r.price;s.served++;s.orders=s.orders.filter(x=>x.id!==o.id);s[s.station]=dish(s.station);this.addOrder();s.selectedOrder=s.orders[0]?.id??null;this.say(`${r.name} served! +¥${r.price} · Combo ×${s.combo}`,'success','serve');
 }
 tick(dt){const s=this.state;if(s.paused||s.ended||!Number.isFinite(dt)||dt<=0)return;s.elapsed+=dt;
  for(const slot of ['oven','grill']){const c=s[slot];if(c){const before=c.elapsed;c.elapsed+=dt;if(before<c.duration&&c.elapsed>=c.duration)this.say(slot==='oven'?'Ding! Your pizza is ready. Click Collect pizza.':'Sizzle! Your patty is ready. Click Collect patty.','success','ready');if(s.mode==='shift'&&c.elapsed>=c.duration+10){if(slot==='oven')c.dish.burned=true;else c.burned=true;}}}
  if(s.mode==='shift'){s.remaining=Math.max(0,s.remaining-dt);for(const o of s.orders)o.remaining-=dt;const expired=s.orders.filter(o=>o.remaining<=0);if(expired.length){s.missed+=expired.length;s.combo=0;s.orders=s.orders.filter(o=>o.remaining>0);for(const o of expired)this.addOrder();if(!s.orders.some(o=>o.id===s.selectedOrder))s.selectedOrder=s.orders[0]?.id;this.say('A customer ran out of patience. Keep going with the next order!','error','miss');}if(s.remaining<=0){s.ended=true;this.say('Shift complete. Nice work, chef!','success','end');}}
  this.emit();
 }
}
