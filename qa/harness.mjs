import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),evidence=path.join(root,'qa','evidence');
await fs.mkdir(evidence,{recursive:true});
const directories=['src','migrations','public','scripts','tests','e2e','docs'];
const files=['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','playwright.config.ts','AGENTS.md','README.md','.env.example','Sky_Petal_Full_Implementation_Roadmap.md','Sky_Petal_Master_Build_Prompt.md'];
async function entries(dir){const result=[];for(const entry of await fs.readdir(path.join(root,dir),{withFileTypes:true})){const relative=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await entries(relative));else if(entry.isFile())result.push(relative);}return result;}
async function manifest(){const names=[...files];for(const dir of directories)names.push(...await entries(dir));const result={};for(const name of names.sort()){try{result[name.replaceAll('\\','/')]=createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex');}catch(e){if(e.code!=='ENOENT')throw e;}}return result;}
if(process.argv[2]==='verify'){
 const before=JSON.parse(await fs.readFile(path.join(evidence,'baseline.json'),'utf8')),after=await manifest();const changed=Object.keys({...before.files,...after}).filter(file=>before.files[file]!==after[file]);const result={at:new Date().toISOString(),changed_application_or_original_test_files:changed,unchanged:changed.length===0};await fs.writeFile(path.join(evidence,'preservation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(changed.length)process.exitCode=1;
}else if(process.argv[2]==='prepare'){
 const runRoot=await fs.mkdtemp(path.join(os.tmpdir(),'sky-petal-qa-')),snapshot=path.join(runRoot,'app');await fs.mkdir(snapshot,{recursive:true});
 const hashes=await manifest();await fs.writeFile(path.join(evidence,'baseline.json'),JSON.stringify({at:new Date().toISOString(),files:hashes},null,2));
 for(const dir of directories)await fs.cp(path.join(root,dir),path.join(snapshot,dir),{recursive:true});for(const file of files){try{await fs.copyFile(path.join(root,file),path.join(snapshot,file));}catch(e){if(e.code!=='ENOENT')throw e;}}
 await fs.cp(path.join(root,'qa'),path.join(snapshot,'qa'),{recursive:true,filter:source=>source!==evidence&&!source.startsWith(evidence+path.sep)});
 await fs.symlink(path.join(root,'node_modules'),path.join(snapshot,'node_modules'),'junction');await fs.mkdir(path.join(snapshot,'artifacts'),{recursive:true});
 const info={runRoot,snapshot,database:path.join(runRoot,'sky-petal-acceptance-store'),access:path.join(runRoot,'access.json'),baseURL:'http://127.0.0.1:4321',node:process.version,platform:process.platform,prepared_at:new Date().toISOString(),git_status:execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'})};await fs.writeFile(path.join(evidence,'environment.json'),JSON.stringify(info,null,2));console.log(JSON.stringify({snapshot,baseURL:info.baseURL}));
}else throw Error('Use prepare or verify');
