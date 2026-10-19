import {total,render} from './director-render.js';
import {inspectWebm,setWebmDuration} from './director-webm.js';

let configuration=null;
let runtime={backend:'webcodecs',phase:'idle',encoderState:'closed',framesSubmitted:0,framesEncoded:0,framesOpen:0,tracks:[],cancelReason:null};
export const encoderRuntime=()=>JSON.parse(JSON.stringify(runtime));
export function encoderAvailable(){return Boolean(window.VideoEncoder&&window.VideoFrame)}
export async function probeEncoder(){
 if(!encoderAvailable())return null;
 for(const codec of ['vp8','vp09.00.10.08']){
  try{const config={codec,width:1280,height:720,bitrate:4500000,framerate:24,latencyMode:'quality',hardwareAcceleration:'prefer-software',alpha:'discard'};const support=await VideoEncoder.isConfigSupported(config);if(support.supported){configuration={config:support.config,webmCodec:codec==='vp8'?'V_VP8':'V_VP9',mime:codec==='vp8'?'video/webm;codecs=vp8':'video/webm;codecs=vp9'};return {...configuration}}}catch{}
 }
 return null;
}
const abortError=()=>new DOMException(document.hidden?'页面已隐藏，导出中止。':'已取消导出。','AbortError');
export async function encodeVideo(project,assets,{signal,onProgress,canvas}){
 const support=configuration||await probeEncoder();if(!support)throw Error('当前浏览器不支持逐帧视频编码。可继续导出分镜图、项目、镜头表与字幕。');
 await document.fonts.ready;if(signal.aborted||document.hidden)throw abortError();
 const {Muxer,ArrayBufferTarget}=await import('../vendor/director/webm-muxer.mjs');
 if(signal.aborted||document.hidden)throw abortError();
 const duration=total(project),frameCount=Math.ceil(duration*24),target=new ArrayBufferTarget(),muxer=new Muxer({target,video:{codec:support.webmCodec,width:1280,height:720,frameRate:24},firstTimestampBehavior:'strict'});
 canvas.width=1280;canvas.height=720;const context=canvas.getContext('2d',{alpha:false}),started=performance.now();let encoder,failure=null;
 runtime={backend:'webcodecs',phase:'encoding',encoderState:'unconfigured',framesSubmitted:0,framesEncoded:0,framesOpen:0,totalFrames:frameCount,tracks:[],cancelReason:null};
 function check(){if(signal.aborted||document.hidden)throw abortError();if(failure)throw failure}
 function close(){if(encoder&&encoder.state!=='closed')encoder.close();runtime.encoderState=encoder?.state||'closed'}
 const abort=()=>{runtime.cancelReason=document.hidden?'hidden':'cancelled';close()};signal.addEventListener('abort',abort,{once:true});
 const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
 try{
  encoder=new VideoEncoder({output:(chunk,metadata)=>{try{if(chunk.timestamp!==Math.round(runtime.framesEncoded*1000000/24))throw Error('编码器返回了不连续的镜头时间戳。');muxer.addVideoChunk(chunk,metadata);runtime.framesEncoded++;onProgress(Math.min(duration,runtime.framesEncoded/24),duration,{encodedFrames:runtime.framesEncoded,totalFrames:frameCount,elapsedSeconds:(performance.now()-started)/1000})}catch(error){failure=error}},error:error=>{failure=error}});
  encoder.configure(support.config);runtime.encoderState=encoder.state;
  for(let index=0;index<frameCount;index++){
   check();while(encoder.encodeQueueSize>2){await yieldUI();check()}
   const timestamp=Math.round(index*1000000/24),end=Math.min(Math.round(duration*1000000),Math.round((index+1)*1000000/24));
   render(context,project,assets,index/24);
   const frame=new VideoFrame(canvas,{timestamp,duration:Math.max(1,end-timestamp),alpha:'discard'});runtime.framesOpen++;
   try{encoder.encode(frame,{keyFrame:index%48===0});runtime.framesSubmitted++}finally{frame.close();runtime.framesOpen--}
   await yieldUI();
  }
  check();runtime.phase='flushing';await encoder.flush();check();if(runtime.framesEncoded!==frameCount)throw Error(`视频编码帧数不完整：${runtime.framesEncoded} / ${frameCount}。`);
  muxer.finalize();let blob=new Blob([target.buffer],{type:support.mime});if(blob.size<1000)throw Error('视频编码结果为空。');
  // Muxer 5.1.4 writes the last frame timestamp as Duration, excluding its hold.
  // Every frame timestamp was checked above; include the real final frame hold
  // while preserving every encoded packet and Cue offset byte-for-byte.
  blob=await setWebmDuration(blob,duration);const metadata=await inspectWebm(blob);check();if(!Number.isFinite(metadata.duration)||Math.abs(metadata.duration-duration)>.001)throw Error('视频时长元数据校验失败。');
  runtime.phase='complete';return {blob,mime:support.mime,width:1280,height:720,fps:24,seconds:metadata.duration,frames:frameCount,actualSeconds:(performance.now()-started)/1000,backend:'webcodecs',metadata};
 }catch(error){runtime.phase=signal.aborted||document.hidden?'cancelled':'error';if(runtime.phase==='cancelled')throw abortError();throw error}
 finally{signal.removeEventListener('abort',abort);close();runtime.framesOpen=0}
}
