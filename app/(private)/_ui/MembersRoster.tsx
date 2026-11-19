"use client";

// The Members view laid out as list and detail (D122): the page's lead (the read, the thanks, the
// check-in line, the legend), the new members and the list on the left; from 1024 the open member beside
// them, sticky, with the open row marked. The open member is in the address (`?m=`), so a link opens them
// and back goes to the one before. Below 1024 the same member opens in the bottom sheet, as before: one
// component, two containers. A new member (D106) opens the same way.
import { useState, type ReactNode } from "react";

import { MasterDetail } from "@/lib/brand/components/layout/MasterDetail";

import type { EditorContext } from "./MemberCards";
import { MemberSheet } from "./MemberSheet";
import { MembersList, type MembersListProps } from "./MembersList";
import { shown, useOpenMember, type OpenMember } from "./open-member";
import { PendingMembers, PendingSheet, type PendingProps } from "./PendingMembers";
import type { Removed } from "./PendingRemove";

export function MembersRoster(props: {
  lead: ReactNode;
  /** After the list, in its column. */
  foot: ReactNode;
  list: MembersListProps;
  editor: EditorContext;
  pending: PendingProps;
  /** `?m=` when the page was opened. */
  initialOpen: string | null;
  /** "Pick a member to see their info." */
  pick: string;
}) {
  const at = useOpenMember(props.initialOpen);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const opener = { uid: at.open, sheet: at.wide !== true, onOpen: (uid: number) => at.show(uid) };
  const name =
    props.list.rows.find((r) => r.uid === at.open)?.name ??
    props.pending.rows.find((r) => r.uid === at.open)?.name;
  const list = (
    <>
      {props.lead}
      <PendingMembers
        {...props.pending}
        open={opener}
        removed={removed}
        onUndone={() => setRemoved(null)}
      />
      <MembersList {...props.list} open={at.open} wide={at.wide} onOpen={at.show} />
      {props.foot}
    </>
  );
  return (
    <>
      <MasterDetail
        list={list}
        detail={
          at.wide && name !== undefined ? (
            <Detail {...props} at={at} pane onRemoved={setRemoved} />
          ) : null
        }
        {...(name !== undefined && { detailLabel: name })}
        empty={
          name !== undefined && at.wide === null ? props.list.words["list.loading"] : props.pick
        }
      />
      {at.wide === false && <Detail {...props} at={at} pane={false} onRemoved={setRemoved} />}
    </>
  );
}

/** The open member's sheet, or their pane; nothing when no one (or no one on the page) is open. */
function Detail(props: {
  list: MembersListProps;
  editor: EditorContext;
  pending: PendingProps;
  at: OpenMember;
  pane: boolean;
  onRemoved: (r: Removed | null) => void;
}) {
  const { at, pane } = props;
  // A pane closed with its Close goes back to its row, so the keyboard carries on down the list.
  const close = () => {
    const uid = at.open;
    at.close();
    if (pane) shown(`[data-uid="${uid}"]`)?.focus();
  };
  const row = props.list.rows.find((r) => r.uid === at.open);
  if (row)
    return (
      <MemberSheet
        key={row.uid}
        pane={pane}
        row={row}
        version={props.list.rows}
        words={props.list.words}
        editor={props.editor}
        onClose={close}
      />
    );
  const pendingRow = props.pending.rows.find((r) => r.uid === at.open);
  if (!pendingRow) return null;
  return (
    <PendingSheet
      key={pendingRow.uid}
      pane={pane}
      row={pendingRow}
      roster={props.pending.roster}
      words={props.pending.words}
      editor={props.editor}
      onClose={close}
      onRemoved={props.onRemoved}
    />
  );
}
