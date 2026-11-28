// planner-screen.tsx — Study Planner tab: a priority carousel, then either a flat list (grouped
// into Today / Monthly / Yearly) or a calendar/week grid of every plan/task/exam. Posting an
// assignment or quiz places it here automatically, on its due date; the student can also add their
// own plan (with notes + priority). Any exam dates already on record (no longer addable from the
// app) still show here too.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppList, HorizontalChipBar, ListState, PageTitle, SectionHeader, useToast, Icon } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { FONT, HIT_SLOP, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { addDaysIso, dayLabel, mondayOf, toLocalIso, weekRangeLabel } from "@/features/student/logic/format";
import { queryCache } from "@/core/data/cache/query-cache";
import { AddPlanSheet } from "@/features/student/components/add-plan-sheet";
import { PlannerItemRow } from "@/features/student/components/planner-item-row";
import { PlannerWeekGrid } from "@/features/student/components/planner-week-grid";
import { PriorityTaskCard } from "@/features/student/components/priority-task-card";
import { plannerKey, useMarkBlockDone, usePlanner } from "@/features/student/hooks/use-planner";
import { useToggleTask } from "@/features/student/hooks/use-tasks";
import type { PlannerBlock, PlannerPriority } from "@/features/student/types/student";

type PlannerTab = "Today" | "Weekly" | "Monthly" | "Yearly";
const TABS: PlannerTab[] = ["Today", "Weekly", "Monthly", "Yearly"];
type PlannerView = "List" | "Week";
const VIEWS: PlannerView[] = ["List", "Week"];
/** Stable empty list: the loading / error / empty states are drawn by ListState below the rows. */
const NO_ROWS: PlannerBlock[] = [];
/** Matches the Badge/chip colors used for the same priority everywhere else in the Planner. */
const PRIORITY_CARD_TONE: Record<PlannerPriority, "red" | "blue" | "green"> = {
  high: "red",
  medium: "blue",
  low: "green",
};

function matchesTab(dayIso: string, tab: PlannerTab, today: string): boolean {
  if (tab === "Today") return dayIso === today;
  if (tab === "Weekly") {
    const monday = mondayOf(today);
    return dayIso >= monday && dayIso <= addDaysIso(monday, 6);
  }
  if (tab === "Monthly") return dayIso.slice(0, 7) === today.slice(0, 7);
  return dayIso.slice(0, 4) === today.slice(0, 4);
}

