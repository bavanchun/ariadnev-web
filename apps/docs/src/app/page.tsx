import { LanguageChooser } from "@/components/language-chooser.tsx";

// D00 Language chooser: no preselection, no automatic locale redirect, both
// stable URLs explicit. Marketing-return link points to the ariadnev product
// home so a reader who landed on docs by mistake can back out cleanly without
// the browser back button. Rendered as plain anchor because static export
// preserves no session state on this page.
export default function HomePage() {
  return (
    <main className="chooser-page">
      <img className="chooser-logo" src="/ariadnev-logo.webp" width="192" height="128" alt="" />
      <p className="chooser-kicker">Documentation gateway · EN / VI</p>
      <h1>ariadnev documentation</h1>
      <p className="chooser-intro">Choose a language for the current stable edition. The choice changes only this route and is not remembered.</p>
      <LanguageChooser />
      <p className="chooser-marketing-return"><a href="https://ariadnev.com/" rel="noreferrer">← ariadnev.com</a></p>
    </main>
  );
}
