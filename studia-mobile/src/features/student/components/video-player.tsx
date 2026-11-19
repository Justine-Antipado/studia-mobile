// video-player.tsx — the only place a student screen touches expo-video directly.
// Lesson videos have no real hosted file yet (mock backend), so this plays Expo's own public
// sample clip as a stand-in; swapping to the real lecture file means passing its URL here.
import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet } from "react-native";

const SAMPLE_SOURCE = "https://docs.expo.dev/static/videos/BigBuckBunny.mp4";

export function VideoPlayer() {
  const player = useVideoPlayer(SAMPLE_SOURCE, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      style={s.box}
      player={player}
      allowsPictureInPicture
      contentFit="contain"
      nativeControls
    />
  );
}

const s = StyleSheet.create({
  box: { width: "100%", aspectRatio: 16 / 9, borderRadius: 20, backgroundColor: "#000" },
});
