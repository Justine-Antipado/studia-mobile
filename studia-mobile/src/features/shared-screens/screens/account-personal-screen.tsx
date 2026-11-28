// account-personal-screen.tsx — view / edit profile. Opens read-only ("view"); "Edit Info" switches
// to the editable form ("edit"). Saving emails an OTP; the server verifies it and writes the change
// to the database, and the session user is only updated after that succeeds.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { displayName, useRoleUser } from "@/core/data/storage/session-store";
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
import { Avatar } from "@/shared/components/ui/avatar";
import { Icon } from "@/shared/components/ui/icon";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { useSafeRouter } from "@/shared/hooks/use-safe-router";

type Step = "view" | "edit" | "otp";

// Built once: the values are what the database stores, the labels only read better in the sheet.
const COURSE_OPTIONS = toOptions(COURSES);
const YEAR_OPTIONS = toOptions(YEARS, (y) => `Year ${y}`);
const SECTION_OPTIONS = toOptions(SECTIONS, (s) => `Section ${s}`);
const DEPARTMENT_OPTIONS = toOptions(DEPARTMENTS);

const labelFor = (options: { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

export function AccountPersonalScreen({ role }: { role: Role }) {
  const user = useRoleUser(role);
  const router = useSafeRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>("view");
  // While editing, Android hardware/gesture back should act like "Cancel" (close the form) rather
  // than leaving the screen.
  const goBack = useSafeBack(`/${role}/account`, {
    blocked: step === "edit",
    onBlocked: () => setStep("view"),
  });
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

  const startEdit = () => {
    setName(user.fullName);
    setPhone(user.phone ?? "");
    setCourse(user.course ?? "");
    setYear(user.year ?? "");
    setSection(user.section ?? "");
    setDepartment(user.department ?? "");
    setErrors({});
    setStep("edit");
  };

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
    setStep("view");
    return null;
  };

  // No back arrow while editing — "Cancel" (below) is the only way out of the form, so an
  // in-progress edit is never lost to an accidental swipe-back.
  const back = step === "otp" ? () => setStep("edit") : step === "edit" ? undefined : goBack;

  return (
    <Screen role={role} scope={`${role}/account-personal`}>
      <PageTitle title="Personal Information" onBack={back} />
      {step === "otp" ? (
        <OtpStep
          email={isEmail(user.email) ? user.email : "your email"}
          devCode={devCode}
          onSubmit={apply}
          onResend={sendCode}
        />
      ) : step === "view" ? (
        <View style={{ gap: SPACE.md }}>
          <View style={s.avatarRow}>
            <View style={s.avatarWrap}>
              <Avatar name={displayName(user)} uri={user.avatarUri} size={88} />
              <Pressable
                onPress={() => router.push(`/${role}/account-photo`)}
                style={s.photoBadge}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                hitSlop={8}
              >
                <Icon name="camera" size="sm" color={C.white} />
              </Pressable>
            </View>
            <Pressable onPress={() => router.push(`/${role}/account-photo`)}>
              <Text style={s.photoLink}>Change photo</Text>
            </Pressable>
          </View>

          <FormField label="Full name" value={user.fullName} editable={false} />
          <FormField label="Email" value={user.email} editable={false} helper="Email can't be changed here." />
          <FormField label="Mobile" value={user.phone || "Not set"} editable={false} />
          {role === "student" ? (
            <>
              <FormField label="Course" value={labelFor(COURSE_OPTIONS, user.course ?? "")} editable={false} />
              <FormField label="Year" value={labelFor(YEAR_OPTIONS, user.year ?? "")} editable={false} />
              <FormField label="Section" value={labelFor(SECTION_OPTIONS, user.section ?? "")} editable={false} />
            </>
          ) : (
            <FormField
              label="Department"
              value={labelFor(DEPARTMENT_OPTIONS, user.department ?? "")}
              editable={false}
            />
          )}
          <ActionButton label="Edit Info" icon="create-outline" onPress={startEdit} />
        </View>
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
          <ActionButton label="Cancel" variant="secondary" onPress={() => setStep("view")} />
        </View>
      )}
    </Screen>
  );
}

export const StudentAccountPersonal = () => <AccountPersonalScreen role="student" />;
export const InstructorAccountPersonal = () => <AccountPersonalScreen role="instructor" />;

const s = StyleSheet.create({
  avatarRow: { alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.sm },
  avatarWrap: { width: 88, height: 88 },
  photoBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  photoLink: { color: C.primaryDark, fontSize: 13, fontFamily: "Poppins_700Bold" },
});
