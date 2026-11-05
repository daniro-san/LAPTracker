// 404 (Phase 5b): "Grandma wandered off." beside the yarn ball she left behind.
import Link from "next/link";

import { ErrorPage, primaryAction } from "@/app/_ui/ErrorPage";
import { YarnLeftBehind } from "@/lib/brand/components/Vignettes";
import { copy } from "@/lib/copy";

const t = copy.errors.notFound;

export const metadata = { title: `${t.title} · ${copy.site.name}` };

export default function NotFound() {
  return (
    <ErrorPage
      code={t.code}
      title={t.title}
      body={t.body}
      art={<YarnLeftBehind />}
      actions={
        <Link href="/" className={primaryAction}>
          {t.back}
        </Link>
      }
    />
  );
}
