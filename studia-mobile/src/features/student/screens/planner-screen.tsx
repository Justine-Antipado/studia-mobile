// planner-screen.tsx — Study Planner tab: a priority carousel, then either a flat list (grouped
// into Today / Monthly / Yearly) or a calendar/week grid of every plan/task/exam. Posting an
// assignment or quiz places it here automatically, on its due date; the student can also add their
// own plan (with notes + priority) or an exam date.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppList, HorizontalChipBar, ListState, PageTitle, useToast, Icon } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { FONT, HIT_SLOP, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { addDaysIso, dayLabel, hourLabel, mondayOf, toLocalIso, weekRangeLabel } from "@/features/student/logic/format";
import { PlannerItemRow } from "@/features/student/components/planner-item-row";
import { PlannerWeekGrid } from "@/features/student/components/planner-week-grid";
import { PriorityTaskCard } from "@/features/student/components/priority-task-card";
import { useMarkBlockDone, usePlanner } from "@/features/student/hooks/use-planner";
import { useToggleTask } from "@/features/student/hooks/use-tasks";
import type { PlannerBlock } from "@/features/student/types/student";

type PlannerTab = "Today" | "Monthly" | "Yearly";
const TABS: PlannerTab[] = ["Today", "Monthly", "Yearly"];
type PlannerView = "List" | "Week";
const VIEWS: PlannerView[] = ["List", "Week"];
/** Stable empty list: the loading / error / empty states are drawn by ListState below the rows. */
const NO_ROWS: PlannerBlock[] = [];

function matchesTab(dayIso: string, tab: PlannerTab, today: string): boolean {
  if (tab === "Today") return dayIso === today;
  if (tab === "Monthly") return dayIso.slice(0, 7) === today.slice(0, 7);
  return dayIso.slice(0, 4) === today.slice(0, 4);
}

