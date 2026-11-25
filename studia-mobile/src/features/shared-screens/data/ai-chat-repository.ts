// ai-chat-repository.ts — STUDIA AI chat. The reply comes from studia-api (api/ai/chat), which holds
// the AI key, applies a per-user hourly limit and stores the thread in ai_chat_messages.
import { z } from "zod";

import type { Result } from "@/core/data/errors/app-error";
import { ok } from "@/core/data/errors/app-error";
import { callAi } from "@/core/data/supabase/ai-api";

export type ChatReply = { threadId: string; reply: string };

export interface AiChatRepository {
  /**
   * Sends `message`; `threadId` groups one conversation.
   *
   * The history is NOT sent: the server reads the thread back from `ai_chat_messages`. Passing it
   * from here meant the request could claim the AI had said something it never said, and the claim
   * was then stored as part of the conversation.
   */
  send(input: { threadId: string | null; message: string }): Promise<Result<ChatReply>>;
}

const Reply = z.object({ threadId: z.string(), reply: z.string() });

class RemoteAiChatRepository implements AiChatRepository {
  async send({ threadId, message }: { threadId: string | null; message: string }) {
    const res = await callAi("chat", { ...(threadId ? { threadId } : {}), message }, Reply);
    return res.ok ? ok(res.value) : res;
  }
}

export const aiChatRepository: AiChatRepository = new RemoteAiChatRepository();
