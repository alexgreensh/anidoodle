import { build } from 'esbuild';
import { strict as assert } from 'node:assert';
const {outputFiles}=await build({entryPoints:['src/canvas-core/music/index.ts'],bundle:true,write:false,format:'esm'});
const M=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const sr=48000, kinds=['click','pop','pop-in','whoosh-short','whoosh-long','dark-riser','impact','cut-hit','sub-drop','typing','notification','toggle-on','toggle-off'];
for(const kind of kinds){const opts={seed:1,key:'C',bpm:120,legacy:false};const a=M.renderSfx(kind,opts,sr),b=M.renderSfx(kind,opts,sr),c=M.renderSfx(kind,{...opts,seed:2},sr);assert.deepEqual(a.L,b.L,kind+' determinism');assert.notDeepEqual(a.L,c.L,kind+' seed variation');assert(M.auditSfx([a.L,a.R],sr).ok,kind+' audit');let lr=0,ll=0,rr=0;for(let i=0;i<a.L.length;i++){lr+=a.L[i]*a.R[i];ll+=a.L[i]**2;rr+=a.R[i]**2}assert(lr/Math.sqrt(ll*rr)>.9,kind+' correlation');}
const pop=M.renderSfx('pop',{seed:1,legacy:false},sr);assert(Math.abs(pop.L.length/sr-.16)<.01);const hz=M.centroid([pop.L,pop.R],sr).energyWeighted;assert(hz>500&&hz<750,`pop centroid ${hz}`);
const rms=(a,start,end)=>{let sum=0;for(let i=Math.round(start*sr);i<Math.round(end*sr);i++)sum+=a[i]**2;return Math.sqrt(sum/((end-start)*sr))};
const imp=M.renderSfx('impact',{variant:'boom',seed:1,key:'C',legacy:false},sr), roll=20*Math.log10(rms(imp.L,2,3)/rms(imp.L,0,.1));assert(roll >= -14 && roll <= -10, `impact roll ${roll} dB`);console.log('impact 2–3 s vs first 100 ms:',roll.toFixed(1),'dB');
console.log('physics: 13 kinds deterministic, varied, audited and correlated; pop duration and centroid pass');
