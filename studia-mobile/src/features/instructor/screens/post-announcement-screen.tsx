// post-announcement-screen.tsx — modal: post a new announcement to the class stream.
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Chip, ConfirmDialog, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useForceBack, useSafeBack } from "@/shared/hooks/use-safe-back";
import { useCreateAnnouncement } from "@/features/instructor/hooks/use-announcements";
import { validateAnnouncementBody, validateAnnouncementTitle } from "@/features/instructor/logic/validators";

export default function PostAnnouncementScreen() {
  const classId = useRouteId("classId");
  const router = useRouter();
  const toast = useToast();
  const create = useCreateAnnouncement(classId ?? "");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [errors, setErrors] = useState<{ title?: string | null; body?: string | null }>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = title.trim().length > 0 || body.trim().length > 0;
  const fallback = classId ? { pathname: "/instructor/class-detail" as const, params: { id: classId } } : "/instructor/classes";
  const goBack = useSafeBack(fallback, { blocked: dirty, onBlocked: () => setConfirmDiscard(true) });
  const forceBack = useForceBack(fallback);

  const submit = async () => {
    const titleError = validateAnnouncementTitle(title);
    const bodyError = validateAnnouncementBody(body);
    setErrors({ title: titleError, body: bodyError });
    if (titleError || bodyError || !classId) return;

    const result = await create.run({ title, body, pinned });
    if (result.ok) {
      toast.show("Announcement posted", { tone: "green" });
      router.replace({ pathname: "/instructor/class-detail", params: { id: classId } });
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  return (
    <Screen role="instructor" scope="instructor/post-announcement">
      <PageTitle title="Post Announcement" onBack={goBack} />

      <FormField
        label="Title"
        value={title}
        onChangeText={(v) => { setTitle(v); setErrors((e) => ({ ...e, title: null })); }}
        placeholder="e.g. Midterm exam schedule"
        maxLength={100}
        error={errors.title}
      />
      <FormField
        label="Message"
        value={body}
        onChangeText={(v) => { setBody(v); setErrors((e) => ({ ...e, body: null })); }}
        placeholder="Write your announcement..."
        multiline
        maxLength={2000}
        error={errors.body}
      />

      <View style={{ gap: SPACE.sm }}>
        <Text style={TYPE.label}>Pin to the top</Text>
        <View style={{ flexDirection: "row", gap: SPACE.sm }}>
          <Chip label="Pinned" selected={pinned} onPress={() => setPinned(!pinned)} icon="pin-outline" />
        </View>
      </View>

      <ActionButton label="Post" icon="send-outline" loading={create.loading} onPress={submit} />

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this announcement?"
        message="Your draft has not been posted yet."
        confirmLabel="Discard"
        onConfirm={() => { setConfirmDiscard(false); forceBack(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Screen>
  );
}
