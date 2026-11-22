// account-password-screen.tsx — change password: send email OTP → verify → set a new password
// that satisfies the same five rules as sign-up (PASSWORD_RULES, not duplicated here).
import { useState } from "react";
import { Text, View } from "react-native";

import { useRoleUser } from "@/core/data/storage/session-store";
import type { Role } from "@/core/types/role";
import { LIMITS, PASSWORD_RULES, isStrongPassword } from "@/features/auth/logic/auth-validation";
import { OtpStep } from "@/features/shared-screens/components/otp-step";
import { profileRepository } from "@/features/shared-screens/data/profile-repository";
import { ActionButton, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

type Step = "start" | "otp" | "new";

export function AccountPasswordScreen({ role }: { role: Role }) {
  const user = useRoleUser(role);
  const toast = useToast();
  const goBack = useSafeBack(`/${role}/account`);
  const [step, setStep] = useState<Step>("start");
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

  const save = async () => {
    setBusy(true);
    const r = await profileRepository.changePassword(pw);
    setBusy(false);
    if (!r.ok) return toast.show(r.error.message, { tone: "red" });
    toast.show("Password changed", { tone: "green" });
    goBack();
  };

  const mismatch = confirm.length > 0 && confirm !== pw;
  const canSave = isStrongPassword(pw) && pw === confirm;

  return (
    <Screen role={role} scope={`${role}/account-password`}>
      <PageTitle title="Password" onBack={goBack} />
      {step === "start" ? (
        <View style={{ gap: SPACE.md }}>
          <Text style={TYPE.body}>
            {`For your security we'll email a verification code to ${user?.email ?? "your email"} before you can set a new password.`}
          </Text>
          <ActionButton label="Send verification code" icon="mail-outline" loading={busy} onPress={sendCode} />
        </View>
      ) : null}
      {step === "otp" ? (
        <OtpStep
          purpose="password_change"
          email={user?.email ?? "your email"}
          devCode={devCode}
          onVerified={() => setStep("new")}
          onResend={sendCode}
        />
      ) : null}
      {step === "new" ? (
        <View style={{ gap: SPACE.md }}>
          <FormField label="New password" value={pw} onChangeText={setPw} secureTextEntry maxLength={LIMITS.password} />
          <View style={{ gap: 2 }}>
            {PASSWORD_RULES.map((rule) => (
              <Text key={rule.id} style={[TYPE.caption, { color: rule.test(pw) ? C.green : C.muted }]}>
                {`${rule.test(pw) ? "✓" : "•"} ${rule.label}`}
              </Text>
            ))}
          </View>
          <FormField
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            error={mismatch ? "Passwords don't match." : null}
          />
          <ActionButton label="Change password" icon="checkmark" disabled={!canSave} loading={busy} onPress={save} />
        </View>
      ) : null}
    </Screen>
  );
}

export const StudentAccountPassword = () => <AccountPasswordScreen role="student" />;
export const InstructorAccountPassword = () => <AccountPasswordScreen role="instructor" />;
