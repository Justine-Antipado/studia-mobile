// create-assignment-screen.tsx — modal: the shared AssignmentForm in "create" mode.
import { useRouter } from "expo-router";

import { useToast } from "@/shared/components/ui";
import { useRouteId } from "@/core/logic/route-params";
import { AssignmentForm } from "@/features/instructor/components/assignment-form";
import { useCreateAssignment } from "@/features/instructor/hooks/use-assignments";

export default function CreateAssignmentScreen() {
  const classId = useRouteId("classId");
  const router = useRouter();
  const toast = useToast();
  const create = useCreateAssignment(classId ?? "");
  const fallback = classId ? { pathname: "/instructor/class-detail" as const, params: { id: classId } } : "/instructor/classes";

  return (
    <AssignmentForm
      mode="create"
      submitLabel="Create assignment"
      discardTitle="Discard this assignment?"
      fallback={fallback}
      loading={create.loading}
      onSubmit={async (draft) => {
        if (!classId) return { ok: false, message: "This class no longer exists." };
        const result = await create.run(draft);
        if (!result.ok) return { ok: false, message: result.error.message };
        toast.show("Assignment created", { tone: "green" });
        router.replace({ pathname: "/instructor/class-detail", params: { id: classId, tab: "Assessments" } });
        return { ok: true };
      }}
    />
  );
}
