// app-cloud.js - Add Firebase Auth + Firestore sync on top of the existing editor + map prototype
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';

// --------- CONFIG ---------
// 请替换为你自己的 Firebase 配置（在 README 中有说明）
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// --------- INIT ---------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// The rest of the code is the previous app.js behavior with added cloud-sync hooks
// For brevity we import the existing behavior by inlining the core editor/map setup

// --- SPA navigation ---
document.querySelectorAll('.tabbar button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabbar button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    showView(btn.dataset.view);
  })
})
function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  const el = document.getElementById(name); if(el) el.classList.remove('hidden');
  if(name==='map') setTimeout(initMap,200);
  if(name==='records') renderRecords();
  if(name==='outfit') renderOutfits();
  if(name==='timeline') renderTimeline();
}

// Fabric editor
const canvas = new fabric.Canvas('c',{preserveObjectStacking:true, selection:true, allowTouchScrolling:false});
canvas.setWidth(900);canvas.setHeight(1200);
function resizeCanvasForDisplay(){
  const containerWidth = Math.min(window.innerWidth-40,760);
  const scale = containerWidth / 900;
  const el = canvas.getElement();
  el.style.width = (900*scale)+"px";
  el.style.height = (1200*scale)+"px";
}
window.addEventListener('resize', resizeCanvasForDisplay);
resizeCanvasForDisplay();

let laceBrushEnabled = false;
const laceImg = new Image();
laceImg.src = '/assets/lace/lace-pattern.svg';
laceImg.onload = ()=>{
  const brush = new fabric.PatternBrush(canvas);
  brush.source = function(){
    const pattern = document.createElement('canvas');
    pattern.width = 40; pattern.height = 40;
    const ctx = pattern.getContext('2d');
    ctx.drawImage(laceImg,0,0,40,40);
    return pattern;
  }
  brush.width = 18;
  canvas.freeDrawingBrush = brush;
}

// toolbar actions
document.getElementById('imgLoader').addEventListener('change', (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    fabric.Image.fromURL(ev.target.result, function(img){
      img.set({left:100, top:100, scaleX:0.5, scaleY:0.5, cornerStyle:'circle'});
      img.setControlsVisibility({mt:true,mb:true,ml:true,mr:true});
      canvas.add(img).setActiveObject(img);
    },{crossOrigin: 'anonymous'});
  };
  reader.readAsDataURL(f);
  e.target.value='';
});

document.getElementById('addText').addEventListener('click', ()=>{
  const t = new fabric.IText('在此输入文字', {left:120, top:120, fill:'#333', fontFamily:'PingFang SC', fontSize:22});
  canvas.add(t).setActiveObject(t);
  t.enterEditing();
});

document.getElementById('stickerSelect').addEventListener('change',(e)=>{
  const v = e.target.value; if(!v) return;
  fabric.Image.fromURL(v, img=>{ img.set({left:80,top:80,scaleX:0.8,scaleY:0.8, selectable:true}); canvas.add(img).setActiveObject(img); },{crossOrigin:'anonymous'});
  e.target.value='';
});

document.getElementById('freeDraw').addEventListener('click', ()=>{
  laceBrushEnabled = !laceBrushEnabled;
  canvas.isDrawingMode = laceBrushEnabled;
  document.getElementById('freeDraw').textContent = laceBrushEnabled? '结束绘制' : '花边绘制';
});

document.getElementById('clearDraw').addEventListener('click', ()=>{
  const objs = canvas.getObjects().filter(o=>o.type==='path' || o.type==='path-group');
  objs.forEach(o=>canvas.remove(o));
  canvas.renderAll();
});

// save locally and optionally to cloud
async function savePage(){
  const data = canvas.toObject(['selectable']);
  const pages = JSON.parse(localStorage.getItem('gd_pages')||'[]');
  const record = {id:Date.now(), data, t:Date.now(), synced:false};
  pages.push(record);
  localStorage.setItem('gd_pages', JSON.stringify(pages));
  // cloud sync if signed in
  if(currentUser){
    try{ await uploadPageToCloud(record); record.synced=true; updateLocalPageSync(record.id,true); }
    catch(e){ console.warn('cloud save failed',e); }
  }
  alert('页面已保存');
}
document.getElementById('savePage').addEventListener('click', savePage);

