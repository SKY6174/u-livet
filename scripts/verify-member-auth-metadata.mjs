import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync('src/lib/auth/member-provisioning.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const personId = '20000000-0000-4000-8000-000000000001';
const authUserId = '20000000-0000-4000-8000-000000000002';
const profile = {
  person_id: personId, auth_user_id: authUserId, org_id: '20000000-0000-4000-8000-000000000003',
  member_group: 'office', email: 'member@uc.ac.kr', name: '구성원', office_position: 'RESEARCHER',
  instructor_kind: null, office_phone: '052-230-0000', mobile_phone: '+821012345678',
  instructor_phone: null, birth_date: '1990-01-01', notes: 'Auth에 복제하면 안 되는 내부 메모',
  activation_complete: true,
};
const updates = [];
const admin = {
  rpc: async () => ({ data: profile, error: null }),
  auth: { admin: {
    getUserById: async () => ({ data: { user: {
      id: authUserId, email: profile.email, user_metadata: { preferred_language: 'ko' },
    } }, error: null }),
    updateUserById: async (_id, payload) => { updates.push(payload); return { error: null }; },
  } },
};
const mocks = {
  'server-only': {},
  '@supabase/supabase-js': { createClient: () => admin },
  '@/lib/supabase/config': { getSupabaseConfig: () => ({ url: 'https://example.invalid', key: 'test' }) },
  '@/lib/auth/login-audience': { isSchoolEmail: email => email.endsWith('@uc.ac.kr') },
};
const module = { exports: {} };
const priorKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
try {
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  const result = await module.exports.syncManualMemberAuthMetadata(personId);
  assert.deepEqual(result, { linked: true, activated: true });
  assert.equal(updates.length, 1);
  const metadata = updates[0].user_metadata;
  assert.equal(metadata.name, profile.name);
  assert.equal(metadata.email, profile.email);
  assert.equal(metadata.member_org_id, profile.org_id);
  assert.equal(metadata.member_group, profile.member_group);
  assert.equal(metadata.office_position, profile.office_position);
  assert.equal(metadata.office_phone, profile.office_phone);
  assert.equal(metadata.mobile_phone, profile.mobile_phone);
  assert.equal(metadata.birth_date, profile.birth_date);
  assert.equal(metadata.preferred_language, 'ko');
  assert.equal(Object.hasOwn(metadata, 'notes'), false);
  console.log('PASS manual roster fields copied to Auth metadata, private notes excluded');
} finally {
  if (priorKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = priorKey;
}
