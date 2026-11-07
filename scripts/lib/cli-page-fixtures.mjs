import { randomUUID } from "node:crypto";

// Called only after verify-all-pages has checked the disposable DB container.
// Revoked production-shaped records exercise detail rendering without issuing
// files. All identities and documents exist only in the disposable test DB.
export function seedPageRecords(sql, { org, year, offering, learner, staff, policy, completion }) {
  const ids = Object.fromEntries(["publicVersion", "publicOffering", "issuer", "template", "request", "certificate", "definition", "badgeRequest", "badge", "run", "proposal", "proposalVersion", "report"].map(key => [key, randomUUID()]));
  const json = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const certificate = {
    person_name: "[검증용] CLI learner", person_id: learner, offering_id: offering, course_name: "[검증용] CLI course", starts_on: "2026-11-01", ends_on: "2026-11-02", kind: "COMPLETION",
    evidence: { minutes: 60 }, issuer: { organization_name: "LOCAL TEST", title: "LOCAL", holder_name: "TEST", seal_omission_basis: "LOCAL TEST ONLY", test_only: false },
    template: { title: "[검증용] 취소된 증명", body: "Local browser test only", version: "cli3", layout: "v1" },
  };
  const artifact = { format: "LOCAL-TEST", number: ids.badge, recipient_name: certificate.person_name,
    badge: { title: "[검증용] 취소된 배지", description: "Local rendering only", achievement: "No real achievement", definition_version: 1 },
    issuer: { organization: "LOCAL TEST", title: "LOCAL", holder_name: "TEST", test_only: false },
    course: { name: certificate.course_name, starts_on: certificate.starts_on, ends_on: certificate.ends_on },
    completion: { approved_at: new Date().toISOString(), policy_version: "LOCAL", policy_body: "Local rendering only" },
    issued_at: new Date().toISOString(), expires_at: null, verification_note: "Revoked synthetic fixture" };
  sql(`begin;
    insert into life_course_versions select (jsonb_populate_record(null::life_course_versions,to_jsonb(v)||jsonb_build_object('id','${ids.publicVersion}','version',(select max(version)+1 from life_course_versions where course_id=v.course_id),'completion_policy_id',null))).* from life_course_versions v join life_offerings o on o.course_version_id=v.id where o.id='${offering}';
    insert into life_offerings select (jsonb_populate_record(null::life_offerings,to_jsonb(o)||jsonb_build_object('id','${ids.publicOffering}','name','LOCAL CLI PUBLIC PAGE','course_version_id','${ids.publicVersion}','enrollment_policy_id',null))).* from life_offerings o where id='${offering}';
    insert into life_issuer_authorizations(id,org_id,organization_name,title,holder_name,valid_from,valid_until,approval_reference,approved_by,approved_at,seal_omission_basis,test_only)
    values('${ids.issuer}','${org}','LOCAL TEST','LOCAL','TEST',now()-interval '1 day',now()+interval '1 day','LOCAL ONLY','${staff}',now(),'LOCAL ONLY',false);
    insert into life_certificate_templates(id,org_id,kind,version,title,body,approved_by,approved_at,approval_reference)
    values('${ids.template}','${org}','COMPLETION','${ids.template}','[검증용] 취소된 증명','Local rendering only','${staff}',now(),'LOCAL ONLY');
    insert into life_certificate_requests(id,offering_id,person_id,kind,status)
    values('${ids.request}','${offering}','${learner}','COMPLETION','REVOKED');
    insert into life_certificate_issues(id,request_id,issuer_id,template_id,org_id,certificate_no,approved_by,snapshot,evidence_hash,verification_hash,status,revoked_at,revocation_reason)
    values('${ids.certificate}','${ids.request}','${ids.issuer}','${ids.template}','${org}','LOCAL-${ids.certificate}','${staff}',${json(certificate)},repeat('0',64),'${ids.certificate}','REVOKED',now(),'LOCAL RENDERING ONLY');
    insert into life_badge_definitions(id,offering_id,org_id,version,issuer_id,completion_policy_id,policy_id,title,description,achievement,created_by)
    values('${ids.definition}','${offering}','${org}',(select coalesce(max(version),0)+1 from life_badge_definitions where offering_id='${offering}'),'${ids.issuer}','${completion}','${policy}','[검증용] 취소된 배지','Local rendering only','No real achievement','${staff}');
    insert into life_badge_requests(id,offering_id,definition_id,person_id,policy_id,status)
    values('${ids.badgeRequest}','${offering}','${ids.definition}','${learner}','${policy}','CANCELLED');
    insert into life_completion_runs(id,enrollment_id,offering_id,person_id,input_revision,outcome,reasons,evidence,calculated_by)
    select '${ids.run}',id,'${offering}','${learner}',0,'NEEDS_REVIEW','[]','{"attendance_percent":null,"sessions":[],"assignments":[],"quizzes":[]}','${staff}' from life_enrollments where offering_id='${offering}' and person_id='${learner}';
    insert into life_badge_awards(id,request_id,definition_id,org_id,person_id,offering_id,issuer_id,number,completion_run_id,evidence_hash,artifact_text,sha256,issued_by,issued_at,status,revoked_at,revocation_reason)
    values('${ids.badge}','${ids.badgeRequest}','${ids.definition}','${org}','${learner}','${offering}','${ids.issuer}','LOCAL-${ids.badge}','${ids.run}',repeat('0',64),(${json(artifact)})::text,repeat('0',64),'${staff}',now(),'REVOKED',now(),'LOCAL RENDERING ONLY');
    insert into life_private.badge_shares(award_id) values('${ids.badge}');
    insert into life_course_proposals(id,org_id,person_id,project_year_id,kind)
    values('${ids.proposal}','${org}','${staff}','${year}','NEW');
    insert into life_course_proposal_versions(id,proposal_id,version) values('${ids.proposalVersion}','${ids.proposal}',1);
    insert into life_performance_reports(id,org_id,year_id,version,request_key,reason,snapshot,fingerprint,created_by)
    values('${ids.report}','${org}','${year}',(select coalesce(max(version),0)+1 from life_performance_reports where year_id='${year}'),'${ids.report}','LOCAL RENDERING ONLY',${json({ year: { id: year, label: "LOCAL TEST" }, metrics: [], facts: { totals: {} }, query_version: "LOCAL" })},repeat('0',64),'${staff}');
    commit;`);
  return ids;
}
