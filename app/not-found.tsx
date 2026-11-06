// 404 (Phase 5b): "Grandma wandered off." beside the yarn ball she left behind.
import Link from "next/link";

import { ErrorPage, primaryAction } from "@/app/_ui/ErrorPage";
import { requestCopy } from "@/app/_ui/locale";
import { YarnLeftBehind } from "@/lib/brand/components/Vignettes";

export async function generateMetadata() {
  const copy = await requestCopy();
  return { title: `${copy.errors.notFound.title} · ${copy.site.name}` };
}

export default async function NotFound() {
  const copy = await requestCopy();
  const t = copy.errors.notFound;
  return (
    <ErrorPage
      code={t.code}
      title={t.title}
      body={t.body}
      art={<YarnLeftBehind />}
      copy={copy}
      actions={
        <Link href="/" className={primaryAction}>
          {t.back}
        </Link>
      }
    />
  );
}
