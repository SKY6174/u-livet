import Link from "next/link";
import { requireIdentity } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOfferings } from "@/lib/portal/data";
import { Empty, PageIntro } from "@/components/portal/ui";
export default async function Instructor() {
  const me = await requireIdentity("/instructor");
  const [{ data, error }, { offerings }] = await Promise.all([
    (await createServerSupabaseClient())
      .from("life_offering_instructors")
      .select("offering_id,valid_until")
      .eq("person_id", me.id),
    getOfferings(),
  ]);
  const assigned = new Set(
    (data ?? [])
      .filter((i) => !i.valid_until || Date.parse(i.valid_until) > Date.now())
      .map((i) => i.offering_id),
  );
  const own = offerings.filter((o) => assigned.has(o.id));
  return (
    <div className="page-shell">
      <PageIntro eyebrow="TEACHING" title={`${me.name} 님의 강사 공간`}>
        담당 기수의 자료·과제·평가를 관리합니다.
      </PageIntro>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link className="btn-secondary" href="/mypage/instructor">
          강사 이력·심사
        </Link>
        <Link className="btn-secondary" href="/development">
          과정 개발·제안
        </Link>
      </div>
      <Link className="btn-secondary mb-6" href="/instructor/records">
        강의실적·경력증명 →
      </Link>
      {error ? (
        <Empty title="담당 과정을 불러오지 못했습니다" />
      ) : !own.length ? (
        <Empty title="배정된 교육과정이 없습니다">
          사업단이 기수를 배정하면 이곳에 표시됩니다.
        </Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {own.map((o) => (
            <article key={o.id} className="panel">
              <h2 className="text-xl font-bold">{o.name}</h2>
              <p className="mt-3 text-sm text-slate-600">
                {o.starts_on} ~ {o.ends_on}
              </p>
              <div className="mt-5 flex flex-wrap gap-4 text-teal-800">
                <Link href={`/instructor/offerings/${o.id}`}>강의 운영 →</Link>
                <Link href={`/quality/${o.id}`}>과정 평가·개선 →</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
