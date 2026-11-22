// otp-step.tsx — "enter the 6-digit code" step shared by the OTP-protected account edits.
import { useState } from "react";
import { Text, View } from "react-native";

import { isOtp } from "@/features/auth/logic/auth-validation";
import { profileRepository, type OtpPurpose } from "@/features/shared-screens/data/profile-repository";
import { ActionButton, FormField, useToast } from "@/shared/components/ui";
import { SPACE, TYPE } from "@/shared/constants/tokens";

export function OtpStep({
  purpose,
  email,
  devCode,
  onVerified,
  onResend,
}: {
  purpose: OtpPurpose;
  email: string;
  devCode?: string;
  onVerified: () => void;
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
    const r = await profileRepository.verifyOtp(purpose, code);
    setBusy(false);
    if (r.ok) onVerified();
    else {
      setError(r.error.message);
      toast.show(r.error.message, { tone: "red" });
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
      <ActionButton label="Verify & save" icon="checkmark" loading={busy} onPress={verify} />
      <ActionButton label="Send a new code" variant="secondary" onPress={onResend} />
    </View>
  );
}
