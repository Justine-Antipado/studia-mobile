// components/shared-screens.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton, Avatar, IconBox, ListCard, Pill, shadow, t } from "@/components/ui/parts";
import { Screen } from "@/components/ui/screen";
import { C } from "@/constants/studia-colors";
import { CHAT_CONFIG, mockReply } from "@/lib/mock-data";
import { displayName, setUser, tagLabel, useRoleUser } from "@/lib/session-store";
import type { Role } from "@/services/auth-service";

/* ---------------- AI Assistant Screen ---------------- */

export function AiAssistantScreen({ role }: { role: Role }) {
  const cfg = CHAT_CONFIG[role];
  const [messages, setMessages] = useState(cfg.seed);
  const [input, setInput] = useState("");

  const send = (textToSend?: string) => {
    const q = (textToSend ?? input).trim();
    if (!q) return;
    const userMsg = { id: String(Date.now()), from: "user" as const, text: q };
    const aiMsg = { id: String(Date.now() + 1), from: "ai" as const, text: mockReply(role, q) };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    if (!textToSend) setInput("");
  };

  return (
    <Screen role={role} scroll={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header Title */}
        <View style={s.aiHeader}>
          <View style={s.aiAvatar}>
            <Ionicons name="sparkles" size={18} color={C.white} />
          </View>
          <View>
            <Text style={t.h2}>STUDIA AI</Text>
            <Text style={t.muted}>{cfg.subtitle}</Text>
          </View>
        </View>

        {/* Messages */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.chatList} showsVerticalScrollIndicator={false}>
          {messages.map((m) => {
            const isUser = m.from === "user";
            return (
              <View key={m.id} style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
                {!isUser && (
                  <View style={s.aiBadge}>
                    <Ionicons name="sparkles-outline" size={12} color={C.primary} />
                    <Text style={s.aiBadgeText}>AI-generated</Text>
                  </View>
                )}
                <Text style={[s.msgText, isUser ? { color: C.white } : { color: C.text }]}>{m.text}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Suggestions & Input */}
        <View style={s.bottomArea}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {cfg.suggestions.map((sug) => (
              <Pressable key={sug} onPress={() => send(sug)} style={s.sugChip}>
                <Text style={s.sugText}>{sug}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={s.inputRow}>
            <View style={s.inputBox}>
              <Ionicons name="document-text-outline" size={18} color={C.muted} />
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Message STUDIA AI..."
                placeholderTextColor={C.muted}
                style={s.input}
                onSubmitEditing={() => send()}
              />
            </View>
            <Pressable onPress={() => send()} style={s.sendBtn}>
              <Ionicons name="send" size={18} color={C.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    router.replace("/auth"); // Palitan ng path ng iyong login screen kung kailangan
  };

  // Helper para ma-preview agad ang kabilang role habang nagde-develop
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
      {/* Profile Card */}
      <View style={s.profileCard}>
        <Avatar name={name} size={60} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={t.h1}>{name}</Text>
          <Text style={t.muted}>{user.email}</Text>
          <View style={{ alignSelf: "flex-start", marginTop: 2 }}>
            <Pill text={tag} tone="purple" />
          </View>
        </View>
      </View>

      {/* Menu Items */}
      <ListCard icon="person-outline" title="Personal Information" meta="Name, section, mobile" onPress={() => Alert.alert("Personal Info", "Edit profile details")} />
      <ListCard icon="lock-closed-outline" title="Password" meta="Change with email OTP" onPress={() => Alert.alert("Password", "Send OTP to email")} />
      <ListCard icon="shield-checkmark-outline" title="Privacy Policy" meta="Read how data is used" onPress={() => {}} />
      <ListCard icon="information-circle-outline" title="About Application" meta="STUDIA Mobile v1.0.0" onPress={() => {}} />
      <ListCard icon="camera-outline" title="Change Profile" meta="Camera, gallery or remove" onPress={() => {}} />

      {/* Dev Role Switcher (Para madaling lumipat sa pagitan ng Student at Instructor) */}
      <ListCard
        icon="swap-horizontal-outline"
        title={`Switch to ${role === "instructor" ? "Student" : "Instructor"} View`}
        meta="Preview other role UI"
        iconBg={`${C.blue}1F`}
        iconColor={C.blue}
        onPress={switchDemoRole}
      />

      {/* Logout Button */}
      <Pressable onPress={handleLogout} style={s.logoutCard}>
        <View style={s.logoutIcon}>
          <Ionicons name="log-out-outline" size={20} color={C.red} />
        </View>
        <Text style={s.logoutText}>Log out</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12 },
  aiAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  chatList: { gap: 12, paddingVertical: 8 },
  bubble: { maxWidth: "84%", borderRadius: 18, padding: 14, gap: 6 },
  userBubble: { alignSelf: "flex-end", backgroundColor: C.primary, borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: C.white, borderBottomLeftRadius: 4, ...shadow },
  aiBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.lavenderSoft, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  aiBadgeText: { color: C.primary, fontSize: 10.5, fontFamily: "Poppins_600SemiBold" },
  msgText: { fontSize: 13.5, lineHeight: 20, fontFamily: "Poppins_400Regular" },
  bottomArea: { gap: 10, paddingTop: 8 },
  sugChip: { backgroundColor: C.lavenderSoft, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  sugText: { color: C.primaryDark, fontSize: 12.5, fontFamily: "Poppins_600SemiBold" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.white, borderRadius: 24, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: C.border },
  input: { flex: 1, fontSize: 13.5, color: C.text, fontFamily: "Poppins_400Regular" },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },

  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.white, borderRadius: 20, padding: 16, ...shadow },
  logoutCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderRadius: 18, padding: 14, ...shadow },
  logoutIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: `${C.red}1A`, alignItems: "center", justifyContent: "center" },
  logoutText: { color: C.red, fontSize: 15, fontFamily: "Poppins_700Bold" },
});