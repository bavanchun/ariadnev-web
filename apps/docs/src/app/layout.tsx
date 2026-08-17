import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/docs.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.ariadnev.com"),
  title: { default: "ariadnev documentation", template: "%s | ariadnev documentation" },
  description: "Versioned English and Vietnamese documentation for ariadnev.",
  // apple-touch-icon.png ships in public/ for iOS home-screen auto-fetch, but is
  // deliberately not referenced from the head: docs has minimal headroom against
  // the frozen 300KB per-page transfer budget and adding it here pushes the
  // referenced resource chain over. iOS still finds it at /apple-touch-icon.png
  // on demand.
  icons: { icon: [{ url: "/favicon.png", type: "image/png", sizes: "64x64" }] },
  robots: { index: true, follow: true },
};

// Dark-only theming: colorScheme hint tells browsers to use dark scrollbars
// and form controls; themeColor sets the mobile status-bar tint to the docs
// canvas so a phone reader sees a matched chrome, not a light bar over dark
// content. Both come from the shared token surface.canvas (color.ink.900).
export const viewport = {
  colorScheme: "dark" as const,
  themeColor: "#181818",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
