// MediaRecorder WebM metadata repair. No media frames are generated or replaced.
// EBML element definitions: https://www.matroska.org/technical/elements.html
// The missing-Duration approach is also documented by the MIT project:
// https://github.com/yusitnikov/fix-webm-duration
const IDS={segment:0x18538067,info:0x1549a966,scale:0x2ad7b1,duration:0x4489,seekHead:0x114d9b74,cues:0x1c53bb6b,crc:0xbf};
function header(bytes,offset,limit){
 const start=offset;let idLength=1;while(idLength<=4&&!(bytes[offset]&(1<<(8-idLength))))idLength++;
 if(idLength>4||offset+idLength>=limit)throw Error('WebM 元素标识不正确。');let id=0;for(let i=0;i<idLength;i++)id=id*256+bytes[offset++];
 const sizeAt=offset;let sizeLength=1;while(sizeLength<=8&&!(bytes[offset]&(1<<(8-sizeLength))))sizeLength++;
 if(sizeLength>8||offset+sizeLength>limit)throw Error('WebM 元素长度不正确。');let value=BigInt(bytes[offset++]&((1<<(8-sizeLength))-1));for(let i=1;i<sizeLength;i++)value=value*256n+BigInt(bytes[offset++]);
 const unknown=value===(1n<<BigInt(7*sizeLength))-1n;
 if(!unknown&&value>BigInt(Number.MAX_SAFE_INTEGER))throw Error('WebM 元素超出可处理范围。');const end=unknown?limit:offset+Number(value);if(end>limit||end<offset)throw Error('WebM 文件内容不完整。');
 return {id,start,idLength,sizeAt,sizeLength,data:offset,end,size:end-offset,unknown};
}
function elements(bytes,start,end){const result=[];for(let offset=start;offset<end;){const item=header(bytes,offset,end);result.push(item);if(item.end<=offset)throw Error('WebM 元素没有结束。');offset=item.end}return result}
function uint(bytes,item){let result=0;for(let i=item.data;i<item.end;i++)result=result*256+bytes[i];return result}
function float(bytes,item){const view=new DataView(bytes.buffer,bytes.byteOffset+item.data,item.size);if(item.size===4)return view.getFloat32(0,false);if(item.size===8)return view.getFloat64(0,false);return NaN}
function sizeBytes(value,minimum=1){let count=minimum;while(BigInt(value)>=(1n<<BigInt(7*count))-1n&&count<8)count++;if(count>8)throw Error('WebM 元素长度过大。');const bytes=new Uint8Array(count);let n=BigInt(value);for(let i=count-1;i>=0;i--){bytes[i]=Number(n&255n);n>>=8n}bytes[0]|=1<<(8-count);return bytes}
function structure(bytes){const segment=elements(bytes,0,bytes.length).find(e=>e.id===IDS.segment);if(!segment)throw Error('WebM 缺少 Segment。');const children=elements(bytes,segment.data,segment.end),info=children.find(e=>e.id===IDS.info);if(!info)throw Error('WebM 缺少 Info。');const fields=elements(bytes,info.data,info.end),scaleField=fields.find(e=>e.id===IDS.scale),durationField=fields.find(e=>e.id===IDS.duration);const scale=scaleField?uint(bytes,scaleField):1000000,duration=durationField?float(bytes,durationField)*scale/1e9:null;return {segment,children,info,fields,scale,durationField,duration}}
export async function inspectWebm(blob){const bytes=new Uint8Array(await blob.arrayBuffer()),s=structure(bytes);return {bytes:bytes.length,duration:s.duration,scale:s.scale,hasDuration:Boolean(s.durationField),segmentUnknown:s.segment.unknown,hasSeekHead:s.children.some(e=>e.id===IDS.seekHead),hasCues:s.children.some(e=>e.id===IDS.cues)}}
export async function setWebmDuration(blob,seconds){
 if(!Number.isFinite(seconds)||seconds<=0)throw Error('视频时长不正确。');const bytes=new Uint8Array(await blob.arrayBuffer()),s=structure(bytes);
 if(!s.durationField)return (await finalizeWebm(blob,seconds)).blob;
 if(s.fields.some(e=>e.id===IDS.crc)||s.children.some(e=>e.id===IDS.crc))throw Error('视频包含校验段，无法安全修改时长。');
 const field=s.durationField,view=new DataView(bytes.buffer,bytes.byteOffset+field.data,field.size),value=seconds*1e9/s.scale;
 if(field.size===8)view.setFloat64(0,value,false);else if(field.size===4)view.setFloat32(0,value,false);else throw Error('视频时长字段格式不受支持。');
 // Only overwrite the existing float payload. All byte offsets, Cues and media
 // packets remain unchanged. Caller supplies the known encoded timeline end.
 return new Blob([bytes],{type:blob.type});
}
export async function finalizeWebm(blob,seconds){
 if(!Number.isFinite(seconds)||seconds<=0)throw Error('视频时长不正确。');const bytes=new Uint8Array(await blob.arrayBuffer()),s=structure(bytes);
 if(Number.isFinite(s.duration)&&s.duration>0)return {blob,patched:false,seconds:s.duration};
 // These indexed containers require remuxing, which this MediaRecorder-specific
 // repair deliberately rejects instead of silently invalidating their offsets.
 if(s.children.some(e=>e.id===IDS.seekHead||e.id===IDS.cues||e.id===IDS.crc)||s.fields.some(e=>e.id===IDS.crc))throw Error('当前浏览器的视频索引需要重新封装，无法安全补写时长。');
 const duration=new Uint8Array(11);duration.set([0x44,0x89,0x88]);new DataView(duration.buffer).setFloat64(3,seconds*1e9/s.scale,false);
 const payload=[];for(const f of s.fields)if(f.id!==IDS.duration)payload.push(bytes.subarray(f.start,f.end));payload.push(duration);const payloadSize=payload.reduce((n,p)=>n+p.length,0),infoSize=sizeBytes(payloadSize,s.info.sizeLength),infoLength=s.info.idLength+infoSize.length+payloadSize,delta=infoLength-(s.info.end-s.info.start);
 const segmentSize=s.segment.unknown?bytes.subarray(s.segment.sizeAt,s.segment.data):sizeBytes(s.segment.size+delta,s.segment.sizeLength);
 const result=new Blob([bytes.subarray(0,s.segment.sizeAt),segmentSize,bytes.subarray(s.segment.data,s.info.start),bytes.subarray(s.info.start,s.info.sizeAt),infoSize,...payload,bytes.subarray(s.info.end)],{type:blob.type});
 const verified=await inspectWebm(result);if(!verified.hasDuration||Math.abs(verified.duration-seconds)>.001)throw Error('视频时长元数据校验失败。');return {blob:result,patched:true,seconds:verified.duration};
}
