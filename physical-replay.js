import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id);
const task=(new URLSearchParams(location.search).get('task')||'cut').toLowerCase();
if(!['cut','brush'].includes(task))throw Error('task must be cut or brush');
const CAPTURE_WIDTH=1280,CAPTURE_HEIGHT=720;
const MANIFEST='assets/robot/mesh_manifest.json';
const eFrame=$('frameStamp'),rgb=$('rgb'),stage=$('stage');
let meta,frame=0,ready=false,renderer,scene,camera,glTFLoader;
let data={},handBodies=[],objectBodies=[],actualTextures=[],tableMesh;
let naturalFPS=30,sourceFrameCount=0;
const cvToGl=new THREE.Matrix4().set(
 1,0,0,0,
 0,-1,0,0,
 0,0,-1,0,
 0,0,0,1);
function setM(mat,buf,index){mat.set(...buf.subarray(index,index+16));}
async function getJSON(url){const res=await fetch(url);if(!res.ok)throw Error(url+' '+res.status);return res.json();}
async function getBin(url,Type){const res=await fetch(url);if(!res.ok)throw Error(url+' '+res.status);return new Type(await res.arrayBuffer());}
function baseScene(){
 scene=new THREE.Scene();
 scene.background=new THREE.Color(0x1a292c);
 camera=new THREE.PerspectiveCamera(48,1280/720,.006,100);
 renderer=new THREE.WebGLRenderer({canvas:$('replayCanvas'),antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(1280,720,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.65;
 scene.add(new THREE.HemisphereLight(0xf5ffec,0x8faaa5,3.1));
 let key=new THREE.DirectionalLight(0xfffae3,3.4);key.position.set(0.4,-1.2,2.7);scene.add(key);
 let back=new THREE.DirectionalLight(0xb3e5f9,1.9);back.position.set(-1.5,1,2.3);scene.add(back);
 let fill=new THREE.DirectionalLight(0xfefefe,1.6);fill.position.set(2.1,1.9,0.8);scene.add(fill);
 glTFLoader=new GLTFLoader();
}
async function geometry(){
 const manifest=await getJSON(MANIFEST);
 const specs=['lh','rh'].flatMap(side=>manifest.hand_links[side].map(item=>({...item,side})));
 const srcs=specs.flatMap(s=>[getBin(s.positions,Float32Array),getBin(s.faces,Uint32Array)]);
 const arrays=await Promise.all(srcs);
 const nameId=new Map(meta.link_names.map((s,i)=>[s,i]));
 for(let i=0;i<specs.length;i++){
   const spec=specs[i],geom=new THREE.BufferGeometry();
   geom.setAttribute('position',new THREE.BufferAttribute(arrays[i*2],3));
   geom.setIndex(new THREE.BufferAttribute(arrays[i*2+1],1));
   geom.computeVertexNormals();
   const mat=new THREE.MeshStandardMaterial({color:spec.side==='lh'?0x8cb79b:0xe5a67a,
       side:THREE.DoubleSide,metalness:.18,roughness:.59});
   const m=new THREE.Mesh(geom,mat);m.frustumCulled=false;
   scene.add(m);
   if(!nameId.has(spec.link))throw Error('missing source link '+spec.link);
   handBodies.push({mesh:m,i:nameId.get(spec.link),name:spec.link});
 }
 const gltf=await Promise.all(meta.object_glb.map(url=>new Promise((resolve,reject)=>glTFLoader.load(url,resolve,undefined,reject))));
 gltf.forEach((g,i)=>{
  const obj=g.scene;
  obj.name='Recorded actual object '+i;
  obj.traverse(x=>{if(x.isMesh){x.castShadow=true;x.frustumCulled=false;}});
  scene.add(obj);
  objectBodies.push(obj);
 });
 const table=meta.table;
 const size=table.size_m;
 const surface=new THREE.Mesh(
   new THREE.BoxGeometry(size[0],size[1],Math.max(.02,size[2])),
   new THREE.MeshStandardMaterial({color:0x445451,roughness:.93,metalness:0}));
 surface.position.set(...table.position_trace_world_m);
 const rot=new THREE.Quaternion(...table.orientation_wxyz.slice(1),table.orientation_wxyz[0]);
 surface.quaternion.copy(rot);
 scene.add(surface);tableMesh=surface;
 let grid=new THREE.GridHelper(Math.max(size[0],size[1])*.98,14,0x62736a,0x64746b);
 grid.rotation.x=Math.PI/2;
 grid.position.copy(surface.position);
 grid.position.z+=size[2]/2+.0015;
 grid.material.transparent=true;grid.material.opacity=.20;
 scene.add(grid);
}
function applyIntrinsic(K){
 const fx=K[0],fy=K[4],cx=K[2],cy=K[5],w=CAPTURE_WIDTH,h=CAPTURE_HEIGHT,n=.006,f=100;
 camera.projectionMatrix.set(
  2*fx/w,0,1-2*cx/w,0,
  0,2*fy/h,2*cy/h-1,0,
  0,0,-(f+n)/(f-n),-2*f*n/(f-n),
  0,0,-1,0);
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
function renderFrame(index){
 if(!ready)return;
 frame=Math.max(0,Math.min(sourceFrameCount-1,Math.round(index)));
 const n=meta.link_count,objCount=meta.object_count;
 const srcL=data.links,srcO=data.objects;
 const mat=new THREE.Matrix4();
 for(const s of handBodies){
  setM(mat,srcL,(frame*n+s.i)*16);
  s.mesh.position.setFromMatrixPosition(mat);
  s.mesh.quaternion.setFromRotationMatrix(mat);
 }
 objectBodies.forEach((obj,i)=>{
  setM(mat,srcO,(frame*objCount+i)*16);
  obj.position.setFromMatrixPosition(mat);
  obj.quaternion.setFromRotationMatrix(mat);
 });
 const C=new THREE.Matrix4();
 setM(C,data.cameras,frame*16);
 C.multiply(cvToGl);
 camera.position.setFromMatrixPosition(C);
 camera.quaternion.setFromRotationMatrix(C);
 camera.updateMatrixWorld(true);
 applyIntrinsic(data.intrinsics.subarray(frame*9,frame*9+9));
 renderer.render(scene,camera);
 const v=(frame/30).toFixed(2);
 eFrame.textContent=v.padStart(5,'0')+' s  /  FRAME '+String(frame+1).padStart(4,'0')+' / '+String(sourceFrameCount).padStart(4,'0');
 $('progressInner').style.width=((frame+1)/sourceFrameCount*100).toFixed(3)+'%';
}
async function seekVideo(frameIndex){
 const url='data/physical/'+task+'/source_frames/frame_'+String(frameIndex).padStart(4,'0')+'.jpg';
 if(rgb.dataset.frame===String(frameIndex)&&rgb.complete&&rgb.naturalWidth)return;
 await new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>{rgb.src=img.src;rgb.dataset.frame=String(frameIndex);resolve();};
  img.onerror=()=>reject(Error('source frame not decoded: '+url));
  img.src=url;
 });
}
window.setReplayFrame=async function(i){
 if(!ready)throw Error('replay not ready');
 await seekVideo(i);
 renderFrame(i);
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 return {i,sourceFrame:Number(rgb.dataset.frame),ready:true};
};
async function load(){
 $('title').innerHTML=task==='cut'?'CUTTING <em>/ XHAND</em>':'BRUSHING <em>/ XHAND</em>';
 meta=await getJSON('data/physical/'+task+'/meta.json');
 if(meta.sample!==task||meta.schema!=='native-frozen-epoch900-sourceview-replay-v1')throw Error('metadata mismatch');
 sourceFrameCount=meta.source_frames;
 baseScene();
 const [links,objects,cameras,intrinsics]=await Promise.all([
  getBin(meta.links,Float32Array),
  getBin(meta.objects,Float32Array),
  getBin(meta.cameras,Float32Array),
  getBin(meta.intrinsics,Float32Array)
 ]);
 if(links.length!==sourceFrameCount*meta.link_count*16||
  objects.length!==sourceFrameCount*meta.object_count*16||cameras.length!==sourceFrameCount*16||intrinsics.length!==sourceFrameCount*9)
  throw Error('native state buffer shape invalid');
 data={links,objects,cameras,intrinsics};
 await geometry();
 await seekVideo(0);
 ready=true;
 renderFrame(0);
 $('loading').style.display='none';
 window.__replayReady=true;
 console.log('REAL_REPLAY_READY',task,sourceFrameCount,'n_links',handBodies.length,'objects',objectBodies.length,
   'physics stepped = 0');
}
load().catch(e=>{
 console.error(e);
 $('loading').textContent='REPLAY LOAD FAILED: '+e.message;
 window.__replayError=String(e);
});
