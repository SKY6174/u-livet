"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { CatalogCourse } from "@/lib/course-guide/model";

type Recommendation = CatalogCourse & { related: boolean };
const MODE_LABELS = { ONLINE: "온라인", OFFLINE: "대면", BLENDED: "혼합" } as const;

export function CourseRecommendationRail({ courses }: { courses: Recommendation[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => {
      setCanBack(element.scrollLeft > 2);
      setCanForward(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [courses]);

  const move = (direction: -1 | 1) => {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.min(element.clientWidth, 560),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <div className="min-w-0">
      <div className="mb-3 flex justify-end gap-2">
        <button type="button" onClick={() => move(-1)} disabled={!canBack}
          aria-label="이전 추천 과정 보기"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 hover:border-teal-700 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => move(1)} disabled={!canForward}
          aria-label="다음 추천 과정 보기"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 hover:border-teal-700 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div ref={rail} role="region" aria-label="다른 과정 추천 목록" tabIndex={0}
        className="flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
        {courses.map((course) => (
          <article key={course.id} className="flex w-[min(78vw,270px)] shrink-0 snap-start flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:w-[270px]">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-teal-800">
              <span className="rounded-full bg-teal-50 px-2.5 py-1">{course.academy}</span>
              {course.related && <span className="text-slate-500">수강 분야와 연관</span>}
            </div>
            <h3 className="mt-4 line-clamp-2 text-lg font-bold leading-snug text-slate-900">{course.name}</h3>
            <p className="mt-3 line-clamp-2 flex-1 text-sm leading-6 text-slate-600">{course.summary}</p>
            <p className="mt-4 text-xs text-slate-500">{MODE_LABELS[course.mode]} · {course.period_label}</p>
            <Link href={course.href} className="mt-4 inline-flex min-h-11 items-center gap-1 border-t border-slate-100 pt-3 text-sm font-semibold text-teal-800 hover:underline">
              과정 자세히 보기 <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">좌우로 넘겨 다른 과정을 살펴보세요.</p>
    </div>
  );
}
