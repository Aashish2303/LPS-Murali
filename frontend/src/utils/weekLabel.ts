// Maps ISO week keys (e.g. "2026-W39") to project-relative labels ("Week 1"),
// matching the week selector in the header.
let orderedWeeks: string[] = [];

export const setProjectWeeks = (weeks: Array<string | null | undefined>) => {
  orderedWeeks = Array.from(
    new Set(weeks.filter((w): w is string => typeof w === 'string' && w.trim().length > 0))
  );
};

export const formatWeek = (weekKey: string): string => {
  const index = orderedWeeks.indexOf(weekKey);
  return index >= 0 ? `Week ${index + 1}` : weekKey;
};
