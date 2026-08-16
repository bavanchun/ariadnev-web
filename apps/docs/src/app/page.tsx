import { LanguageChooser } from "@/components/language-chooser.tsx";

export default function HomePage() {
  return <main className="chooser-page"><img className="chooser-logo" src="/ariadnev-logo.webp" width="192" height="128" alt="" /><h1>ariadnev documentation</h1><p>Choose your documentation language.</p><LanguageChooser /></main>;
}
