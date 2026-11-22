// account-photo-screen.tsx — change or remove the profile photo (camera or gallery).
// The photo is cropped square, resized and re-encoded on the device (logic/avatar-image.ts), shown
// as a preview, and only becomes the profile photo after "Save photo".
import { useState } from "react";
import { Text, View } from "react-native";

import { displayName, useRoleUser } from "@/core/data/storage/session-store";
import type { Role } from "@/core/types/role";
import { pickAvatar, type AvatarSource } from "@/features/shared-screens/logic/avatar-image";
import { profileRepository } from "@/features/shared-screens/data/profile-repository";
import { ActionButton, ConfirmDialog, PageTitle, useToast } from "@/shared/components/ui";
import { Avatar } from "@/shared/components/ui/avatar";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

export function AccountPhotoScreen({ role }: { role: Role }) {
  const user = useRoleUser(role);
  const toast = useToast();
  const goBack = useSafeBack(`/${role}/account`);
  const [preview, setPreview] = useState<string | null>(null);
  const [picking, setPicking] = useState<AvatarSource | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!user) return null;
  const name = displayName(user);
  const shown = preview ?? user.avatarUri ?? null;

  const pick = async (source: AvatarSource) => {
    setPicking(source);
    const result = await pickAvatar(source);
    setPicking(null);
    if (result.ok) setPreview(result.uri);
    else if (result.reason !== "cancelled") toast.show(result.message, { tone: "red" });
  };

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    const result = await profileRepository.setAvatar(user, preview);
    setSaving(false);
    if (!result.ok) return toast.show(result.error.message, { tone: "red" });
    toast.show("Profile photo updated", { tone: "green" });
    goBack();
  };

  const remove = async () => {
    setSaving(true);
    const result = await profileRepository.setAvatar(user, null);
    setSaving(false);
    setConfirmRemove(false);
    if (!result.ok) return toast.show(result.error.message, { tone: "red" });
    setPreview(null);
    toast.show("Profile photo removed", { tone: "green" });
  };

  return (
    <Screen role={role} scope={`${role}/account-photo`}>
      <PageTitle title="Profile Photo" onBack={goBack} />

      <View style={{ alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.lg }}>
        <Avatar name={name} uri={shown} size={140} />
        <Text style={TYPE.muted}>
          {preview ? "New photo (not saved yet)" : user.avatarUri ? "Your current photo" : "No photo yet. Your initials are shown."}
        </Text>
      </View>

      <View style={{ gap: SPACE.md }}>
        <ActionButton label="Take a photo" icon="camera-outline" variant="secondary" loading={picking === "camera"} onPress={() => pick("camera")} />
        <ActionButton label="Choose from gallery" icon="images-outline" variant="secondary" loading={picking === "gallery"} onPress={() => pick("gallery")} />
        {preview ? <ActionButton label="Save photo" icon="checkmark" loading={saving} onPress={save} /> : null}
        {user.avatarUri && !preview ? (
          <ActionButton label="Remove photo" icon="trash-outline" variant="danger" onPress={() => setConfirmRemove(true)} />
        ) : null}
      </View>

      <Text style={TYPE.caption}>
        Photos are cropped to a square and shrunk on your phone before they are saved. Location data in the photo is removed.
      </Text>

      <ConfirmDialog
        visible={confirmRemove}
        title="Remove your photo?"
        message="Your initials will be shown instead."
        confirmLabel="Remove"
        busy={saving}
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </Screen>
  );
}

export const StudentAccountPhoto = () => <AccountPhotoScreen role="student" />;
export const InstructorAccountPhoto = () => <AccountPhotoScreen role="instructor" />;
