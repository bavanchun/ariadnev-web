// Renderers for the documentation pages that are generated, not authored:
// the CLI, provider, skill, and workflow references, the release notes, and
// the root page of the previous stable edition. Every function is pure —
// same bundle in, byte-identical Markdown out — so the content root the docs
// build consumes is reproducible from the release artifact alone.
//
// Output is plain Markdown that `apps/docs/src/lib/public-markdown.ts`
// accepts: no H1 (the page title becomes the H1), no HTML, no JSX, no images.
// Text lifted from the bundle is escaped so a `<` or `{` in a skill
// description can never become MDX syntax.

const STRINGS = {
  en: {
    cli: {
      title: "CLI reference",
      description: "Every ariadnev command, its arguments, and its options, projected from the release.",
      intro: "This page is generated from the command surface the release ships. `ariadnev` and `av` are interchangeable everywhere.",
      arguments: "Arguments",
      options: "Options",
      aliases: "Aliases",
      required: "required",
      none: "This command takes no options.",
      onThisRelease: "Commands in this release",
    },
    providers: {
      title: "Provider reference",
      description: "Where each artifact kind is written for every supported provider, and which targets are skipped.",
      intro: "The install engine writes an artifact only where the target path and format are verified. A cell marked *skip* is an unverified target: ariadnev never guesses, it skips and logs it in the install summary.",
      artifact: "Artifact",
      path: "Path",
      skip: "skip",
    },
    skills: {
      title: "Skill catalog",
      description: "The Agent Skills the kit installs, grouped by category, with the argument hint each one declares.",
      intro: "Every skill below is installed as `av:<name>`. The counts and descriptions come from the release itself, so this page cannot drift from what `ariadnev list` reports.",
      total: "skills in this release",
      argumentHint: "Arguments",
    },
    workflows: {
      title: "Workflow reference",
      description: "The canonical workflow graphs `av run` can validate and execute, with their nodes and edges.",
      intro: "Each workflow is a provider-neutral graph. `av run <workflow> --validate` proves the graph without contacting any provider; see the graph execution concept for the run lifecycle.",
      nodes: "Nodes",
      edges: "Edges",
      node: "Node",
      kind: "Kind",
      from: "From",
      to: "To",
      type: "Type",
      handler: "Handler",
    },
    releaseNotes: {
      title: "Release notes",
      description: "What changed in this release, exactly as the release ships it.",
      intro: "Release notes are published in English with every release.",
    },
    previousRoot: {
      title: "Documentation for the previous stable release",
      description: "The reference the previous stable release shipped, kept so links into it keep resolving.",
      body: (previous, current) => [
        `This edition documents **${previous}**, the release before **${current}**. It shipped under the product's previous name, so its commands read \`vcskill …\` where the current release reads \`ariadnev …\`. It is retained for readers who are still on it; new installs receive the current release.`,
        "",
        "Only the machine-projected reference is available for this edition:",
        "",
        "- [CLI reference](%ROOT%reference/cli/)",
        "- [Provider reference](%ROOT%reference/providers/)",
        "",
        `Switch to the **stable** edition in the version selector for the current guides and concepts.`,
      ],
    },
  },
  vi: {
    cli: {
      title: "Tham chiếu CLI",
      description: "Toàn bộ lệnh của ariadnev, tham số và tùy chọn, chiếu ra từ bản phát hành.",
      intro: "Trang này được sinh từ bề mặt lệnh mà bản phát hành đóng gói. `ariadnev` và `av` dùng thay cho nhau ở mọi nơi.",
      arguments: "Tham số",
      options: "Tùy chọn",
      aliases: "Bí danh",
      required: "bắt buộc",
      none: "Lệnh này không có tùy chọn.",
      onThisRelease: "Các lệnh trong bản phát hành này",
    },
    providers: {
      title: "Tham chiếu provider",
      description: "Mỗi loại artifact được ghi vào đâu với từng provider được hỗ trợ, và mục tiêu nào bị bỏ qua.",
      intro: "Bộ cài chỉ ghi artifact khi đường dẫn và định dạng đích đã được xác minh. Ô ghi *skip* là mục tiêu chưa xác minh: ariadnev không đoán, nó bỏ qua và ghi vào bản tóm tắt cài đặt.",
      artifact: "Artifact",
      path: "Đường dẫn",
      skip: "skip",
    },
    skills: {
      title: "Danh mục skill",
      description: "Các Agent Skill mà kit cài đặt, nhóm theo danh mục, kèm gợi ý tham số mỗi skill khai báo.",
      intro: "Mọi skill dưới đây được cài với tên `av:<name>`. Số lượng và mô tả lấy trực tiếp từ bản phát hành, nên trang này không thể lệch với những gì `ariadnev list` báo cáo.",
      total: "skill trong bản phát hành này",
      argumentHint: "Tham số",
    },
    workflows: {
      title: "Tham chiếu workflow",
      description: "Các đồ thị workflow chuẩn mà `av run` có thể kiểm tra và thực thi, kèm node và edge.",
      intro: "Mỗi workflow là một đồ thị trung lập với provider. `av run <workflow> --validate` chứng minh đồ thị mà không cần liên hệ provider nào; xem khái niệm thực thi đồ thị để hiểu vòng đời một lần chạy.",
      nodes: "Node",
      edges: "Edge",
      node: "Node",
      kind: "Loại",
      from: "Từ",
      to: "Đến",
      type: "Kiểu",
      handler: "Bộ xử lý",
    },
    releaseNotes: {
      title: "Ghi chú phát hành",
      description: "Những gì thay đổi trong bản phát hành này, đúng như bản phát hành đóng gói.",
      intro: "Ghi chú phát hành được công bố bằng tiếng Anh cùng mỗi bản phát hành.",
    },
    previousRoot: {
      title: "Tài liệu cho bản ổn định trước",
      description: "Phần tham chiếu mà bản ổn định trước đã đóng gói, giữ lại để các liên kết vào đó vẫn hoạt động.",
      body: (previous, current) => [
        `Ấn bản này ghi lại **${previous}**, bản phát hành ngay trước **${current}**. Bản đó phát hành dưới tên cũ của sản phẩm, nên các lệnh đọc là \`vcskill …\` thay vì \`ariadnev …\` như bản hiện tại. Nó được giữ cho người đọc còn dùng bản đó; cài đặt mới nhận bản hiện tại.`,
        "",
        "Chỉ phần tham chiếu chiếu từ máy có sẵn cho ấn bản này:",
        "",
        "- [Tham chiếu CLI](%ROOT%reference/cli/)",
        "- [Tham chiếu provider](%ROOT%reference/providers/)",
        "",
        "Chuyển sang ấn bản **stable** trong bộ chọn phiên bản để đọc hướng dẫn và khái niệm hiện tại.",
      ],
    },
  },
};

