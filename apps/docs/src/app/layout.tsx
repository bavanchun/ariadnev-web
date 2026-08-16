import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/docs.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.ariadnev.com"),
  title: { default: "ariadnev documentation", template: "%s | ariadnev documentation" },
  description: "Versioned English and Vietnamese documentation for ariadnev.",
  // apple-touch-icon.png ships in public/ for iOS home-screen auto-fetch, but is
  // deliberately not referenced from the head: docs has ~2KB headroom against the
  // frozen 300KB per-page transfer budget and adding it here pushes the referenced
  // resource chain over. iOS still finds it at /apple-touch-icon.png on demand.
  icons: { icon: [{ url: "/favicon.png", type: "image/png", sizes: "64x64" }] },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
