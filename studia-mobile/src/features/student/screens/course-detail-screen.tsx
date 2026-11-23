// course-detail-screen.tsx — tabs: Stream · Lessons · Tasks · Grades · People (docs/ROUTE-MAP.md).
import { useRouter } from "expo-router";
import { useCallback } from "react";

import { FeatureGate } from "@/shared/components/ui/gate-views";
import { ListState, PageTitle, SegmentedTabs } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useRouteEnum, useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { GradesTab } from "@/features/student/components/course-detail/grades-tab";
import { LessonsTab } from "@/features/student/components/course-detail/lessons-tab";
import { PeopleTab } from "@/features/student/components/course-detail/people-tab";
import { StreamTab } from "@/features/student/components/course-detail/stream-tab";
import { TasksTab } from "@/features/student/components/course-detail/tasks-tab";
import { useClass } from "@/features/student/hooks/use-classes";

const TABS = ["Stream", "Lessons", "Tasks", "Grades", "People"] as const;
type Tab = (typeof TABS)[number];

export default function StudentCourseDetail() {
  const id = useRouteId();
  const router = useRouter();
  const goBack = useSafeBack("/student/courses");
  const { data: course, loading, error, refetch } = useClass(id);
  // In the URL, so opening a lesson and coming back returns to the same tab.
  const [tab, setTab] = useRouteEnum<Tab>("tab", TABS, "Stream");
  const onLeft = useCallback(() => router.replace("/student/courses"), [router]);

  return (
    <Screen role="student" scope="student/course-detail">
      <PageTitle title={course ? `${course.code} · ${course.title}` : "Course"} onBack={goBack} />

      <ListState
        loading={loading}
        error={error}
        empty={!loading && !course}
        onRetry={refetch}
        emptyIcon="book-outline"
        emptyTitle="Course not found"
        emptyMessage="This class may have been removed or you left it."
      >
        {course ? (
          <>
            <SegmentedTabs items={TABS} value={tab} onChange={setTab} />
            {tab === "Stream" && (
              <FeatureGate feature="announcements">
                <StreamTab classId={course.id} />
              </FeatureGate>
            )}
            {tab === "Lessons" && (
              <FeatureGate feature="content">
                <LessonsTab classId={course.id} />
              </FeatureGate>
            )}
            {tab === "Tasks" && (
              <FeatureGate feature="assessments">
                <TasksTab classId={course.id} />
              </FeatureGate>
            )}
            {tab === "Grades" && (
              <FeatureGate feature="assessments">
                <GradesTab classId={course.id} />
              </FeatureGate>
            )}
            {tab === "People" && <PeopleTab classId={course.id} onLeft={onLeft} />}
          </>
        ) : null}
      </ListState>
    </Screen>
  );
}
