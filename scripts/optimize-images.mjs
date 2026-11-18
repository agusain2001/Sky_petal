import sharp from 'sharp';
import {readdir} from 'node:fs/promises';
for(const file of (await readdir('public/images')).filter(f=>f.endsWith('.png'))){const name=file.slice(0,-4);await sharp(`public/images/${file}`).resize({width:name==='hero'?1920:900,withoutEnlargement:true}).webp({quality:87}).toFile(`public/images/${name}.webp`);}
console.log('Optimized all original Sky Petal images.');
