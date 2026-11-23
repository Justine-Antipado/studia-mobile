// file-viewer-screen.tsx — G7: opens an uploaded material, attachment or submission inside the
// app instead of leaving the student with a file name they cannot read.
//
// What renders where, and why:
//   image            -> AppImage, in the screen
//   pdf (iOS)        -> WebView; iOS renders PDF natively
//   pdf (Android)    -> the in-app browser (Chrome Custom Tab): Android's WebView has NO PDF
//                       renderer, so a WebView would show a blank page
//   video / doc / ppt-> the in-app browser, which plays or hands the file to the device viewer
// The in-app browser is a Custom Tab / SFSafariViewController: it opens over the app and comes
// back to this screen, and the signed URL never leaves the device.
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import type { Role } from "@/core/types/role";
import { useFile } from "@/features/shared-screens/hooks/use-file";
import type { ViewableFile } from "@/features/shared-screens/data/file-repository";
import { ActionButton, AppImage, IconTile, ListState, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useRouteIds } from "@/core/logic/route-params";
import { C } from "@/shared/constants/studia-colors";
import { RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { formatFileSize } from "@/shared/utils/file";

/** Can this file be shown by the screen itself? Everything else goes to the in-app browser. */
function rendersInline(file: ViewableFile): "image" | "webview" | null {
  if (file.kind === "image") return "image";
  if (file.kind === "pdf" && Platform.OS === "ios") return "webview";
  return null;
}

export function FileViewerScreen({ role }: { role: Role }) {
  const { fileId } = useRouteIds("fileId");
  const goBack = useSafeBack(`/${role}/home`);
  const toast = useToast();
  const { data: file, loading, error, refetch } = useFile(fileId);

  // The browser is opened once per file, automatically, so a tap on the attachment goes straight
  // to the document. A manual button stays for a second look or a failed open.
  const opened = useRef<string | null>(null);
  const [opening, setOpening] = useState(false);

  const openExternally = useCallback(
    async (url: string) => {
      setOpening(true);
      try {
        await WebBrowser.openBrowserAsync(url, {
          toolbarColor: C.primaryDark,
          controlsColor: C.white,
          enableDefaultShareMenuItem: false,
        });
      } catch {
        toast.show("This file could not be opened on this device.", { tone: "red" });
      } finally {
        setOpening(false);
      }
    },
    [toast],
  );

  const inline = file ? rendersInline(file) : null;

  useEffect(() => {
    if (!file || inline || opened.current === file.id) return;
    opened.current = file.id;
    void openExternally(file.url);
  }, [file, inline, openExternally]);

  return (
    <Screen role={role} scroll={!!inline} scope={`${role}/file-viewer`}>
      <PageTitle title={file?.name ?? "File"} onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && !file}
        onRetry={refetch}
        emptyIcon="document-outline"
        emptyTitle="File not found"
        emptyMessage="It may have been removed by the instructor."
      >
        {file ? (
          <View style={inline === "webview" ? s.fill : s.stack}>
            {inline === "image" ? (
              <AppImage
                source={{ uri: file.url }}
                contentFit="contain"
                aspectRatio={3 / 4}
                accessibilityLabel={file.name}
              />
            ) : inline === "webview" ? (
              <WebView
                source={{ uri: file.url }}
                style={s.web}
                originWhitelist={["https://*"]}
                // Nothing in a course document should be able to run a nested page or app link.
                javaScriptEnabled={false}
                allowsInlineMediaPlayback
                setSupportMultipleWindows={false}
              />
            ) : (
              <View style={s.card}>
                <IconTile name="document-text-outline" size={56} />
                <Text style={[TYPE.h3, s.center]} numberOfLines={2}>
                  {file.name}
                </Text>
                <Text style={[TYPE.muted, s.center]}>
                  {`${file.extension.toUpperCase()} · ${formatFileSize(file.sizeBytes)}`}
                </Text>
                <Text style={[TYPE.caption, s.center]}>
                  This file opens in the in-app viewer. It stays on your device.
                </Text>
                <ActionButton
                  label="Open document"
                  icon="open-outline"
                  loading={opening}
                  onPress={() => void openExternally(file.url)}
                />
              </View>
            )}
          </View>
        ) : null}
      </ListState>
    </Screen>
  );
}

const s = StyleSheet.create({
  stack: { gap: SPACE.md },
  fill: { flex: 1, minHeight: 420 },
  web: { flex: 1, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: C.white },
  card: { alignItems: "center", gap: SPACE.sm },
  center: { textAlign: "center" },
});

export const StudentFileViewer = () => <FileViewerScreen role="student" />;
export const InstructorFileViewer = () => <FileViewerScreen role="instructor" />;
