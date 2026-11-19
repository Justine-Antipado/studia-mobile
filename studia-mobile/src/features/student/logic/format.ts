// format.ts — student-side formatting. Everything generic lives in shared/utils/format.ts and is
// re-exported here so student screens keep one import path; only student-specific helpers are
// defined below.
export {
  PASSING_PERCENT,
  dayLabel,
  dueLabel,
  hourLabel,
  isOverdue,
  scoreTone,
  timeAgo,
  toPercent,
  weekdayShort,
} from "@/shared/utils/format";
