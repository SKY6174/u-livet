import { getCourseCards } from "@/lib/portal/data";
import { CourseCard, Empty, PageIntro } from "@/components/portal/ui";
export default async function Courses(props: {
  searchParams: Promise<{ q?: string; mode?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { offerings, unavailable } = await getCourseCards();
  const q = (searchParams.q ?? "").slice(0, 100);
  const mode = searchParams.mode ?? "";
  const items = offerings.filter(
    (o) =>
      (!q ||
        `${o.name} ${o.summary} ${o.academy}`
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (!mode || o.mode === mode),
  );
  return (
    <div className="page-shell">
      <PageIntro eyebrow="COURSES" title="교육과정 찾기">
        내가 원하는 배움, 나에게 맞는 일정으로 시작하세요.
      </PageIntro>
      <form className="mb-8 flex flex-wrap items-end gap-3">
        <label className="field flex-1">
          과정 검색
          <input
            name="q"
            placeholder="과정명, 관심 분야"
            defaultValue={q}
            maxLength={100}
          />
        </label>
        <label className="field">
          운영방식
          <select name="mode" defaultValue={mode}>
            <option value="">전체</option>
            <option value="ONLINE">온라인</option>
            <option value="OFFLINE">대면</option>
            <option value="BLENDED">혼합</option>
          </select>
        </label>
        <button className="btn-primary">검색</button>
      </form>
      <p className="mb-4 text-sm text-slate-600">총 {items.length}개 과정</p>
      {items.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((o) => (
            <CourseCard key={o.id} offering={o} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            unavailable
              ? "교육과정을 불러오지 못했습니다"
              : "조건에 맞는 교육과정이 없습니다"
          }
        >
          {unavailable
            ? "잠시 후 다시 확인해 주세요."
            : "다른 검색어를 입력하거나 모집 공지를 기다려 주세요."}
        </Empty>
      )}
    </div>
  );
}
