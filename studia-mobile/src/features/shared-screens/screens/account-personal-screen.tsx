// account-personal-screen.tsx — view / edit profile. Saving needs an email OTP first; nothing is
// applied (and the session user is not changed) until the code is verified.
import { useState } from "react";
import { Text, View } from "react-native";

import { useRoleUser } from "@/core/data/storage/session-store";
import type { Role } from "@/core/types/role";
import {
  COURSES,
  DEPARTMENTS,
  SECTIONS,
  YEARS,
  isEmail,
  normalizeName,
  normalizePhone,
} from "@/features/auth/logic/auth-validation";
import { OtpStep } from "@/features/shared-screens/components/otp-step";
import { profileRepository, type ProfilePatch } from "@/features/shared-screens/data/profile-repository";
import { ActionButton, Chip, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

type Step = "form" | "otp";

export function AccountPersonalScreen({ role }: { role: Role }) {
  const user = useRoleUser(role);
  const toast = useToast();
  const goBack = useSafeBack(`/${role}/account`);
  const [step, setStep] = useState<Step>("form");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [name, setName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [course, setCourse] = useState(user?.course ?? "");
  const [year, setYear] = useState(user?.year ?? "");
  const [section, setSection] = useState(user?.section ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const patch = (): ProfilePatch =>
    role === "student"
      ? { fullName: normalizeName(name), phone: normalizePhone(phone) ?? "", course, year, section }
      : { fullName: normalizeName(name), phone: normalizePhone(phone) ?? "", department };

  const sendCode = async () => {
    const e: typeof errors = {};
    if (normalizeName(name).length < 2) e.name = "Enter your full name.";
    if (normalizePhone(phone) === null) e.phone = "Use 09XXXXXXXXX or +639XXXXXXXXX.";
    setErrors(e);
    if (e.name || e.phone) return;
    setBusy(true);
    const r = await profileRepository.requestOtp("profile_update");
    setBusy(false);
    if (!r.ok) return toast.show(r.error.message, { tone: "red" });
    setDevCode(r.value.devCode);
    setStep("otp");
  };

  const apply = async () => {
    const r = await profileRepository.updateProfile(user, patch());
    if (!r.ok) return toast.show(r.error.message, { tone: "red" });
    toast.show("Profile updated", { tone: "green" });
    goBack();
  };

  return (
    <Screen role={role} scope={`${role}/account-personal`}>
      <PageTitle title="Personal Information" onBack={goBack} />
      {step === "otp" ? (
        <OtpStep
          purpose="profile_update"
          email={isEmail(user.email) ? user.email : "your email"}
          devCode={devCode}
          onVerified={apply}
          onResend={sendCode}
        />
      ) : (
        <View style={{ gap: SPACE.md }}>
          <FormField label="Full name" value={name} onChangeText={setName} error={errors.name} maxLength={80} />
          <FormField label="Email" value={user.email} editable={false} helper="Email can't be changed here." />
          <FormField
            label="Mobile (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            error={errors.phone}
          />
          {role === "student" ? (
            <>
              <Choice label="Course" items={COURSES} value={course} onChange={setCourse} />
              <Choice label="Year" items={YEARS} value={year} onChange={setYear} />
              <Choice label="Section" items={SECTIONS} value={section} onChange={setSection} />
            </>
          ) : (
            <Choice label="Department" items={DEPARTMENTS} value={department} onChange={setDepartment} />
          )}
          <Text style={TYPE.caption}>Saving sends a verification code to your email.</Text>
          <ActionButton label="Save changes" icon="shield-checkmark-outline" loading={busy} onPress={sendCode} />
        </View>
      )}
    </Screen>
  );
}

function Choice({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={TYPE.label}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {items.map((i) => (
          <Chip key={i} label={i} selected={value === i} onPress={() => onChange(i)} />
        ))}
      </View>
    </View>
  );
}

export const StudentAccountPersonal = () => <AccountPersonalScreen role="student" />;
export const InstructorAccountPersonal = () => <AccountPersonalScreen role="instructor" />;
