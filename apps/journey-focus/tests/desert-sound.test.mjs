import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_MIX,normalizeMix,presetMix,selectedPreset} from '../public/desert/src/soundscape.mjs';

test('stored audio preferences recover from invalid data and clamp dangerous values',()=>{
 assert.deepEqual(normalizeMix(null),DEFAULT_MIX);
 const mix=normalizeMix({music:{enabled:false,volume:999},nature:{enabled:'yes',volume:-20},rail:{volume:NaN}});
 assert.deepEqual(mix.music,{enabled:false,volume:100});assert.deepEqual(mix.nature,{enabled:true,volume:0});assert.deepEqual(mix.rail,DEFAULT_MIX.rail);
 mix.rail.volume=0;assert.equal(DEFAULT_MIX.rail.volume,25);
});
test('comparison presets isolate the requested layers while preserving volume choices',()=>{
 const mix=normalizeMix({music:{volume:68},nature:{volume:18},rail:{volume:39}});
 for(const name of ['nature','music','together']){
  const result=presetMix(mix,name);assert.equal(selectedPreset(result),name);
  for(const key of Object.keys(result))assert.equal(result[key].volume,mix[key].volume);
 }
 assert.equal(presetMix(mix,'nature').music.enabled,false);
 assert.equal(presetMix(mix,'music').rail.enabled,false);
 assert.equal(selectedPreset({...mix,rail:{...mix.rail,enabled:false}}),'custom');
 assert.deepEqual(presetMix(mix,'unknown'),mix);
});
