// avatar-image.ts — pick a profile photo from the camera or gallery and shrink it.
// Every photo is cropped square by the picker, resized to AVATAR_PX and re-encoded as JPEG, so what
// the app keeps (and later uploads) is ~50-150 KB, far under the 2 MB limit, whatever the camera
// produced. Re-encoding also drops EXIF metadata such as GPS position.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export const AVATAR_PX = 512;
export const AVATAR_QUALITY = 0.8;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type AvatarSource = "camera" | "gallery";

export type AvatarPick =
  | { ok: true; uri: string }
  | { ok: false; reason: "cancelled" }
  | { ok: false; reason: "denied"; canAskAgain: boolean; message: string }
  | { ok: false; reason: "error"; message: string };

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
  allowsMultipleSelection: false,
};

export async function pickAvatar(source: AvatarSource): Promise<AvatarPick> {
  try {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        return {
          ok: false,
          reason: "denied",
          canAskAgain: perm.canAskAgain,
          message: "Camera access is off. Allow it in your phone settings to take a photo.",
        };
      }
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(OPTIONS);
    const asset = result.canceled ? undefined : result.assets?.[0];
    if (!asset) return { ok: false, reason: "cancelled" };

    // Check what the picker reports before doing any work; the real guarantee is the re-encode below.
    if (asset.type && asset.type !== "image") return { ok: false, reason: "error", message: "Choose a photo." };

    const ref = await ImageManipulator.manipulate(asset.uri).resize({ width: AVATAR_PX }).renderAsync();
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: AVATAR_QUALITY });
    return { ok: true, uri: saved.uri };
  } catch {
    // Never surface the native message: it can contain a device file path.
    return { ok: false, reason: "error", message: "Could not use that photo. Please try another one." };
  }
}
