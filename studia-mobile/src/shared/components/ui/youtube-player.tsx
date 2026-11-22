// youtube-player.tsx — plays a YouTube lesson video inside the app (YouTube's own embedded player).
// Safety: the WebView never loads an instructor-supplied URL. It renders ONE fixed HTML page whose only
// variable is the video id, which must match YouTube's 11-character format first, and navigation is
// locked to the YouTube embed so nothing else can load inside the app. Anything else is opened by
// the system by the caller ("Watch on YouTube").
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { C } from "@/shared/constants/studia-colors";
import { RADIUS } from "@/shared/constants/tokens";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const isYoutubeId = (id: string | null | undefined): id is string => !!id && VIDEO_ID.test(id);

const EMBED_HOST = "https://www.youtube.com";

function html(videoId: string, startSec: number, autoplay: boolean): string {
  const params = `playsinline=1&rel=0&modestbranding=1&fs=1&start=${Math.max(0, Math.floor(startSec))}&autoplay=${autoplay ? 1 : 0}`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="${EMBED_HOST}/embed/${videoId}?${params}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`;
}

function YoutubePlayerBase({
  videoId,
  startSec = 0,
  autoplay = false,
  onError,
}: {
  videoId: string;
  /** Changing this reloads the player at that second (used by the transcript timestamps). */
  startSec?: number;
  autoplay?: boolean;
  onError?: () => void;
}) {
  const source = useMemo(() => ({ html: html(videoId, startSec, autoplay), baseUrl: EMBED_HOST }), [videoId, startSec, autoplay]);
  return (
    <View style={s.box}>
      <WebView
        key={`${videoId}:${startSec}`}
        source={source}
        style={s.web}
        originWhitelist={[EMBED_HOST, "about:*"]}
        javaScriptEnabled
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={!autoplay}
        setSupportMultipleWindows={false}
        // Only the YouTube embed (and the first about:blank/base load) may load; links inside the player do not navigate the app.
        onShouldStartLoadWithRequest={(req) => req.url.startsWith(`${EMBED_HOST}/embed/`) || req.url.startsWith("about:")}
        onError={onError}
        onHttpError={onError}
        accessibilityLabel="Lesson video"
      />
    </View>
  );
}

export const YoutubePlayer = memo(YoutubePlayerBase);

const s = StyleSheet.create({
  box: { aspectRatio: 16 / 9, borderRadius: RADIUS.xxl, overflow: "hidden", backgroundColor: C.primaryDark },
  web: { flex: 1, backgroundColor: "transparent" },
});
