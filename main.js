
(() => {
const IMAGES = [
{ src: "homeroom/sadgirls/girl1.png", thumb: null, title: "Girl 1", caption: "" },
{ src: "homeroom/sadgirls/girl6.png", thumb: null, title: "Girl 6", caption: "" },
{ src: "homeroom/sadgirls/girl8.png", thumb: null, title: "Girl 8", caption: "" }
];


const stageImg = document.getElementById('stageImg');
const thumbBar = document.getElementById('thumbBar');
const idxEl = document.getElementById('idx');
const lenEl = document.getElementById('len');
const metaTitle = document.getElementById('metaTitle');
const captionEl = document.getElementById('caption');
const diag = document.getElementById('diag');


let current = 0;


function writeDiag(msg){
if(!diag) return; const p=document.createElement('div'); p.innerHTML = msg; diag.appendChild(p);
}


function setStage(i){
const item = IMAGES[i]; if(!item) return;
const img = new Image(); img.alt = item.title || "";
img.onload = () => { stageImg.style.opacity = 0; requestAnimationFrame(()=>{ stageImg.src = img.src; stageImg.alt = img.alt; stageImg.style.opacity = 1; }); };
img.onerror = () => { stageImg.alt = "Image failed to load"; writeDiag(`❌ failed: <code>${item.src}</code>`); };
img.src = item.src; writeDiag(`↻ loading: <code>${item.src}</code>`);


if(idxEl) idxEl.textContent = i+1; if(metaTitle) metaTitle.textContent = item.title || ''; if(captionEl) captionEl.textContent = item.caption || '';
[...thumbBar.children].forEach((el,ix)=> el.classList.toggle('active', ix===i));
}


function makeThumb(item, i){
const t = document.createElement('button'); t.className = 'thumb' + (i===0 ? ' active' : ''); t.type = 'button'; t.setAttribute('aria-label', `Go to image ${i+1}`); t.addEventListener('click', () => go(i));
const img = document.createElement('img'); img.alt = item.title ? `${item.title} thumbnail` : `Thumbnail ${i+1}`; img.loading = 'lazy'; img.src = item.thumb || item.src; t.appendChild(img); return t;
}


function render(){ IMAGES.forEach((it,i)=> thumbBar.appendChild(makeThumb(it,i)) ); if(lenEl) lenEl.textContent = IMAGES.length; setStage(0); preloadAround(0); }


function go(n){ const len = IMAGES.length; current = ((n % len) + len) % len; setStage(current); preloadAround(current); }


function preload(src){ const i = new Image(); i.src = src; }
function preloadAround(i){ const nextI = (i+1) % IMAGES.length; const prevI = (i-1+IMAGES.length) % IMAGES.length; preload(IMAGES[nextI].src); preload(IMAGES[prevI].src); }


document.getElementById('stage').addEventListener('keydown', (e)=>{ if(e.key === 'ArrowRight'){ go(current+1); e.preventDefault(); } else if(e.key === 'ArrowLeft'){ go(current-1); e.preventDefault(); } });


IMAGES.forEach(it=>{ fetch(it.src, {method:'HEAD'}).then(r=> writeDiag(`${r.ok?"✅":"❌"} ${r.status} <code>${it.src}</code>`)).catch(()=> writeDiag(`❌ fetch error <code>${it.src}</code>`)); });


render();
})();

