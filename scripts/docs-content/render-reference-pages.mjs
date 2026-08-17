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
      indexDescription: "Every ariadnev command in this release, with a link to its detail page.",
      indexIntro: "Every command below has its own page with arguments, options, and aliases. `ariadnev` and `av` are interchangeable everywhere.",
      detailIntroPrefix: "This is the reference for the",
      detailIntroSuffix: "command, projected from the release.",
      backToIndex: "Back to CLI index",
      retiredReplacedTitlePrefix: "Retired:",
      retiredReplacedDescription: "This CLI URL has moved. The command still exists under a new slug.",
      retiredReplacedIntro: "The URL you followed is retired. This command is still available in the current release under a new slug:",
      retiredReplacedGoTo: "Go to the current command",
      retiredTombstoneTitlePrefix: "Retired:",
      retiredTombstoneDescription: "This CLI URL has been retired.",
      retiredTombstoneIntro: "The URL you followed points at a command that no longer ships in the current release.",
      retiredReasonLabel: "Reason",
      retiredIndexLink: "Browse the current CLI reference",
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
      indexIntro: "Every skill below is installed as `av:<name>`. Open a category to see its skills, arguments, and descriptions. Counts and descriptions come from the release itself, so this page cannot drift from what `ariadnev list` reports.",
      total: "skills in this release",
      argumentHint: "Arguments",
      skill: "Skill",
      details: "Details",
      categoryDetailPrefix: "Skills:",
      categoryDetailDescriptionPrefix: "Agent Skills in the",
      categoryDetailDescriptionSuffix: "category, with argument hints and descriptions from the release.",
      backToIndex: "Back to skill catalog",
      inThisCategory: "skills in this category",
      uncategorizedLabel: "uncategorized",
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
      editionHeading: "This edition",
      versionLabel: "Version",
      releaseTagLabel: "Release tag",
      sourceShaLabel: "Source commit",
      docsHomeLabel: "Documentation home",
      upgradingLabel: "Upgrade guide",
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
      indexDescription: "Toàn bộ lệnh ariadnev trong bản phát hành này, kèm đường dẫn tới trang chi tiết.",
      indexIntro: "Mỗi lệnh dưới đây có trang riêng với tham số, tùy chọn và bí danh. `ariadnev` và `av` dùng thay cho nhau ở mọi nơi.",
      detailIntroPrefix: "Đây là tham chiếu cho lệnh",
      detailIntroSuffix: ", chiếu ra từ bản phát hành.",
      backToIndex: "Về danh mục CLI",
      retiredReplacedTitlePrefix: "Đã ngừng:",
      retiredReplacedDescription: "URL CLI này đã đổi. Lệnh vẫn còn trong bản phát hành hiện tại với slug mới.",
      retiredReplacedIntro: "URL bạn theo đã ngừng. Lệnh này vẫn có trong bản phát hành hiện tại với slug mới:",
      retiredReplacedGoTo: "Mở lệnh hiện tại",
      retiredTombstoneTitlePrefix: "Đã ngừng:",
      retiredTombstoneDescription: "URL CLI này đã ngừng phục vụ.",
      retiredTombstoneIntro: "URL bạn theo trỏ tới một lệnh không còn xuất hiện trong bản phát hành hiện tại.",
      retiredReasonLabel: "Lý do",
      retiredIndexLink: "Xem danh mục CLI hiện tại",
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
      indexIntro: "Mọi skill dưới đây được cài với tên `av:<name>`. Mở một danh mục để xem các skill, tham số và mô tả. Số lượng và mô tả lấy trực tiếp từ bản phát hành, nên trang này không thể lệch với những gì `ariadnev list` báo cáo.",
      total: "skill trong bản phát hành này",
      argumentHint: "Tham số",
      skill: "Skill",
      details: "Chi tiết",
      categoryDetailPrefix: "Skill:",
      categoryDetailDescriptionPrefix: "Các Agent Skill thuộc danh mục",
      categoryDetailDescriptionSuffix: ", kèm gợi ý tham số và mô tả từ bản phát hành.",
      backToIndex: "Quay lại danh mục skill",
      inThisCategory: "skill trong danh mục này",
      uncategorizedLabel: "chưa phân loại",
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
      editionHeading: "Ấn bản này",
      versionLabel: "Phiên bản",
      releaseTagLabel: "Tag phát hành",
      sourceShaLabel: "Commit gốc",
      docsHomeLabel: "Trang tài liệu",
      upgradingLabel: "Hướng dẫn nâng cấp",
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

