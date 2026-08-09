import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/docs.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.vcskill.vchun.dev"),
  title: { default: "vcskill documentation", template: "%s | vcskill documentation" },
  description: "Versioned English and Vietnamese documentation for vcskill.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