export const GENERATED_PAGE_IDS = Object.freeze({
  cli: "reference/cli",
  providers: "reference/providers",
  skills: "reference/skills",
  workflows: "reference/workflows",
  releaseNotes: "release-notes",
});

/** Escape text lifted from JSON so it renders literally inside MDX. */
export function escapeMdx(value) {
  return String(value ?? "")
    .replace(/[\\`*_{}[\]<>#|~]/g, (char) => `\\${char}`)
    .replace(/\r?\n/g, " ")
    .trim();
}

/**
 * Inline code from untrusted text. Backticks cannot be escaped inside a code
 * span, so the fence is widened past the longest run; `|` is escaped because
 * GFM splits table cells on it even inside a code span.
 */
export function code(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
  if (text.length === 0) return "";
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  const padded = text.startsWith("`") || text.endsWith("`") ? ` ${text} ` : text;
  return `${fence}${padded}${fence}`;
}

/**
 * Escape MDX-significant characters in authored-style Markdown while leaving
 * fenced blocks and inline code spans untouched — MDX already treats code
 * content literally, and an escape written there renders as a backslash.
 * Also demotes H1s outside fences, because the page title is the H1.
 */
export function escapeMarkdownProse(markdown) {
  const out = [];
  let inFence = null;
  for (const line of String(markdown).split(/\r?\n/)) {
    const fence = /^(\s*)(`{3,}|~{3,})/.exec(line);
    if (inFence) {
      out.push(line);
      if (fence && fence[2][0] === inFence[0] && fence[2].length >= inFence.length) inFence = null;
      continue;
    }
    if (fence) {
      inFence = fence[2];
      out.push(line);
      continue;
    }
    const demoted = line.startsWith("# ") ? `## ${line.slice(2)}` : line;
    out.push(escapeOutsideCodeSpans(demoted));
  }
  return out.join("\n");
}

function escapeOutsideCodeSpans(line) {
  let result = "";
  let index = 0;
  while (index < line.length) {
    const open = /`+/.exec(line.slice(index));
    if (!open) {
      result += escapeProseSegment(line.slice(index));
      break;
    }
    const start = index + open.index;
    const closeAt = line.indexOf(open[0], start + open[0].length);
    result += escapeProseSegment(line.slice(index, start));
    if (closeAt === -1) {
      // An unclosed run of backticks is prose, not a span.
      result += escapeProseSegment(line.slice(start));
      break;
    }
    result += line.slice(start, closeAt + open[0].length);
    index = closeAt + open[0].length;
  }
  return result;
}

function escapeProseSegment(text) {
  return text.replace(/<(?=[^\s`])/g, "\\<").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

