// account-personal-screen.tsx — view / edit profile. Saving emails an OTP; the server verifies it and
// writes the change to the database, and the session user is only updated after that succeeds.
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
import {
  ActionButton,
  CustomDropdown,
  FormField,
  PageTitle,
  toOptions,
  useToast,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

type Step = "form" | "otp";

// Built once: the values are what the database stores, the labels only read better in the sheet.
const COURSE_OPTIONS = toOptions(COURSES);
const YEAR_OPTIONS = toOptions(YEARS, (y) => `Year ${y}`);
const SECTION_OPTIONS = toOptions(SECTIONS, (s) => `Section ${s}`);
const DEPARTMENT_OPTIONS = toOptions(DEPARTMENTS);

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

  const apply = async (code: string): Promise<string | null> => {
    const r = await profileRepository.updateProfile(user, patch(), code);
    if (!r.ok) return r.error.message;
    toast.show("Profile updated", { tone: "green" });
    goBack();
    return null;
  };

  return (
    <Screen role={role} scope={`${role}/account-personal`}>
      <PageTitle title="Personal Information" onBack={goBack} />
      {step === "otp" ? (
        <OtpStep
          email={isEmail(user.email) ? user.email : "your email"}
          devCode={devCode}
          onSubmit={apply}
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
          {/* E2 / F6: dropdowns instead of chip rows — they stay one row tall however many
              courses, sections or departments the campus adds. */}
          {role === "student" ? (
            <>
              <CustomDropdown label="Course" options={COURSE_OPTIONS} value={course} onChange={setCourse} />
              <CustomDropdown label="Year" options={YEAR_OPTIONS} value={year} onChange={setYear} />
              <CustomDropdown label="Section" options={SECTION_OPTIONS} value={section} onChange={setSection} />
            </>
          ) : (
            <CustomDropdown
              label="Department"
              options={DEPARTMENT_OPTIONS}
              value={department}
              onChange={setDepartment}
            />
          )}
          <Text style={TYPE.caption}>Saving sends a verification code to your email.</Text>
          <ActionButton label="Save changes" icon="shield-checkmark-outline" loading={busy} onPress={sendCode} />
        </View>
      )}
    </Screen>
  );
}

export const StudentAccountPersonal = () => <AccountPersonalScreen role="student" />;
export const InstructorAccountPersonal = () => <AccountPersonalScreen role="instructor" />;
