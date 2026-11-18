// shared-screens.tsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  Avatar,
  EmptyState,
  IconBox,
  ListCard,
  Pill,
  TabChips,
  shadow,
  t,
  type IconName,
} from "@/components/ui/parts";
import { Screen } from "@/components/ui/screen";
import { C } from "@/constants/studia-colors";
import { CHAT_CONFIG, mockReply } from "@/lib/mock-data";
import {
  displayName,
  setUser,
  tagLabel,
  useRoleUser,
} from "@/lib/session-store";
import type { Role } from "@/services/auth-service";

/* ---------------- AI Assistant Screen ---------------- */

// Gawing true kung Android mo ay naka "resize" at HINDI edge-to-edge
// (OS na ang nagre-resize ng window, kaya hindi na kailangan ng kbPad).
const ANDROID_OS_RESIZES = false;

export function AiAssistantScreen({ role }: { role: Role }) {
  const cfg = CHAT_CONFIG[role];
  const [messages, setMessages] = useState(cfg.seed);
  const [input, setInput] = useState("");
  const listRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const wrapRef = useRef<ComponentRef<typeof View>>(null);
  const [kbPad, setKbPad] = useState(0);
  const kbTop = useRef<number | null>(null); // Y ng taas ng keyboard, null kapag sarado

  // Sukatin kung gaano tinatakpan ng keyboard ang wrapper
  const recalc = () => {
    const top = kbTop.current;
    if (top == null) {
      setKbPad(0);
      return;
    }
    wrapRef.current?.measureInWindow((_x, y, _w, h) => {
      setKbPad(Math.max(0, Math.round(y + h - top)));
    });
  };

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const showEvt = ios ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvt = ios ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvt, (e) => {
      kbTop.current = e.endCoordinates.screenY;
      recalc();
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true }),
      );
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      kbTop.current = null;
      setKbPad(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const id = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(id);
  }, [messages.length]);

  const send = (textToSend?: string) => {
    const q = (textToSend ?? input).trim();
    if (!q) return;
    const userMsg = { id: String(Date.now()), from: "user" as const, text: q };
    const aiMsg = {
      id: String(Date.now() + 1),
      from: "ai" as const,
      text: mockReply(role, q),
    };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    if (!textToSend) setInput("");
  };

  return (
    <Screen role={role} scroll={false} contentStyle={s.aiFixed}>
      {/* <View
        ref={wrapRef}
        collapsable={false}
        onLayout={() => {
          // I-capture ang base bottom habang sarado ang keyboard
          if (kbOpen.current) return;
          wrapRef.current?.measureInWindow((_x, y, _w, h) => {
            baseBottom.current = y + h;
          });
        }}
        style={[s.flex, { paddingBottom: kbPad }]}
      > */}
      <View
        ref={wrapRef}
        collapsable={false}
        onLayout={recalc}
        style={[s.flex, { paddingBottom: kbPad }]}
      >
        <View style={s.aiHeader}>
          <View style={s.aiAvatar}>
            <Ionicons name="sparkles" size={18} color={C.white} />
          </View>
          <View style={s.flex}>
            <Text style={t.h2}>STUDIA AI</Text>
            <Text style={t.muted} numberOfLines={1}>
              {cfg.subtitle}
            </Text>
          </View>
        </View>

        <ScrollView
          ref={listRef}
          style={s.flex}
          contentContainerStyle={s.chatList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {messages.map((m) => {
            const isUser = m.from === "user";
            return (
              <View
                key={m.id}
                style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}
              >
                {!isUser && (
                  <View style={s.aiBadge}>
                    <Ionicons
                      name="sparkles-outline"
                      size={12}
                      color={C.primary}
                    />
                    <Text style={s.aiBadgeText}>AI-generated</Text>
                  </View>
                )}
                <Text style={[s.msgText, { color: isUser ? C.white : C.text }]}>
                  {m.text}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={s.bottomArea}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.sugRow}
            keyboardShouldPersistTaps="handled"
            style={s.sugScroll}
          >
            {cfg.suggestions.map((sug) => (
              <Pressable key={sug} onPress={() => send(sug)} style={s.sugChip}>
                <Text style={s.sugText} numberOfLines={1}>
                  {sug}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={s.inputRow}>
            <View style={s.inputBox}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Message STUDIA AI..."
                placeholderTextColor={C.muted}
                style={s.input}
                multiline
                textAlignVertical="center"
                blurOnSubmit={false}
                returnKeyType="send"
                onSubmitEditing={() => send()}
                accessibilityLabel="Message STUDIA AI"
              />
            </View>
            <Pressable
              onPress={() => send()}
              style={[
                s.sendBtn,
                !input.trim() && { opacity: 1, backgroundColor: C.lavender },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <Ionicons
                name="send"
                size={18}
                color={input.trim() ? C.white : C.primaryDark}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

/* ---------------- Notifications Screen (layout only) ---------------- */

type Notif = {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  time: string;
  unread?: boolean;
  tone?: "orange" | "blue" | "green" | "purple";
  tag?: string;
};

const NOTIFS: Record<Role, Notif[]> = {
  student: [
    {
      id: "1",
      icon: "megaphone-outline",
      title: "Midterm exam schedule",
      meta: "IT 321 · Nov 10–14, 2026",
      time: "2h",
      unread: true,
      tone: "purple",
      tag: "Notice",
    },
    {
      id: "2",
      icon: "document-text-outline",
      title: "Quiz 2 due today",
      meta: "IT 321 · 5:00 PM",
      time: "5h",
      unread: true,
      tone: "orange",
      tag: "Quiz",
    },
    {
      id: "3",
      icon: "bar-chart-outline",
      title: "Quiz 1 graded",
      meta: "You scored 18/20",
      time: "1d",
      tone: "green",
      tag: "Grade",
    },
    {
      id: "4",
      icon: "book-outline",
      title: "New lesson posted",
      meta: "Lesson 3: Network Security Basics",
      time: "2d",
      tone: "blue",
      tag: "Lesson",
    },
  ],
  instructor: [
    {
      id: "1",
      icon: "document-text-outline",
      title: "12 submissions need grading",
      meta: "Quiz 2 · IT 321",
      time: "1h",
      unread: true,
      tone: "orange",
      tag: "Grade",
    },
    {
      id: "2",
      icon: "person-add-outline",
      title: "3 students joined your class",
      meta: "IT 321 · Section A",
      time: "4h",
      unread: true,
      tone: "blue",
      tag: "Class",
    },
    {
      id: "3",
      icon: "sparkles-outline",
      title: "AI quiz is ready to review",
      meta: "Generated from Lesson 3",
      time: "1d",
      tone: "purple",
      tag: "AI",
    },
    {
      id: "4",
      icon: "calendar-outline",
      title: "Midterm exam reminder",
      meta: "Nov 10–14, 2026",
      time: "3d",
      tone: "green",
      tag: "Reminder",
    },
  ],
};

export function NotificationsScreen({ role }: { role: Role }) {
  const [filter, setFilter] = useState<string>("All");
  const [items, setItems] = useState(NOTIFS[role]);
  const unread = items.filter((n) => n.unread).length;
  const shown = filter === "Unread" ? items.filter((n) => n.unread) : items;

  const markAll = () =>
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  const open = (id: string) =>
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n)),
    );

  return (
    <Screen role={role}>
      <View style={s.notifHead}>
        <Text style={[t.h1, s.flex]}>Notifications</Text>
        {unread > 0 && (
          <Pressable onPress={markAll} hitSlop={8} accessibilityRole="button">
            <Text style={s.markAll}>Mark all read</Text>
          </Pressable>
        )}
      </View>
      <TabChips items={["All", "Unread"]} value={filter} onChange={setFilter} />

      {shown.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="You're all caught up"
          sub="New notifications will show up here."
        />
      ) : (
        shown.map((n) => (
          <ListCard
            key={n.id}
            icon={n.icon}
            eyebrow={n.tag}
            title={n.title}
            meta={`${n.meta} · ${n.time}`}
            right={n.unread ? <View style={s.unreadDot} /> : <View />}
            onPress={() => open(n.id)}
          />
        ))
      )}
    </Screen>
  );
}

/* ---------------- Account Screen ---------------- */

export function AccountScreen({ role }: { role: Role }) {
  const user = useRoleUser(role);
  const router = useRouter();
  if (!user) return null;

  const name = displayName(user);
  const tag = tagLabel(user);

  const handleLogout = () => {
    setUser(null);
    // Goes straight to the auth screen, carrying the role so it can open on the right tab.
    router.replace({ pathname: "/auth", params: { role } });
  };

  const switchDemoRole = () => {
    if (role === "instructor") {
      setUser({
        role: "student",
        fullName: "Juan Dela Cruz",
        email: "juan.delacruz@omsu.edu.ph",
        course: "BSIT",
        year: "3",
        section: "A",
      });
      router.replace("/student/home");
    } else {
      setUser({
        role: "instructor",
        fullName: "Maria Santos",
        email: "maria.santos@omsu.edu.ph",
        department: "IT Department",
      });
      router.replace("/instructor/home");
    }
  };

  return (
    <Screen role={role}>
      <View style={s.profileCard}>
        <Avatar name={name} size={60} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={t.h1} numberOfLines={2}>
            {name}
          </Text>
          <Text style={t.muted} numberOfLines={1}>
            {user.email}
          </Text>
          <View style={{ alignSelf: "flex-start", marginTop: 2 }}>
            <Pill text={tag} tone="purple" />
          </View>
        </View>
      </View>

      <ListCard
        icon="person-outline"
        title="Personal Information"
        meta="Name, section, mobile"
        onPress={() => Alert.alert("Personal Info", "Edit profile details")}
      />
      <ListCard
        icon="lock-closed-outline"
        title="Password"
        meta="Change with email OTP"
        onPress={() => Alert.alert("Password", "Send OTP to email")}
      />
      <ListCard
        icon="shield-checkmark-outline"
        title="Privacy Policy"
        meta="Read how data is used"
        onPress={() => {}}
      />
      <ListCard
        icon="information-circle-outline"
        title="About Application"
        meta="STUDIA Mobile v1.0.0"
        onPress={() => {}}
      />
      <ListCard
        icon="camera-outline"
        title="Change Profile"
        meta="Camera, gallery or remove"
        onPress={() => {}}
      />
      <ListCard
        icon="swap-horizontal-outline"
        title={`Switch to ${role === "instructor" ? "Student" : "Instructor"} View`}
        meta="Preview other role UI"
        iconBg={`${C.blue}1F`}
        iconColor={C.blue}
        onPress={switchDemoRole}
      />

      <Pressable
        onPress={handleLogout}
        style={s.logoutCard}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <View style={s.logoutIcon}>
          <Ionicons name="log-out-outline" size={20} color={C.red} />
        </View>
        <Text style={s.logoutText}>Log out</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  aiFixed: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 10,
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  chatList: { gap: 12, paddingVertical: 8, flexGrow: 1 },
  bubble: { maxWidth: "88%", borderRadius: 18, padding: 14, gap: 6 },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: C.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: C.white,
    borderBottomLeftRadius: 4,
    ...shadow,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.lavenderSoft,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiBadgeText: {
    color: C.primary,
    fontSize: 10.5,
    fontFamily: "Poppins_600SemiBold",
  },
  msgText: { fontSize: 13.5, lineHeight: 20, fontFamily: "Poppins_400Regular" },
  bottomArea: { gap: 8, paddingTop: 6 },
  sugScroll: { flexGrow: 0 },
  sugRow: { gap: 8, paddingRight: 8 },
  sugChip: {
    backgroundColor: C.lavenderSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  sugText: {
    color: C.primaryDark,
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  inputBox: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
  },
  input: {
    fontSize: 14,
    color: C.text,
    fontFamily: "Poppins_400Regular",
    paddingVertical: 8,
    minHeight: 28,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  notifHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  markAll: {
    color: C.primary,
    fontSize: 12.5,
    fontFamily: "Poppins_600SemiBold",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    ...shadow,
  },
  logoutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 14,
    ...shadow,
  },
  logoutIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${C.red}1A`,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { color: C.red, fontSize: 15, fontFamily: "Poppins_700Bold" },
});