function frontmatter(title, description) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n\n`;
}

function tableRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function sortBy(items, key) {
  return [...items].sort((left, right) => key(left).localeCompare(key(right), "en"));
}

// ------------------------------------------------------------------ renderers

export function renderCliReference(locale, commands) {
  const t = STRINGS[locale].cli;
  const lines = [frontmatter(t.title, t.description).trimEnd(), "", t.intro, "", `## ${t.onThisRelease}`, ""];
  const ordered = sortBy(commands, (command) => command.path);
  for (const command of ordered) lines.push(`- [${code(command.path)}](#${anchor(command.path)})`);
  lines.push("");
  for (const command of ordered) {
    lines.push(`## ${code(command.path)}`, "", escapeMdx(command.description), "");
    if (command.aliases?.length) lines.push(`${t.aliases}: ${command.aliases.map(code).join(", ")}`, "");
    if (command.arguments?.length) {
      lines.push(`### ${t.arguments}`, "");
      for (const argument of command.arguments) {
        const name = code(argument.name ?? argument.usage ?? argument.flags ?? "");
        const flags = [argument.required ? t.required : null, argument.variadic ? "variadic" : null].filter(Boolean);
        lines.push(`- ${name}${flags.length ? ` (${flags.join(", ")})` : ""}${argument.description ? ` — ${escapeMdx(argument.description)}` : ""}`);
      }
      lines.push("");
    }
    lines.push(`### ${t.options}`, "");
    if (!command.options?.length) {
      lines.push(t.none, "");
    } else {
      lines.push(tableRow([t.options, ""]), tableRow(["---", "---"]));
      for (const option of sortBy(command.options, (option) => option.flags)) {
        lines.push(tableRow([code(option.flags), escapeMdx(option.description)]));
      }
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderProviderReference(locale, providers) {
  const t = STRINGS[locale].providers;
  const lines = [frontmatter(t.title, t.description).trimEnd(), "", t.intro, ""];
  for (const provider of sortBy(providers, (provider) => provider.id)) {
    lines.push(`## ${code(provider.id)}`, "");
    lines.push(tableRow([t.artifact, t.path]), tableRow(["---", "---"]));
    for (const artifact of sortBy(provider.artifacts ?? [], (artifact) => artifact.artifact)) {
      lines.push(tableRow([code(artifact.artifact), artifact.verified === false || !artifact.path ? `*${t.skip}*` : code(artifact.path)]));
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderSkillCatalog(locale, skills) {
  const t = STRINGS[locale].skills;
  const lines = [frontmatter(t.title, t.description).trimEnd(), "", t.intro, "", `**${skills.length}** ${t.total}.`, ""];
  const groups = new Map();
  for (const skill of skills) {
    const category = skill.category || "uncategorized";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(skill);
  }
  for (const category of [...groups.keys()].sort((left, right) => left.localeCompare(right, "en"))) {
    const members = sortBy(groups.get(category), (skill) => skill.name);
    lines.push(`## ${escapeMdx(category)} (${members.length})`, "");
    for (const skill of members) {
      lines.push(`### ${code(skill.name.startsWith("av:") ? skill.name : `av:${skill.name}`)}`, "", escapeMdx(skill.description), "");
      if (skill.argumentHint) lines.push(`${t.argumentHint}: ${code(skill.argumentHint)}`, "");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderWorkflowReference(locale, workflows) {
  const t = STRINGS[locale].workflows;
  const lines = [frontmatter(t.title, t.description).trimEnd(), "", t.intro, ""];
  for (const workflow of sortBy(workflows, (workflow) => workflow.id)) {
    lines.push(`## ${code(workflow.id)}`, "", `**${escapeMdx(workflow.title)}** — ${escapeMdx(workflow.description)}`, "");
    if (workflow.nodes?.length) {
      lines.push(`### ${t.nodes}`, "", tableRow([t.node, t.kind, t.handler]), tableRow(["---", "---", "---"]));
      for (const node of sortBy(workflow.nodes, (node) => node.id)) {
        const handler = node.handler ? `${escapeMdx(node.handler.kind)}: ${code(node.handler.ref)}` : "";
        lines.push(tableRow([code(node.id), escapeMdx(node.type ?? ""), handler]));
      }
      lines.push("");
    }
    if (workflow.edges?.length) {
      lines.push(`### ${t.edges}`, "", tableRow([t.from, t.to, t.type]), tableRow(["---", "---", "---"]));
      for (const edge of sortBy(workflow.edges, (edge) => `${edge.from} ${edge.to} ${edge.id ?? ""}`)) {
        lines.push(tableRow([code(edge.from), code(edge.to), escapeMdx(edge.type ?? "")]));
      }
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/** Release notes ship as Markdown with H2 headings per version; H1s, if any, are demoted. */
export function renderReleaseNotes(locale, notesMarkdown) {
  const t = STRINGS[locale].releaseNotes;
  const body = escapeMarkdownProse(String(notesMarkdown).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")).trim();
  return `${frontmatter(t.title, t.description)}${t.intro}\n\n${body}\n`;
}

export function renderPreviousRoot(locale, previousVersion, currentVersion) {
  const t = STRINGS[locale].previousRoot;
  return `${frontmatter(t.title, t.description)}${t.body(previousVersion, currentVersion).join("\n")}\n`;
}

export function generatedPageMeta(locale, kind) {
  const t = STRINGS[locale][kind];
  return { title: t.title, description: t.description };
}

function anchor(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