export default function StudentPlanner() {
  const router = useSafeRouter();
  const toast = useToast();
  const { data, loading, error, refetch } = usePlanner();
  const markDone = useMarkBlockDone();
  const toggleTask = useToggleTask();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<PlannerTab>("Today");
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<PlannerView>("List");

  const today = toLocalIso(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const blocks = useMemo(() => data?.blocks ?? [], [data]);
  const exams = useMemo(() => data?.exams ?? [], [data]);

  const openAddPlan = useCallback(() => router.push("/student/add-plan"), [router]);
  const openEditPlan = useCallback(
    (block: PlannerBlock) => router.push({ pathname: "/student/add-plan", params: { blockId: block.id } }),
    [router],
  );

  const toggleDone = useCallback(
    async (block: PlannerBlock) => {
      const result = block.taskId ? await toggleTask.run(block.taskId) : await markDone.run({ id: block.id, done: !block.done });
      if (!result.ok) toast.show(result.error.message, { tone: "red" });
      else if (block.taskId) refetch();
    },
    [toggleTask, markDone, refetch, toast],
  );

  // A task-derived block has nothing of its own to edit; the grid's chip is too small to show its
  // full title, so tapping one there just surfaces it instead of opening anything.
  const pressBlock = useCallback(
    (block: PlannerBlock) => {
      if (block.taskId) toast.show(`${block.title} — ${dayLabel(block.dayIso)} · ${hourLabel(block.startHour)}`);
      else openEditPlan(block);
    },
    [openEditPlan, toast],
  );

  const priorityCards = useMemo(() => {
    const high = blocks
      .filter((b) => !b.done && b.priority === "high")
      .sort((a, b) => a.dayIso.localeCompare(b.dayIso));
    const soonExams = exams.filter((e) => e.dateIso >= today).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    return { high: high.slice(0, 6), exams: soonExams.slice(0, 4) };
  }, [blocks, exams, today]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? blocks.filter((b) => b.title.toLowerCase().includes(q)) : blocks;
  }, [blocks, query]);

  const rows = useMemo(
    () =>
      searched
        .filter((b) => showAll || matchesTab(b.dayIso, tab, today))
        .sort((a, b) => a.dayIso.localeCompare(b.dayIso) || a.startHour - b.startHour),
    [searched, showAll, tab, today],
  );

  const renderRow = useCallback(
    (block: PlannerBlock) => (
      <PlannerItemRow block={block} onToggleDone={() => void toggleDone(block)} onPress={block.taskId ? undefined : () => pressBlock(block)} />
    ),
    [toggleDone, pressBlock],
  );

  const topChrome = (
    <View style={{ gap: SPACE.md + 2 }}>
      <PageTitle
        title="Planner"
        trailing={
          <Pressable onPress={openAddPlan} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel="Add plan" style={s.addBtn}>
            <Icon name="add" size="lg" color={C.white} />
          </Pressable>
        }
      />

      <View style={s.search}>
        <Icon name="search" size="md" color={C.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search task"
          placeholderTextColor={C.muted}
          accessibilityLabel="Search task"
          style={s.searchInput}
        />
      </View>

      {priorityCards.high.length > 0 || priorityCards.exams.length > 0 ? (
        <View style={{ gap: SPACE.sm }}>
          <Text style={TYPE.label}>My Priority Task</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
            {priorityCards.high.map((b, i) => (
              <PriorityTaskCard
                key={b.id}
                title={b.title}
                notes={b.notes}
                dayIso={b.dayIso}
                icon={b.taskId ? "document-text-outline" : "bulb-outline"}
                tone={i % 2 === 0 ? "blue" : "orange"}
              />
            ))}
            {priorityCards.exams.map((e) => (
              <PriorityTaskCard key={e.id} title={e.title} notes="Exam" dayIso={e.dateIso} icon="school-outline" tone="red" />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <HorizontalChipBar items={VIEWS} value={view} onChange={setView} label="Planner view" />
    </View>
  );

  if (view === "Week") {
    return (
      <Screen role="student" scope="student/planner" refreshing={loading} onRefresh={refetch}>
        <View style={s.chrome}>
          {topChrome}

          <View style={s.weekNav}>
            <Pressable
              onPress={() => setWeekStart((w) => addDaysIso(w, -7))}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Previous week"
            >
              <Icon name="chevron-back" size="md" color={C.primaryDark} />
            </Pressable>
            <Pressable onPress={() => setWeekStart(mondayOf(today))} accessibilityRole="button" accessibilityLabel="Jump to this week">
              <Text style={TYPE.h3}>{weekRangeLabel(weekStart)}</Text>
            </Pressable>
            <Pressable
              onPress={() => setWeekStart((w) => addDaysIso(w, 7))}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Next week"
            >
              <Icon name="chevron-forward" size="md" color={C.primaryDark} />
            </Pressable>
          </View>

          {loading || error ? (
            <ListState loading={loading} error={error} onRetry={refetch} empty={false}>
              {null}
            </ListState>
          ) : (
            <PlannerWeekGrid weekStartIso={weekStart} blocks={searched} todayIso={today} onPressBlock={pressBlock} />
          )}
        </View>
      </Screen>
    );
  }

  const chrome = (
    <View style={s.chrome}>
      {topChrome}

      <View style={s.sectionHead}>
        <Text style={TYPE.label}>My Tasks</Text>
        <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={HIT_SLOP}>
          <Text style={s.link}>{showAll ? "Show less" : "See All"}</Text>
        </Pressable>
      </View>
      {!showAll ? <HorizontalChipBar items={TABS} value={tab} onChange={setTab} label="Planner range" /> : null}
    </View>
  );

  return (
    <Screen role="student" scroll={false} tabScreen scope="student/planner" contentStyle={s.flush} refreshing={loading} onRefresh={refetch}>
      <AppList
        data={loading || error ? NO_ROWS : rows}
        renderRow={renderRow}
        header={chrome}
        footer={
          <ListState
            loading={loading}
            error={error}
            empty={!loading && rows.length === 0}
            onRetry={refetch}
            emptyIcon="calendar-outline"
            emptyTitle="Nothing here yet"
            emptyMessage="Add a plan, or wait for your instructors to post an assignment or quiz."
          >
            {null}
          </ListState>
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  flush: { paddingTop: 0 },
  chrome: { paddingTop: SPACE.md + 2, paddingBottom: SPACE.md + 2, gap: SPACE.md + 2 },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: 46,
    paddingHorizontal: SPACE.lg - 2,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.lg,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontFamily: FONT.regular, paddingVertical: SPACE.sm },
  carousel: { gap: SPACE.md, paddingRight: SPACE.lg },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: { ...TYPE.label, color: C.primary },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
