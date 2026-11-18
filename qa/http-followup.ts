import {readFile} from 'node:fs/promises';import {assert,probe,saveResults} from './probe';
async function main(){const data=JSON.parse(await readFile(process.env.TEST_OWNER_ACCESS_FILE!,'utf8')),base=process.env.TEST_BASE_URL!;let i=165;
for(const role of ['catalog_editor','fulfillment','support','finance','marketing','customer','customer_b']){
 const credentials=data.roles[role],login=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'login',email:credentials.email,password:role==='customer_b'?'QA-New-Password-123456!':credentials.password})});assert.equal(login.status,200);const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
 await probe(`QA-H-WRITE-${i++}`,['A01','A02','Q06'],`${role}: POST admin/jobs/retry with schema-valid ID`,'HTTP 403 for a valid job identifier; no retry attempted.',async record=>{const r=await fetch(base+'/api/admin/jobs/retry',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({id:'qa-nonexistent-schema-valid-job'})});record({status:r.status,role,route:'admin/jobs/retry',schema_valid_id:true});assert.equal(r.status,403);});
}
await saveResults('http-role-retest');}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
