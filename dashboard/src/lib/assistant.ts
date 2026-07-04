import "server-only";

import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

import { fetchAvailability } from "./availability";
import { fetchCompanyProfile, saveActiveNotice } from "./companyProfile";
import { fetchConversations } from "./conversations";
import { fetchEscalations } from "./escalations";

const MODEL = "gpt-4o";
const MAX_TOOL_ROUNDS = 4;

const SYSTEM_PROMPT =
  "Ты — AI-ассистент владельца в панели Cortège. У тебя две задачи:\n" +
  "1) Отвечать на вопросы владельца о том, как идут дела в его заведении — используй " +
  "get_business_overview, чтобы получить реальные цифры (эскалации, диалоги, свободные даты). " +
  "Никогда не выдумывай цифры от себя.\n" +
  "2) Принимать директивы на естественном языке, которые должны повлиять на то, что клиентский " +
  "бот говорит клиентам — например «у нас акция, скажи клиентам про скидки». В этом случае " +
  "сформулируй короткое чёткое объявление (1-2 предложения) и вызови set_active_notice. Если " +
  "владелец просит убрать объявление — вызови clear_active_notice. Перед тем как менять " +
  "объявление, можешь вызвать get_active_notice, чтобы посмотреть, что сейчас установлено.\n" +
  "Отвечай на русском, дружелюбно и по-деловому, кратко. После вызова set_active_notice или " +
  "clear_active_notice обязательно подтверди владельцу, что именно изменилось.";

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_business_overview",
      description: "Получить актуальные цифры по бизнесу: открытые эскалации, диалоги, свободные даты, последние причины эскалаций.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_notice",
      description: "Получить текущее активное объявление, которое видит клиентский бот (если оно есть).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_active_notice",
      description: "Установить объявление, которое клиентский бот будет учитывать при ответах клиентам.",
      parameters: {
        type: "object",
        properties: { notice: { type: "string", description: "Короткий текст объявления, 1-2 предложения." } },
        required: ["notice"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_active_notice",
      description: "Убрать текущее активное объявление, если оно больше не актуально.",
      parameters: { type: "object", properties: {} },
    },
  },
];

let cachedClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server");
  }
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

async function callTool(tenantId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === "get_business_overview") {
    const [escalations, conversations, availability] = await Promise.all([
      fetchEscalations(tenantId),
      fetchConversations(tenantId),
      fetchAvailability(tenantId),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return {
      openEscalations: escalations.filter((e) => !e.notifiedOwner).length,
      totalEscalations: escalations.length,
      recentEscalationReasons: escalations.slice(0, 5).map((e) => e.reason),
      totalConversations: conversations.length,
      upcomingAvailableDates: availability.filter((a) => a.isAvailable && a.date >= today).map((a) => a.date),
    };
  }
  if (name === "get_active_notice") {
    const profile = await fetchCompanyProfile(tenantId);
    return { activeNotice: profile.activeNotice };
  }
  if (name === "set_active_notice") {
    const notice = String(args.notice ?? "").trim();
    if (!notice) throw new Error("notice must not be empty");
    await saveActiveNotice(tenantId, notice);
    return { ok: true, activeNotice: notice };
  }
  if (name === "clear_active_notice") {
    await saveActiveNotice(tenantId, null);
    return { ok: true, activeNotice: null };
  }
  throw new Error(`Unknown tool: ${name}`);
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateAssistantReply(tenantId: string, history: AssistantMessage[]): Promise<string> {
  const client = getOpenAIClient();
  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.chat.completions.create({ model: MODEL, messages, tools: TOOLS });
    const choice = response.choices[0]?.message;
    if (!choice) {
      throw new Error("OpenAI returned no choices");
    }

    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      return choice.content ?? "";
    }

    messages.push({ role: "assistant", content: choice.content, tool_calls: choice.tool_calls });

    for (const toolCall of choice.tool_calls) {
      if (toolCall.type !== "function") continue;
      const args = JSON.parse(toolCall.function.arguments || "{}");
      let result: unknown;
      try {
        result = await callTool(tenantId, toolCall.function.name, args);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Unknown error" };
      }
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  return "Не удалось обработать запрос за отведённое количество шагов. Попробуйте переформулировать.";
}
