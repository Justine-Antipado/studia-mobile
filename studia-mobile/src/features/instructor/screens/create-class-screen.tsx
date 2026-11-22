// create-class-screen.tsx — modal: name, section, subject code; join code is auto-generated.
import { useRouter } from "expo-router";
import { useState } from "react";

import { ActionButton, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useUnsavedGuard } from "@/shared/hooks/use-unsaved-guard";
import { useCreateClass } from "@/features/instructor/hooks/use-classes";
import { validateClassCode, validateClassSection, validateClassTitle } from "@/features/instructor/logic/validators";

export default function CreateClassScreen() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateClass();

  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ title?: string | null; section?: string | null; code?: string | null }>({});

  const { goBack, discardDialog } = useUnsavedGuard(
    "/instructor/classes",
    title.trim().length > 0 || section.trim().length > 0 || code.trim().length > 0,
    "Discard this class?",
    "It has not been created yet.",
  );

  const submit = async () => {
    const titleError = validateClassTitle(title);
    const sectionError = validateClassSection(section);
    const codeError = validateClassCode(code);
    setErrors({ title: titleError, section: sectionError, code: codeError });
    if (titleError || sectionError || codeError) return;

    const result = await create.run({ title, section, code });
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
      <FormField
        label="Section"
        value={section}
        onChangeText={(v) => { setSection(v); setErrors((e) => ({ ...e, section: null })); }}
        placeholder="e.g. BSIT 4-A"
        maxLength={30}
        error={errors.section}
      />

      <ActionButton label="Create class" icon="checkmark" loading={create.loading} onPress={submit} />
      {discardDialog}
    </Screen>
  );
}
