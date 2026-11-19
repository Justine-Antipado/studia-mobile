// join-class-screen.tsx — modal: join a class by its 6-character code.
import { useRouter } from "expo-router";
import { useState } from "react";

import { ActionButton, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { validateJoinCode } from "@/features/student/logic/validators";
import { useJoinClass } from "@/features/student/hooks/use-classes";

export default function StudentJoinClass() {
  const router = useRouter();
  const goBack = useSafeBack("/student/courses");
  const toast = useToast();
  const join = useJoinClass();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const validation = validateJoinCode(code);
    setError(validation);
    if (validation) return;

    const result = await join.run(code.trim().toUpperCase());
    if (result.ok) {
      toast.show(`Joined ${result.value.code} · ${result.value.title}`, { tone: "green" });
      router.replace({ pathname: "/student/course-detail", params: { id: result.value.id } });
    } else {
      setError(result.error.message);
    }
  };

  return (
    <Screen role="student" scope="student/join-class">
      <PageTitle title="Join Class" subtitle="Enter the 6-character code from your instructor" onBack={goBack} />
      <FormField
        label="Class code"
        value={code}
        onChangeText={(text) => {
          setCode(text.toUpperCase());
          setError(null);
        }}
        onSubmitEditing={submit}
        placeholder="e.g. K7P9QX"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        icon="key-outline"
        error={error}
        returnKeyType="done"
      />
      <ActionButton label="Join" icon="arrow-forward" loading={join.loading} onPress={submit} />
    </Screen>
  );
}
