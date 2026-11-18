// // home.tsx

// import { useRouter } from "expo-router";
// import { StyleSheet, Text, View } from "react-native";

// import {
//   ListCard,
//   QuickAction,
//   SectionHeader,
//   StatCard,
//   t,
// } from "@/shared/components/ui/parts";
// import { Screen } from "@/shared/components/ui/screen";
// import { C } from "@/shared/constants/studia-colors";
// // TODO(refactor): route through data/ layer
// import { INSTRUCTOR_CLASSES } from "@/core/data/mock/mock-data";
// import { greetName, useRoleUser } from "@/core/data/storage/session-store";

// export default function InstructorHome() {
//   const user = useRoleUser("instructor");
//   const router = useRouter();

//   return (
//     <Screen role="instructor">
//       <View>
//         <Text style={t.muted}>Welcome back</Text>
//         <Text style={t.h1}>
//           {user ? greetName(user) : "Prof. Maria Santos"}
//         </Text>
//       </View>

//       <View style={s.statsRow}>
//         <StatCard label="Classes" value={4} />
//         <StatCard label="Students" value={128} />
//         <StatCard label="To Grade" value={12} tone="orange" />
//       </View>

//       <View style={s.qaRow}>
//         <QuickAction
//           icon="people-outline"
//           label="My Classes"
//           onPress={() => router.push("/instructor/classes")}
//         />
//         <QuickAction
//           icon="create-outline"
//           label="Create Quiz"
//           onPress={() => router.push("/instructor/assessments")}
//         />
//         <QuickAction
//           icon="bar-chart-outline"
//           label="Gradebook"
//           onPress={() => router.push("/instructor/assessments")}
//         />
//         <QuickAction
//           icon="sparkles-outline"
//           label="AI Quiz"
//           onPress={() => router.push("/instructor/assessments")}
//         />
//       </View>

//       <ListCard
//         icon="document-text-outline"
//         title="Needs Grading"
//         meta="12 submissions · Quiz 2, IT 321 · Due for review today"
//         iconBg={`${C.orange}26`}
//         iconColor={C.orange}
//         style={{ backgroundColor: `${C.orange}14` }}
//         onPress={() => router.push("/instructor/assessments")}
//       />

//       <SectionHeader
//         title="My Classes"
//         action="View All"
//         onAction={() => router.push("/instructor/classes")}
//       />
//       {INSTRUCTOR_CLASSES.slice(0, 2).map((c) => (
//         <ListCard
//           key={c.id}
//           icon="book-outline"
//           eyebrow={`${c.code} · ${c.section}`}
//           title={c.title}
//           meta={`${c.students} students`}
//           onPress={() =>
//             router.push({
//               pathname: "/instructor/class-detail",
//               params: { id: c.id },
//             })
//           }
//         />
//       ))}
//     </Screen>
//   );
// }

// const s = StyleSheet.create({
//   statsRow: { flexDirection: "row", gap: 10 },
//   qaRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     flexWrap: "wrap",
//     rowGap: 10,
//     paddingVertical: 4,
//   },
// });

// import { useRouter } from "expo-router";
// import { StyleSheet, Text, View } from "react-native";

// import {
//   EmptyState,
//   ListCard,
//   Page,
//   QuickAction,
//   SectionHeader,
//   StatCard,
// } from "@/features/instructor/components/instructor-ui";
// import { useInstructorClasses, useInstructorStats } from "@/features/instructor/data/instructor-store";
// import { plural, timeAgo } from "@/features/instructor/logic/format";
// import { greetName, useRoleUser } from "@/core/data/storage/session-store";
// import { Screen } from "@/shared/components/ui/screen";
// import { C } from "@/shared/constants/studia-colors";

// export default function InstructorHomeScreen() {
//   const user = useRoleUser("instructor");
//   const router = useRouter();
//   const classes = useInstructorClasses();
//   const { classCount, studentCount, pendingCount, nextGrading } = useInstructorStats();

//   const openGrading = () =>
//     router.push(
//       nextGrading
//         ? { pathname: "/instructor/grading", params: { quizId: nextGrading.quizId } }
//         : "/instructor/grading",
//     );

//   return (
//     <Screen role="instructor">
//       <Page>
//         {/* 1. Greeting */}
//         <View>
//           <Text style={s.muted}>Welcome back</Text>
//           <Text style={s.h1} numberOfLines={2}>{user ? greetName(user) : "Instructor"}</Text>
//         </View>

//         {/* 2. Overview numbers (derived from data, tappable) */}
//         <View style={s.statsRow}>
//           <StatCard label="Classes" value={classCount} onPress={() => router.push("/instructor/classes")} />
//           <StatCard label="Students" value={studentCount} onPress={() => router.push("/instructor/classes")} />
//           <StatCard label="To Grade" value={pendingCount} tone={pendingCount > 0 ? "orange" : "green"} onPress={openGrading} />
//         </View>

//         {/* 3. What needs action right now */}
//         {nextGrading ? (
//           <ListCard
//             icon="document-text-outline"
//             tone="orange"
//             title="Needs Grading"
//             meta={`${plural(pendingCount, "submission")} · ${nextGrading.quizTitle}, ${nextGrading.classCode} · Oldest ${timeAgo(nextGrading.oldestAt)}`}
//             onPress={openGrading}
//           />
//         ) : (
//           <ListCard
//             icon="checkmark-circle-outline"
//             tone="green"
//             title="All caught up"
//             meta="No submissions waiting for review."
//             onPress={() => router.push("/instructor/gradebook")}
//           />
//         )}

