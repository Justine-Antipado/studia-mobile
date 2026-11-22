// index.tsx

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/shared/components/ui/app-button";
import { C, SPLASH_GRADIENT } from "@/shared/constants/studia-colors";

const BUILDING = require("@/assets/images/omsu.jpg");
const LOGO = require("@/assets/images/omsc.logo.png");
const STUDIA_LOGO = require("@/assets/images/studia-mobile-logo.png");
const MASCOT = require("@/assets/images/studia-mascot.png");

export default function WelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Walang useFonts dito: ang _layout.tsx na ang nag-gate ng rendering.

  const compact = height < 700; // maliliit na phone
  const mascotSize = Math.min(width * 0.85, height * 0.4, 360);
  const logoSize = compact ? 64 : 80;

  // push (not replace) so Back returns to the welcome screen.
  const handleGetStarted = () => router.push("/explore");
  const handleLearnMore = () => router.push("/learn-more");

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* Layer 1: building photo (decorative) */}
      <Image
        source={BUILDING}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        priority="high"
        accessible={false}
      />

      {/* Layer 2: gradient overlay */}
      <LinearGradient
        colors={[...SPLASH_GRADIENT.colors]}
        locations={[...SPLASH_GRADIENT.locations]}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 3: content */}
      <View
        style={[
          s.safe,
          {
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
        ]}
      >
        <View style={[s.hero, { marginTop: compact ? 16 : 44 }]}>
          <View style={s.logoRow}>
            <Image
              source={LOGO}
              style={{ width: logoSize, height: logoSize }}
              contentFit="contain"
              alt="OMSC logo"
            />
            <View style={s.logoDivider} />
            <Image
              source={STUDIA_LOGO}
              style={{ width: logoSize, height: logoSize }}
              contentFit="contain"
              alt="Studia logo"
            />
          </View>
          <Text style={[s.title, compact && s.titleCompact]}>OMSU</Text>
          <Text style={[s.subtitle, compact && s.subtitleCompact]}>AI-LMS</Text>
          <Text style={s.tagline}>
            AI-Powered Mobile Learning{"\n"}Management System
          </Text>
        </View>

        <View style={s.mascotWrap}>
          <View
            style={[
              s.mascotGlow,
              {
                width: mascotSize * 0.88,
                height: mascotSize * 0.88,
                borderRadius: mascotSize * 0.44,
              },
            ]}
          />
          {/* Lumiliit kapag maliit ang espasyo, hindi lalampas sa mascotSize */}
          <Image
            source={MASCOT}
            style={{ height: "100%", maxHeight: mascotSize, aspectRatio: 1 }}
            contentFit="contain"
            alt="Studia mascot"
          />
        </View>

        <View style={s.actions}>
          <AppButton label="Get Started" onPress={handleGetStarted} />
          <AppButton
            label="Learn More"
            variant="secondary"
            onPress={handleLearnMore}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  safe: { flex: 1, paddingHorizontal: 24 },

  hero: { alignItems: "center", gap: 4 },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginBottom: 14,
  },
  logoDivider: {
    width: 2,
    height: 52,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  title: {
    color: C.white,
    fontSize: 44,
    lineHeight: 58,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 1,
  },
  titleCompact: { fontSize: 36, lineHeight: 48 },
  subtitle: {
    color: C.white,
    fontSize: 28,
    lineHeight: 38,
    fontFamily: "Poppins_700Bold",
  },
  subtitleCompact: { fontSize: 24, lineHeight: 32 },
  tagline: {
    color: C.white,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
    fontFamily: "Poppins_400Regular",
  },

  mascotWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  mascotGlow: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  actions: { gap: 12 },
});
