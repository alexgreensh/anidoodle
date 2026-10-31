import { build } from 'esbuild';
import { strict as assert } from 'node:assert';

const {outputFiles}=await build({entryPoints:['src/canvas-core/music/index.ts'],bundle:true,write:false,format:'esm'});
const M=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const fftBundle=await build({entryPoints:['src/canvas-core/music/meter.ts'],bundle:true,write:false,format:'esm'});
const {fft}=await import('data:text/javascript;base64,'+Buffer.from(fftBundle.outputFiles[0].text).toString('base64'));
function measure(x){
 const hop=48, rms=[]; for(let i=0;i+hop<=x.length;i+=hop){let s=0;for(let j=0;j<hop;j++)s+=x[i+j]**2;rms.push(Math.sqrt(s/hop));}
 const peak=Math.max(...rms), candidates=[];for(let i=2;i<rms.length-2;i++)if(rms[i]>peak*.08&&rms[i]>=rms[i-1]&&rms[i]>rms[i+1]&&rms[i]>=rms[i-2]&&rms[i]>=rms[i+2])candidates.push(i);
 const events=[];for(const i of candidates){if(events.length&&i-events.at(-1)<70){if(rms[i]>rms[events.at(-1)])events[events.length-1]=i;}else events.push(i);}
 const q=(a,p)=>{if(!a.length)return null;a.sort((a,b)=>a-b);return +a[Math.floor((a.length-1)*p)].toFixed(2)};
 const decay30=[],decay45=[],rise=[],upDelay=[],upGap=[],levels=[],intervals=[],bands=[0,0,0,0,0], freqs=[80,300,1000,3000,8000,24000]; let power=0,weight=0;
 for(let k=0;k<events.length;k++){let p=events[k],v=rms[p], before=p;while(before>0&&p-before<30&&rms[before]>v*.1)before--;rise.push(p-before);levels.push(20*Math.log10(v/peak));if(k)intervals.push(p-events[k-1]);
  let end=Math.min(p+150,events[k+1]??rms.length);for(const [threshold,arr] of [[.03162,decay30],[.005623,decay45]]){let i=p+1;while(i<end&&rms[i]>v*threshold)i++;if(i<end)arr.push(i-p);}
  let sub=[];for(let i=p+20;i<Math.min(end,p+150)-2;i++)if(rms[i]>v*.02&&rms[i]>rms[i-1]&&rms[i]>=rms[i+1]&&rms[i]>rms[i-2]&&rms[i]>=rms[i+2])sub.push(i);if(sub.length){let u=sub.reduce((a,b)=>rms[a]>rms[b]?a:b);upDelay.push(u-p);upGap.push(20*Math.log10(rms[u]/v));}
  const N=2048,re=new Float64Array(N),im=new Float64Array(N),start=Math.max(0,(p-5)*hop);for(let i=0;i<N&&start+i<x.length;i++)re[i]=x[start+i]*(.5-.5*Math.cos(2*Math.PI*i/(N-1)));fft(re,im);for(let i=1;i<N/2;i++){const f=i*sr/N,e=re[i]**2+im[i]**2;for(let b=0;b<5;b++)if(f>=freqs[b]&&f<freqs[b+1])bands[b]+=e;power+=e;weight+=e*f;}
 }
 return {events:events.length,onset_ms:[q(rise,.1),q(rise,.5),q(rise,.9)],decay30_ms:[q(decay30,.1),q(decay30,.5),q(decay30,.9)],decay45_ms:[q(decay45,.1),q(decay45,.5),q(decay45,.9)],centroid_hz:Math.round(weight/power),bands:bands.map(x=>+(100*x/power).toFixed(2)),up_delay_ms:[q(upDelay,.1),q(upDelay,.5),q(upDelay,.9)],up_gap_db:[q(upGap,.1),q(upGap,.5),q(upGap,.9)],interval_ms:[q(intervals,.1),q(intervals,.5),q(intervals,.9)],level_db:[q(levels,.1),q(levels,.5),q(levels,.9)],noise_floor_db:+(20*Math.log10(Math.max(1e-12,[...rms].sort((a,b)=>a-b)[Math.floor(rms.length*.1)])/peak)).toFixed(2)};
}
const sr=48000, takes=[1,2,3].map(seed=>M.renderSfx('typing',{variant:'real',seed,lengthS:6},sr));
assert.deepEqual(takes[0].L,M.renderSfx('typing',{variant:'real',seed:1,lengthS:6},sr).L);
assert.notDeepEqual(takes[0].L,takes[1].L);assert.notDeepEqual(takes[1].L,takes[2].L);
const measurements=[];
for(const take of takes){assert.equal(take.L.length,6*sr);assert(M.auditSfx([take.L,take.R],sr).ok);const m=measure(take.L);measurements.push(m);console.log(JSON.stringify(m));const inRange=(name,x,lo,hi)=>assert(x>=lo&&x<=hi,`${name}: ${x} outside ${lo}..${hi}`);
  inRange('centroid',m.centroid_hz,1749,4459);for(let i=0;i<5;i++)inRange(`band ${i}`,m.bands[i],[2.41,.67,16.7,19.36,1.05][i],[38.79,24.33,53.38,71.14,8.86][i]);
  for(const [name,lo,hi] of [['onset_ms',3,9],['decay30_ms',25,89],['up_delay_ms',25,74],['up_gap_db',-15.29,-5.31],['interval_ms',108,267],['level_db',-18.98,-10.17]])inRange(name,m[name][1],lo,hi);
  inRange('noise floor',m.noise_floor_db,-69.6,-43.67);}
const decay45=measurements.map(m=>m.decay45_ms[1]).sort((a,b)=>a-b)[1]; assert(decay45>=75&&decay45<=83, `median decay45: ${decay45}`);
console.log('typing.real determinism, variation, duration, audit and spectral range pass');
