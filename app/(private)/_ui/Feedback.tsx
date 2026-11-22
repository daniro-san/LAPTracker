// "Send feedback" (D157) at the end of a desk or board page: the button with only its own words, so the page
// sends the client none of the rest of the dictionary.
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { feedbackWords } from "@/lib/private/dictionary.feedback";

import { FeedbackButton } from "./FeedbackButton";
import { sheetWords } from "./sheet-words";

export function Feedback(props: {
  slug: string;
  area: "desk" | "board";
  language: WorkspaceLanguage;
  t: WorkspaceDictionary;
}) {
  return (
    <FeedbackButton
      slug={props.slug}
      area={props.area}
      language={props.language}
      words={feedbackWords(props.t)}
      sheet={sheetWords(props.t)}
    />
  );
}
