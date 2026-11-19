// upload-material-screen.tsx — modal: upload a lecture video/PDF/slides; AI auto-extracts the
// transcript and key objectives after upload (docs/UI-BRIEF Lesson & Material Repository).
import { useRouter } from "expo-router";
import { useState } from "react";

import { ActionButton, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { useFilePicker } from "@/features/instructor/hooks/use-file-picker";
import { useUploadMaterial } from "@/features/instructor/hooks/use-materials";
import { validateMaterialTitle } from "@/features/instructor/logic/validators";
import type { Attachment } from "@/features/instructor/types/instructor";

export default function UploadMaterialScreen() {
  const classId = useRouteId("classId");
  const router = useRouter();
  const toast = useToast();
  const goBack = useSafeBack(classId ? { pathname: "/instructor/class-detail", params: { id: classId } } : "/instructor/classes");
  const filePicker = useFilePicker();
  const upload = useUploadMaterial(classId ?? "");

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<Attachment | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const pickFile = async () => {
    const picked = await filePicker.pick();
    if (picked) setFile(picked);
    else if (filePicker.error) toast.show(filePicker.error, { tone: "red" });
  };

  const submit = async () => {
    const error = validateMaterialTitle(title);
    setTitleError(error);
    if (error || !classId) return;
    if (!file) {
      toast.show("Attach a video, PDF or slide deck first.", { tone: "red" });
      return;
    }
    const result = await upload.run({ title, attachment: file });
    if (result.ok) {
      toast.show("Uploaded · AI is extracting the transcript and key objectives", { tone: "green" });
      router.replace({ pathname: "/instructor/class-detail", params: { id: classId } });
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  return (
    <Screen role="instructor" scope="instructor/upload-material">
      <PageTitle title="Upload Material" subtitle="MP4, MOV, PDF, PPT(X) or DOCX, up to 500 MB." onBack={goBack} />

      <FormField
        label="Title"
        value={title}
        onChangeText={(v) => { setTitle(v); setTitleError(null); }}
        placeholder="e.g. Lesson 5: Access Control Models"
        maxLength={100}
        error={titleError}
      />

      {file ? (
        <AttachmentRow attachment={file} onPress={() => setFile(null)} />
      ) : null}
      <ActionButton label={file ? "Replace file" : "Choose file"} icon="cloud-upload-outline" variant="secondary" onPress={pickFile} />

      <ActionButton label="Upload" icon="checkmark" loading={upload.loading} onPress={submit} />
    </Screen>
  );
}
