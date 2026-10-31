import { build } from 'esbuild';
import { strict as assert } from 'node:assert';
const bundle=async entry=>{const {outputFiles}=await build({entryPoints:[entry],bundle:true,write:false,format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));};
const M=await bundle('src/canvas-core/music/index.ts'), K=await bundle('src/canvas-core/music/sfxModels.ts'), sr=48000;
assert.throws(() => M.validateSfxPlan({fps:30, frames:1, cues:[], sfxVersion:3}), /sfxVersion/);
assert.throws(() => M.validateSfxPlan({fps:30, frames:1, cues:[], legacy:'yes'}), /legacy/);
assert.throws(() => M.validateSfx('tick', {variant:'new'}), /no variant/);
assert.equal(M.renderSfx('notification', {sfxVersion:2, legacy:false, seed:1}, sr).variant, 'default');
assert.notEqual(Buffer.compare(Buffer.from(M.renderSfx('notification', {variant:'drop', seed:1, pitch:12}, sr).L.buffer), Buffer.from(M.renderSfx('notification', {variant:'drop', seed:1, pitch:0}, sr).L.buffer)), 0);
for (const variant of ['mech', 'laptop', 'soft', 'real']) for (const lengthS of [.05, .16]) assert.equal(M.renderSfx('typing', {variant, lengthS, seed:1}, sr).L.length, Math.round(sr*lengthS));
for (const seed of [1, 7, 4294967295]) {
  const typing = M.renderSfx('typing', {sfxVersion:2, seed}, sr);
  const real = M.renderSfx('typing', {variant:'real', seed}, sr);
  assert.equal(Buffer.compare(Buffer.from(typing.L.buffer), Buffer.from(real.L.buffer)), 0); assert.equal(Buffer.compare(Buffer.from(typing.R.buffer), Buffer.from(real.R.buffer)), 0); assert.equal(typing.hit, real.hit);
  const plan = {fps:30, frames:90, sfxVersion:2, cues:[{frame:30, kind:'typing', seed}]};
  assert.equal(Buffer.compare(Buffer.from(M.placeSfx(plan,sr)[0].sound.L.buffer), Buffer.from(real.L.buffer)), 0);
  const old = M.renderSfx('typing', {variant:'old', seed}, sr), tick = M.renderSfx('tick', {variant:'key', seed, legacy:true}, sr);
  assert.equal(Buffer.compare(Buffer.from(old.L.buffer), Buffer.from(tick.L.buffer)), 0);
  const notification = M.renderSfx('notification', {sfxVersion:2, seed, key:'E'}, sr);
  const drop = M.renderSfx('notification', {variant:'drop', seed, key:'E'}, sr);
  assert.equal(Buffer.compare(Buffer.from(notification.L.buffer), Buffer.from(drop.L.buffer)), 0); assert.equal(Buffer.compare(Buffer.from(notification.R.buffer), Buffer.from(drop.R.buffer)), 0);
}
assert.deepEqual(K.keyProperties(4),K.keyProperties(4)); assert.notDeepEqual(K.keyProperties(4),K.keyProperties(5));
for(const variant of ['mech','laptop','soft']){
  const takes=[1,2,3].map(seed=>M.renderSfx('typing',{variant,seed,lengthS:6},sr));
  for(const s of takes){const hz=M.centroid([s.L,s.R],sr).energyWeighted;assert(hz>=900&&hz<=2200,`${variant} centroid ${hz}`);assert(M.auditSfx([s.L,s.R],sr).ok);assert.equal(s.L.length,sr*6);}
  assert.notDeepEqual(takes[0].L,takes[1].L);assert.notDeepEqual(takes[1].L,takes[2].L);
}
for(const variant of ['bar','glass','drop']) for(const key of ['E','Am']){
  const s=M.renderSfx('notification',{variant,key,seed:1},sr);let peak=0,at=0;for(let i=0;i<s.L.length;i++)if(Math.abs(s.L[i])>peak){peak=Math.abs(s.L[i]);at=i;}
  assert(at/sr<=.008,`${variant} peak ${at/sr}`);assert(M.auditSfx([s.L,s.R],sr).ok);assert.equal(s.L.length,sr*.7);
  if(variant!=='drop')assert(!M.hasRisingGlide(s.L,sr),variant+' rising glide');
}
const base={fps:30,frames:300,key:'C',bpm:120,cues:[{frame:90,kind:'pop',variant:'pop',seed:1}]};
const unchanged=M.placeSfx(base,sr)[0].sound, old=M.renderSfx('pop',{variant:'pop',seed:1,key:'C',bpm:120,legacy:true},sr);
assert.deepEqual(unchanged.L,old.L,'unversioned plan uses shipped pop');
assert.deepEqual(M.placeSfx({...base,sfxVersion:2},sr)[0].sound.L,old.L,'v2 keeps old pop');
assert.notDeepEqual(M.renderSfx('pop',{variant:'new',seed:1,key:'C',bpm:120},sr).L,M.renderSfx('pop',{variant:'old',seed:1,key:'C',bpm:120},sr).L,'explicit old/new');
console.log('typing and notification: key map, varied typing, centroid, duration, audit, notification peak and glide pass');
