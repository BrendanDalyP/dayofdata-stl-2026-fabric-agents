// Offline fallback, used only when VITE_AGENT_MODE=offline (the venue Wi-Fi died).
// Answers are the SQL-verified results from labs/01-data-agent/verify_answers.sql,
// written the way the live agents answer. Every one says it is a recording.

import type { AgentKey } from "./team";
import { RECORDED } from "./recorded";

export async function offlineAnswer(agent: AgentKey, question: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 1200));
    const note = "\n\n_Recorded answer (offline mode), checked against SQL._";
    const hit = RECORDED.find((r) => r.agent === agent && r.question.toLowerCase() === question.trim().toLowerCase());
    if (hit) return hit.answer + note;
    return "I'm in **offline mode**, so I can only replay answers recorded during rehearsal. Pick one of the suggested questions." + note;
}
