// upload-material-screen.tsx — modal: add a lesson material.
//   Video  -> paste a LINK (YouTube gets a thumbnail preview; other https links just open outside the app)
//   File   -> PDF / Word / PowerPoint, up to 50 MB
// After saving, the AI fetches the transcript (videos) and extracts key objectives
// (docs/UI-BRIEF Lesson & Material Repository).
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Chip, FormField, PageTitle, VideoLinkCard, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { useFilePicker } from "@/features/instructor/hooks/use-file-picker";
import { useAddVideoLink, useUploadMaterial } from "@/features/instructor/hooks/use-materials";
import { validateMaterialTitle } from "@/features/instructor/logic/validators";
import type { Attachment } from "@/features/instructor/types/instructor";
import { parseVideoLink } from "@/shared/utils/video-link";

type Mode = "link" | "file";

export default function UploadMaterialScreen() {
  const classId = useRouteId("classId");
  const router = useRouter();
  const toast = useToast();
  const goBack = useSafeBack(classId ? { pathname: "/instructor/class-detail", params: { id: classId } } : "/instructor/classes");
  const filePicker = useFilePicker();
  const upload = useUploadMaterial(classId ?? "");
  const addLink = useAddVideoLink(classId ?? "");

  const [mode, setMode] = useState<Mode>("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<Attachment | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Live parse so a bad link is explained as soon as it is pasted, and a YouTube link previews.
  const parsed = useMemo(() => (url.trim() ? parseVideoLink(url) : null), [url]);

  const pickFile = async () => {
    const picked = await filePicker.pick();
    if (picked) setFile(picked);
    else if (filePicker.error) toast.show(filePicker.error, { tone: "red" });
  };

  const finish = (message: string) => {
    toast.show(message, { tone: "green" });
    if (classId) router.replace({ pathname: "/instructor/class-detail", params: { id: classId, tab: "Materials" } });
  };

  const submit = async () => {
    const error = validateMaterialTitle(title);
    setTitleError(error);
    if (error || !classId) return;

    if (mode === "link") {
      const check = parseVideoLink(url);
      if (!check.ok) return setUrlError(check.error);
      const result = await addLink.run({ title, url });
      if (result.ok) finish("Link added · AI is fetching the transcript");
      else toast.show(result.error.message, { tone: "red" });
      return;
    }

    if (!file) {
      toast.show("Attach a PDF, Word file or slide deck first.", { tone: "red" });
      return;
    }
    const result = await upload.run({ title, attachment: file });
    if (result.ok) finish("Uploaded · AI is extracting the key objectives");
    else toast.show(result.error.message, { tone: "red" });
  };

  return (
    <Screen role="instructor" scope="instructor/upload-material">
      <PageTitle title="Add Material" subtitle="Paste a video link, or upload a document (up to 50 MB)." onBack={goBack} />

      <View style={{ flexDirection: "row", gap: SPACE.sm }}>
        <Chip label="Video link" icon="link-outline" selected={mode === "link"} onPress={() => setMode("link")} />
        <Chip label="Upload file" icon="cloud-upload-outline" selected={mode === "file"} onPress={() => setMode("file")} />
      </View>

      <FormField
        label="Title"
        value={title}
        onChangeText={(v) => { setTitle(v); setTitleError(null); }}
        placeholder="e.g. Lesson 5: Access Control Models"
        maxLength={100}
        error={titleError}
      />

      {mode === "link" ? (
        <>
          <FormField
            label="Video link"
            value={url}
            onChangeText={(v) => { setUrl(v); setUrlError(null); }}
            placeholder="https://youtu.be/..."
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={2048}
            error={urlError ?? (parsed && !parsed.ok ? parsed.error : null)}
            helper="YouTube links get a preview and a Watch on YouTube button. Other links open outside the app."
          />
          {parsed?.ok ? <VideoLinkCard link={parsed.link} /> : null}
          {parsed?.ok && parsed.link.provider === "other" ? (
            <Text style={TYPE.caption}>
              No captions can be read from this site, so the AI summary will need a transcript that you paste after saving.
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {file ? <AttachmentRow attachment={file} onPress={() => setFile(null)} /> : null}
          <ActionButton label={file ? "Replace file" : "Choose file"} icon="cloud-upload-outline" variant="secondary" onPress={pickFile} />
        </>
      )}

      <ActionButton
        label={mode === "link" ? "Add video" : "Upload"}
        icon="checkmark"
        loading={upload.loading || addLink.loading}
        onPress={submit}
      />
    </Screen>
  );
}
