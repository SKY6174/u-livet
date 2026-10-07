export const MAX_COURSE_LOCATIONS = 3;
export const MAX_COURSE_LOCATION_LENGTH = 160;

export function parseCourseLocations(value: string): string[] {
  const lines = value.includes("\n") ? value.split(/\r?\n/) : value.split(/,\s*/);
  const places = lines.map(part => part.trim()).filter(Boolean);
  return places.length > MAX_COURSE_LOCATIONS ? [value.trim()] : places.length ? places : [""];
}

export function joinCourseLocations(places: string[]): string {
  return places.map(place => place.trim()).filter(Boolean).join("\n");
}

export function validCourseLocation(value: string): boolean {
  const places = value.split(/\r?\n/).map(place => place.trim());
  return value.length <= MAX_COURSE_LOCATION_LENGTH && places.length <= MAX_COURSE_LOCATIONS &&
    places.every(place => place.length > 0 && place.length <= MAX_COURSE_LOCATION_LENGTH);
}
