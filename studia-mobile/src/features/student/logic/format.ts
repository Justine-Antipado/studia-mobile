// format.ts — student-side formatting. Everything generic lives in shared/utils/format.ts and is
// re-exported here so student screens keep one import path; only student-specific helpers are
// defined below.
export {
  PASSING_PERCENT,
  addDaysIso,
  clockLabel,
  dayChipLabel,
  dayLabel,
  dueLabel,
  greeting,
  hourLabel,
  isOverdue,
  materialDetail,
  mondayOf,
  scoreTone,
  timeAgo,
  toLocalIso,
  toPercent,
  weekdayShort,
  weekRangeLabel,
} from "@/shared/utils/format";
