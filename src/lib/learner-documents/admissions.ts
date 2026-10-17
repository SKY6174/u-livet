type Admissions = { status?: string | null; academic_sealed?: boolean; apply_from?: string | null; apply_until?: string | null; starts_on?: string | null };

export function applicationIsOpen(course: Admissions, now = Date.now()) {
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  return course.status === "PUBLISHED" && !course.academic_sealed && !!course.apply_from && !!course.apply_until && !!course.starts_on &&
    now >= Date.parse(course.apply_from) && now < Date.parse(course.apply_until) && today < course.starts_on;
}
