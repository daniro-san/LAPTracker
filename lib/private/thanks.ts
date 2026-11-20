// "Share the thanks" (issue 404, D114): the weekly appreciation post an officer writes from the thanks box.
// The officer ticks who is named (this week's list starts ticked); the model drafts it in EN, PT and FR
// from placeholders and plain deeds, never names or numbers; the officer edits it, then copies it for the
// game, posts it to the members' Discord channel (D102's webhook, once per request id, no pings) or puts it
// on the members' board. Nothing is posted on its own, and nobody is ever listed as missing (D75).
import { z } from "zod";

import type { ChatModel } from "../ai/groq";
import { WRITING_LANGUAGES } from "../ai/notice-writing";
import { withNames, writeThanks, type Person } from "../ai/thanks-writing";
import type { Db } from "../db";
import { claimShare, finishShare, takeDown, weekShared, type ShareRow } from "../repo/thanks";
import type { WorkspaceAccess } from "./access";
import { isDay, weekdayIndex } from "./calendar-time";
import { appreciationDay, thanksWeek } from "./fact-trend";
import { settled } from "./features";
import { privateLog } from "./log";
import { discordMessages } from "./notice-formats";
import { postMessages, STUCK_MS, type Channels } from "./notice-publish";
import { NOTICE_LANGUAGES, NOTICE_LIMIT, noticeLength, type NoticeLanguage } from "./notice-rules";

/** The most people one post names. */
export const THANKS_PEOPLE = 40;
/** A name as the roster writes it. */
const NAME = z.string().trim().min(1).max(60);

/** "A few words about them": the officer's own reason for one person (D114). */
export const NOTE_LIMIT = 80;

/**
 * "Draft it for me": who, in order, with what they did and, optionally, the officer's few words about them;
 * and whether it covers last week (a Monday).
 */
export const draftInput = z
  .object({
    people: z
      .array(
        z
          .object({
            name: NAME,
            did: z.array(z.enum(["squad", "ad", "steady"])).max(3),
            note: z.string().trim().max(NOTE_LIMIT).optional(),
          })
          .strict()
          .refine((p) => new Set(p.did).size === p.did.length),
      )
      .min(1)
      .max(THANKS_PEOPLE),
    lastWeek: z.boolean(),
  })
  .strict();
export type DraftInput = z.infer<typeof draftInput>;

/** A Monday as a server day: the week thanked. */
const MONDAY = z.string().refine((d) => isDay(d) && weekdayIndex(d) === 0);
const TEXT = z
  .string()
  .max(NOTICE_LIMIT * 4)
  .refine((t) => noticeLength(t) <= NOTICE_LIMIT);

export const thanksInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("share"),
      target: z.enum(["discord", "board"]),
      week: MONDAY,
      /** The forum post's title and the plain channel's bold first line: "Weekly appreciation · Nov 9–15". */
      title: z.string().trim().min(1).max(100),
      texts: z.partialRecord(z.enum(NOTICE_LANGUAGES), TEXT),
      names: z.array(NAME).max(THANKS_PEOPLE),
      requestId: z.uuid(),
    })
    .strict()
    .refine((s) => Object.values(s.texts).some((t) => t?.trim())),
  z.object({ action: z.literal("take_down"), id: z.number().int().positive() }).strict(),
]);
export type ShareInput = Extract<z.infer<typeof thanksInput>, { action: "share" }>;

/**
 * The post in the three languages, each drafted on its own (one call per language, at once) and the names
 * put back in after the answer. Throws ChatError when the model fails.
 */
export async function draftThanks(
  model: ChatModel,
  input: DraftInput,
  /** How many languages the model did not answer (D126: only those units are given back). */
  onFailed: (n: number) => void = () => undefined,
): Promise<Record<NoticeLanguage, string>> {
  const people: Person[] = input.people.map((p) => ({ did: p.did, note: p.note ?? "" }));
  const names = input.people.map((p) => p.name);
  const texts = await settled(
    WRITING_LANGUAGES.map(async (l) => {
      const draft = await writeThanks(model, l, people, input.lastWeek);
      return [l, withNames(draft, names)] as const;
    }),
    onFailed,
  );
  return Object.fromEntries(texts) as Record<NoticeLanguage, string>;
}

