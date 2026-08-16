import type { ReactNode } from "react";
import { getDocsCatalog } from "@/lib/content-source.ts";
import { primaryVersions } from "@/lib/content-catalog.ts";

export const dynamicParams = false;

export async function generateStaticParams() {
  const catalog = await getDocsCatalog();
  return catalog.locales.flatMap((locale) => primaryVersions(catalog).map((version) => ({ locale, version })));
}

export default async function EditionLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string; version: string }> }) {
  await params;
  return children;
}
