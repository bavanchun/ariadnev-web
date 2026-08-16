import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/docs.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.ariadnev.com"),
  title: { default: "ariadnev documentation", template: "%s | ariadnev documentation" },
  description: "Versioned English and Vietnamese documentation for ariadnev.",
  icons: { icon: [{ url: "/favicon.png", type: "image/png", sizes: "128x128" }] },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
