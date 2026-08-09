import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";

const source = loader({ baseUrl: "/", source: docs.toFumadocsSource() });

export default function Page() {
  const page = source.getPage([]);
  if (!page) throw new Error("Fumadocs compatibility fixture did not load its index document");

  return <main><h1>{page.data.title}</h1></main>;
}
