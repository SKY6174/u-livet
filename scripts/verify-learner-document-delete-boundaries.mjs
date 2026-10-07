import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync('src/app/admin/learner-documents/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let authenticated=true,error=null,calls=[],revalidated=[];
const mocks={
 'next/navigation':{redirect:path=>{throw Object.assign(Error('redirect'),{path});}},
 'next/cache':{revalidatePath:path=>revalidated.push(path)},
 '@/lib/auth/session':{requireIdentity:async()=>{if(!authenticated)throw Error('LOGIN_REQUIRED');}},
 '@/lib/learner-document-workflow/types':{DOCUMENT_KIND_LABELS:{APPLICATION:'수강신청원서'},DOCUMENT_STATUS_LABELS:{APPROVED:'승인'}},
 '@/lib/portal/data':{UUID:/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i},
 '@/lib/supabase/server':{createServerSupabaseClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return{error};}})}
};
const module={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]??require(name),module,module.exports);
const id='10000000-0000-4000-8000-000000000011';
const form=(requestId=id,revision=2)=>{const f=new FormData();for(const[k,v]of Object.entries({request_id:requestId,revision,filter_kind:'APPLICATION',filter_status:'APPROVED',filter_query:'  합성  '}))f.set(k,String(v));return f;};
const invoke=async f=>{try{await module.exports.deleteLearnerDocument(f);throw Error('NO_REDIRECT');}catch(e){if(!e.path)throw e;return new URL(e.path,'https://example.invalid');}};
for(const [requestId,revision]of [['invalid',2],[id,0],[id,1.5],[id,Number.MAX_SAFE_INTEGER+1],[id,'']]){
 const url=await invoke(form(requestId,revision));assert.ok(url.searchParams.has('error'));assert.equal(calls.length,0);
}
console.log('PASS invalid deletion inputs never call RPC');
authenticated=false;await assert.rejects(invoke(form()),/LOGIN_REQUIRED/);assert.equal(calls.length,0);authenticated=true;
console.log('PASS unauthenticated action is rejected');
for(const message of ['STALE_REVISION','FORBIDDEN','MFA_REAUTH_REQUIRED','NOT_FOUND']){
 error={message};const url=await invoke(form());assert.ok(url.searchParams.get('error'));assert.equal(revalidated.length,0);
 assert.equal(url.searchParams.get('kind'),'APPLICATION');assert.equal(url.searchParams.get('status'),'APPROVED');assert.equal(url.searchParams.get('q'),'합성');
}
console.log('PASS RPC errors preserve filters and do not report success');
error=null;const url=await invoke(form());assert.ok(url.searchParams.get('notice'));assert.deepEqual(calls.at(-1),{name:'life_delete_learner_document',args:{r:id,expected_revision:2}});
assert.ok(revalidated.includes('/admin/learner-documents'));assert.ok(revalidated.includes('/mypage'));assert.ok(revalidated.includes('/learning'));
console.log('PASS deletion delegates to secured RPC and revalidates document and learning pages');
