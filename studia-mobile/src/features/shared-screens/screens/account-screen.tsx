// account-screen.tsx — one implementation, role-aware via `role` (profile comes from
// useRoleUser(role)). Sub-pages (edit profile, change password, ...) are a later phase; entries
// below are placeholders until those routes exist.
import { useState } from "react";
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import Constants from "expo-constants";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { displayName, tagLabel, useRoleUser } from "@/core/data/storage/session-store";
import { mockDb } from "@/core/data/mock/mock-db";
import { clearAllCaches, signOut, switchUser } from "@/core/logic/sign-out";
import type { Role } from "@/core/types/role";
import { Avatar } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { Icon } from "@/shared/components/ui/icon";
import { ListRow } from "@/shared/components/ui/list-row";
import { PageTitle } from "@/shared/components/ui/page-title";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";

export function AccountScreen({ role }: { role: Role }) {
  const user = useRoleUser(role);
  const router = useSafeRouter();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  if (!user) return null;

  const logout = () => {
    // signOut() also clears the query + image caches, so the next account never sees this one's
    // classes, grades or avatars. Navigation happens immediately; the purge finishes behind it.
    void signOut();
    // Goes straight to the auth screen, carrying the role so it can open on the right tab.
    router.replace({ pathname: "/auth", params: { role } });
  };

  const switchDemoRole = () => {
    if (role === "instructor") {
      void switchUser({
        role: "student",
        fullName: "Juan Dela Cruz",
        email: "juan.delacruz@omsu.edu.ph",
        course: "BSIT",
        year: "3",
        section: "A",
      });
      router.replace("/student/home");
    } else {
      void switchUser({
        role: "instructor",
        fullName: "Maria Santos",
        email: "maria.santos@omsu.edu.ph",
        department: "IT Department",
      });
      router.replace("/instructor/home");
    }
  };

  return (
    <Screen role={role} scope={`${role}/account`}>
      <PageTitle title="Account" />
      <View style={s.profileCard}>
        <Avatar name={displayName(user)} uri={user.avatarUri} size={60} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={TYPE.h1} numberOfLines={2}>
            {displayName(user)}
          </Text>
          <Text style={TYPE.muted} numberOfLines={1}>
            {user.email}
          </Text>
          <View style={{ alignSelf: "flex-start", marginTop: 2 }}>
            <Badge label={tagLabel(user)} />
          </View>
        </View>
      </View>

      <ListRow
        icon="person-outline"
        title="Personal Information"
        subtitle="Name, section, mobile"
        onPress={() => router.push(`/${role}/account-personal`)}
      />
      <ListRow
        icon="lock-closed-outline"
        title="Password"
        subtitle="Change with email OTP"
        onPress={() => router.push(`/${role}/account-password`)}
      />
      <ListRow
        icon="shield-checkmark-outline"
        title="Privacy Policy"
        subtitle="Read how data is used"
        onPress={() => router.push(`/${role}/account-privacy`)}
      />
      <ListRow
        icon="information-circle-outline"
        title="About Application"
        subtitle={`STUDIA Mobile v${Constants.expoConfig?.version ?? "1.0.0"}`}
        onPress={() => router.push(`/${role}/account-about`)}
      />
      <ListRow
        icon="camera-outline"
        title="Change Profile Photo"
        subtitle="Camera, gallery or remove"
        onPress={() => router.push(`/${role}/account-photo`)}
      />
      {__DEV__ ? (
      <ListRow
        icon="swap-horizontal-outline"
        title={`Switch to ${role === "instructor" ? "Student" : "Instructor"} View`}
        subtitle="Preview other role UI"
        iconBg={`${C.blue}1F`}
        iconColor={C.blue}
        onPress={switchDemoRole}
      />
      ) : null}
      {__DEV__ ? (
        <ListRow
          icon="refresh-outline"
          title="Reset mock data"
          subtitle="Restore the seeded classes, assignments and submissions"
          onPress={() => {
            mockDb.reset();
            void clearAllCaches();
          }}
        />
      ) : null}

      <Pressable
        onPress={() => setConfirmingLogout(true)}
        style={s.logoutCard}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <View style={s.logoutIcon}>
          <Icon name="log-out-outline" size="lg" color={C.red} />
        </View>
        <Text style={s.logoutText}>Log out</Text>
      </Pressable>

      <ConfirmDialog
        visible={confirmingLogout}
        title="Log out?"
        message="You'll need to sign in again to access your account."
        icon="log-out-outline"
        confirmLabel="Log out"
        onConfirm={logout}
        onCancel={() => setConfirmingLogout(false)}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.white,
    borderRadius: RADIUS.xxl,
    padding: SPACE.lg,
    ...SHADOW.card,
  },
  logoutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    backgroundColor: C.white,
    borderRadius: RADIUS.xl,
    padding: SPACE.lg - 2,
    ...SHADOW.card,
  },
  logoutIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: `${C.red}1A`,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { color: C.red, fontSize: 15, fontFamily: "Poppins_700Bold" },
});
