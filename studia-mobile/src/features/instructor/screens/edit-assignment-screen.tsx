// edit-assignment-screen.tsx — modal: the shared AssignmentForm in "edit" mode, preloaded with the
// current values and attachments. Saving returns to the assignment detail.
import { useRouter } from "expo-router";
import { useMemo } from "react";

import { ListState, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useRouteIds } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { AssignmentForm } from "@/features/instructor/components/assignment-form";
import { useInstructorAssignment, useUpdateAssignment } from "@/features/instructor/hooks/use-assignments";

export default function EditAssignmentScreen() {
  const { classId, id } = useRouteIds("classId", "id");
  const router = useRouter();
  const toast = useToast();
  const goBack = useSafeBack(
    classId && id ? { pathname: "/instructor/assignment-detail", params: { classId, id } } : "/instructor/classes",
  );
  const { data, loading, error, refetch } = useInstructorAssignment(classId, id);
  const update = useUpdateAssignment(classId ?? "", id ?? "");

  const initial = useMemo(
    () =>
      data
        ? {
            title: data.title,
            instructions: data.instructions,
            dueAt: new Date(data.dueAt),
            points: data.points,
            allowLate: data.allowLate,
            attachments: data.attachments,
          }
        : undefined,
    [data],
  );

  if (!initial || !classId || !id) {
    return (
      <Screen role="instructor" scope="instructor/edit-assignment">
        <PageTitle title="Edit Assignment" onBack={goBack} />
        <ListState
          loading={loading}
          error={error}
          empty={!loading}
          onRetry={refetch}
          emptyIcon="document-text-outline"
          emptyTitle="Assignment not found"
        >
          {null}
        </ListState>
      </Screen>
    );
  }

  return (
    <AssignmentForm
      key={data?.id}
      mode="edit"
      initial={initial}
      submitLabel="Save changes"
      discardTitle="Discard your changes?"
      fallback={{ pathname: "/instructor/assignment-detail", params: { classId, id } }}
      loading={update.loading}
      onSubmit={async (draft) => {
        const result = await update.run(draft);
        if (!result.ok) return { ok: false, message: result.error.message };
        toast.show("Assignment updated", { tone: "green" });
        router.replace({ pathname: "/instructor/assignment-detail", params: { classId, id } });
        return { ok: true };
      }}
    />
  );
}
