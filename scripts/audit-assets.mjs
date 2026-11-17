import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL('../apps/client/public/assets/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base)));
let images=0,materials=0;
for(const entry of manifest){
 assert.equal(path.basename(entry.file),entry.file,'Unsafe manifest path');
 const data=fs.readFileSync(new URL('models/'+entry.file,base));
 assert.equal(data.length,entry.bytes,entry.file+' size');assert.equal(crypto.createHash('sha256').update(data).digest('hex'),entry.sha256,entry.file+' checksum');
 assert.equal(data.readUInt32LE(0),0x46546c67,entry.file+' GLB magic');assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
 const jsonSize=data.readUInt32LE(12),gltf=JSON.parse(data.subarray(20,20+jsonSize).toString('utf8'));
 for(const buffer of gltf.buffers??[])assert.equal(buffer.uri,undefined,entry.file+' external buffer');
 for(const image of gltf.images??[]){assert.equal(image.uri,undefined,entry.file+' external image');const view=gltf.bufferViews?.[image.bufferView];assert.ok(view&&view.byteLength>0,entry.file+' missing image bytes');assert.ok((view.byteOffset??0)+view.byteLength<=gltf.buffers[view.buffer??0].byteLength,entry.file+' image outside buffer');images++;}
 for(const texture of gltf.textures??[])assert.ok(gltf.images?.[texture.source],entry.file+' invalid texture source');
 for(const material of gltf.materials??[]){for(const channel of [material.pbrMetallicRoughness?.baseColorTexture,material.pbrMetallicRoughness?.metallicRoughnessTexture,material.normalTexture,material.occlusionTexture,material.emissiveTexture])if(channel)assert.ok(gltf.textures?.[channel.index],entry.file+' missing material texture');materials++;}
 assert.ok(entry.source&&entry.author&&entry.license,entry.file+' missing provenance');
}
const shipped=fs.readdirSync(new URL('models/',base)).filter(name=>name.endsWith('.glb')).sort();assert.deepEqual(shipped,manifest.map(e=>e.file).sort(),'Untracked or missing runtime models');
console.log(JSON.stringify({models:manifest.length,embeddedImages:images,materials,checksums:'all matched',externalModelResources:0}));