export default function StudentPlanner() {
  const router = useSafeRouter();
  const toast = useToast();
  const { data, loading, error, refetch, mutate } = usePlanner();
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

  const [sheet, setSheet] = useState<{ open: boolean; editingBlock: PlannerBlock | null }>({
    open: false,
    editingBlock: null,
  });
  const openAddPlan = useCallback(() => setSheet({ open: true, editingBlock: null }), []);
  const openEditPlan = useCallback((block: PlannerBlock) => setSheet({ open: true, editingBlock: block }), []);
  const closeSheet = useCallback(() => setSheet((s) => ({ ...s, open: false })), []);

  // Flips `done` on this one block in the cached planner data immediately, so the checkbox
  // responds right away instead of waiting on a round trip — the server call below still runs,
  // and a failure flips it back and surfaces the real error instead of silently reloading
  // (which used to blank the whole list while it refetched).
  const patchBlockDone = useCallback(
    (id: string, done: boolean) =>
      mutate((current) =>
        current ? { ...current, blocks: current.blocks.map((b) => (b.id === id ? { ...b, done } : b)) } : current!,
      ),
    [mutate],
  );

  // A block whose server row is already gone (deleted elsewhere, or a stale on-device cache from
  // before a reset) is dropped from the list on the spot, quietly: it is a stale row, not an error
  // the student can act on. Otherwise it would fail again on every tap, since a failed write never
  // touches the cache.
  const removeBlock = useCallback(
    (id: string) => mutate((current) => (current ? { ...current, blocks: current.blocks.filter((b) => b.id !== id) } : current!)),
    [mutate],
  );

  const toggleDone = useCallback(
    async (block: PlannerBlock) => {
      const nextDone = !block.done;
      patchBlockDone(block.id, nextDone);
      const result = block.taskId ? await toggleTask.run(block.taskId) : await markDone.run({ id: block.id, done: nextDone });
      if (result.ok) {
        // The server has the last word: a task this cached block still showed as open may already be submitted.
        if (result.value.done !== nextDone) patchBlockDone(block.id, result.value.done);
      } else if (result.error.code === "not_found") {
        removeBlock(block.id);
        queryCache.invalidate(plannerKey);
      } else {
        toast.show(result.error.message, { tone: "red" });
        patchBlockDone(block.id, block.done);
      }
    },
    [toggleTask, markDone, patchBlockDone, removeBlock, toast],
  );

  // A task-derived block has no plan row of its own to edit — its title/date/time come straight
  // from the assignment or quiz the instructor posted — so tapping it opens that instead.
  const openTaskDetail = useCallback(
    (block: PlannerBlock) => {
      if (!block.taskKind || !block.taskClassId || !block.taskRefId) return;
      router.push(
        block.taskKind === "assignment"
          ? { pathname: "/student/assignment-detail", params: { classId: block.taskClassId, id: block.taskRefId } }
          : block.done
            ? { pathname: "/student/quiz-result", params: { classId: block.taskClassId, quizId: block.taskRefId } }
            : { pathname: "/student/quiz-take", params: { classId: block.taskClassId, quizId: block.taskRefId } },
      );
    },
    [router],
  );

  const pressBlock = useCallback(
    (block: PlannerBlock) => {
      if (block.taskId) openTaskDetail(block);
      else openEditPlan(block);
    },
    [openEditPlan, openTaskDetail],
  );

  const priorityCards = useMemo(() => {
    const open = blocks.filter((b) => !b.done).sort((a, b) => a.dayIso.localeCompare(b.dayIso));
    const soonExams = exams.filter((e) => e.dateIso >= today).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    return { open: open.slice(0, 6), exams: soonExams.slice(0, 4) };
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
      <PlannerItemRow block={block} onToggleDone={() => void toggleDone(block)} onPress={() => pressBlock(block)} />
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

      <HorizontalChipBar items={VIEWS} value={view} onChange={setView} label="Planner view" />

      <View style={{ gap: SPACE.sm }}>
        <SectionHeader title="My Priority Task" />
        {priorityCards.open.length > 0 || priorityCards.exams.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
            {priorityCards.open.map((b) => (
              <PriorityTaskCard
                key={b.id}
                title={b.title}
                notes={b.notes}
                dayIso={b.dayIso}
                icon={b.taskId ? "document-text-outline" : "bulb-outline"}
                tone={PRIORITY_CARD_TONE[b.priority]}
                onPress={() => pressBlock(b)}
              />
            ))}
            {priorityCards.exams.map((e) => (
              <PriorityTaskCard
                key={e.id}
                title={e.title}
                notes="Exam"
                dayIso={e.dateIso}
                icon="school-outline"
                tone="red"
                onPress={() => toast.show(`${e.title} — ${dayLabel(e.dateIso)}`)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={s.priorityEmpty}>
            <Icon name="sparkles-outline" size="md" color={C.muted} />
            <Text style={TYPE.muted}>No priority tasks yet.</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (view === "Week") {
    return (
      <Screen
        role="student"
        scope="student/planner"
        contentStyle={s.flush}
        refreshing={loading}
        onRefresh={refetch}
      >
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
            <Pressable
              onPress={() => setWeekStart(mondayOf(today))}
              accessibilityRole="button"
              accessibilityLabel="Jump to this week"
              style={s.weekLabel}
            >
              <Text style={TYPE.h3} numberOfLines={1}>
                {weekRangeLabel(weekStart)}
              </Text>
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

        <AddPlanSheet visible={sheet.open} editingBlock={sheet.editingBlock} onClose={closeSheet} />
      </Screen>
    );
  }

  const chrome = (
    <View style={s.chrome}>
      {topChrome}

      <SectionHeader title="My Tasks" action={showAll ? "Show less" : "See All"} onAction={() => setShowAll((v) => !v)} />
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

      <AddPlanSheet visible={sheet.open} editingBlock={sheet.editingBlock} onClose={closeSheet} />
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
  priorityEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: 64,
    paddingHorizontal: SPACE.lg - 2,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.xl,
  },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekLabel: { flexShrink: 1, paddingHorizontal: SPACE.sm },
});
