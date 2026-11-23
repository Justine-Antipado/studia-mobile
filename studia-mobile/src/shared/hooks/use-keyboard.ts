// use-keyboard.ts — "is the soft keyboard on screen right now?"
// Used to free the little room the keyboard leaves (the AI quick-chat chips hide, E3).
// `keyboardWillShow/Hide` on iOS so the UI moves with the animation; Android only fires `did*`.
import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
