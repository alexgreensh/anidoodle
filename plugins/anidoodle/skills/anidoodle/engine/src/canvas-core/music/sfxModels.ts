import { rng } from '../core';
import { Biquad } from './dsp';
import { Bus, buf, filt, secs, white } from './sfxCore';
import { smallRoom } from './roomSmall';

const tau = 2 * Math.PI;
/** Stable physical properties for each key, independent of take seed. */
export const keyProperties = (key: number) => {
  const r = rng((key + 1) * 739391);
  return { bands: [180, 420, 900, 2200].map(f => f * (0.93 + 0.14 * r())), gain: Math.pow(10, (r() * 4 - 2) / 20) };
};
/** Low-profile key: a short contact and damped case, followed by a lighter release. */
export const typingReal = (seed: number, length: number, sr: number) => {
  const r = rng(seed), bus = new Bus(sr, secs(sr, length + .2));
  let at = .015, count = 0;
  while (at < Math.max(.016, length - .16)) {
    const space = count % (4 + Math.floor(r() * 5)) === 3;
    const velocity = Math.pow(10, (r() * 20 - 10) / 20), pan = (r() - .5) * .16;
    const hit = (time: number, gain: number, decay: number) => {
      const a = white(r, secs(sr, .2));
      filt(a, sr, { hp: 120, lp: 4800 });
      for (let i = 0; i < a.length; i++) a[i] *= (Math.exp(-i / sr / decay) + .04 * Math.exp(-i / sr / .033)) * Math.min(1, i / (sr * .002));
      bus.add(a, secs(sr, time), gain * velocity, pan);
    };
    hit(at, space ? .8 : 1, .006 + r() * .003);
    hit(at + .045 + r() * .055, .28 + r() * .18, .003 + r() * .003);
    at += (space ? .20 : .09) + r() * (space ? .14 : .12) + (count % 13 === 12 ? .2 + r() * .2 : 0);
    count++;
  }
  const ambience = white(r, bus.n);
  filt(ambience, sr, { hp: 200, lp: 6000 });
  bus.add(ambience, 0, .0012);
  if (length <= .176) for (const c of [bus.L, bus.R]) {
    const end = secs(sr, length), fade = secs(sr, Math.min(.035, length / 2));
    for (let i = Math.max(0, end - fade); i < c.length; i++) c[i] *= i >= end ? 0 : Math.pow(.5 + .5 * Math.cos(Math.PI * (i - (end - fade)) / fade), 3);
  }
  return {bus, hit: 0};
};
export const typingModels = (variant: string, seed: number, length: number, sr: number) => {
  const r = rng(seed), n = secs(sr, length + .2), bus = new Bus(sr, n), laptop = variant === 'laptop', soft = variant === 'soft';
  let at = 0, count = 0, word = 3 + Math.floor(r() * 6), pos = 0;
  while (at < Math.max(.001, length - .15)) {
    const space = pos === word, key = space ? 29 : Math.floor(r() * 29), props = keyProperties(key), pan = space ? 0 : ((key % 10) / 9 - .5) * .3;
    const velocity = Math.pow(10, ((r() * 6 - 3) + (pos === 0 ? 1 : 0)) / 20) * props.gain * (laptop ? .708 : 1);
    const event = (when: number, bright: number, gain: number, decayScale: number) => {
      const size = secs(sr, .16), source = white(r, size), sig = buf(size);
      for (let j = 0; j < 4; j++) {
        const b = source.slice(), f = props.bands[j] * (space ? .7 : 1) * (soft ? .85 : 1) * (laptop ? 1.5 : 1) * bright;
        filt(b, sr, { bp: f, q: 3 });
        const decay = (space ? .045 : laptop ? [.015,.013,.010,.008][j] : [.035,.028,.021,.015][j]) * decayScale;
        for (let i = 0; i < size; i++) sig[i] += b[i] * Math.exp(-i / sr / decay) * [650,30,2,.25][j];
      }
      bus.add(sig, secs(sr, when), gain * velocity, pan);
      return sig;
    };
    const bottom = at + (soft ? 0 : .003);
    const body = event(bottom, 1, 1, 1);
    if (!soft) { const c = white(r, secs(sr, .004)); filt(c, sr, { hp: 2000, lp: 5000 }); let ce=0,be=0; for (let i=0;i<c.length;i++) { c[i] *= Math.sin(Math.PI*i/c.length); ce+=c[i]*c[i]; be+=body[i]*body[i]; } bus.add(c, secs(sr, at), Math.sqrt(be/Math.max(ce,1e-30))*.2*velocity, pan); }
    if (!laptop) event(bottom + .055 + .065*r(), 1.45, .32, .4);
    if (space) { event(bottom+.007, 1.4, .08, .25); event(bottom+.015, 1.4, .07, .25); }
    count++; pos++;
    let gap: number;
    if (space) { gap = .18 + .14*r(); pos=0; word=3+Math.floor(r()*6); }
    else { const z = Math.sqrt(-2*Math.log(Math.max(r(),1e-8))) * Math.cos(tau*r()); gap = Math.max(.07,Math.min(.19,.115*Math.exp(.28*z))); }
    at += count % 12 === 0 ? .4 + .3*r() : gap;
  }
  for (const c of [bus.L,bus.R]) { const hp=Biquad.make(sr,'hp',70,.707), lp=Biquad.make(sr,'lp',9000,.707); for(let i=0;i<n;i++) c[i]=lp.tick(hp.tick(c[i])); }
  const l=bus.L.slice(), rr=bus.R.slice(), delay=secs(sr,.004); for(let i=delay;i<n;i++){bus.L[i]+=l[i-delay]*.158;bus.R[i]+=rr[i-delay]*.158;}
  const wet=smallRoom(l,rr,sr,{rt60:.12,size:.4,er:.4,late:.4,predelay:.004,hp:200,lp:9000,damp:6500,seed}); bus.add2(wet[0],wet[1],0,.063);
  for (const c of [bus.L, bus.R]) {
    const end = secs(sr, length), fade = secs(sr, Math.min(.035, length / 2));
    for (let i = Math.max(0, end - fade); i < n; i++) c[i] *= i >= end ? 0 : Math.pow(.5 + .5 * Math.cos(Math.PI * (i - (end - fade)) / fade), 3);
  }
  return {bus,hit:0};
};
export const notificationModels = (variant: string, seed: number, root: number, sr: number) => {
  const r=rng(seed), n=secs(sr,.7), bus=new Bus(sr,n), a=buf(n);
  const note=(start:number,f:number,gain:number, ratios:number[], decay:number, attack:number) => {
    for(let i=secs(sr,start);i<n;i++){const t=i/sr-start, rise=Math.min(1,t/attack), env=(.5-.5*Math.cos(Math.PI*rise))*Math.exp(-t/decay); for(let j=0;j<ratios.length;j++) a[i]+=gain*env*Math.sin(tau*f*ratios[j]*t)/(1+j*2)*Math.exp(-t*(variant==='bar' && j ? 3 : j/.8)/decay);}
  };
  if(variant==='bar'){note(0,root,1,[1,3.9,9.2],.035,.005);note(.075,root*1.25,.794,[1,3.9,9.2],.035,.005);}
  else if(variant==='glass'){note(0,root-.4,.5,[1,2.32,4.25,6.63],.5,.0015);note(0,root+.4,.5,[1],.5,.0015);const tap=white(r,secs(sr,.0015));filt(tap,sr,{bp:4000,q:2});for(let i=0;i<tap.length;i++) a[i]+=tap[i]*3*Math.sin(Math.PI*i/tap.length);}
  else {let phase=0;for(let i=0;i<secs(sr,.06);i++){const t=i/sr;phase+=tau*root*(1+.6*t/.06)/sr;a[i]+=Math.sin(phase)*Math.sin(Math.PI*Math.min(1,t/.003)/2)*Math.exp(-t/.012);} const tick=white(r,secs(sr,.001));for(let i=0;i<tick.length;i++)a[i]+=tick[i]*.05*Math.sin(Math.PI*i/tick.length);}
  // End the finite render smoothly after the model has decayed.
  for(let i=0;i<n;i++){const t=i/sr; a[i]*=Math.min(1,Math.max(0,(.7-t)/.1));}
  bus.add(a); return {bus,hit:0};
};
