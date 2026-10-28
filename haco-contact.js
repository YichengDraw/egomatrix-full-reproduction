import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const $=id=>document.getElementById(id);
const TASK_META={
 main:{video:'media/main_original_rgb.mp4',name:'搅拌',label:'主例249帧'},
 cut:{video:'media/cut_original_rgb.mp4',name:'切割',label:'切割200帧'},
 brush:{video:'media/brush_original_rgb.mp4',name:'刷洗',label:'刷洗209帧'},
 brush260:{video:'media/haco_brush260_original_rgb.mp4',name:'历史刷洗',label:'刷洗260帧'}
};
const DPEN={main:{before:.306,after:1.184},cut:{before:.220,after:1.422,candidate_extra:1.362},brush:{before:.470,after:1.062},brush260:{before:.826,after:1.329}};
const $video=$('haco-video');
const CV={original:$('haco-original'),before:$('haco-before'),after:$('haco-after')};
const CTX=Object.fromEntries(Object.entries(CV).map(([k,v])=>[k,v.getContext('2d')]));
const URLS={};
let catalog=null,threeManifest=null,task=null,id='main',data={},frame=0,prob=.52,gapMm=5,playing=false,variant='after',trace=[],metrics=null,loadToken=0,stageToken=0,threeReady=false,site3D=null;
const N=778;
const ONE_FRAME=2*N;
const format=(x,d=1)=> x==null||!Number.isFinite(x)?'N/A':x.toFixed(d);
function videoSeek(t){if($video.readyState>=1){try{$video.currentTime=Math.max(0,Math.min(t,($video.duration||1000)-.003))}catch{}}}
async function fetchBin(url,Type){const res=await fetch(url);if(!res.ok)throw Error(url+' HTTP '+res.status);return new Type(await res.arrayBuffer());}
async function getJSON(url){const res=await fetch(url);if(!res.ok)throw Error(url+' HTTP '+res.status);return res.json();}
function setStatus(value,bad=false){$('haco-load-status').textContent=value;$('haco-load-status').style.color=bad?'var(--bad)':'var(--muted)';}
async function loadStage(stageKey,token){
 const s=task.stages[stageKey];if(!s)return null;
 const [uv,gap]=await Promise.all([fetchBin(s.uv,Int16Array),fetchBin(s.gap,Uint16Array)]);
 if(token!==loadToken)return null;
 const expected=task.frames*2*N;
 if(uv.length!==expected*2||gap.length!==expected)throw Error(stageKey+' HACO projection/geometry length mismatch');
 return {uv,gap,meta:s,stageKey};
}
async function loadTask(idNew){
 const next=++loadToken;id=idNew;task=catalog.tasks.find(x=>x.id===id);
 if(!task)throw Error('任务不存在');
 playing=false;$video.pause();frame=0;
 $('haco-play').textContent='▶ 播放';
 for(const button of ['haco-play','haco-prev','haco-next','haco-timeline'])$(button).disabled=true;
 setStatus('载入 '+TASK_META[id].name+' 全序列接触数据…');
 const sw=$('haco-branch-wrap');sw.hidden=!task.stages.candidate_extra;
 variant='after';$('haco-branch').value='after';
 $('haco-after-caption').textContent=task.stages.after.stage+' · 同一 HACO 概率';
 $('haco-a3-badge').textContent=task.stages.after.stage==='A3_paper_fixed_objects_v1'?'PAPER-FIXED':'AFTER';
 $('haco-gt-badge').textContent=task.stages.gt?'GT 几何可用':'GT N/A · 260/262 不匹配';
 $('haco-video').poster='';
 $('haco-timeline').max=String(task.frames-1);
 $('haco-3d-stage').value='after';
 $video.src=TASK_META[id].video;$video.load();
 const req=[fetchBin(task.p,Uint8Array),fetchBin(task.valid,Uint8Array),
            loadStage('before',next),loadStage('after',next)];
 if(task.stages.gt)req.push(loadStage('gt',next));
 const loaded=await Promise.all(req);
 if(next!==loadToken)return;
 if(loaded[0].length!==task.frames*2*N||loaded[1].length!==task.frames*2)throw Error('HACO buffer size mismatch');
 data={prob:loaded[0],valid:loaded[1],before:loaded[2],after:loaded[3],gt:task.stages.gt?loaded[4]:null};
 for(const b of ['haco-play','haco-prev','haco-next','haco-timeline'])$(b).disabled=false;
 setStatus('真实 HACO '+task.frames+' / '+task.frames+' 帧 · 2 × 778顶点 · 原阈值0.52');
 frame=0;calculateMetrics();showFrame();
 await load3DModel(id,variant);
}
async function changeVariant(){
 if(!task)return;
 const desired=$('haco-branch').value;
 if(desired==='candidate_extra'&&!data.candidate_extra){
  const token=loadToken;setStatus('载入旧候选 extra grounding 分支…');
  const loaded=await loadStage('candidate_extra',token);
  if(token!==loadToken||!loaded)return;
  data.candidate_extra=loaded;
 }
 variant=desired;
 $('haco-after-caption').textContent=task.stages[variant].stage+' · 原模型概率不变';
 $('haco-a3-badge').textContent=variant==='candidate_extra'?'EXTRA GROUNDING':'PAPER-FIXED';
 calculateMetrics();showFrame();
 if($('haco-3d-stage').value==='after')await load3DStage(variant);
}
function selected(h,point,p){return Boolean(data.valid[frame*2+h])&&p>=Math.round(prob*255);}
function drawDots(ctx,overlay,kind){
 if(!overlay||!data.prob)return;
 const f=frame;
 const uv=overlay.uv,gap=overlay.gap;
 const hfilter=[$('haco-left').checked,$('haco-right').checked];
 for(let h=0;h<2;h++){
  if(!hfilter[h]||!data.valid[f*2+h])continue;
  const base=(f*2+h)*N;
  // Raw HACO probability never altered across the before/after views.
  for(let v=0;v<N;v++){
   const idx=base+v,confidence=data.prob[idx]/255;
   if(confidence<prob)continue;
   const px=uv[idx*2],py=uv[idx*2+1];
   if(px===-32768||py===-32768||px<-80||px>2000||py<-80||py>1200)continue;
   const x=px/2,y=py/2;
   const alpha=Math.min(.92,.44+.45*(confidence-prob)/(1-prob+.001));
   ctx.fillStyle='rgba(255,132,37,'+alpha.toFixed(3)+')';
   ctx.beginPath();ctx.arc(x,y,confidence>.9?2.1:1.5,0,Math.PI*2);ctx.fill();
   if(kind==='gt'){
    // independent GT close-contact labels, regardless of HACO confidence
    continue;
   }
   if($('haco-rings').checked&&gap[idx]/10<=gapMm){
    ctx.strokeStyle='rgba(64,245,176,0.91)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(x,y,3.7,0,Math.PI*2);ctx.stroke();
   }
  }
 }
 if(kind==='gt'&&$('haco-rings').checked){
  for(let h=0;h<2;h++){
   if(!hfilter[h]||!data.valid[f*2+h])continue;
   const base=(f*2+h)*N;
   for(let v=0;v<N;v++){
    const idx=base+v;
    if(gap[idx]/10>gapMm)continue;
    const px=uv[idx*2],py=uv[idx*2+1];
    if(px===-32768||py===-32768||px<-80||px>2000||py<-80||py>1200)continue;
    ctx.strokeStyle='rgba(50,202,248,.97)';ctx.lineWidth=1.9;
    ctx.beginPath();ctx.arc(px/2,py/2,3.5,0,Math.PI*2);ctx.stroke();
   }
  }
 }
}
function renderCanvas(which,overlay){
 const ctx=CTX[which],canvas=CV[which];
 ctx.fillStyle='#0a1412';ctx.fillRect(0,0,canvas.width,canvas.height);
 if($video.readyState>=2){
  try{ctx.drawImage($video,0,0,canvas.width,canvas.height);}catch(e){/* video decoding pending */}
 }
 if(overlay)drawDots(ctx,overlay,which==='original'?'gt':'stage');
}
function showFrame(){
 if(!task||!data.before)return;
 const current=Math.max(0,Math.min(task.frames-1,frame));frame=current;
 renderCanvas('original',data.gt);renderCanvas('before',data.before);renderCanvas('after',data[variant]||data.after);
 $('haco-timeline').value=String(frame);
 $('haco-time').textContent=(frame/30).toFixed(3)+' / '+((task.frames-1)/30).toFixed(3)+' s · '+(frame+1)+'/'+task.frames+'帧';
 const summary=frameCounts(frame);
 $('haco-frame-readout').innerHTML=
 '当前帧 HACO 高置信顶点：<strong>'+summary.selected+'</strong>。A2贴近：<strong>'+format(summary.beforeRate*100,1)+'%</strong>；A3贴近：<strong>'+
 format(summary.afterRate*100,1)+'%</strong>；'+(data.gt?'独立 GT 贴近：<strong>'+format(summary.gtRate*100,1)+'%</strong>':'历史260帧无可对应 GT；该栏仅显示原RGB。')+
 ' 这里的“贴近”只是绑定物体表面最近邻，不等于接触力。';
 updateCursor();update3D();
}
function frameCounts(f){
 let total=0,a=0,b=0,gt=0;
 for(let h=0;h<2;h++){
  if(!(h===0?$('haco-left').checked:$('haco-right').checked)||!data.valid[f*2+h])continue;
  const beg=(f*2+h)*N;
  for(let v=0;v<N;v++){
   const i=beg+v;
   if(data.prob[i]/255<prob)continue;
   total++;
   if(data.before.gap[i]/10<=gapMm)a++;
   if(data[variant].gap[i]/10<=gapMm)b++;
   if(data.gt&&data.gt.gap[i]/10<=gapMm)gt++;
  }
 }
 return{selected:total,beforeRate:total?a/total:null,afterRate:total?b/total:null,gtRate:data.gt&&total?gt/total:null};
}
function calculateMetrics(){
 if(!task||!data.before||!data[variant])return;
 const len=task.frames,side=[0,1].map(()=>({n:0,b:0,a:0,gt:0,sumB:0,sumA:0}));
 const frameRows=[];
 for(let f=0;f<len;f++){
  let n=0,bc=0,ac=0,gc=0;
  for(let h=0;h<2;h++){
   if(!data.valid[f*2+h])continue;
   const beg=(f*2+h)*N,z=side[h];
   for(let v=0;v<N;v++){
    const i=beg+v;if(data.prob[i]/255<prob)continue;
    z.n++;n++;
    let gb=data.before.gap[i]/10,ga=data[variant].gap[i]/10;
    z.sumB+=gb;z.sumA+=ga;
    if(gb<=gapMm){bc++;z.b++;}
    if(ga<=gapMm){ac++;z.a++;}
    if(data.gt&&data.gt.gap[i]/10<=gapMm){gc++;z.gt++;}
   }
  }
  frameRows.push({b:n?bc/n:null,a:n?ac/n:null,g:data.gt&&n?gc/n:null});
 }
 const totals={n:side[0].n+side[1].n,b:side[0].b+side[1].b,a:side[0].a+side[1].a,gt:side[0].gt+side[1].gt};
 const b=totals.n?totals.b/totals.n:null,a=totals.n?totals.a/totals.n:null,g=data.gt&&totals.n?totals.gt/totals.n:null,delta=a!=null&&b!=null?(a-b)*100:null;
 metrics={sides:side,totals,frameRows,b,a,g,delta};
 $('haco-before-rate').textContent=format(b*100,1)+'%';
 $('haco-after-rate').textContent=format(a*100,1)+'%';
 $('haco-delta-rate').textContent=(delta>=0?'+':'')+format(delta,1)+'pp';
 $('haco-gt-rate').textContent=g==null?'N/A':format(g*100,1)+'%';
 const delbox=$('haco-delta-rate').parentElement;delbox.classList.toggle('positive',delta>0);delbox.classList.toggle('negative',delta<0);
 const tbody=$('haco-summary-table').querySelector('tbody');tbody.replaceChildren();
 for(let h=0;h<2;h++){
  const z=side[h],rB=z.n?z.b/z.n:null,rA=z.n?z.a/z.n:null,rG=data.gt&&z.n?z.gt/z.n:null,dif=(rA-rB)*100;
  const tr=document.createElement('tr');
  const vals=[h?'RH 右手 / 物体':'LH 左手 / 物体',z.n,format(rB*100,1)+'%',format(rA*100,1)+'%',(dif>=0?'+':'')+format(dif,1)+'pp',format(z.sumB/z.n,1)+' mm',format(z.sumA/z.n,1)+' mm',rG==null?'N/A':format(rG*100,1)+'%'];
  vals.forEach((val,k)=>{let td=document.createElement('td');td.textContent=val;if(k===4)td.className=dif>=0?'positive':'negative';tr.appendChild(td);});
  tbody.appendChild(tr);
 }
 const verdict=delta>1?'高置信区域几何贴近比例提高':delta<-1?'高置信区域几何贴近比例下降':'高置信区域几何贴近比例变化很小';
 $('haco-eval-head').textContent=verdict+'（'+(delta>=0?'+':'')+format(delta,1)+' 个百分点）';
 $('haco-eval-text').textContent='这一结果只度量相同 HACO 预测手部顶点在 A2 与 A3 重建几何中的贴近程度。'
 +(data.gt?'GT近邻支持率是独立官方几何评测，不参与优化；可以和预测热图逐帧对照。':'这段历史视频的GT与源RGB不完整对齐，因此不能报告独立GT支持率。')
 +' 高置信位置远离绑定物体可能意味着预测接触桌面或其他目标，也可能是HACO误报。';
 const d=DPEN[id],pA=d?.[variant],pB=d?.before;
 $('haco-dpen-text').textContent=pA!=null?'⚠ 独立Dpen（时间平均最大穿透深度）为 A2 '+pB.toFixed(3)+'mm → '+pA.toFixed(3)+'mm；贴近率增加同时穿透可能增加。Dpen与本页的无符号近邻采用不同评分协议。':'';
 drawChart();
}
function drawChart(){
 if(!metrics)return;
 const svg=$('haco-chart');svg.replaceChildren();
 const NS='http://www.w3.org/2000/svg',x0=55,x1=962,y0=242,y1=27;
 const add=(tag,attrs,txt='')=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(txt)e.textContent=txt;svg.appendChild(e);return e;};
 for(let t=0;t<=4;t++){
  let y=y0-(y0-y1)*t/4;add('line',{x1:x0,y1:y,x2:x1,y2:y,stroke:'var(--line)','stroke-width':1});
  add('text',{x:12,y:y+4,fill:'var(--muted)','font-size':13},String(t*25)+'%');
 }
 for(let t=0;t<=4;t++){
  let x=x0+(x1-x0)*t/4;add('text',{x:x,y:266,'text-anchor':'middle',fill:'var(--muted)','font-size':12},(t*(task.frames-1)/4/30).toFixed(1)+'s');
 }
 const vals=[['b','#d6a65c',false],['a','#41c98b',false],['g','#42bae8',true]];
 for(const [key,color,dash]of vals){
  if(key==='g'&&!data.gt)continue;
  let path='';
  for(let i=0;i<metrics.frameRows.length;i++){
   let v=metrics.frameRows[i][key];if(v==null){path+=' ';continue;}
   let x=x0+(x1-x0)*i/Math.max(1,task.frames-1),y=y0-(y0-y1)*v;
   path+=(i===0||!metrics.frameRows[i-1]||metrics.frameRows[i-1][key]==null?'M':'L')+x.toFixed(2)+' '+y.toFixed(2)+' ';
  }
  add('path',{d:path,fill:'none',stroke:color,'stroke-width':2.3,'stroke-linecap':'round','stroke-dasharray':dash?'6 5':'',opacity:.95});
 }
 add('line',{id:'haco-chart-cursor',x1:x0,x2:x0,y1:y1,y2:y0,stroke:'var(--ink)','stroke-width':1,'stroke-dasharray':'2 4'});
 svg.onclick=e=>{
  if(!task)return;const box=svg.getBoundingClientRect();
  let sx=(e.clientX-box.left)/box.width*1000;
  seekFrame(Math.round((sx-x0)/(x1-x0)*(task.frames-1)));
 };
 updateCursor();
}
function updateCursor(){
 if(!task||!metrics)return;
 const f=Math.max(0,Math.min(task.frames-1,frame)),x=55+(962-55)*f/(task.frames-1);
 const e=$('haco-chart-cursor');if(e){e.setAttribute('x1',x);e.setAttribute('x2',x);}
}
function seekFrame(f){
 if(!task)return;
 $video.pause();playing=false;$('haco-play').textContent='▶ 播放';
 frame=Math.max(0,Math.min(task.frames-1,Math.round(f)));
 $('haco-timeline').value=String(frame);
 videoSeek(frame/30);showFrame();
}
function bind(){
 $('theme').onclick=()=>{
  const d=document.documentElement,theme=d.dataset.theme==='dark'?'light':'dark';d.dataset.theme=theme;
  $('theme').textContent=theme==='dark'?'☾':'☀';
  try{localStorage.setItem('egomatrix-theme',theme);}catch{}
 };
 $('theme').textContent=document.documentElement.dataset.theme==='dark'?'☾':'☀';
 $('haco-task').onchange=()=>loadTask($('haco-task').value).catch(e=>setStatus(e.message,true));
 $('haco-branch').onchange=()=>changeVariant().catch(e=>setStatus(e.message,true));
 const sliders=[['haco-prob','haco-prob-label',v=>(v*1).toFixed(2)],['haco-gap','haco-gap-label',v=>(v*1).toFixed(1)+' mm']];
 for(const [sel,lab,fmt]of sliders){
  $(sel).oninput=()=>{prob=+$('haco-prob').value;gapMm=+$('haco-gap').value;$(lab).textContent=fmt($(sel).value);calculateMetrics();showFrame();};
 }
 for(const c of ['haco-left','haco-right','haco-rings'])$(c).onchange=()=>{calculateMetrics();showFrame();};
 $('haco-timeline').oninput=e=>seekFrame(+e.target.value);
 $('haco-prev').onclick=()=>seekFrame(frame-1);
 $('haco-next').onclick=()=>seekFrame(frame+1);
 $('haco-play').onclick=async()=>{
  if(playing){playing=false;$video.pause();$('haco-play').textContent='▶ 播放';return;}
  if(frame>=task.frames-1)seekFrame(0);
  playing=true;$('haco-play').textContent='Ⅱ 暂停';
  try{await $video.play();}catch(e){playing=false;$('haco-play').textContent='▶ 播放';}
 };
 $video.addEventListener('loadeddata',()=>{if(task)showFrame();});
 $video.addEventListener('seeked',()=>{if(task)showFrame();});
 $video.addEventListener('ended',()=>{playing=false;$('haco-play').textContent='▶ 播放';});
 $('haco-3d-stage').onchange=()=>load3DStage($('haco-3d-stage').value==='before'?'before':variant);
 $('haco-3d-obj').onchange=()=>update3D();
 $('haco-3d-hands').onchange=()=>update3D();
 $('haco-3d-reset').onclick=()=>reset3DView();
 document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(e.code==='ArrowLeft'){e.preventDefault();seekFrame(frame-1);}
  if(e.code==='ArrowRight'){e.preventDefault();seekFrame(frame+1);}
 });
}
function tick(){
 requestAnimationFrame(tick);
 if(task&&playing&&$video.readyState>=2){
  const idx=Math.max(0,Math.min(task.frames-1,Math.round($video.currentTime*30)));
  if(idx!==frame){frame=idx;showFrame();}
 }
 if(site3D)render3D();
}
async function boot(){
 bind();try{
  [catalog,threeManifest]=await Promise.all([getJSON('data/haco/manifest.json'),getJSON('data/haco/3d/manifest.json')]);
  if(catalog.schema!=='haco-source-probability-and-independent-geometry-v1')throw Error('HACO manifest version mismatch');
  await loadTask('main');
 }catch(e){console.error(e);setStatus('数据读取失败：'+e.message,true);}
 requestAnimationFrame(tick);
}

