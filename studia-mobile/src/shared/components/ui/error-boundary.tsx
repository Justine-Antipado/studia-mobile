// error-boundary.tsx — catches render/lifecycle crashes and shows a friendly fallback.
// Mounted in the root layout, in each role layout (via Tabs unstable_screenErrorBoundary)
// and around every screen body through the Screen component.
import { router } from "expo-router";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { reportError } from "@/core/logic/report-error";
import { AppButton } from "@/shared/components/ui/app-button";
import { IconTile } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";

export type FallbackProps = { error: Error; retry: () => void; scope?: string };

/** Shared fallback UI. Also used for expo-router's own ErrorBoundary / screenErrorBoundary. */
export function ErrorFallback({ error, retry, scope }: FallbackProps) {
  const goHome = () => {
    retry();
    router.replace("/");
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <IconTile name="warning-outline" size={56} bg={C.redTint} color={C.red} />
          <Text style={[TYPE.h1, s.center]} numberOfLines={2}>
            Something went wrong
          </Text>
          <Text style={[TYPE.muted, s.center]} numberOfLines={4}>
            This screen could not be displayed. Your work is not lost — try again, or go back to the
            start.
          </Text>

          {/* Technical detail is DEV-only: never show stack traces or server text to users. */}
          {__DEV__ ? (
            <Text style={[TYPE.caption, s.debug]} numberOfLines={6}>
              {scope ? `[${scope}] ` : ""}
              {error.message}
            </Text>
          ) : null}

          <View style={s.actions}>
            <AppButton label="Try again" onPress={retry} />
            <AppButton label="Go home" variant="secondary" onPress={goHome} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

type Props = {
  children: ReactNode;
  scope?: string;
  onReset?: () => void;
  /** Replaces the full-screen fallback — e.g. FeatureBoundary's inline card. */
  fallback?: (props: FallbackProps) => ReactNode;
};
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, {
      scope: this.props.scope ?? "error-boundary",
      info: { componentStack: (info.componentStack ?? "").slice(0, 400) },
    });
  }

  retry = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const props: FallbackProps = { error, retry: this.retry, scope: this.props.scope };
    return this.props.fallback ? <>{this.props.fallback(props)}</> : <ErrorFallback {...props} />;
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  content: { flexGrow: 1, justifyContent: "center", padding: SPACE.xl },
  card: {
    alignItems: "center",
    gap: SPACE.sm,
    backgroundColor: C.white,
    borderRadius: RADIUS.xxl,
    padding: SPACE.xl,
    ...SHADOW.card,
  },
  center: { textAlign: "center" },
  debug: {
    alignSelf: "stretch",
    marginTop: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: C.surface,
    color: C.muted,
  },
  actions: { alignSelf: "stretch", gap: SPACE.md, marginTop: SPACE.lg },
});
