// comment-composer.tsx — the "Add a comment" field + Post button, shared by the student and the
// instructor announcement screens. The caller supplies the validator and the async submit.
import { useState } from "react";

import { ActionButton } from "@/shared/components/ui/action-button";
import { FormField } from "@/shared/components/ui/form-field";
import { useToast } from "@/shared/components/ui/toast";

export function CommentComposer({
  validate,
  onSubmit,
  loading,
}: {
  /** Returns an error message, or null when the text is fine. */
  validate: (text: string) => string | null;
  /** Resolves with ok=false and a message when the post failed. */
  onSubmit: (text: string) => Promise<{ ok: true } | { ok: false; error: { message: string } }>;
  loading?: boolean;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const post = async () => {
    const validation = validate(text);
    setFieldError(validation);
    if (validation) return;
    const result = await onSubmit(text.trim());
    if (result.ok) setText("");
    else toast.show(result.error.message, { tone: "red" });
  };

  return (
    <>
      <FormField
        label="Add a comment"
        value={text}
        onChangeText={(t) => {
          setText(t);
          setFieldError(null);
        }}
        placeholder="Write something..."
        multiline
        maxLength={500}
        error={fieldError}
      />
      <ActionButton label="Post comment" icon="send-outline" loading={loading} onPress={post} />
    </>
  );
}
