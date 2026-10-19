export const SCENES = {
 departure:{name:'出航平台',src:'../assets/archive-v2.webp',x:.43,y:.57},
 character:{name:'记录者近景',src:'../assets/hero-v2.webp',x:.59,y:.44},
 port:{name:'晨潮港口',src:'../assets/refinement-2026/port.webp',x:.65,y:.53},
 relay:{name:'轨道中继站',src:'../assets/refinement-2026/relay.webp',x:.70,y:.46},
 archive:{name:'记忆档案室',src:'../assets/refinement-2026/archive.webp',x:.72,y:.49},
 night:{name:'夜航归途',src:'../assets/refinement-2026/night.webp',x:.65,y:.49}
};
export const uid=()=>`d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
export const clone=value=>JSON.parse(JSON.stringify(value));
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const clean=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');
export function shot(scene='port',duration=3,dialogue='',action='',motion='push') {
 const asset=SCENES[scene]||{x:.5,y:.5};
 return {id:uid(),scene,crop:'wide',motion,duration,action,dialogue,transition:'cut',from:{x:asset.x,y:asset.y,zoom:1},to:{x:asset.x,y:asset.y,zoom:motion==='push'?1.16:1}};
}
const templateData={
 departure:{title:'归巢协议 · 出航',durations:[3,3,4,4,3,3],scenes:['departure','character','port','relay','archive','night'],lines:['记录开始。下一站，寻找失落的回声。','我会把每一次相遇带回来。','晨潮港口，出发。','中继信号已接收。','有一段记忆，仍在等待。','归巢协议，继续执行。']},
 decode:{title:'归巢协议 · 解码',durations:[4,3,4,4,5,4],scenes:['night','relay','character','archive','archive','departure'],lines:['一段信号，穿过长夜。','中继站没有记录它的来处。','但我认得这个频率。','在记忆深处，光正在醒来。','答案并非坐标，而是一次相遇。','这一次，换我回应。']},
 home:{title:'归巢协议 · 归巢',durations:[3,3,3,3,3,3],scenes:['relay','night','character','port','archive','departure'],lines:['旅程很长。','有些灯，始终没有熄灭。','我带回了你的回声。','熟悉的港口，新的晨光。','所有相遇，都值得被记住。','欢迎归巢。']}
};
export const TEMPLATES=[{id:'departure',name:'出航',seconds:20,description:'晨光、远征与第一道回声',scene:'departure'},{id:'decode',name:'解码',seconds:24,description:'一段信号，六个寻找答案的镜头',scene:'archive'},{id:'home',name:'归巢',seconds:18,description:'穿过长夜，将记忆带回港口',scene:'night'}];
export function template(id='departure'){
 const t=templateData[id]||templateData.departure;
 return {version:2,id:uid(),title:t.title,subtitles:true,slate:true,updatedAt:Date.now(),shots:t.scenes.map((scene,i)=>{
  const s=shot(scene,t.durations[i],t.lines[i],`以${SCENES[scene].name}为主体，保持空间连续，以光影连接这一段叙事。`,i%3===1?'static':'push');
  s.transition=i===0?'cut':i%3===0?'black':'dissolve';
  if(scene==='character'){s.from.zoom=1.3;s.to.zoom=1.44;s.crop='medium'}
  if(id==='decode'&&i===4){s.from.zoom=1.7;s.to.zoom=2.1;s.crop='close'}
  return s;
 })};
}
export function validate(raw,customIds=[]){
 if(!raw||typeof raw!=='object'||![1,2].includes(raw.version))throw Error('不支持的项目版本。');
 if(typeof raw.title!=='string'||raw.title.length>60||!clean(raw.title).trim())throw Error('项目名称需要 1–60 个字符。');
 if(!Array.isArray(raw.shots)||raw.shots.length<1||raw.shots.length>12)throw Error('项目需要包含 1–12 个镜头。');
 const ids=new Set();
 const frame=(value,fallback)=>{
  if(!value)return clone(fallback);
  if(typeof value!=='object'||!['x','y','zoom'].every(k=>typeof value[k]==='number'&&Number.isFinite(value[k])))throw Error('机位参数不正确。');
  if(value.x<0||value.x>1||value.y<0||value.y>1||value.zoom<1||value.zoom>4)throw Error('机位参数超出范围。');
  return {x:value.x,y:value.y,zoom:value.zoom};
 };
 const shots=raw.shots.map(s=>{
  if(!s||typeof s.scene!=='string'||(!Object.hasOwn(SCENES,s.scene)&&!customIds.includes(s.scene)))throw Error('项目引用了缺失的素材。');
  if(typeof s.duration!=='number'||!Number.isFinite(s.duration)||s.duration<.5||s.duration>12)throw Error('镜头时长需要在 0.5–12 秒之间。');
  if(typeof s.action!=='string'||s.action.length>300||typeof s.dialogue!=='string'||s.dialogue.length>180)throw Error('动作最多 300 字符，对白最多 180 字符。');
  const base=shot(s.scene,s.duration,s.dialogue,s.action,['static','push','left','right'].includes(s.motion)?s.motion:'static');
  const zoom={wide:1,medium:1.38,close:1.95}[s.crop]||1;
  base.from.zoom=zoom;base.to.zoom=base.motion==='push'?Math.min(4,zoom*1.16):zoom;
  if(raw.version===1&&['left','right'].includes(base.motion)){base.from.zoom=Math.min(4,zoom*1.12);base.to.zoom=base.from.zoom;base.to.x=clamp(base.from.x+(base.motion==='right'?.14:-.14),0,1)}
  let id=typeof s.id==='string'&&/^[\w-]{1,80}$/.test(s.id)&&!ids.has(s.id)?s.id:uid();ids.add(id);
  return {...base,id,crop:['wide','medium','close'].includes(s.crop)?s.crop:'wide',action:clean(s.action),dialogue:clean(s.dialogue),from:frame(s.from,base.from),to:frame(s.to,base.to),transition:['cut','dissolve','black'].includes(s.transition)?s.transition:'cut'};
 });
 return {version:2,id:typeof raw.id==='string'&&/^[\w-]{1,80}$/.test(raw.id)?raw.id:uid(),title:clean(raw.title).trim(),subtitles:raw.subtitles!==false,slate:raw.slate!==false,updatedAt:typeof raw.updatedAt==='number'&&Number.isFinite(raw.updatedAt)?raw.updatedAt:Date.now(),shots};
}
export const LIBRARY_KEY='recorder-director-library-v2';
export async function openAssets(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('recorder-director-assets',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('images',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('本机图片存储不可用，请保留项目 JSON 备份。'));
 });
}
export async function assetRecords(db){return new Promise((resolve,reject)=>{const r=db.transaction('images').objectStore('images').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function putAsset(db,record){return new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
export async function compressImage(file){
 if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)||file.size>10*1024*1024)throw Error('请选择 10 MB 以内的 JPG、PNG、WebP 或 AVIF 图片。');
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width*bitmap.height>24000000)throw Error('图片尺寸过大，请使用 2400 万像素以内的图片。');
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  let data=canvas.toDataURL('image/webp',.8);
  if(data.length>1000000)data=canvas.toDataURL('image/webp',.55);
  if(data.length>1400000)throw Error('图片压缩后仍过大，请换一张较小的图片。');
  return {id:uid(),name:clean(file.name).slice(0,60),src:data,width:canvas.width,height:canvas.height,x:.5,y:.5,custom:true};
 }finally{bitmap.close()}
}