/* Lightweight Three.js geometry. Native MANO vertices and reconstructed objects, no simulation. */
async function init3D(){
 if(site3D)return;
 const canvas=$('haco-3d-canvas'),holder=canvas.parentElement;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#101b1b');
 const camera=new THREE.PerspectiveCamera(43,1,.005,30);camera.up.set(0,0,1);
 scene.add(new THREE.HemisphereLight(0xffffff,0x45564e,2.2));
 const key=new THREE.DirectionalLight(0xffffff,2.8);key.position.set(1,-1,3);scene.add(key);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.minDistance=.15;orbit.maxDistance=5;
 const group=new THREE.Group();scene.add(group);
 const grid=new THREE.GridHelper(2.5,25,0x506b57,0x273c36);grid.rotation.x=Math.PI/2;grid.material.transparent=true;grid.material.opacity=.3;scene.add(grid);
 const resize=()=>{const w=Math.max(50,holder.clientWidth),h=Math.max(100,holder.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 resize();new ResizeObserver(resize).observe(holder);
 site3D={scene,renderer,camera,orbit,group,grid,meshCase:null,stage:null,handMeshes:[],objectMeshes:[],stages:{},bufs:null};
}
function reset3DView(){
 if(!site3D||!task)return;
 const cfg=threeManifest[task.id];if(!cfg)return;
 const [x,y,z]=cfg.center;const d=Math.max(.55,cfg.span*1.7);
 site3D.camera.position.set(x+d*.7,y-d*1.1,z+d*.7);
 site3D.orbit.target.set(x,y,z);site3D.camera.up.set(0,0,1);site3D.orbit.update();
}
function clear3DMeshes(){
 if(!site3D)return;
 for(const m of [...site3D.handMeshes,...site3D.objectMeshes]){
  site3D.group.remove(m);
  m.geometry?.dispose();m.material?.dispose();
 }
 site3D.handMeshes=[];site3D.objectMeshes=[];site3D.stages={};site3D.bufs=null;site3D.stage=null;site3D.meshCase=null;
}
async function load3DModel(caseId,desired){
 if(!threeManifest)return;
 try{await init3D();}catch(e){$('haco-3d-status').textContent='当前浏览器不支持 WebGL：'+e.message;return;}
 const cfg=threeManifest[caseId];if(!cfg)return;
 const myToken=++stageToken;
 if(site3D.meshCase!==caseId){
  $('haco-3d-status').textContent='载入 MANO/物体网格…';
  const jobs=[fetchBin(cfg.handFaces,Uint16Array)];
  cfg.objects.forEach(o=>jobs.push(fetchBin(o.vertices,Float32Array),fetchBin(o.faces,Uint32Array)));
  const values=await Promise.all(jobs);
  if(myToken!==stageToken||!task||task.id!==caseId)return;
  clear3DMeshes();
  const faces=values[0];
  for(let h=0;h<2;h++){
   const g=new THREE.BufferGeometry();
   const pos=new THREE.BufferAttribute(new Float32Array(N*3),3),colors=new THREE.BufferAttribute(new Float32Array(N*3),3);
   pos.setUsage(THREE.DynamicDrawUsage);colors.setUsage(THREE.DynamicDrawUsage);
   g.setAttribute('position',pos);g.setAttribute('color',colors);
   g.setIndex(new THREE.BufferAttribute(faces.slice(h*1538*3,(h+1)*1538*3),1));
   const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.78,metalness:0,transparent:true,opacity:.97}));
   m.frustumCulled=false;site3D.group.add(m);site3D.handMeshes.push(m);
  }
  cfg.objects.forEach((o,j)=>{
   const g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.BufferAttribute(values[1+j*2],3));
   g.setIndex(new THREE.BufferAttribute(values[2+j*2],1));g.computeVertexNormals();
   const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:j?0x9cbeeb:0xc8d8cd,side:THREE.DoubleSide,transparent:true,opacity:.62,roughness:.8}));
   m.frustumCulled=false;site3D.group.add(m);site3D.objectMeshes.push(m);
  });
  site3D.grid.position.set(cfg.center[0],cfg.center[1],cfg.center[2]-cfg.span*.23);
  site3D.meshCase=caseId;reset3DView();
 }
 await load3DStage(desired);
}
async function load3DStage(key){
 if(!site3D||!task)return;
 const caseId=task.id,token=++stageToken;
 const realKey=key==='after'?variant:key;
 const cfg=threeManifest[caseId]?.stages?.[realKey];
 if(!cfg){$('haco-3d-status').textContent='本样本没有 '+realKey+' 的3D轨迹';return;}
 $('haco-3d-status').textContent='加载 '+cfg.stage+' 3D轨迹…';
 try{
  let cached=site3D.stages[realKey];
  if(!cached){
   const m=await getJSON(cfg.meta);
   const [hands,poses]=await Promise.all([fetchBin(m.hands,Uint16Array),fetchBin(m.poses,Float32Array)]);
   cached={m,hands,poses};
   if(token!==stageToken||site3D.meshCase!==caseId)return;
   site3D.stages[realKey]=cached;
  }
  site3D.stage=realKey;site3D.bufs=cached;
  $('haco-3d-status').textContent=cfg.stage+' · 已载入，颜色随帧更新';
  update3D();
 }catch(e){console.error(e);$('haco-3d-status').textContent=e.message;}
}
function update3D(){
 if(!site3D||!site3D.bufs||!task||site3D.meshCase!==task.id)return;
 const state=site3D.bufs,m=state.m;
 const ids=m.frameIds;
 const f=Math.max(0,Math.min(task.frames-1,frame));
 let a=Math.floor(f/2);a=Math.min(a,ids.length-1);
 let b=Math.min(a+1,ids.length-1);
 const blend=a===b?0:Math.max(0,Math.min(1,(f-ids[a])/Math.max(1,ids[b]-ids[a])));
 const contactKey=site3D.stage==='candidate_extra'?'candidate_extra':site3D.stage==='before'?'before':'after';
 const stageGaps=data[contactKey]?.gap;
 for(let h=0;h<2;h++){
  const mesh=site3D.handMeshes[h];if(!mesh)continue;
  mesh.visible=$('haco-3d-hands').checked&&(h===0?$('haco-left').checked:$('haco-right').checked);
  const pAttr=mesh.geometry.attributes.position,colAttr=mesh.geometry.attributes.color;
  const xyz=pAttr.array,cols=colAttr.array;
  const qBase0=(a*2+h)*N*3,qBase1=(b*2+h)*N*3;
  const min=m.handQuantMin,scale=m.handQuantScale;
  for(let k=0;k<N;k++){
   const i=k*3,pIndex=(f*2+h)*N+k,pr=data.prob[pIndex]/255;
   for(let j=0;j<3;j++){
    xyz[i+j]=min[j]+(state.hands[qBase0+i+j]*(1-blend)+state.hands[qBase1+i+j]*blend)*scale[j];
   }
   if(pr<prob){cols[i]=.17;cols[i+1]=.30;cols[i+2]=.31;}
   else if(stageGaps&&stageGaps[pIndex]/10<=gapMm){cols[i]=.2;cols[i+1]=1;cols[i+2]=.64;}
   else{cols[i]=1;cols[i+1]=.35+.24*pr;cols[i+2]=.11;}
  }
  pAttr.needsUpdate=true;colAttr.needsUpdate=true;mesh.geometry.computeVertexNormals();
 }
 const nObjs=site3D.objectMeshes.length;
 const M0=new THREE.Matrix4(),M1=new THREE.Matrix4();
 const v0=new THREE.Vector3(),v1=new THREE.Vector3(),q0=new THREE.Quaternion(),q1=new THREE.Quaternion(),s0=new THREE.Vector3(),s1=new THREE.Vector3();
 for(let j=0;j<nObjs;j++){
  const mesh=site3D.objectMeshes[j];mesh.visible=$('haco-3d-obj').checked;
  const start0=(a*nObjs+j)*16,start1=(b*nObjs+j)*16;
  M0.set(...state.poses.slice(start0,start0+16));M1.set(...state.poses.slice(start1,start1+16));
  M0.decompose(v0,q0,s0);M1.decompose(v1,q1,s1);
  mesh.position.copy(v0).lerp(v1,blend);mesh.quaternion.copy(q0).slerp(q1,blend);mesh.scale.copy(s0).lerp(s1,blend);
 }
}
function render3D(){site3D.orbit.update();site3D.renderer.render(site3D.scene,site3D.camera);}
boot();
