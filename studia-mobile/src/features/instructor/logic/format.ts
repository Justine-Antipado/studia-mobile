// format.ts — instructor-side formatting. Everything generic lives in shared/utils/format.ts and
// is re-exported here so instructor screens keep one import path.
export {
  PASSING_PERCENT,
  dueLabel,
  isOverdue,
  plural,
  scoreTone,
  timeAgo,
  toPercent,
} from "@/shared/utils/format";
export { newId } from "@/shared/utils/id";