/**
 * Route-safe slug for one command's detail page. The root `ariadnev` invocation
 * keeps its own slug so the disambiguates from `ariadnev install`; every
 * subcommand strips the leading `ariadnev ` and joins remaining tokens with
 * `-` so nested subcommands like `ariadnev adapters regenerate` become
 * `adapters-regenerate` at a single URL depth.
 */
export function cliCommandSlug(commandPath) {
  const path = String(commandPath ?? "").trim();
  if (path === "ariadnev") return "ariadnev";
  const rest = path.startsWith("ariadnev ") ? path.slice("ariadnev ".length) : path;
  return rest.trim().replace(/\s+/g, "-");
}

/** Full canonical page id for a command detail page (matches catalog `pageId`). */
export function cliCommandPageId(commandPath) {
  return `reference/cli/${cliCommandSlug(commandPath)}`;
}

/**
 * Compact index page: one row per command with description and link to its
 * detail page. No arguments or options tables here — those live on the detail
 * page. This is the load-bearing shrink that lets the previously ~24KB
 * `reference/cli/` monolith fit inside the frozen per-route byte cap.
 */
export function renderCliCommandIndex(locale, commands) {
  const t = STRINGS[locale].cli;
  const lines = [
    frontmatter(t.title, t.indexDescription).trimEnd(),
    "",
    t.indexIntro,
    "",
    `## ${t.onThisRelease}`,
    "",
    tableRow([t.title, t.description.split(",")[0]]),
    tableRow(["---", "---"]),
  ];
  const ordered = sortBy(commands, (command) => command.path);
  for (const command of ordered) {
    const slug = cliCommandSlug(command.path);
    const summary = escapeMdx(command.description ?? "");
    lines.push(tableRow([`[${code(command.path)}](%ROOT%reference/cli/${slug}/)`, summary]));
  }
  lines.push("");
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Detail page for one command: description, aliases, arguments, options. The
 * front-matter title reads as `code path`-adjacent so the H1 is unambiguously
 * the command identity, and a link back to the index sits at the bottom so a
 * reader can navigate without depending on the sidebar (which hides these
 * pages via `navigationVisibility: "reference-only"`).
 */
export function renderCliCommandDetail(locale, command) {
  const t = STRINGS[locale].cli;
  const path = String(command.path);
  const title = path;
  const description = escapeMdx(command.description ?? "");
  const lines = [
    frontmatter(title, description).trimEnd(),
    "",
    `${t.detailIntroPrefix} ${code(path)} ${t.detailIntroSuffix}`,
    "",
    description,
    "",
  ];
  if (command.aliases?.length) lines.push(`${t.aliases}: ${command.aliases.map(code).join(", ")}`, "");
  if (command.arguments?.length) {
    lines.push(`## ${t.arguments}`, "");
    for (const argument of command.arguments) {
      const name = code(argument.name ?? argument.usage ?? argument.flags ?? "");
      const flags = [argument.required ? t.required : null, argument.variadic ? "variadic" : null].filter(Boolean);
      lines.push(`- ${name}${flags.length ? ` (${flags.join(", ")})` : ""}${argument.description ? ` — ${escapeMdx(argument.description)}` : ""}`);
    }
    lines.push("");
  }
  lines.push(`## ${t.options}`, "");
  if (!command.options?.length) {
    lines.push(t.none, "");
  } else {
    lines.push(tableRow([t.options, ""]), tableRow(["---", "---"]));
    for (const option of sortBy(command.options, (option) => option.flags)) {
      lines.push(tableRow([code(option.flags), escapeMdx(option.description)]));
    }
    lines.push("");
  }
  lines.push(`[${t.backToIndex}](%ROOT%reference/cli/)`, "");
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Retired CLI slug page: a stable 200 landing that either points at the
 * live replacement command or explains that the URL has been tombstoned.
 * `oldSlug` is the URL the reader followed (before the leading segment);
 * `retired` is the `RetiredRoute` entry the contract registry supplies.
 */
export function renderRetiredCliRoute(locale, oldSlug, retired) {
  const t = STRINGS[locale].cli;
  const label = oldSlug;
  if (retired.kind === "replaced") {
    const title = `${t.retiredReplacedTitlePrefix} ${label}`;
    const lines = [
      frontmatter(title, t.retiredReplacedDescription).trimEnd(),
      "",
      t.retiredReplacedIntro,
      "",
      `- [${t.retiredReplacedGoTo} (${code(retired.replacementSlug)})](%ROOT%reference/cli/${retired.replacementSlug}/)`,
      "",
      `${t.retiredReasonLabel}: ${escapeMdx(retired.reason)}`,
      "",
      `[${t.retiredIndexLink}](%ROOT%reference/cli/)`,
    ];
    return `${lines.join("\n").trimEnd()}\n`;
  }
  const title = `${t.retiredTombstoneTitlePrefix} ${label}`;
  const lines = [
    frontmatter(title, t.retiredTombstoneDescription).trimEnd(),
    "",
    t.retiredTombstoneIntro,
    "",
    `${t.retiredReasonLabel}: ${escapeMdx(retired.reason)}`,
    "",
    `[${t.retiredIndexLink}](%ROOT%reference/cli/)`,
  ];
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

const SKILL_CATEGORY_UNCATEGORIZED = "uncategorized";
// Any category with more skills than this is chunked into consecutive
// alphabetical pages (base slug + `-2`, `-3` …) so no single detail page
// blows the frozen per-route transfer cap. Currently only `utilities`
// (40 skills) triggers the split; the threshold gives it two pages of
// 20 each and leaves headroom against the 302,000 byte cap for future
// skill count growth in other categories.
const SKILL_CATEGORY_PAGE_MAX = 25;

/**
 * Normalize a category label into a URL slug. `uncategorized` is the stable
 * key both locales use so cross-locale sibling resolution matches by identity;
 * the visible label is localized on the detail page.
 */
export function skillCategorySlug(category) {
  const raw = String(category ?? "").trim().toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || SKILL_CATEGORY_UNCATEGORIZED;
}

/**
 * Canonical page id for a per-category skills page — used by
 * `attachSiblings` to match categories across locales/editions.
 */
export function skillCategoryPageId(category) {
  return `reference/skills/${skillCategorySlug(category)}`;
}

/**
 * Group skills by their source category, keeping key stable across locales.
 * Category-less entries collapse to `uncategorized`.
 */
export function groupSkillsByCategory(skills) {
  const groups = new Map();
  for (const skill of skills) {
    const key = skill.category?.trim() || SKILL_CATEGORY_UNCATEGORIZED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(skill);
  }
  return groups;
}

/**
 * Chunk a category's skills into consecutive alphabetical pages that each
 * fit the per-route cap. Returns one chunk per detail page, in link order.
 * Each chunk carries the slug the page will be published under and its
 * position in the pager so the detail renderer can emit prev/next links.
 */
export function planSkillCategoryPages(category, skills) {
  const sorted = sortBy(skills, (item) => item.name);
  const baseSlug = skillCategorySlug(category);
  if (sorted.length <= SKILL_CATEGORY_PAGE_MAX) {
    return [{ slug: baseSlug, skills: sorted, index: 0, total: 1 }];
  }
  const total = Math.ceil(sorted.length / SKILL_CATEGORY_PAGE_MAX);
  const perChunk = Math.ceil(sorted.length / total);
  const pages = [];
  for (let position = 0; position < total; position += 1) {
    const chunk = sorted.slice(position * perChunk, (position + 1) * perChunk);
    const slug = position === 0 ? baseSlug : `${baseSlug}-${position + 1}`;
    pages.push({ slug, skills: chunk, index: position, total });
  }
  return pages;
}

/**
 * Main `/reference/skills/` page: intro + category index (linked list only).
 * The dense skill rows live on the per-category detail pages this same slice
 * emits. Splitting is the load-bearing shrink Phase 5 owes — a monolithic
 * catalog of all 105 skills sits ~10KB above the frozen 302,000 byte cap
 * even with the compact-table markup rewrite (see slice 2). Per-category
 * pages keep every description in initial HTML; the main index is tiny.
 * See docs/decisions/docs-performance-baselines.md#shrink-criterion.
 */
export function renderSkillCatalog(locale, skills) {
  const t = STRINGS[locale].skills;
  const groups = groupSkillsByCategory(skills);
  const lines = [
    frontmatter(t.title, t.description).trimEnd(),
    "",
    t.indexIntro,
    "",
    `**${skills.length}** ${t.total}.`,
    "",
  ];
  const categories = [...groups.keys()].sort((left, right) => left.localeCompare(right, "en"));
  for (const category of categories) {
    const members = groups.get(category);
    const label = category === SKILL_CATEGORY_UNCATEGORIZED ? t.uncategorizedLabel : category;
    const pages = planSkillCategoryPages(category, members);
    if (pages.length === 1) {
      lines.push(`- [${escapeMdx(label)} (${members.length})](%ROOT%reference/skills/${pages[0].slug}/)`);
      continue;
    }
    // Category is chunked across multiple detail pages; index links to each
    // chunk so no user path depends on JS-driven pagination.
    lines.push(`- **${escapeMdx(label)}** (${members.length}) — ${pages
      .map((page, order) => `[${order + 1}/${pages.length}](%ROOT%reference/skills/${page.slug}/) (${page.skills.length})`)
      .join(" · ")}`);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Per-category detail page: back link + optional pager + dense two-column
 * table (`Skill | Details`). Description/arguments come from source
 * unchanged. When a category is chunked across multiple pages, `page` and
 * `siblingPages` supply the pager metadata so each detail page carries a
 * static "n of N" plus previous/next links to its neighbours.
 */
export function renderSkillCategoryPage(locale, category, skills, options = {}) {
  const t = STRINGS[locale].skills;
  const label = category === SKILL_CATEGORY_UNCATEGORIZED ? t.uncategorizedLabel : category;
  const siblings = options.siblingPages ?? [];
  const position = options.pageIndex ?? 0;
  const hasSiblings = siblings.length > 1;
  const suffix = hasSiblings ? ` (${position + 1}/${siblings.length})` : "";
  const title = `${t.categoryDetailPrefix} ${label}${suffix}`;
  const description = `${t.categoryDetailDescriptionPrefix} ${label} ${t.categoryDetailDescriptionSuffix}`;
  const lines = [
    frontmatter(title, description).trimEnd(),
    "",
    `[← ${t.backToIndex}](%ROOT%reference/skills/)`,
    "",
    `**${skills.length}** ${t.inThisCategory}.`,
    "",
    tableRow([t.skill, t.details]),
    tableRow(["---", "---"]),
  ];
  for (const skill of sortBy(skills, (item) => item.name)) {
    const name = skill.name.startsWith("av:") ? skill.name : `av:${skill.name}`;
    const desc = escapeMdx(skill.description);
    const args = skill.argumentHint ? ` — ${t.argumentHint}: ${code(skill.argumentHint)}` : "";
    lines.push(tableRow([code(name), `${desc}${args}`]));
  }
  if (hasSiblings) {
    const previous = siblings[position - 1];
    const next = siblings[position + 1];
    const parts = [];
    if (previous) parts.push(`[← ${position}/${siblings.length}](%ROOT%reference/skills/${previous.slug}/)`);
    if (next) parts.push(`[${position + 2}/${siblings.length} →](%ROOT%reference/skills/${next.slug}/)`);
    if (parts.length > 0) lines.push("", parts.join(" · "));
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

/**
 * Release notes ship as Markdown with H2 headings per version; H1s, if any,
 * are demoted. The renderer prepends an edition metadata block plus links
 * to the upgrade guide and the versioned docs home. Change groups
 * (`### Minor Changes` / `### Major Changes` / `### Patch Changes` /
 * `### Security` / `### Migration`) are preserved verbatim: this renderer
 * never invents a classification the source does not state.
 */
export function renderReleaseNotes(locale, notesMarkdown, edition = {}) {
  const t = STRINGS[locale].releaseNotes;
  const body = escapeMarkdownProse(String(notesMarkdown).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")).trim();
  const rows = [];
  if (edition.version) rows.push(`- **${t.versionLabel}**: ${code(edition.version)}`);
  if (edition.releaseTag) rows.push(`- **${t.releaseTagLabel}**: ${code(edition.releaseTag)}`);
  if (edition.sourceSha) rows.push(`- **${t.sourceShaLabel}**: ${code(edition.sourceSha.slice(0, 12))}`);
  const links = [`[${t.docsHomeLabel}](%ROOT%)`, `[${t.upgradingLabel}](%ROOT%guides/upgrading/)`].join(" · ");
  const editionBlock = rows.length > 0
    ? `## ${t.editionHeading}\n\n${rows.join("\n")}\n\n${links}\n\n`
    : `${links}\n\n`;
  return `${frontmatter(t.title, t.description)}${t.intro}\n\n${editionBlock}${body}\n`;
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
