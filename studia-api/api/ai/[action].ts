// One function for all AI endpoints (the Vercel Hobby plan allows 12 functions per deployment):
//   POST /api/ai/chat | /api/ai/quiz | /api/ai/summarize
import type { VercelRequest, VercelResponse } from "@vercel/node";
import chat from "../../src/ai/chat.js";
import quiz from "../../src/ai/quiz.js";
import summarize from "../../src/ai/summarize.js";

const HANDLERS = { chat, quiz, summarize } as const;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;
  const run = action && Object.hasOwn(HANDLERS, action) ? HANDLERS[action as keyof typeof HANDLERS] : null;
  if (!run) {
    res.status(404).json({ error: { code: "UNKNOWN", message: "Not found" } });
    return;
  }
  await run(req, res);
}
