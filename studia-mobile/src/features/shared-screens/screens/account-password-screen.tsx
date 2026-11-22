// account-password-screen.tsx — change password (same strength rules and meter
// as sign-up / reset on the auth screen). Order: email a 6-digit code, enter it, then choose the new
// password (the strength checklist only appears once typing starts). The server checks the code and
// sets the password in one call.
import { useState } from "react";
import { Text, View } from "react-native";

import { useRoleUser } from "@/core/data/storage/session-store";
import type { Role } from "@/core/types/role";
import { PasswordMeter } from "@/features/auth/components/auth-parts";
import { LIMITS, isStrongPassword } from "@/features/auth/logic/auth-validation";
import { OtpStep } from "@/features/shared-screens/components/otp-step";
import { profileRepository } from "@/features/shared-screens/data/profile-repository";
import { ActionButton, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

type Step = "start" | "otp" | "new";

export function AccountPasswordScreen({ role }: { role: Role }) {
  const user = useRoleUser(role);
  const toast = useToast();
  const goBack = useSafeBack(`/${role}/account`);
  const [step, setStep] = useState<Step>("start");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const email = user?.email ?? "your email";

  const sendCode = async () => {
    setBusy(true);
    const r = await profileRepository.requestOtp("password_change");
    setBusy(false);
    if (!r.ok) return toast.show(r.error.message, { tone: "red" });
    setDevCode(r.value.devCode);
    setStep("otp");
  };

  // The server verifies the code and sets the password in one call, so the code is held here until
  // the new password is chosen. A wrong code sends the user back to the code step.
  const save = async () => {
    setBusy(true);
    const r = await profileRepository.changePassword(pw, code);
    setBusy(false);
    if (!r.ok) {
      toast.show(r.error.message, { tone: "red" });
      if (r.error.code === "validation" && /code/i.test(r.error.message)) setStep("otp");
      return;
    }
    toast.show("Password changed", { tone: "green" });
    goBack();
  };

  const strong = isStrongPassword(pw);
  const mismatch = confirm.length > 0 && confirm !== pw;
  const canSave = strong && pw === confirm;

  const back = step === "new" ? () => setStep("otp") : step === "otp" ? () => setStep("start") : goBack;

  return (
    <Screen role={role} scope={`${role}/account-password`}>
      <PageTitle title="Password" onBack={back} />
      {step === "start" ? (
        <View style={{ gap: SPACE.md }}>
          <Text style={TYPE.body}>{`First we'll email a 6-digit verification code to ${email} to confirm it's you.`}</Text>
          <ActionButton label="Send verification code" icon="mail-outline" loading={busy} onPress={sendCode} />
        </View>
      ) : step === "otp" ? (
        <OtpStep
          email={email}
          devCode={devCode}
          confirmLabel="Continue"
          onSubmit={async (c) => {
            setCode(c);
            setStep("new");
            return null;
          }}
          onResend={sendCode}
        />
      ) : (
        <View style={{ gap: SPACE.md }}>
          <Text style={TYPE.body}>Code accepted. Choose your new password.</Text>
          <FormField
            label="New password"
            value={pw}
            onChangeText={setPw}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            maxLength={LIMITS.password}
          />
          {pw.length > 0 && !strong ? <PasswordMeter password={pw} /> : null}
          <FormField
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            maxLength={LIMITS.password}
            error={mismatch ? "Passwords don't match." : null}
          />
          <ActionButton label="Change password" icon="lock-closed-outline" disabled={!canSave} loading={busy} onPress={save} />
        </View>
      )}
    </Screen>
  );
}

export const StudentAccountPassword = () => <AccountPasswordScreen role="student" />;
export const InstructorAccountPassword = () => <AccountPasswordScreen role="instructor" />;
