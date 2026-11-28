"use client";

// Alliance settings → Branding (issue 462, D167): the tab title, one of three icons and one of six colours,
// with a preview of the header band. One Save for the card (SaveRow, issue 585). No uploads and no free colour:
// the icon is the alliance badge, the Discord server's icon (read through the bot, served by our own /img
// route) or the desk mark, and each colour keeps the header's wax-paper text at 4.5:1 in light and dark. Every
// control is 44 px or taller; the preview is a plain header strip, not a control.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FIELD } from "@/lib/brand/components/controls";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";
import {
  ACCENTS,
  BRAND_ICONS,
  cleanTitle,
  TITLE_LIMIT,
  titleLength,
  type Accent,
  type BrandIcon,
} from "@/lib/workspace-branding";

import { SaveRow } from "./SaveRow";
import { SIGNED_OUT } from "./SignedOut";

/** What the card starts from: what is saved, and the title an empty field falls back to. */
export interface BrandingView {
  /** The saved title, "" while it is the default. */
  title: string;
  /** The default title: "[TAG] Desk". */
  standard: string;
  icon: BrandIcon;
  accent: Accent;
  badgeId: number | null;
  discordIconHash: string | null;
}

interface Look {
  title: string;
  icon: BrandIcon;
  accent: Accent;
}

const lookOf = (v: BrandingView): Look => ({ title: v.title, icon: v.icon, accent: v.accent });

/** The refusal in words: signed out, a server with no readable icon, too many saves, or anything else. */
function refusal(status: number | undefined, code: string | undefined, t: WorkspaceDictionary) {
  if (status === 401) return SIGNED_OUT;
  if (status === 429) return t["branding.rateLimited"];
  if (code === "no_discord_icon") return t["branding.noDiscordIcon"];
  if (code === "too_long") return t["branding.title.tooLong"];
  return t["branding.failed"];
}

