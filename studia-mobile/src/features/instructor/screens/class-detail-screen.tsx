// class-detail-screen.tsx — tabs: Stream · Materials · Assessments · People · Grades (docs/ROUTE-MAP.md).
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { ActionButton, BottomSheet, ConfirmDialog, ListState, PageTitle, HorizontalChipBar, useToast } from "@/shared/components/ui";
import { Icon } from "@/shared/components/ui/icon";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { HIT_SLOP } from "@/shared/constants/tokens";
import { useRouteEnum, useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { AssessmentsTab } from "@/features/instructor/components/class-detail/assessments-tab";
import { GradesTab } from "@/features/instructor/components/class-detail/grades-tab";
import { MaterialsTab } from "@/features/instructor/components/class-detail/materials-tab";
import { PeopleTab } from "@/features/instructor/components/class-detail/people-tab";
import { StreamTab } from "@/features/instructor/components/class-detail/stream-tab";
import { useArchiveClass, useDeleteClass, useInstructorClass } from "@/features/instructor/hooks/use-classes";

const TABS = ["Stream", "Materials", "Assessments", "People", "Grades"] as const;
type Tab = (typeof TABS)[number];

export default function InstructorClassDetailScreen() {
  const id = useRouteId();
  const router = useSafeRouter();
  const toast = useToast();
  const goBack = useSafeBack("/instructor/classes");
  const { data: cls, loading, error, refetch } = useInstructorClass(id);
  // In the URL, so opening a material or a student and coming back keeps the same tab.
  const [tab, setTab] = useRouteEnum<Tab>("tab", TABS, "Stream");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const archiveClass = useArchiveClass(id ?? "");
  const deleteClass = useDeleteClass();

  const toggleArchive = async () => {
    if (!cls) return;
    const result = await archiveClass.run(!cls.archived);
    if (result.ok) {
      setSettingsOpen(false);
      toast.show(cls.archived ? "Class unarchived" : "Class archived", { tone: "green" });
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  const confirmDeleteClass = async () => {
    if (!cls) return;
    const result = await deleteClass.run(cls.id);
    setConfirmDelete(false);
    if (result.ok) {
      toast.show("Class deleted", { tone: "green", icon: "trash-outline" });
      router.replace("/instructor/classes");
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  return (
    <Screen role="instructor" scope="instructor/class-detail">
      <PageTitle
        title={cls ? `${cls.code} · ${cls.section}` : "Class"}
        onBack={goBack}
        trailing={
          cls ? (
            <Pressable
              onPress={() => setSettingsOpen(true)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Class settings"
              style={s.gear}
            >
              <Icon name="settings-outline" size="md" color={C.primaryDark} />
            </Pressable>
          ) : null
        }
      />

      <ListState
        loading={loading}
        error={error}
        empty={!loading && !cls}
        onRetry={refetch}
        emptyIcon="school-outline"
        emptyTitle="Class not found"
        emptyMessage="This class may have been archived or removed."
      >
        {cls ? (
          <>
            <HorizontalChipBar items={TABS} value={tab} onChange={setTab} label="Sections" />
            {tab === "Stream" && <StreamTab classId={cls.id} />}
            {tab === "Materials" && <MaterialsTab classId={cls.id} />}
            {tab === "Assessments" && <AssessmentsTab classId={cls.id} />}
            {tab === "People" && <PeopleTab classId={cls.id} />}
            {tab === "Grades" && <GradesTab classId={cls.id} />}
          </>
        ) : null}
      </ListState>

      <BottomSheet visible={settingsOpen} title="Class settings" onClose={() => setSettingsOpen(false)}>
        <ActionButton
          label={cls?.archived ? "Unarchive class" : "Archive class"}
          icon="archive-outline"
          variant="secondary"
          loading={archiveClass.loading}
          onPress={toggleArchive}
        />
        <ActionButton
          label="Delete class"
          icon="trash-outline"
          variant="danger"
          onPress={() => {
            setSettingsOpen(false);
            setConfirmDelete(true);
          }}
        />
      </BottomSheet>

      <ConfirmDialog
        visible={confirmDelete}
        title={cls ? `Delete ${cls.code}?` : "Delete this class?"}
        message="This permanently deletes the class along with its announcements, materials, assignments, and quizzes, and removes all enrolled students. This cannot be undone."
        confirmLabel="Delete"
        icon="trash-outline"
        busy={deleteClass.loading}
        onConfirm={confirmDeleteClass}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  gear: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
