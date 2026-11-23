// feature-boundary.tsx — fault isolation inside a screen. Wrap one tab, panel or card stack:
// when it crashes, only that block turns into a small "could not load" card and the header, the
// tab bar and the rest of the screen keep working. The full-screen ErrorFallback stays for a
// whole route or the app root.
//
//   <FeatureBoundary scope="course-detail.grades" title="Grades">
//     <GradesTab classId={id} />
//   </FeatureBoundary>
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/shared/components/ui/app-button";
import { ErrorBoundary, type FallbackProps } from "@/shared/components/ui/error-boundary";
import { IconTile } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";

/** The inline card itself. Exported so a screen can show it without a thrown error. */
export function FeatureFallback({
  title,
  message,
  error,
  retry,
}: {
  title?: string;
  message?: string;
  error?: Error;
  retry?: () => void;
}) {
  return (
    <View style={s.card}>
      <IconTile name="cloud-offline-outline" size={44} bg={C.redTint} color={C.red} />
      <Text style={[TYPE.h3, s.center]} numberOfLines={2}>
        {title ? `${title} could not load` : "This section could not load"}
      </Text>
      <Text style={[TYPE.muted, s.center]} numberOfLines={3}>
        {message ?? "The rest of the screen still works. Try loading this part again."}
      </Text>
      {__DEV__ && error ? (
        <Text style={[TYPE.caption, s.debug]} numberOfLines={4}>
          {error.message}
        </Text>
      ) : null}
      {retry ? <AppButton label="Try again" variant="secondary" onPress={retry} /> : null}
    </View>
  );
}

export function FeatureBoundary({
  children,
  scope,
  title,
  message,
  onReset,
}: {
  children: ReactNode;
  /** Where the crash happened, for the error sink. Use "<screen>.<block>". */
  scope: string;
  /** Feature name in the message ("Grades could not load"). */
  title?: string;
  message?: string;
  onReset?: () => void;
}) {
  const fallback = ({ error, retry }: FallbackProps) => (
    <FeatureFallback title={title} message={message} error={error} retry={retry} />
  );

  return (
    <ErrorBoundary scope={scope} onReset={onReset} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  center: { textAlign: "center" },
  debug: {
    alignSelf: "stretch",
    padding: SPACE.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: C.surface,
  },
});
