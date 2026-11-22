// ai-chat-repository.ts — STUDIA AI chat. The reply comes from studia-api (api/ai/chat), which holds
// the AI key, applies a per-user hourly limit and stores the thread in ai_chat_messages.
import { z } from "zod";

import type { Result } from "@/core/data/errors/app-error";
import { ok } from "@/core/data/errors/app-error";
import { callAi } from "@/core/data/supabase/ai-api";

export type ChatTurn = { from: "user" | "ai"; text: string };
export type ChatReply = { threadId: string; reply: string };

export interface AiChatRepository {
  /** Sends `message` with the recent `history` (oldest first). `threadId` groups one conversation. */
  send(input: { threadId: string | null; message: string; history: ChatTurn[] }): Promise<Result<ChatReply>>;
}

const Reply = z.object({ threadId: z.string(), reply: z.string() });

const MAX_HISTORY = 12;

class RemoteAiChatRepository implements AiChatRepository {
  async send({ threadId, message, history }: { threadId: string | null; message: string; history: ChatTurn[] }) {
    const res = await callAi(
      "chat",
      { ...(threadId ? { threadId } : {}), message, history: history.slice(-MAX_HISTORY) },
      Reply,
    );
    return res.ok ? ok(res.value) : res;
  }
}

export const aiChatRepository: AiChatRepository = new RemoteAiChatRepository();
