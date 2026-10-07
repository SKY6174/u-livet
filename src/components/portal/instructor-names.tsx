import { Fragment } from "react";
import type { InstructorName } from "@/lib/portal/types";

export function InstructorNames({ instructors }: { instructors?: InstructorName[] | null }) {
  return <span>
    강사 : {instructors === null ? "정보 확인 중" : !instructors?.length ? "배정 안내 예정" : instructors.map((instructor, index) => (
      <Fragment key={index}>
        {index > 0 && ", "}
        {instructor.name}
        {instructor.responsible && <sup className="ml-0.5 text-[0.7em] font-semibold text-teal-800">(책임)</sup>}
      </Fragment>
    ))}
  </span>;
}
