// use-file-picker.ts — the student submission picker: the shared hook bound to this side's policy.
// The picking/validation logic itself lives in shared/hooks/use-file-picker.ts.
import { SUBMISSION_FILE_POLICY } from "@/features/student/logic/validators";
import { useFilePicker as useSharedFilePicker, type FilePickerState } from "@/shared/hooks/use-file-picker";

export function useFilePicker(): FilePickerState {
  return useSharedFilePicker(SUBMISSION_FILE_POLICY);
}
