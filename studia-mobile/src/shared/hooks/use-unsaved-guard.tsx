// use-unsaved-guard.tsx — one place for "you have unsaved changes" on a form screen.
// Wraps useSafeBack (hardware + header back) and returns a ready-made confirm dialog:
//   const { goBack, discardDialog } = useUnsavedGuard("/instructor/classes", dirty, "Discard this class?");
//   <PageTitle onBack={goBack} /> ... {discardDialog}
// Call `forceBack()` after a successful save if you navigate with back instead of replace.
import type { Href } from "expo-router";
import { useState, type ReactElement } from "react";

import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { useForceBack, useSafeBack } from "@/shared/hooks/use-safe-back";

export function useUnsavedGuard(
  fallback: Href,
  dirty: boolean,
  title = "Discard your changes?",
  message = "What you entered has not been saved yet.",
  onDiscard?: () => void,
): { goBack: () => void; forceBack: () => void; discardDialog: ReactElement } {
  const [open, setOpen] = useState(false);
  const goBack = useSafeBack(fallback, { blocked: dirty, onBlocked: () => setOpen(true) });
  const forceBack = useForceBack(fallback);

  const discardDialog = (
    <ConfirmDialog
      visible={open}
      title={title}
      message={message}
      confirmLabel="Discard"
      onConfirm={() => {
        setOpen(false);
        onDiscard?.();
        forceBack();
      }}
      onCancel={() => setOpen(false)}
    />
  );
  return { goBack, forceBack, discardDialog };
}
