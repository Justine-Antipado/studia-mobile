// class-detail-screen.tsx — tabs: Stream · Materials · Assessments · People · Grades (docs/ROUTE-MAP.md).
import { FeatureGate } from "@/shared/components/ui/gate-views";
import { ListState, PageTitle, HorizontalChipBar } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useRouteEnum, useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { AssessmentsTab } from "@/features/instructor/components/class-detail/assessments-tab";
import { GradesTab } from "@/features/instructor/components/class-detail/grades-tab";
import { MaterialsTab } from "@/features/instructor/components/class-detail/materials-tab";
import { PeopleTab } from "@/features/instructor/components/class-detail/people-tab";
import { StreamTab } from "@/features/instructor/components/class-detail/stream-tab";
import { useInstructorClass } from "@/features/instructor/hooks/use-classes";

const TABS = ["Stream", "Materials", "Assessments", "People", "Grades"] as const;
type Tab = (typeof TABS)[number];

export default function InstructorClassDetailScreen() {
  const id = useRouteId();
  const goBack = useSafeBack("/instructor/classes");
  const { data: cls, loading, error, refetch } = useInstructorClass(id);
  // In the URL, so opening a material or a student and coming back keeps the same tab.
  const [tab, setTab] = useRouteEnum<Tab>("tab", TABS, "Stream");

  return (
    <Screen role="instructor" scope="instructor/class-detail">
      <PageTitle title={cls ? `${cls.code} · ${cls.section}` : "Class"} onBack={goBack} />

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
            {tab === "Stream" && (
              <FeatureGate feature="announcements">
                <StreamTab classId={cls.id} />
              </FeatureGate>
            )}
            {tab === "Materials" && (
              <FeatureGate feature="content">
                <MaterialsTab classId={cls.id} />
              </FeatureGate>
            )}
            {tab === "Assessments" && (
              <FeatureGate feature="assessments">
                <AssessmentsTab classId={cls.id} />
              </FeatureGate>
            )}
            {tab === "People" && <PeopleTab classId={cls.id} />}
            {tab === "Grades" && (
              <FeatureGate feature="assessments">
                <GradesTab classId={cls.id} />
              </FeatureGate>
            )}
          </>
        ) : null}
      </ListState>
    </Screen>
  );
}