document.getElementById('exportPNG').addEventListener('click', ()=>{
  const dataURL = canvas.toDataURL({format:'png', multiplier:1});
  const a = document.createElement('a'); a.href = dataURL; a.download = 'globe-diary-page.png'; a.click();
});

function updateLocalPageSync(id, synced){
  const pages = JSON.parse(localStorage.getItem('gd_pages')||'[]');
  const p = pages.find(x=>x.id===id); if(p){ p.synced = synced; localStorage.setItem('gd_pages', JSON.stringify(pages)); }
}

// records UI
function renderRecords(){
  const panel = document.getElementById('recordsList'); panel.innerHTML='';
  const pages = JSON.parse(localStorage.getItem('gd_pages')||'[]');
  if(pages.length===0) panel.innerHTML='<div class="panel">暂无记录，编辑并保存一页试试</div>';
  pages.slice().reverse().forEach(p=>{
    const d = document.createElement('div'); d.className='panel'; d.style.marginTop='8px';
    d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>页面 ${p.id}</strong><div><button data-id="${p.id}" class="loadPage">打开</button> <button data-id="${p.id}" class="delPage">删除</button></div></div>`;
    panel.appendChild(d);
  });
  panel.querySelectorAll('.loadPage').forEach(b=>b.addEventListener('click', e=>{
    const id = +e.target.dataset.id; const pages = JSON.parse(localStorage.getItem('gd_pages')||'[]'); const p = pages.find(x=>x.id===id); if(!p) return; canvas.loadFromJSON(p.data, canvas.renderAll.bind(canvas)); showView('editor');
  }));
  panel.querySelectorAll('.delPage').forEach(b=>b.addEventListener('click', e=>{
    const id=+e.target.dataset.id; let pages = JSON.parse(localStorage.getItem('gd_pages')||'[]'); pages = pages.filter(x=>x.id!==id); localStorage.setItem('gd_pages', JSON.stringify(pages)); renderRecords();
  }));
}

document.getElementById('newRecord').addEventListener('click', ()=>{ showView('editor'); });

// Map
let map, markersLayer;
function initMap(){
  if(map) return;
  map = L.map('mapContainer').setView([20,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  loadMarkersToMap();
}
function loadMarkersToMap(){
  if(!markersLayer) return;
  markersLayer.clearLayers();
  const markers = JSON.parse(localStorage.getItem('gd_markers')||'[]');
  markers.forEach(m=>{
    const mk = L.marker([m.lat,m.lng]).addTo(markersLayer).bindPopup(`<strong>${m.title}</strong><div style="font-size:12px;color:#666">${new Date(m.t).toLocaleString()}</div>`);
  });
}

document.getElementById('addMarker').addEventListener('click', ()=>{
  const title = document.getElementById('markerTitle').value || '无名地点';
  const center = map.getCenter();
  const markers = JSON.parse(localStorage.getItem('gd_markers')||'[]');
  const rec = {title,lat:center.lat,lng:center.lng,t:Date.now(), synced:false};
  markers.push(rec);
  localStorage.setItem('gd_markers', JSON.stringify(markers));
  if(currentUser) uploadMarkerToCloud(rec).then(()=>updateLocalMarkerSync(rec.t,true)).catch(()=>{});
  loadMarkersToMap();
  alert('旅行点已保存（本地）');
});

document.getElementById('listMarkers').addEventListener('click', ()=>{
  const list = document.getElementById('markersList'); list.innerHTML=''; list.classList.toggle('hidden');
  const markers = JSON.parse(localStorage.getItem('gd_markers')||'[]');
  markers.forEach(m=>{ const r = document.createElement('div'); r.className='panel'; r.style.marginTop='6px'; r.innerHTML = `<strong>${m.title}</strong><div style="font-size:12px;color:#666">${m.lat.toFixed(2)}, ${m.lng.toFixed(2)} • ${new Date(m.t).toLocaleString()}</div>`; list.appendChild(r)});
});

function updateLocalMarkerSync(t, synced){
  const markers = JSON.parse(localStorage.getItem('gd_markers')||'[]'); const m = markers.find(x=>x.t===t); if(m){ m.synced = synced; localStorage.setItem('gd_markers', JSON.stringify(markers)); }
}

// Outfits
function renderOutfits(){
  const panel = document.getElementById('outfitList'); panel.innerHTML='';
  const outfits = JSON.parse(localStorage.getItem('gd_outfits')||'[]');
  if(outfits.length===0) panel.innerHTML='<div class="panel">暂无穿搭，上传一张试试</div>';
  outfits.slice().reverse().forEach(o=>{
    const d = document.createElement('div'); d.className='panel'; d.style.marginTop='8px';
    d.innerHTML = `<img src="${o.img}" style="height:88px;border-radius:6px;object-fit:cover;margin-right:8px;float:left;width:88px"/><div><strong>${o.note||'无备注'}</strong><div style="font-size:12px;color:#666">${new Date(o.t).toLocaleString()}</div></div><div style="clear:both"></div>`;
    panel.appendChild(d);
  });
}
document.getElementById('addOutfit').addEventListener('click', ()=>{
  const f = document.getElementById('outfitImg').files[0]; const note = document.getElementById('outfitNote').value;
  if(!f){ alert('请选择图片'); return; }
  const reader = new FileReader(); reader.onload = e=>{
    const rec = {img:e.target.result, note, t:Date.now(), synced:false};
    const outfits = JSON.parse(localStorage.getItem('gd_outfits')||'[]'); outfits.push(rec); localStorage.setItem('gd_outfits', JSON.stringify(outfits));
    if(currentUser) uploadOutfitToCloud(rec).then(()=>updateLocalOutfitSync(rec.t,true)).catch(()=>{});
    renderOutfits(); document.getElementById('outfitImg').value=''; document.getElementById('outfitNote').value='';
  }; reader.readAsDataURL(f);
});
function updateLocalOutfitSync(t, synced){ const outfits = JSON.parse(localStorage.getItem('gd_outfits')||'[]'); const o = outfits.find(x=>x.t===t); if(o){ o.synced = synced; localStorage.setItem('gd_outfits', JSON.stringify(outfits)); } }

// Timeline
function renderTimeline(){
  const panel = document.getElementById('timelineList'); panel.innerHTML='';
  const markers = JSON.parse(localStorage.getItem('gd_markers')||'[]');
  const pages = JSON.parse(localStorage.getItem('gd_pages')||'[]');
  const outfits = JSON.parse(localStorage.getItem('gd_outfits')||'[]');
  const items = [];
  markers.forEach(m=>items.push({t:m.t, type:'marker', title:m.title}));
  pages.forEach(p=>items.push({t:p.id, type:'page', title:'手账页面'}));
  outfits.forEach(o=>items.push({t:o.t, type:'outfit', title:'穿搭收藏'}));
  items.sort((a,b)=>b.t-a.t);
  if(items.length===0) panel.innerHTML='<div class="panel">暂无时间线事件</div>';
  items.forEach(i=>{ const d=document.createElement('div'); d.className='panel'; d.style.marginTop='8px'; d.innerHTML = `<strong>${i.title}</strong><div style="font-size:12px;color:#666">${new Date(i.t).toLocaleString()}</div>`; panel.appendChild(d); });
}

// --- Firebase sync helpers (simple implementations) ---
let currentUser = null;
const provider = new GoogleAuthProvider();

// UI: user and sync buttons
const userBtn = document.getElementById('userBtn');
const syncBtn = document.getElementById('syncBtn');
userBtn.addEventListener('click', ()=>{ openAuthModal(); });
syncBtn.addEventListener('click', ()=>{ if(currentUser) manualSync(); else alert('请先登录以启用云同步'); });

onAuthStateChanged(auth, async user=>{
  currentUser = user;
  if(user){
    userBtn.textContent = user.displayName ? user.displayName[0] : 'U';
    // on sign-in, pull remote data and merge
    try{ await pullRemoteAndMerge(); loadMarkersToMap(); renderOutfits(); renderRecords(); renderTimeline(); alert('已从云端同步数据'); }
    catch(e){ console.warn('pull failed', e); }
  } else { userBtn.textContent=''; }
});

// simple popup auth flow
async function openAuthModal(){
  const r = confirm('使用 Google 登录？按 确认 使用 Google，取消 使用匿名/邮箱登录');
  if(r){
    try{ await signInWithPopup(auth, provider); alert('登录成功'); }
    catch(e){ alert('登录失败: '+e.message); }
  } else {
    const em = prompt('输入邮箱登录(若无账户会创建):'); if(!em) return; const pw = prompt('密码:'); if(!pw) return;
    try{ await signInWithEmailAndPassword(auth, em, pw); alert('登录成功'); }
    catch(err){
      // if no user, create
      try{ await createUserWithEmailAndPassword(auth, em, pw); alert('已创建并登录'); }
      catch(e){ alert('登录/注册失败: '+e.message); }
    }
  }
}

async function manualSync(){
  try{ await pushLocalToCloud(); await pullRemoteAndMerge(); alert('手动同步完成'); }
  catch(e){ alert('同步失败: '+e.message); }
}

// Firestore helpers (compat layer)
const firestore = db; // using compat imported object

async function uploadPageToCloud(page){
  // store under users/{uid}/pages/{id}
  const uid = auth.currentUser.uid;
  await firestore.collection('users').doc(uid).collection('pages').doc(String(page.id)).set({data:page.data,t:page.t});
}
async function uploadMarkerToCloud(marker){
  const uid = auth.currentUser.uid;
  await firestore.collection('users').doc(uid).collection('markers').add({title:marker.title,lat:marker.lat,lng:marker.lng,t:marker.t});
}
async function uploadOutfitToCloud(outfit){
  const uid = auth.currentUser.uid;
  await firestore.collection('users').doc(uid).collection('outfits').add({img:outfit.img,note:outfit.note,t:outfit.t});
}

async function pushLocalToCloud(){
  if(!auth.currentUser) throw new Error('未登录');
  const pages = JSON.parse(localStorage.getItem('gd_pages')||'[]');
  const markers = JSON.parse(localStorage.getItem('gd_markers')||'[]');
  const outfits = JSON.parse(localStorage.getItem('gd_outfits')||'[]');
  for(const p of pages){ if(!p.synced) await uploadPageToCloud(p); }
  for(const m of markers){ if(!m.synced) await uploadMarkerToCloud(m); }
  for(const o of outfits){ if(!o.synced) await uploadOutfitToCloud(o); }
}

async function pullRemoteAndMerge(){
  if(!auth.currentUser) throw new Error('未登录');
  const uid = auth.currentUser.uid;
  // pages
  const localPages = JSON.parse(localStorage.getItem('gd_pages')||'[]');
  const remotePagesSnap = await firestore.collection('users').doc(uid).collection('pages').get();
  remotePagesSnap.forEach(doc=>{
    const d = doc.data(); const id = Number(doc.id);
    if(!localPages.find(p=>p.id===id)) localPages.push({id, data:d.data, t:d.t, synced:true});
  });
  localStorage.setItem('gd_pages', JSON.stringify(localPages));
  // markers
  const localMarkers = JSON.parse(localStorage.getItem('gd_markers')||'[]');
  const remoteMarkersSnap = await firestore.collection('users').doc(uid).collection('markers').get();
  remoteMarkersSnap.forEach(doc=>{ const d=doc.data(); if(!localMarkers.find(m=>m.t===d.t && Math.abs(m.lat-d.lat)<1e-6)) localMarkers.push({...d, synced:true}); });
  localStorage.setItem('gd_markers', JSON.stringify(localMarkers));
  // outfits
  const localOutfits = JSON.parse(localStorage.getItem('gd_outfits')||'[]');
  const remoteOutfitsSnap = await firestore.collection('users').doc(uid).collection('outfits').get();
  remoteOutfitsSnap.forEach(doc=>{ const d=doc.data(); if(!localOutfits.find(o=>o.t===d.t)) localOutfits.push({...d, synced:true}); });
  localStorage.setItem('gd_outfits', JSON.stringify(localOutfits));
}

// sign out
async function doSignOut(){ if(auth.currentUser) await signOut(auth); alert('已登出'); }

// wire simple sign-out on long-press of userBtn
let pressTimer;
userBtn.addEventListener('mousedown', ()=>{ pressTimer = setTimeout(()=>{ if(currentUser) doSignOut(); },1000); });
userBtn.addEventListener('mouseup', ()=>{ clearTimeout(pressTimer); });

// init default view
showView('editor');

// touch prevention for canvas
const cvs = document.getElementById('c');
['touchstart','touchmove'].forEach(ev=>cvs.addEventListener(ev, e=>{ if(canvas.isDrawingMode || canvas.getActiveObject()) e.preventDefault(); },{passive:false}));

// on load, if user already signed in, onAuthStateChanged will pull

