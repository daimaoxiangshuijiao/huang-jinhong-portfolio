import { analyzeOrbit } from './orbit-math.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const clone = v => JSON.parse(JSON.stringify(v));
const $ = name => document.getElementById('orbit-' + name);
const canvas = $('canvas'), field = $('drawing'), arena = document.querySelector('.orbit-arena');
if (canvas && field && arena) mount();

function mount() {
  const ctx = canvas.getContext('2d');
  if (!ctx) { $('status').textContent = '当前浏览器无法创建绘图区，请换用支持Canvas的浏览器。'; return; }
  const ui = Object.fromEntries(['planet','score','grade','status','best','last','history','start','download','replay','practice','challenge','sound','coverage-live','progress-ring','score-label','measurements','circularity','coverage','closure','space','foreground'].map(k => [k,$(k)]));
  const key = 'recorder-lab:orbit:v2';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let size = {width:0,height:0,dpr:1}, state = 'ready', mode = 'challenge';
  let points = [], result = null, currentRecord = null, pointer = null, startTime = 0;
  let frame = 0, replayFrame = 0, replayFraction = 1, exporting = false;
  let sound = false, audio = null, tone = null, gain = null, storageAvailable = true;
  let store = {version:2,bests:{challenge:null,practice:null},recent:[]};
  let sums = {count:0,r:0,r2:0,sweep:0,previous:null};
  const metricValid = r => r && ['score','circularity','coverage','closure'].every(k=>Number.isFinite(r[k])&&r[k]>=0&&r[k]<=100) && typeof r.at==='string' && Number.isFinite(Date.parse(r.at));
  const traceValid = r => metricValid(r) && ['challenge','practice'].includes(r.mode) && Array.isArray(r.trace) && r.trace.length>=6 && r.trace.length<=800 && r.trace.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=3&&Math.abs(p.y)<=3);
  try {
    const saved = JSON.parse(localStorage.getItem(key)||'null');
    if(saved?.version===2){store.bests.challenge=metricValid(saved.bests?.challenge)?saved.bests.challenge:null;store.bests.practice=metricValid(saved.bests?.practice)?saved.bests.practice:null;store.recent=Array.isArray(saved.recent)?saved.recent.filter(traceValid).slice(0,3).map(r=>({...r,duration:Number.isFinite(r.duration)&&r.duration>=0?r.duration:1700,traceRadius:Number.isFinite(r.traceRadius)&&r.traceRadius>.05&&r.traceRadius<3?r.traceRadius:r.trace.reduce((sum,p)=>sum+Math.hypot(p.x,p.y),0)/r.trace.length})):[];}
    else {const old=JSON.parse(localStorage.getItem('recorder-lab:orbit:v1')||'null');if(metricValid(old?.best))store.bests.challenge={...old.best,mode:'challenge'};}
  } catch {storageAvailable=false;}
  const minSide = () => Math.min(size.width,size.height);
  const center = () => ({x:size.width/2,y:size.height/2});
  const note = s => {ui.status.textContent=s;};
  const format = n => n.toFixed(1)+'%';
  const normalize = p => ({x:(p.x-size.width/2)/minSide(),y:(p.y-size.height/2)/minSide(),t:p.t||0});
  const denormalize = p => ({x:p.x*minSide()+size.width/2,y:p.y*minSide()+size.height/2,t:p.t||0});
  function saveStore(){try{localStorage.setItem(key,JSON.stringify(store));storageAvailable=true;}catch{storageAvailable=false;note('成绩已计算；浏览器存储已满，本次记录无法在刷新后保留。');}}
  function controls(){ui.download.disabled=exporting||!result||state==='drawing';ui.replay.disabled=exporting||!currentRecord||state==='drawing';ui.start.disabled=exporting;ui.practice.disabled=exporting;ui.challenge.disabled=exporting;}
  function setState(next){state=next;arena.dataset.state=next;controls();}
  function history(){
    const best=store.bests[mode];ui.best.textContent=best?format(best.score):'—';ui.last.textContent=store.recent[0]?format(store.recent[0].score):'尚无本机记录';
    ui.history.replaceChildren();
    if(!store.recent.length){const li=document.createElement('li');li.textContent='完成第一圈，留下你的记录。';ui.history.append(li);return;}
    store.recent.forEach((r,i)=>{const li=document.createElement('li'),button=document.createElement('button'),number=document.createElement('span'),score=document.createElement('span'),time=document.createElement('small');
      number.textContent=String(i+1).padStart(2,'0');score.textContent=format(r.score);time.textContent=(r.mode==='practice'?'练习 ':'挑战 ')+new Date(r.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
      button.type='button';button.append(number,score,time);button.setAttribute('aria-label','查看'+format(r.score)+'的'+(r.mode==='practice'?'练习':'挑战')+'轨迹');button.addEventListener('click',()=>loadRecord(r));li.append(button);ui.history.append(li);
    });
  }
  function release(){const previous=pointer;pointer=null;if(previous!==null&&canvas.hasPointerCapture(previous)){try{canvas.releasePointerCapture(previous);}catch{}}}
  function stopSound(){if(tone){try{tone.stop();}catch{}tone.disconnect();tone=null;}if(gain){gain.disconnect();gain=null;}}
  async function startSound(){
    if(!sound)return;
    try {const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio??=new AC();await audio.resume();if(state!=='drawing'||!sound)return;stopSound();tone=audio.createOscillator();gain=audio.createGain();tone.type='sine';tone.frequency.value=170;gain.gain.setValueAtTime(.012,audio.currentTime);tone.connect(gain).connect(audio.destination);tone.start();}
    catch{sound=false;syncSound();}
  }
  function resultSound(score){
    if(!sound||!audio)return;
    const t=audio.currentTime;[0,4,7].forEach((step,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=(score>=85?260:190)*2**(step/12);g.gain.setValueAtTime(0,t+i*.07);g.gain.linearRampToValueAtTime(.022,t+i*.07+.012);g.gain.exponentialRampToValueAtTime(.0001,t+i*.07+.25);o.connect(g).connect(audio.destination);o.start(t+i*.07);o.stop(t+i*.07+.26);o.onended=()=>{o.disconnect();g.disconnect();};});
  }
  function syncSound(){ui.sound.setAttribute('aria-pressed',String(sound));ui.sound.querySelector('span').textContent=sound?'声音开启':'声音关闭';ui.sound.querySelector('use').setAttribute('href','icons.svg#'+(sound?'sound':'muted'));}
  function stopReplay(){if(replayFrame)cancelAnimationFrame(replayFrame);replayFrame=0;replayFraction=1;if(state==='replaying'){setState('result');requestDraw();}}
  function reset(message='一笔画完，松开后查看评分。',focus=false){
    release();stopReplay();stopSound();points=[];result=null;currentRecord=null;sums={count:0,r:0,r2:0,sweep:0,previous:null};
    ui.score.textContent='—';ui['score-label'].textContent='当前圆度';ui.grade.textContent='从任意方向开始。';ui.measurements.hidden=true;progress(0);setState('ready');note(message);requestDraw();if(focus)canvas.focus({preventScroll:true});
  }
  function setMode(next){if(exporting)return;mode=next;ui.challenge.setAttribute('aria-pressed',String(mode==='challenge'));ui.practice.setAttribute('aria-pressed',String(mode==='practice'));history();reset(next==='practice'?'跟随虚线练习；练习成绩独立保存。':'自由挑战没有参考圆；从任意方向开始。');}
  function progress(n){const p=clamp(n,0,100);ui['coverage-live'].textContent=Math.round(p)+'%';ui['progress-ring'].style.strokeDasharray=p+' 100';}
  function live(){
    if(sums.count<2)return;const mean=sums.r/sums.count;const variance=Math.max(0,sums.r2/sums.count-mean*mean);const c=clamp(1-Math.sqrt(variance)/Math.max(1,mean)*2.5)*100;
    ui.score.textContent=format(c);progress(Math.abs(sums.sweep)/TAU*100);ui.grade.textContent='松开，完成这一圈。';
    if(tone&&audio)tone.frequency.setTargetAtTime(150+c*1.2,audio.currentTime,.035);
  }
  function append(event){
    let events;try{events=event.getCoalescedEvents?.();}catch{}events=events?.length?[...events,event]:[event];const rect=canvas.getBoundingClientRect(),c=center();
    for(const e of events){const p={x:(e.clientX-rect.left)*size.width/rect.width,y:(e.clientY-rect.top)*size.height/rect.height,t:Math.max(0,performance.now()-startTime)};
      if(points.length&&Math.hypot(p.x-points.at(-1).x,p.y-points.at(-1).y)<.6)continue;
      if(points.length>=16000){reset('轨迹过长。一次只需画一圈，请重新开始。');return;}
      points.push(p);const r=Math.hypot(p.x-c.x,p.y-c.y),a=Math.atan2(p.y-c.y,p.x-c.x);sums.count++;sums.r+=r;sums.r2+=r*r;
      if(sums.previous!==null){let delta=a-sums.previous;if(delta>Math.PI)delta-=TAU;if(delta<-Math.PI)delta+=TAU;sums.sweep+=delta;}sums.previous=a;
    }
    live();requestDraw();
  }
  function grade(r){if(r.score>=98)return'近乎完美，轨道已锁定。';if(r.score>=90)return'漂亮的一圈，再接近一点。';if(r.score>=75)return'航迹稳定，还有提升空间。';if(r.coverage<85)return'还差一段，试着完整绕一圈。';if(r.closure<80)return'首尾没有接上，下次靠近起点。';return'保持半径，再挑战一次。';}
  function showResult(){
    if(!result)return;ui['score-label'].textContent=mode==='practice'?'本次练习':'本次得分';ui.score.textContent=format(result.score);ui.grade.textContent=grade(result);
    for(const k of ['circularity','coverage','closure'])ui[k].textContent=format(result[k]);ui.measurements.hidden=false;progress(result.coverage);setState('result');requestDraw();
  }
  function finish(){
    release();stopSound();const r=analyzeOrbit(points,size);
    if(!r.valid){const messages={'too-short':'轨迹太短，请按住拖动，完整画一圈。','too-small':'离中心太近，请在行星外围画一圈。','out-of-bounds':'轨迹超出绘图区，请在画面内重新画一圈。','too-long':'一次只需画一圈，请重新开始。'};reset(messages[r.reason]||'没有读到完整轨迹，请再试一次。');return;}
    result=r;const step=Math.max(1,Math.ceil(points.length/700));const trace=points.filter((_,i)=>i%step===0||i===points.length-1).map(normalize);
    currentRecord={...r,trace,traceRadius:r.meanRadius/minSide(),mode,at:new Date().toISOString(),duration:Math.round(performance.now()-startTime)};
    const improved=!store.bests[mode]||r.score>store.bests[mode].score;store.bests[mode]=improved?{score:r.score,circularity:r.circularity,coverage:r.coverage,closure:r.closure,mode,at:currentRecord.at}:store.bests[mode];store.recent=[clone(currentRecord),...store.recent].slice(0,3);
    history();showResult();note((improved?'刷新了'+(mode==='practice'?'练习':'挑战')+'最佳记录。':'这一圈已完成。')+'点击再画一圈，或直接按住开始。');saveStore();resultSound(r.score);
  }
  function loadRecord(record){if(exporting)return;stopReplay();release();stopSound();mode=record.mode;ui.challenge.setAttribute('aria-pressed',String(mode==='challenge'));ui.practice.setAttribute('aria-pressed',String(mode==='practice'));currentRecord=clone(record);result=clone(record);points=record.trace.map(denormalize);history();showResult();note('已恢复这一次的实际轨迹，可回放或保存。');}
  function repaint(){frame=0;ctx.setTransform(size.dpr,0,0,size.dpr,0,0);ctx.clearRect(0,0,size.width,size.height);drawTrace(ctx,size.width,size.height,points,result,state,replayFraction);}
  function requestDraw(){if(!frame)frame=requestAnimationFrame(repaint);}
  function drawTrace(c,w,h,trace,metrics,phase,fraction=1){
    const m=Math.min(w,h),cx=w/2,cy=h/2;let radius=phase==='ready'||phase==='drawing'?m*.36:(currentRecord?.traceRadius||.36)*m;
    c.save();
    if(mode==='practice'||phase==='result'||phase==='replaying'){
      c.strokeStyle='rgba(210,216,215,.34)';c.lineWidth=1;c.setLineDash([2,6]);c.beginPath();c.arc(cx,cy,radius,0,TAU);c.stroke();c.setLineDash([]);
    }
    if(trace.length>1){
      const count=Math.max(2,Math.ceil(trace.length*fraction));const mean=metrics?.meanRadius?radius:(sums.count?sums.r/sums.count:m*.36);
      c.lineCap='round';c.lineJoin='round';c.lineWidth=Math.max(2.2,m*.0038);c.shadowColor='#d9f87065';c.shadowBlur=6;
      for(let i=1;i<Math.min(count,trace.length);i++){const a=trace[i-1],b=trace[i];const deviation=Math.abs(Math.hypot(b.x-cx,b.y-cy)-mean)/Math.max(1,mean);c.strokeStyle=`rgba(217,248,112,${clamp(1-deviation*2,.4,1)})`;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
      c.shadowBlur=0;const tip=trace[Math.min(count,trace.length)-1];c.fillStyle='#eaffbc';c.shadowColor='#d9f870';c.shadowBlur=12;c.beginPath();c.arc(tip.x,tip.y,4.2,0,TAU);c.fill();c.shadowBlur=0;
      const first=trace[0];c.fillStyle='#d9f870';c.beginPath();c.arc(first.x,first.y,2.5,0,TAU);c.fill();
    }
    c.restore();
  }
  function resize(){
    const rect=field.getBoundingClientRect();if(rect.width<2||rect.height<2)return;
    const dpr=clamp(devicePixelRatio||1,1,2.5);if(Math.abs(size.width-rect.width)<.5&&Math.abs(size.height-rect.height)<.5&&size.dpr===dpr)return;
    const old=size.width&&size.height?points.map(normalize):[];if(state==='drawing')reset('画面尺寸改变了，请再画一圈。');
    size={width:rect.width,height:rect.height,dpr};if(old.length&&state==='result')points=old.map(denormalize);
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ui.planet.style.width=minSide()*.52+'px';ui.planet.style.height=minSide()*.52+'px';requestDraw();
  }
  function replay(){
    if(!currentRecord||exporting)return;if(state==='replaying'){stopReplay();requestDraw();note('回放已停止。');return;}
    const source=clone(currentRecord);points=source.trace.map(denormalize);if(reduce.matches){replayFraction=1;requestDraw();note('已显示完整轨迹；当前使用减少动态设置。');return;}
    setState('replaying');const start=performance.now(),duration=clamp(source.duration||1700,1200,3500);replayFraction=0;note('正在回放这一次的实际轨迹。');
    const tick=t=>{replayFrame=0;if(state!=='replaying'||document.hidden)return;replayFraction=clamp((t-start)/duration);requestDraw();if(replayFraction<1)replayFrame=requestAnimationFrame(tick);else{setState('result');note('回放完成，可以继续挑战。');}};replayFrame=requestAnimationFrame(tick);
  }
  function cover(c,img,x,y,w,h){if(!img?.complete||!img.naturalWidth)return;const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(img,x+(w-img.naturalWidth*scale)/2,y+(h-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale);c.restore();}
  async function download(){
    if(!currentRecord||exporting)return;const snapshot=clone(currentRecord);exporting=true;stopReplay();controls();note('正在制作这一次的航迹记录卡…');
    try{
      await document.fonts.ready;await Promise.all([ui.planet,ui.space,ui.foreground].map(i=>i.decode().catch(()=>{})));
      const card=document.createElement('canvas');card.width=1600;card.height=1200;const c=card.getContext('2d');c.fillStyle='#0c0e10';c.fillRect(0,0,1600,1200);cover(c,ui.space,0,0,1600,1200);
      c.fillStyle='#fff';c.font='oblique 8deg 48px ArchiveCard, ArchiveSans, sans-serif';c.fillText('跃迁航迹校准',72,90);c.font='20px ArchiveGrotesk, ArchiveSans, sans-serif';c.fillStyle='#b1b6ba';c.fillText(snapshot.mode==='practice'?'辅助练习 · 航迹记录卡':'自由挑战 · 航迹记录卡',74,130);
      const scene={x:70,y:175,w:1460,h:780};c.save();c.translate(scene.x,scene.y);const m=Math.min(scene.w,scene.h),pd=m*.52;c.drawImage(ui.planet,(scene.w-pd)/2,(scene.h-pd)/2,pd,pd);
      const trace=snapshot.trace.map(p=>({x:p.x*m+scene.w/2,y:p.y*m+scene.h/2}));const previous=currentRecord;currentRecord=snapshot;drawTrace(c,scene.w,scene.h,trace,snapshot,'result');currentRecord=previous;c.restore();
      c.strokeStyle='#ffffff42';c.beginPath();c.moveTo(72,990);c.lineTo(1528,990);c.stroke();c.fillStyle='#d9f870';c.font='80px ArchiveMono, monospace';c.fillText(format(snapshot.score),72,1090);
      c.font='18px ArchiveSans, sans-serif';[['圆度',snapshot.circularity],['覆盖',snapshot.coverage],['闭合',snapshot.closure]].forEach(([label,value],i)=>{c.fillStyle='#9a9fa4';c.fillText(label,750+i*245,1038);c.fillStyle='#fff';c.font='30px ArchiveMono, monospace';c.fillText(format(value),750+i*245,1085);c.font='18px ArchiveSans, sans-serif';});
      c.font='16px ArchiveGrotesk, ArchiveSans, sans-serif';c.fillStyle='#9a9fa4';c.fillText('黄进鸿 · 记录者实验室',74,1150);c.textAlign='right';c.fillText(new Date(snapshot.at).toLocaleString('zh-CN',{hour12:false}),1526,1150);
      const blob=await new Promise(resolve=>card.toBlob(resolve,'image/png'));if(!blob)throw Error('生成图片失败');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='orbit-'+snapshot.score.toFixed(1)+'-'+snapshot.at.slice(0,10)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);note('记录卡已下载，包含这一次的真实轨迹与评分。');
    }catch{note('记录卡未能生成；请重新尝试，成绩仍在。');}finally{exporting=false;controls();}
  }
  canvas.addEventListener('pointerdown',event=>{
    if(exporting||event.button>0)return;if(pointer!==null){reset('一次使用一根手指绘制，请重新开始。');return;}if(!event.isPrimary)return;event.preventDefault();stopReplay();stopSound();points=[];result=null;currentRecord=null;sums={count:0,r:0,r2:0,sweep:0,previous:null};ui.measurements.hidden=true;ui['score-label'].textContent='当前圆度';pointer=event.pointerId;startTime=performance.now();setState('drawing');canvas.setPointerCapture(pointer);append(event);note('保持到中心的距离，绕一周后松开。');startSound();
  });
  canvas.addEventListener('pointermove',event=>{if(pointer!==event.pointerId||state!=='drawing')return;event.preventDefault();append(event);});
  canvas.addEventListener('pointerup',event=>{if(pointer!==event.pointerId||state!=='drawing')return;append(event);if(state==='drawing')finish();});
  for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{if(pointer===event.pointerId&&state==='drawing')reset('绘制已取消；可以直接再画一圈。');});
  canvas.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();reset('准备好了，按住绘制。',true);}if(event.key==='Escape'){event.preventDefault();reset('已清除，可以重新画一圈。',true);}});
  ui.start.addEventListener('click',()=>reset('准备好了，按住绘制。',true));ui.replay.addEventListener('click',replay);ui.download.addEventListener('click',download);
  ui.challenge.addEventListener('click',()=>setMode('challenge'));ui.practice.addEventListener('click',()=>setMode('practice'));ui.sound.addEventListener('click',()=>{sound=!sound;syncSound();if(!sound)stopSound();});
  const suspend=()=>{if(state==='drawing')reset('绘制暂停了；返回后可以直接再画一圈。');stopReplay();stopSound();};window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
  reduce.addEventListener('change',()=>{if(reduce.matches)stopReplay();});
  arena.addEventListener('pointermove',event=>{if(reduce.matches||event.pointerType!=='mouse')return;const r=arena.getBoundingClientRect();arena.style.setProperty('--drift-x',((event.clientX-r.left)/r.width-.5)*10+'px');arena.style.setProperty('--drift-y',((event.clientY-r.top)/r.height-.5)*7+'px');});
  arena.addEventListener('pointerleave',()=>{arena.style.setProperty('--drift-x','0px');arena.style.setProperty('--drift-y','0px');});
  const observer=new ResizeObserver(resize);observer.observe(field);window.addEventListener('pagehide',()=>{observer.disconnect();if(frame)cancelAnimationFrame(frame);suspend();audio?.close();});
  function inspect(){return Object.freeze(clone({version:2,state,mode,pointCount:points.length,metrics:result,live:{circularity:sums.count?clamp(1-Math.sqrt(Math.max(0,sums.r2/sums.count-(sums.r/sums.count)**2))/Math.max(1,sums.r/sums.count)*2.5)*100:null,coverage:clamp(Math.abs(sums.sweep)/TAU)*100},size:{...size,centerX:size.width/2,centerY:size.height/2,idealRadius:minSide()*.36},best:store.bests[mode],last:store.recent[0]||null,recent:store.recent,storageAvailable,sound,replayFraction,pendingRaf:!!(frame||replayFrame),exporting}));}
  Object.defineProperty(window,'RecorderOrbit',{configurable:true,value:Object.freeze({inspect})});
  if(innerWidth>1000&&innerHeight>=850)document.querySelector('.orbit-recent').open=true;
  history();syncSound();setState('ready');resize();
}