function useBranding(slug: string, view: BrandingView, t: WorkspaceDictionary) {
  const router = useRouter();
  const [look, setLook] = useState(() => lookOf(view));
  const [kept, setKept] = useState(() => lookOf(view));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = (l: Look) => ({ ...l, title: cleanTitle(l.title) });
  const changes = (["title", "icon", "accent"] as const).filter(
    (k) => clean(look)[k] !== clean(kept)[k],
  ).length;
  const change = (next: Partial<Look>) => {
    setSaved(false);
    setLook((l) => ({ ...l, ...next }));
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/w/${slug}/branding`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(look),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { code?: string } | null;
      return setError(refusal(res?.status, body?.code, t));
    }
    const done = (await res.json()) as { title: string; custom: boolean };
    const next = { ...look, title: done.custom ? done.title : "" };
    setKept(next);
    setLook(next);
    setSaved(true);
    // The header, the tab and the index's row take the new look.
    router.refresh();
  };
  return { look, kept, change, changes, busy, saved, error, save };
}

/**
 * The icon the preview draws. The badge and the mark need nothing saved; the server's icon is served once it
 * is the saved choice, so until then the preview shows none rather than a broken picture.
 */
function previewSrc(look: Look, kept: Look, view: BrandingView, slug: string): string | null {
  if (look.icon === "discord")
    return kept.icon === "discord" && view.discordIconHash ? `/img/desk/${slug}?size=192` : null;
  if (look.icon === "badge" && view.badgeId !== null) return `/img/badge/${view.badgeId}`;
  return "/icon/192";
}

/** The header band as it will look: the chosen colour, icon and title. */
function Preview(props: {
  slug: string;
  look: Look;
  kept: Look;
  view: BrandingView;
  t: WorkspaceDictionary;
}) {
  const { look, view, t } = props;
  const src = previewSrc(look, props.kept, view, props.slug);
  const title = cleanTitle(look.title) || view.standard;
  return (
    <figure className="mt-4">
      <figcaption className="text-label text-ink/75">{t["branding.preview"]}</figcaption>
      <div
        data-accent={look.accent === "burgundy" ? undefined : look.accent}
        className="mt-1 flex items-center gap-3 bg-burgundy px-3 py-2 text-wax-paper"
      >
        {src && (
          <img
            src={src}
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-xs bg-wax-paper object-cover"
          />
        )}
        <span className="min-w-0 font-display text-display-sm break-words ph-no-capture">
          {title}
        </span>
      </div>
    </figure>
  );
}

const OPTION =
  "flex min-h-11 cursor-pointer items-start gap-3 border border-rule px-3 py-2 has-checked:border-plum has-checked:bg-plum/10";

function IconChoice(props: {
  value: BrandIcon;
  look: Look;
  view: BrandingView;
  t: WorkspaceDictionary;
  onChange: (icon: BrandIcon) => void;
}) {
  const { value, t } = props;
  const note =
    value === "badge" && props.view.badgeId === null
      ? t["branding.icon.badge.none"]
      : t[`branding.icon.${value}.note`];
  return (
    <label className={OPTION}>
      <input
        type="radio"
        name="branding-icon"
        checked={props.look.icon === value}
        onChange={() => props.onChange(value)}
        className="mt-1 size-5 shrink-0"
      />
      <span>
        <span className="block font-medium">{t[`branding.icon.${value}`]}</span>
        <span className="block text-body-sm text-ink/75">{note}</span>
      </span>
    </label>
  );
}

function AccentChoice(props: {
  value: Accent;
  look: Look;
  t: WorkspaceDictionary;
  onChange: (accent: Accent) => void;
}) {
  const { value, t } = props;
  return (
    <label className={`${OPTION} items-center`}>
      <input
        type="radio"
        name="branding-accent"
        checked={props.look.accent === value}
        onChange={() => props.onChange(value)}
        className="size-5 shrink-0"
      />
      <span
        aria-hidden="true"
        data-accent={value === "burgundy" ? undefined : value}
        className="size-6 shrink-0 rounded-xs bg-burgundy"
      />
      <span className="font-medium">{t[`branding.accent.${value}`]}</span>
    </label>
  );
}

function TitleField(props: {
  look: Look;
  view: BrandingView;
  t: WorkspaceDictionary;
  onChange: (title: string) => void;
}) {
  const { look, view, t } = props;
  const length = titleLength(cleanTitle(look.title));
  const over = length > TITLE_LIMIT;
  return (
    <div className="mt-4">
      <label htmlFor="branding-title" className="font-medium">
        {t["branding.title.label"]}
      </label>
      <input
        id="branding-title"
        type="text"
        value={look.title}
        placeholder={view.standard}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={over || undefined}
        aria-describedby="branding-title-hint branding-title-count"
        autoComplete="off"
        className={`${FIELD} mt-1 text-[16px] ph-no-capture`}
      />
      <p id="branding-title-hint" className="mt-1 text-body-sm text-ink/75">
        {fill(t["branding.title.hint"], { name: view.standard })}
      </p>
      <p
        id="branding-title-count"
        className={`text-body-sm tabular-nums ${over ? "font-semibold text-seal" : "text-ink/75"}`}
      >
        {over ? t["branding.title.tooLong"] : fill(t["branding.title.count"], { n: length })}
      </p>
    </div>
  );
}

export function BrandingCard(props: {
  slug: string;
  view: BrandingView;
  t: WorkspaceDictionary;
  language: string;
}) {
  const { t, view } = props;
  const { look, kept, change, changes, busy, saved, error, save } = useBranding(
    props.slug,
    view,
    t,
  );
  return (
    <section aria-labelledby="branding" className="drawn-card mt-6 max-w-2xl px-4 py-3">
      <h2 id="branding" className="font-subhead text-display-sm">
        {t["branding.head"]}
      </h2>
      <p className="mt-1">{t["branding.lead"]}</p>
      <TitleField look={look} view={view} t={t} onChange={(title) => change({ title })} />
      <fieldset className="mt-4 grid gap-2">
        <legend className="font-medium">{t["branding.icon.legend"]}</legend>
        {BRAND_ICONS.map((value) => (
          <IconChoice
            key={value}
            value={value}
            look={look}
            view={view}
            t={t}
            onChange={(icon) => change({ icon })}
          />
        ))}
      </fieldset>
      <fieldset className="mt-4 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
        <legend className="font-medium">{t["branding.accent.legend"]}</legend>
        {ACCENTS.map((value) => (
          <AccentChoice
            key={value}
            value={value}
            look={look}
            t={t}
            onChange={(accent) => change({ accent })}
          />
        ))}
      </fieldset>
      <Preview slug={props.slug} look={look} kept={kept} view={view} t={t} />
      <SaveRow
        changes={changes}
        busy={busy}
        saved={saved}
        error={error}
        onSave={() => void save()}
        t={t}
        language={props.language}
      />
    </section>
  );
}
