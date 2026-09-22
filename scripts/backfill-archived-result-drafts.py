#!/usr/bin/env python3
"""Create review-only operation result drafts from verified archived PDFs.

Requires PyMuPDF, Pillow, Supabase CLI access, and a private JSON manifest.
The manifest contains {projectRef, courses:[{offeringId,path,sha256,photoIndices}]}.
Run without --apply to validate only. Keep the manifest outside Git.
"""

import argparse
import base64
import hashlib
import io
import json
import re
import subprocess
import tempfile
from pathlib import Path

import pymupdf
from PIL import Image, ImageOps


UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
SHA256 = re.compile(r"^[0-9a-f]{64}$", re.I)
PHOTO_MAX = 30
BUDGET_CATEGORIES = ("운영비", "인쇄비", "재료비", "강사료")


def quoted(value):
    return "'" + str(value).replace("'", "''") + "'"


def db_query(project_ref, sql):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", prefix="draft-", dir="tmp/pdfs", delete=False, encoding="utf-8") as file:
        file.write(sql)
        path = Path(file.name)
    try:
        result = subprocess.run(
            ["supabase", "db", "query", "--linked", "--project-ref", project_ref, "--file", str(path), "--output", "json"],
            capture_output=True, text=True, check=False,
        )
        if result.returncode:
            raise RuntimeError(f"Supabase query failed (exit {result.returncode}); private SQL was removed")
        return json.loads(result.stdout).get("rows", [])
    finally:
        path.unlink(missing_ok=True)


def read_record(project_ref, offering_id):
    sql = f"""select o.id::text as offering_id,o.name,c.academy,o.status,o.capacity,
      o.starts_on::text as starts_on,o.ends_on::text as ends_on,f.filename,
      r.updated_by::text as operator_id,encode(sha256(decode(f.body,'base64')),'hex') as stored_sha256,
      r.payload-'participants'-'scholarships'-'fees'-'budgets' as legacy,
      life_private.operation_schema('result') as schema,
      exists(select 1 from public.life_operation_documents d where d.offering_id=o.id and d.kind='result') as already_saved,
      coalesce((select p.name from public.life_operation_responsibilities x join public.life_people p on p.id=x.person_id where x.offering_id=o.id),'') as responsible
      from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id
      join public.life_courses c on c.id=v.course_id join public.life_course_reports r on r.offering_id=o.id
      join public.life_report_files f on f.offering_id=o.id and f.kind='result'
      where o.id={quoted(offering_id)}::uuid;"""
    rows = db_query(project_ref, sql)
    if len(rows) != 1:
        raise ValueError("Archived course/report/PDF association was not found")
    return rows[0]


def image_candidates(pdf):
    index = 0
    for page in pdf:
        seen = set()
        for entry in page.get_images(full=True):
            xref = entry[0]
            if xref in seen:
                continue
            seen.add(xref)
            pixmap = pymupdf.Pixmap(pdf, xref)
            if pixmap.width < 400 or pixmap.height < 300 or pixmap.width * pixmap.height > 12_000_000:
                continue
            index += 1
            yield index, pdf.extract_image(xref)["image"]