//         {/* 4. Shortcuts, color coded by purpose */}
//         <SectionHeader title="Quick actions" />
//         <View style={s.qaRow}>
//           <QuickAction icon="people-outline" label="My Classes" tone="primary" onPress={() => router.push("/instructor/classes")} />
//           <QuickAction icon="create-outline" label="Create Quiz" tone="blue" onPress={() => router.push("/instructor/create-quiz")} />
//           <QuickAction icon="bar-chart-outline" label="Gradebook" tone="green" onPress={() => router.push("/instructor/gradebook")} />
//           <QuickAction icon="sparkles-outline" label="AI Quiz" tone="gold" onPress={() => router.push("/instructor/ai-quiz")} />
//         </View>

//         {/* 5. Classes */}
//         <SectionHeader title="My Classes" action="View All" onAction={() => router.push("/instructor/classes")} />
//         {classes.length === 0 ? (
//           <EmptyState icon="school-outline" title="No classes yet" message="Classes assigned to you will show up here." />
//         ) : (
//           classes.slice(0, 2).map((c) => (
//             <ListCard
//               key={c.id}
//               icon="book-outline"
//               eyebrow={`${c.code} · ${c.section}`}
//               title={c.title}
//               meta={plural(c.students, "student")}
//               onPress={() => router.push({ pathname: "/instructor/class-detail", params: { id: c.id } })}
//             />
//           ))
//         )}
//       </Page>
//     </Screen>
//   );
// }

// const s = StyleSheet.create({
//   h1: { fontSize: 26, fontWeight: "800", color: C.text },
//   muted: { fontSize: 14, color: C.muted },
//   statsRow: { flexDirection: "row", gap: 10 },
//   qaRow: { flexDirection: "row", alignItems: "flex-start" },
// });
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  EmptyState,
  ListCard,
  Page,
  QuickAction,
  SectionHeader,
  StatCard,
} from "@/features/instructor/components/instructor-ui";
import { useInstructorClasses, useInstructorStats } from "@/features/instructor/data/instructor-store";
import { plural, timeAgo } from "@/features/instructor/logic/format";
import { greetName, useRoleUser } from "@/core/data/storage/session-store";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";

export default function InstructorHomeScreen() {
  const user = useRoleUser("instructor");
  const router = useRouter();
  const classes = useInstructorClasses();
  const { classCount, studentCount, pendingCount, nextGrading } = useInstructorStats();

  const openGrading = () =>
    router.push(
      nextGrading
        ? { pathname: "/instructor/grading", params: { quizId: nextGrading.quizId } }
        : "/instructor/grading",
    );

  return (
    <Screen role="instructor">
      <Page>
        {/* 1. Greeting */}
        <View>
          <Text style={s.muted}>Welcome back</Text>
          <Text style={s.h1} numberOfLines={2}>{user ? greetName(user) : "Instructor"}</Text>
        </View>

        {/* 2. Overview numbers (derived from data, tappable) */}
        <View style={s.statsRow}>
          <StatCard label="Classes" value={classCount} onPress={() => router.push("/instructor/classes")} />
          <StatCard label="Students" value={studentCount} onPress={() => router.push("/instructor/classes")} />
          <StatCard label="To Grade" value={pendingCount} tone={pendingCount > 0 ? "orange" : "green"} onPress={openGrading} />
        </View>

        {/* 3. What needs action right now */}
        {nextGrading ? (
          <ListCard
            icon="document-text-outline"
            tone="orange"
            title="Needs Grading"
            meta={`${plural(pendingCount, "submission")} · ${nextGrading.quizTitle}, ${nextGrading.classCode} · Oldest ${timeAgo(nextGrading.oldestAt)}`}
            onPress={openGrading}
          />
        ) : (
          <ListCard
            icon="checkmark-circle-outline"
            tone="green"
            title="All caught up"
            meta="No submissions waiting for review."
            onPress={() => router.push("/instructor/gradebook")}
          />
        )}

        {/* 4. Shortcuts, color coded by purpose */}
        <SectionHeader title="Quick actions" />
        <View style={s.qaRow}>
          <QuickAction icon="people-outline" label="My Classes" tone="primary" onPress={() => router.push("/instructor/classes")} />
          <QuickAction icon="create-outline" label="Create Quiz" tone="blue" onPress={() => router.push("/instructor/create-quiz")} />
          <QuickAction icon="bar-chart-outline" label="Gradebook" tone="green" onPress={() => router.push("/instructor/gradebook")} />
          <QuickAction icon="sparkles-outline" label="AI Quiz" tone="gold" onPress={() => router.push("/instructor/ai-quiz")} />
        </View>

        {/* 5. Classes */}
        <SectionHeader title="My Classes" action="View All" onAction={() => router.push("/instructor/classes")} />
        {classes.length === 0 ? (
          <EmptyState icon="school-outline" title="No classes yet" message="Classes assigned to you will show up here." />
        ) : (
          classes.slice(0, 2).map((c) => (
            <ListCard
              key={c.id}
              icon="book-outline"
              eyebrow={`${c.code} · ${c.section}`}
              title={c.title}
              meta={plural(c.students, "student")}
              onPress={() => router.push({ pathname: "/instructor/class-detail", params: { id: c.id } })}
            />
          ))
        )}
      </Page>
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: "800", color: C.text },
  muted: { fontSize: 14, color: C.muted },
  statsRow: { flexDirection: "row", gap: 10 },
  qaRow: { flexDirection: "row", alignItems: "flex-start" },
});