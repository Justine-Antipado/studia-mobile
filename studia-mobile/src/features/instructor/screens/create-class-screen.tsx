// create-class-screen.tsx — modal: name, subject code, program/year/section dropdowns; join code
// is auto-generated.
import { useRouter } from "expo-router";
import { useState } from "react";

import { ActionButton, FormField, PageTitle, SelectField, useToast } from "@/shared/components/ui";
import type { SelectOption } from "@/shared/components/ui/select-field";
import { Screen } from "@/shared/components/ui/screen";
import { useUnsavedGuard } from "@/shared/hooks/use-unsaved-guard";
import { useCreateClass } from "@/features/instructor/hooks/use-classes";
import {
  CLASS_PROGRAMS,
  CLASS_SECTIONS,
  CLASS_YEARS,
  composeClassSection,
  validateClassCode,
  validateClassTitle,
} from "@/features/instructor/logic/validators";

const DEFAULT_PROGRAM = CLASS_PROGRAMS[0];
const DEFAULT_YEAR = CLASS_YEARS[0];
const DEFAULT_SECTION = CLASS_SECTIONS[0];

const PROGRAM_OPTIONS: SelectOption<string>[] = CLASS_PROGRAMS.map((p) => ({ value: p, label: p }));
const YEAR_OPTIONS: SelectOption<string>[] = CLASS_YEARS.map((y) => ({ value: y, label: `Year ${y}` }));
const SECTION_OPTIONS: SelectOption<string>[] = CLASS_SECTIONS.map((s) => ({ value: s, label: `Section ${s}` }));

export default function CreateClassScreen() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateClass();

  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [program, setProgram] = useState<string>(DEFAULT_PROGRAM);
  const [year, setYear] = useState<string>(DEFAULT_YEAR);
  const [section, setSection] = useState<string>(DEFAULT_SECTION);
  const [errors, setErrors] = useState<{ title?: string | null; code?: string | null }>({});

  const isDirty =
    title.trim().length > 0 ||
    code.trim().length > 0 ||
    program !== DEFAULT_PROGRAM ||
    year !== DEFAULT_YEAR ||
    section !== DEFAULT_SECTION;

  const { goBack, discardDialog } = useUnsavedGuard(
    "/instructor/classes",
    isDirty,
    "Discard this class?",
    "It has not been created yet.",
  );

  const submit = async () => {
    const titleError = validateClassTitle(title);
    const codeError = validateClassCode(code);
    setErrors({ title: titleError, code: codeError });
    if (titleError || codeError) return;

    const result = await create.run({ title, section: composeClassSection(program, year, section), code });
    if (result.ok) {
      toast.show(`"${result.value.title}" created · Join code ${result.value.joinCode}`, { tone: "green" });
      router.replace({ pathname: "/instructor/class-detail", params: { id: result.value.id } });
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  return (
    <Screen role="instructor" scope="instructor/create-class">
      <PageTitle title="Create Class" subtitle="Students join using the code we generate for you." onBack={goBack} />

      <FormField
        label="Class name"
        value={title}
        onChangeText={(v) => { setTitle(v); setErrors((e) => ({ ...e, title: null })); }}
        placeholder="e.g. Information Assurance and Security"
        maxLength={80}
        error={errors.title}
      />
      <FormField
        label="Subject code"
        value={code}
        onChangeText={(v) => { setCode(v.toUpperCase()); setErrors((e) => ({ ...e, code: null })); }}
        placeholder="e.g. IT 401"
        maxLength={15}
        autoCapitalize="characters"
        error={errors.code}
      />
      <SelectField label="Program" value={program} options={PROGRAM_OPTIONS} onChange={setProgram} />
      <SelectField label="Year level" value={year} options={YEAR_OPTIONS} onChange={setYear} />
      <SelectField label="Section" value={section} options={SECTION_OPTIONS} onChange={setSection} />

      <ActionButton label="Create class" icon="checkmark" loading={create.loading} onPress={submit} />
      {discardDialog}
    </Screen>
  );
}
