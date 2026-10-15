/* app.js - 实现核心功能：fabric 编辑器、贴纸、花边绘制、地图、记录、穿搭与时间线 */
const state = { view: 'editor' }
// --- simple SPA navigation ---
document.querySelectorAll('.nav button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    showView(btn.dataset.view);
  })
})
function showView(name){
  state.view = name;
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  const el = document.getElementById(name);
  if(el) el.classList.remove('hidden');
  if(name==='map') setTimeout(initMap,200);
  if(name==='records') renderRecords();
  if(name==='outfit') renderOutfits();
  if(name==='timeline') renderTimeline();
}

// --- Fabric editor setup ---
const canvas = new fabric.Canvas('c',{preserveObjectStacking:true, selection:true, allowTouchScrolling:false});
canvas.setWidth(900);canvas.setHeight(1200);
// adapt for device pixel ratio for crispness
function resizeCanvasForDisplay(){
  const containerWidth = Math.min(window.innerWidth-40,420);
  const scale = containerWidth / 900;
  const el = canvas.getElement();
  el.style.width = (900*scale)+"px";
  el.style.height = (1200*scale)+"px";
}
window.addEventListener('resize', resizeCanvasForDisplay);
resizeCanvasForDisplay();

// enable touch gestures (fabric supports per-element gestures via controls)
canvas.on('touch:gesture', function(){});

// free drawing lace brush
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
  brush.width = 18; // stroke width uses brush.width
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

// toggle free draw
document.getElementById('freeDraw').addEventListener('click', ()=>{
  laceBrushEnabled = !laceBrushEnabled;
  canvas.isDrawingMode = laceBrushEnabled;
  document.getElementById('freeDraw').textContent = laceBrushEnabled? '结束绘制' : '花边绘制';
});

document.getElementById('clearDraw').addEventListener('click', ()=>{
  // remove all paths (drawings)
  const objs = canvas.getObjects().filter(o=>o.type==='path' || o.type==='path-group');
  objs.forEach(o=>canvas.remove(o));
  canvas.renderAll();
});

// saving and export
document.getElementById('savePage').addEventListener('click', ()=>{
  const data = canvas.toObject(['selectable']);
  const pages = JSON.parse(localStorage.getItem('gd_pages')||'[]');
  pages.push({id:Date.now(), data});
  localStorage.setItem('gd_pages', JSON.stringify(pages));
  alert('页面已保存到本地记录');
});

document.getElementById('exportPNG').addEventListener('click', ()=>{
  const dataURL = canvas.toDataURL({format:'png', multiplier:1});
  const a = document.createElement('a'); a.href = dataURL; a.download = 'globe-diary-page.png'; a.click();
});

// allow multi-touch gestures on mobile (fabric controls handle transform)
// persist selection when dragging
canvas.on('object:selected', ()=>{});
canvas.on('selection:cleared', ()=>{});

// load saved pages list for timeline & records
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

// --- Map and travel markers ---
let map, markersLayer;
function initMap(){
  if(map) return;
  map = L.map('mapContainer').setView([20,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  loadMarkersToMap();
}

function loadMarkersToMap(){
  markersLayer.clearLayers();
  const markers = JSON.parse(localStorage.getItem('gd_markers')||'[]');
  markers.forEach(m=>{
    const mk = L.marker([m.lat,m.lng]).addTo(markersLayer).bindPopup(`<strong>${m.title}</strong><div style="font-size:12px;color:#666">${new Date(m.t).toLocaleString()}</div>`);
  });
}

// add marker - center on current view
document.getElementById('addMarker').addEventListener('click', ()=>{
  const title = document.getElementById('markerTitle').value || '无名地点';
  const center = map.getCenter();
  const markers = JSON.parse(localStorage.getItem('gd_markers')||'[]');
  markers.push({title,lat:center.lat,lng:center.lng,t:Date.now()});
  localStorage.setItem('gd_markers', JSON.stringify(markers));
  loadMarkersToMap();
  alert('旅行点已保存（保存在本地）');
});

document.getElementById('listMarkers').addEventListener('click', ()=>{
  const list = document.getElementById('markersList'); list.innerHTML=''; list.classList.toggle('hidden');
  const markers = JSON.parse(localStorage.getItem('gd_markers')||'[]');
  markers.forEach(m=>{ const r = document.createElement('div'); r.className='panel'; r.style.marginTop='6px'; r.innerHTML = `<strong>${m.title}</strong><div style="font-size:12px;color:#666">${m.lat.toFixed(2)}, ${m.lng.toFixed(2)} • ${new Date(m.t).toLocaleString()}</div>`; list.appendChild(r)});
});

// --- Outfit collection ---
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
    const outfits = JSON.parse(localStorage.getItem('gd_outfits')||'[]'); outfits.push({img:e.target.result, note, t:Date.now()}); localStorage.setItem('gd_outfits', JSON.stringify(outfits)); renderOutfits(); document.getElementById('outfitImg').value=''; document.getElementById('outfitNote').value='';
  }; reader.readAsDataURL(f);
});

// --- Timeline ---
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

// init default view
showView('editor');

// load some small helper assets from repo if available
// if using GitHub Pages, assets path is root; when served locally, use relative paths

// ensure touch move & gesture support for mobile (iPhone) by preventing default scrolling when interacting with canvas
const cvs = document.getElementById('c');
['touchstart','touchmove'].forEach(ev=>cvs.addEventListener(ev, e=>{ if(canvas.isDrawingMode || canvas.getActiveObject()) e.preventDefault(); },{passive:false}));
