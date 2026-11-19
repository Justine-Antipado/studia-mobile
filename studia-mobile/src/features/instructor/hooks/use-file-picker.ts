// use-file-picker.ts — the instructor material picker: the shared hook bound to this side's policy.
// The picking/validation logic itself lives in shared/hooks/use-file-picker.ts.
import { MATERIAL_FILE_POLICY } from "@/features/instructor/logic/validators";
import { useFilePicker as useSharedFilePicker, type FilePickerState } from "@/shared/hooks/use-file-picker";

export function useFilePicker(): FilePickerState {
  return useSharedFilePicker(MATERIAL_FILE_POLICY);
}