export type ShareResult =
  { ok: true; row: ShareRow } | { ok: false; code: "not_set_up" | "posting" | "recent" | "failed" };

/** An earlier claim of this request id: what it came to. A claim stuck in "posting" counts as failed. */
function earlier(row: ShareRow, now: Date): ShareResult {
  if (row.status === "posted") return { ok: true, row };
  const running = row.status === "posting" && now.getTime() - row.at.getTime() < STUCK_MS;
  return { ok: false, code: running ? "posting" : "failed" };
}

export interface ShareDeps {
  fetch: typeof fetch;
  now: Date;
  channels: Channels;
  /** Each language's name as the post heads it: "English", "Português", "Français". */
  names: Record<NoticeLanguage, string>;
}

/** The written languages, in the usual order, trimmed. */
const written = (texts: ShareInput["texts"]) =>
  NOTICE_LANGUAGES.flatMap((l) => {
    const text = texts[l]?.trim();
    return text ? [[l, text] as const] : [];
  });

/**
 * Shares the post once per request id (D100): to the members' board at once, or to the members' Discord
 * channel, each language under its name, with no mention allowed (D102). A repeat of the request id gets
 * the first one's outcome and posts nothing more; a claim still "posting" after STUCK_MS counts as failed.
 * The same week to the same place within 30 s of another share is refused (`recent`, D102's cooldown).
 */
export async function shareThanks(
  db: Db,
  access: WorkspaceAccess,
  input: ShareInput,
  deps: ShareDeps,
): Promise<ShareResult> {
  const channel = deps.channels.members;
  if (input.target === "discord" && !channel) return { ok: false, code: "not_set_up" };
  const texts = Object.fromEntries(written(input.texts));
  // INVARIANT thanks.share-once: a double tap or a retry with the same request id posts nothing more.
  const claim = await claimShare(db, {
    workspaceId: access.workspaceId,
    requestId: input.requestId,
    target: input.target,
    week: input.week,
    texts,
    names: input.names,
    userId: access.user.id,
    now: deps.now,
  });
  if (claim.kind === "recent") return { ok: false, code: "recent" };
  if (claim.kind === "earlier") return earlier(claim.row, deps.now);
  if (input.target === "board" || !channel) {
    privateLog("thanks.share.board", { languages: Object.keys(texts).length });
    return { ok: true, row: claim.row };
  }
  const sections = written(input.texts).map(([l, text]) => ({ name: deps.names[l], text }));
  const messages = discordMessages(input.title, sections, !channel.forum);
  const { sent } = await postMessages(deps.fetch, channel, input.title, messages);
  const done = sent === messages.length;
  await finishShare(db, claim.row.id, done ? "posted" : "failed");
  privateLog(done ? "thanks.share.discord" : "thanks.share.failed", {
    sent,
    of: messages.length,
  });
  return done
    ? { ok: true, row: { ...claim.row, status: "posted" } }
    : { ok: false, code: "failed" };
}

/**
 * Home's gentle line (D114): on Sunday and Monday (server days), while the week the thanks cover has no
 * Discord or board share yet. The share is only read on those two days.
 */
export async function thanksNudge(db: Db, access: WorkspaceAccess, today: string) {
  if (!appreciationDay(today)) return false;
  return !(await weekShared(db, access.workspaceId, thanksWeek(today)));
}

/** "Take down" on the board's card; false when the id is not this workspace's board share. */
export const takeDownThanks = (db: Db, access: WorkspaceAccess, id: number, now: Date) =>
  takeDown(db, access.workspaceId, id, access.user.id, now);
