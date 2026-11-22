// video-link-card.tsx — how a lesson VIDEO is shown: it is a link, not a file.
//   YouTube  -> thumbnail we build from the validated video id + "Watch on YouTube"
//   other    -> a link card with the host name + "Open link"
// The link is opened by the system (YouTube app / browser). It is never rendered in a WebView, so
// an instructor-supplied URL cannot run anything inside the app.
import * as WebBrowser from "expo-web-browser";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import type { VideoLink } from "@/core/types/content";
import { ActionButton } from "@/shared/components/ui/action-button";
import { AppImage } from "@/shared/components/ui/app-image";
import { Icon } from "@/shared/components/ui/icon";
import { useToast } from "@/shared/components/ui/toast";
import { C, OVERLAY } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { youtubeThumbnail } from "@/shared/utils/video-link";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
};

export function VideoLinkCard({ link }: { link: VideoLink }) {
  const toast = useToast();
  const isYoutube = link.provider === "youtube" && !!link.videoId;

  const open = async () => {
    try {
      // The YouTube app (or the default browser) handles it; fall back to the in-app browser tab.
      await Linking.openURL(link.url);
    } catch {
      try {
        await WebBrowser.openBrowserAsync(link.url);
      } catch {
        toast.show("Could not open the link.", { tone: "red" });
      }
    }
  };

  return (
    <View style={s.wrap}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={isYoutube ? "Play video on YouTube" : `Open link on ${hostOf(link.url)}`}
        style={s.media}
      >
        {isYoutube ? (
          <AppImage source={youtubeThumbnail(link.videoId!)} aspectRatio={16 / 9} radius={RADIUS.xxl} placeholder={C.primaryDark} />
        ) : (
          <View style={s.plain}>
            <Icon name="link-outline" size="lg" color={C.white} />
            <Text style={s.host} numberOfLines={1}>
              {hostOf(link.url)}
            </Text>
          </View>
        )}
        {isYoutube ? (
          <View style={s.playBadge} pointerEvents="none">
            <Icon name="play" size="lg" color={C.white} />
          </View>
        ) : null}
      </Pressable>
      <ActionButton
        label={isYoutube ? "Watch on YouTube" : "Open link"}
        icon={isYoutube ? "logo-youtube" : "open-outline"}
        variant="secondary"
        onPress={open}
      />
      {!isYoutube ? <Text style={TYPE.caption}>This opens outside the app.</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  media: { borderRadius: RADIUS.xxl, overflow: "hidden", backgroundColor: C.primaryDark },
  plain: {
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    backgroundColor: C.primaryDark,
  },
  host: { color: C.white, fontFamily: FONT.semibold, fontSize: 13 },
  playBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 56,
    height: 56,
    marginTop: -28,
    marginLeft: -28,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: OVERLAY.tile,
  },
});
