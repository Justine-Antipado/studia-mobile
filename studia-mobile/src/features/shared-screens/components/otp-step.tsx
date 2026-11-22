// otp-step.tsx — "enter the 6-digit code" step shared by the OTP-protected account edits. The code is
// checked by the server together with the save (see profile-repository.ts), not here.
import { useState } from "react";
import { Text, View } from "react-native";

import { isOtp } from "@/features/auth/logic/auth-validation";
import { ActionButton, FormField, useToast } from "@/shared/components/ui";
import { SPACE, TYPE } from "@/shared/constants/tokens";

export function OtpStep({
  email,
  devCode,
  confirmLabel = "Verify & save",
  onSubmit,
  onResend,
}: {
  email: string;
  devCode?: string;
  confirmLabel?: string;
  /** Runs the save with the code. Resolve with an error message to show it, or null on success. */
  onSubmit: (code: string) => Promise<string | null>;
  onResend: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    if (!isOtp(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    const message = await onSubmit(code);
    setBusy(false);
    if (message) {
      setError(message);
      toast.show(message, { tone: "red" });
    }
  };

  return (
    <View style={{ gap: SPACE.md }}>
      <Text style={TYPE.body}>{`We sent a 6-digit code to ${email}. It expires in 5 minutes.`}</Text>
      {devCode ? <Text style={TYPE.caption}>{`DEV code: ${devCode}`}</Text> : null}
      <FormField
        label="Verification code"
        value={code}
        onChangeText={(t) => {
          setCode(t.replace(/\D/g, "").slice(0, 6));
          setError(null);
        }}
        keyboardType="number-pad"
        maxLength={6}
        error={error}
      />
      <ActionButton label={confirmLabel} icon="checkmark" loading={busy} onPress={verify} />
      <ActionButton label="Send a new code" variant="secondary" onPress={onResend} />
    </View>
  );
}
