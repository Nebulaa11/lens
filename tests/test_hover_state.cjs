const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('app.js','utf8');
const listeners={},queue=new Map();let id=0;
const context={state:{sector:'all'},render:()=>{},$:()=>({addEventListener:(name,fn)=>listeners[name]=fn}),$$:()=>[],setTimeout:fn=>{queue.set(++id,fn);return id},clearTimeout:key=>queue.delete(key)};
vm.createContext(context);
vm.runInContext('let hoveredSector=null;const activeSector=()=>hoveredSector||state.sector;'+source.match(/function setSector\(sector\)\{[^\n]+/)[0]+source.slice(source.indexOf('let sectorHoverTimer;'),source.indexOf('// Give scrolling priority')),context);
const active=()=>vm.runInContext('activeSector()',context),pin=name=>vm.runInContext(`setSector('${name}')`,context);
function hover(sector){const button={dataset:{sector},contains:()=>false};listeners.pointerover({pointerType:'mouse',target:{closest:()=>button},relatedTarget:null});for(const [key,fn] of queue){queue.delete(key);fn()}}
hover('IT');assert.equal(active(),'IT');listeners.pointerleave();assert.equal(active(),'all');
hover('BANK');pin('BANK');listeners.pointerleave();assert.equal(active(),'BANK');
hover('IT');assert.equal(active(),'IT');listeners.pointerleave();assert.equal(active(),'BANK');
pin('all');assert.equal(active(),'all');hover('POWER');listeners.pointerout({target:{closest:()=>({contains:()=>false})},relatedTarget:null});assert.equal(active(),'all');
console.log('PASS: hover preview, leave reset, click pin, restore pinned sector, explicit reset, per-button exit.');