def jpeg_data_url(raw):
    with Image.open(io.BytesIO(raw)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
    image.thumbnail((680, 680), Image.Resampling.LANCZOS)
    for quality in (70, 55, 40, 30):
        target = io.BytesIO()
        image.save(target, format="JPEG", quality=quality, optimize=True)
        value = "data:image/jpeg;base64," + base64.b64encode(target.getvalue()).decode("ascii")
        if len(value) <= 78_000:
            return value
    raise ValueError("Selected photo cannot fit the report image limit")


def extract_photos(path, selected):
    selected = set(selected)
    photos = []
    with pymupdf.open(path) as pdf:
        for index, raw in image_candidates(pdf):
            if index in selected:
                photos.append({"caption": f"운영사진{len(photos) + 1}", "date": "", "image": jpeg_data_url(raw)})
    if len(photos) != len(selected):
        raise ValueError("Manifest photo selection does not match the PDF")
    return photos


def build_draft(row, photos):
    legacy = row["legacy"]
    source_report = legacy.get("sourceReport") or {}
    fields = {item["key"]: "" for item in row["schema"]["fields"]}
    values = {
        "title": row["name"], "year": row["starts_on"][:4], "academy": row["academy"],
        "program": legacy.get("program"), "professor": row["responsible"],
        "documentDate": legacy.get("reportDate"), "startsOn": row["starts_on"],
        "endsOn": row["ends_on"], "capacity": row["capacity"],
        "enrolled": source_report.get("enrolled"), "completed": source_report.get("completed"),
        "improvementsNote": source_report.get("notes"),
        "photoNote": f"원본 PDF의 운영사진 {len(photos)}장을 추출했습니다. 촬영일과 설명은 담당자 확인이 필요합니다.",
    }
    for key in ("content", "method", "education", "promotion", "other", "strengths", "improvements",
                "followUp", "certificates", "employed", "surveyResponses", "satisfaction"):
        values[key] = legacy.get(key)
    for key, value in values.items():
        if key not in fields:
            raise ValueError(f"Unexpected report field: {key}")
        fields[key] = "" if value is None else str(value)
    content = {
        "fields": fields,
        "tables": {item["key"]: [] for item in row["schema"]["tables"]},
        "photos": [{"caption": "개강식", "date": "", "image": ""},
                   {"caption": "수료식", "date": "", "image": ""}, *photos],
        "signature": "",
    }
    budget = {
        "rows": [{"category": category, "calculation": "", "planned": "", "spent": "", "note": ""}
                 for category in BUDGET_CATEGORIES],
        "scholarshipCount": "", "scholarshipAmount": "", "scholarshipNote": "",
    }
    if len(content["photos"]) > PHOTO_MAX + 2 or len(json.dumps(content, ensure_ascii=False).encode("utf-8")) > 3_000_000:
        raise ValueError("Generated report exceeds photo or content limits")
    return content, budget


def verify_and_apply(project_ref, entry, apply):
    offering_id, path, expected_hash = entry["offeringId"], Path(entry["path"]), entry["sha256"].lower()
    if not UUID.fullmatch(offering_id) or not SHA256.fullmatch(expected_hash):
        raise ValueError("Invalid offering ID or source hash")
    selected = entry["photoIndices"]
    if not isinstance(selected, list) or not selected or len(selected) > PHOTO_MAX or selected != sorted(set(selected)) or any(not isinstance(n, int) or n < 1 for n in selected):
        raise ValueError("Photo indices must be unique ascending positive integers")
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected_hash:
        raise ValueError("Local PDF hash changed")
    row = read_record(project_ref, offering_id)
    source_report = row["legacy"].get("sourceReport") or {}
    if row["already_saved"]:
        raise ValueError(f"Result draft already exists for {offering_id}; refusing overwrite")
    if row["status"] != "ARCHIVED" or row["stored_sha256"] != expected_hash or source_report.get("sha256") != expected_hash or row["filename"] != path.name:
        raise ValueError("Archived PDF, course, and source provenance do not match")
    if not row["responsible"]:
        raise ValueError("Responsible instructor is not assigned")
    photos = extract_photos(path, selected)
    content, budget = build_draft(row, photos)
    content_sql = quoted(json.dumps(content, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"
    budget_sql = quoted(json.dumps(budget, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"
    valid = db_query(project_ref, f"select life_private.operation_content_valid({content_sql},'result') as content_ok, life_private.operation_budget_valid({budget_sql},'result') as budget_ok;")
    if len(valid) != 1 or not valid[0]["content_ok"] or not valid[0]["budget_ok"]:
        raise ValueError("Generated draft failed database validation")
    print(json.dumps({"course": row["name"], "offeringId": offering_id, "photos": len(photos),
                      "contentBytes": len(content_sql.encode("utf-8")), "mode": "apply" if apply else "validated"}, ensure_ascii=False))
    if not apply:
        return
    sql = f"""begin;
      set local lock_timeout='5s'; set local statement_timeout='60s';
      select pg_advisory_xact_lock(hashtextextended('archived-result-draft:{offering_id}',0));
      do $backfill$ declare draft_content jsonb := {content_sql}; draft_budget jsonb := {budget_sql}; begin
        if auth.uid() is not null then raise exception 'ADMINISTRATIVE_OPERATION_ONLY'; end if;
        if exists(select 1 from public.life_operation_documents where offering_id={quoted(offering_id)}::uuid and kind='result') then raise exception 'RESULT_ALREADY_EXISTS'; end if;
        if not exists(select 1 from public.life_offerings o join public.life_course_reports r on r.offering_id=o.id
          join public.life_report_files f on f.offering_id=o.id and f.kind='result'
          where o.id={quoted(offering_id)}::uuid and o.status='ARCHIVED' and f.filename={quoted(path.name)}
          and r.payload#>>'{{sourceReport,sha256}}'={quoted(expected_hash)}
          and encode(sha256(decode(f.body,'base64')),'hex')={quoted(expected_hash)}) then raise exception 'SOURCE_CHANGED'; end if;
        if not life_private.operation_content_valid(draft_content,'result') or not life_private.operation_budget_valid(draft_budget,'result') then raise exception 'INVALID_DRAFT'; end if;
        insert into public.life_operation_documents(offering_id,kind,content,budget,status,updated_by)
          values({quoted(offering_id)}::uuid,'result',draft_content,draft_budget,'DRAFT',{quoted(row['operator_id'])}::uuid);
        insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
          select org_id,null,'ARCHIVED_OPERATION_DRAFT_IMPORTED',id,
            jsonb_build_object('source_sha256',{quoted(expected_hash)},'photo_count',{len(photos)},'execution_context','administrative_management_api','recorded_for',{quoted(row['operator_id'])},'status','DRAFT')
          from public.life_offerings where id={quoted(offering_id)}::uuid;
      end $backfill$;
      select kind,status,jsonb_array_length(content->'photos')-2 as photo_count,revision
        from public.life_operation_documents where offering_id={quoted(offering_id)}::uuid and kind='result';
      commit;"""
    result = db_query(project_ref, sql)
    if len(result) != 1 or result[0]["status"] != "DRAFT" or result[0]["photo_count"] != len(photos):
        raise RuntimeError("Post-insert result verification failed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    project_ref = manifest.get("projectRef", "")
    if not re.fullmatch(r"[a-z]{20}", project_ref) or not manifest.get("courses"):
        raise ValueError("Invalid private manifest")
    Path("tmp/pdfs").mkdir(parents=True, exist_ok=True)
    for entry in manifest["courses"]:
        verify_and_apply(project_ref, entry, args.apply)


if __name__ == "__main__":
    main()
