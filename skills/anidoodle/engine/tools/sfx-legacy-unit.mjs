import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const entry=resolve('src/canvas-core/music/sfxKit.ts');
const old=execFileSync('git',['show','cf5ccfc:skills/anidoodle/engine/src/canvas-core/music/sfxKit.ts'],{encoding:'utf8'});
const bundle=async plugins=>{const {outputFiles}=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'neutral',plugins});return import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));};
const original=await bundle([{name:'original',setup(b){b.onLoad({filter:/sfxKit\.ts$/},()=>({contents:old,loader:'ts',resolveDir:resolve('src/canvas-core/music')}));}}]);
const current=await bundle([]);
const hash=s=>createHash('sha256').update(Buffer.from(s.L.buffer)).update(Buffer.from(s.R.buffer)).digest('hex');
let count=0;
for(const kind of original.SFX_KINDS) for(const variant of original.sfxVariants(kind)) for(const seed of [1,11]) {const opts={variant,seed,key:'C',bpm:120};const a=original.renderSfx(kind,opts,48000),b=current.renderSfx(kind,opts,48000),c=current.renderSfx(kind,{...opts,legacy:true},48000);if(hash(a)!==hash(b)||hash(a)!==hash(c)||a.hit!==b.hit||a.hit!==c.hit)throw Error(`legacy changed ${kind}:${variant} seed ${seed}`);count++;}
console.log(`legacy: ${count} original takes bit-identical`);
