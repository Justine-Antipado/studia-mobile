// account-password-screen.tsx — change password: choose a new password (same strength rules and meter
// as sign-up / reset on the auth screen), then confirm with a 6-digit code emailed to the account.
// The server checks the code and sets the password in one call.
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

type Step = "new" | "otp";

export function AccountPasswordScreen({ role }: { role: Role }) {
  const user = useRoleUser(role);
  const toast = useToast();
  const goBack = useSafeBack(`/${role}/account`);
  const [step, setStep] = useState<Step>("new");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    const r = await profileRepository.requestOtp("password_change");
    setBusy(false);
    if (!r.ok) return toast.show(r.error.message, { tone: "red" });
    setDevCode(r.value.devCode);
    setStep("otp");
  };

  const save = async (code: string): Promise<string | null> => {
    const r = await profileRepository.changePassword(pw, code);
    if (!r.ok) return r.error.message;
    toast.show("Password changed", { tone: "green" });
    goBack();
    return null;
  };

  const strong = isStrongPassword(pw);
  const mismatch = confirm.length > 0 && confirm !== pw;
  const canContinue = strong && pw === confirm;

  return (
    <Screen role={role} scope={`${role}/account-password`}>
      <PageTitle title="Password" onBack={step === "otp" ? () => setStep("new") : goBack} />
      {step === "new" ? (
        <View style={{ gap: SPACE.md }}>
          <Text style={TYPE.body}>
            {`Choose a new password. We'll email a verification code to ${user?.email ?? "your email"} to confirm it's you.`}
          </Text>
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
          {!strong ? <PasswordMeter password={pw} /> : null}
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
          <ActionButton
            label="Send verification code"
            icon="mail-outline"
            disabled={!canContinue}
            loading={busy}
            onPress={sendCode}
          />
        </View>
      ) : (
        <OtpStep
          email={user?.email ?? "your email"}
          devCode={devCode}
          confirmLabel="Verify & change password"
          onSubmit={save}
          onResend={sendCode}
        />
      )}
    </Screen>
  );
}

export const StudentAccountPassword = () => <AccountPasswordScreen role="student" />;
export const InstructorAccountPassword = () => <AccountPasswordScreen role="instructor" />;
