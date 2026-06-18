import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rootDir = path.resolve(appDir, "../..");
const languages = ["English", "Japanese", "Chinese"];

const data = {
  generatedAt: new Date().toISOString(),
  daily: {},
  issues: {},
  vocabulary: {}
};

for (const language of languages) {
  data.daily[language] = await readLessonFolder("01_Daily Sentences", language, parseDaily);
  data.issues[language] = await readLessonFolder("02_World Issues", language, parseIssue);
}

await mkdir(path.join(appDir, "data"), { recursive: true });
await writeFile(path.join(appDir, "data", "lessons.json"), JSON.stringify(data, null, 2));

async function readLessonFolder(section, language, parser) {
  const dir = path.join(rootDir, section, language);
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
  const lessons = [];
  for (const file of files) {
    const raw = await readFile(path.join(dir, file), "utf8");
    lessons.push(parser(raw, file, language));
  }
  return lessons;
}

function parseDaily(raw, file, language) {
  const meta = readFrontmatter(raw);
  const body = stripFrontmatter(raw);
  const sentenceSection = between(body, "## Sentences", "## 오늘 바로 써볼 문장")
    || body.replace(/^# .+\n*/, "").split("## 오늘 바로 써볼 문장")[0].trim();
  const sentenceBlocks = sentenceSection.split(/\n(?=\d+\.\s)/).map((block) => block.trim()).filter(Boolean);
  const sentences = sentenceBlocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const textLines = [];
    for (const line of lines) {
      if (line.startsWith("한국어:") || line.startsWith("고난이도") || line.startsWith("- ")) break;
      textLines.push(line.replace(/^\d+\.\s*/, ""));
    }
    const { reading, original } = splitReadingAndOriginal(textLines, language);
    const korean = (lines.find((line) => line.startsWith("한국어:")) || "").replace(/^한국어:\s*/, "");
    const expressions = extractBulletExpressions(block);
    return { reading, original, korean, expressions };
  });
  const practice = (between(body, "## 오늘 바로 써볼 문장", "").match(/-\s*(.+)/) || [])[1] || sentences[0]?.original || "";

  return {
    date: meta.date || dateFromFile(file),
    language,
    title: `${language} Daily Sentences - ${meta.date || dateFromFile(file)}`,
    practice,
    sentences,
    expressions: sentences.flatMap((sentence) => sentence.expressions),
    sourceFile: file
  };
}

function parseIssue(raw, file, language) {
  const meta = readFrontmatter(raw);
  const body = stripFrontmatter(raw);
  const issueSection = between(body, "## Issue", "## 내 의견 한 줄");
  const korean = (issueSection.match(/한국어:\s*(.+)/) || [])[1] || "";
  const expressions = extractBulletExpressions(issueSection);
  const sourceLines = issueSection.split("\n").filter((line) => line.trim().startsWith("- ["));
  const opinionSection = between(body, "## 내 의견 한 줄", "");
  const practice = (opinionSection.match(/-\s*(?:English|Japanese|Chinese):\s*(.+)/) || opinionSection.match(/-\s*한국어:\s*(.+)/) || [])[1] || korean;
  const lines = issueSection.split("\n").map((line) => line.trim()).filter(Boolean);
  const textLines = lines.filter((line) => !line.startsWith("한국어:") && !line.startsWith("고난이도") && !line.startsWith("-") && !line.startsWith("Sources:"));
  const { reading, original } = splitReadingAndOriginal(textLines, language);

  return {
    date: meta.date || dateFromFile(file),
    language,
    title: `${language} World Issue - ${meta.date || dateFromFile(file)}`,
    topic: meta.topic || "",
    practice,
    issueCards: [
      {
        title: meta.topic || "World Issue",
        reading,
        original: original || korean,
        korean,
        expressions
      }
    ],
    expressions,
    sources: sourceLines,
    sourceFile: file
  };
}

function readFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return Object.fromEntries(
    match[1].split("\n").map((line) => {
      const index = line.indexOf(":");
      if (index === -1) return null;
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }).filter(Boolean)
  );
}

function stripFrontmatter(raw) {
  return raw.replace(/^---\n[\s\S]*?\n---\n*/, "");
}

function between(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  if (start === -1) return "";
  const bodyStart = start + startHeading.length;
  const end = endHeading ? text.indexOf(endHeading, bodyStart) : -1;
  return text.slice(bodyStart, end === -1 ? text.length : end).trim();
}

function extractBulletExpressions(block) {
  const expressions = [];
  let current = null;

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("- Hiragana:") || line.startsWith("- Pinyin:")) {
      if (current) expressions.push(normalizeExpression(current));
      const [label, ...rest] = line.replace(/^- /, "").split(":");
      current = { readingLabel: label.trim(), reading: rest.join(":").trim() };
      continue;
    }

    if (current && (line.startsWith("표현:") || line.startsWith("한국어:") || line.startsWith("활용:"))) {
      const [label, ...rest] = line.split(":");
      current[label.trim()] = rest.join(":").trim();
      continue;
    }

    if (!line.startsWith("- ")) continue;
    const value = line.replace(/^- /, "");
    if (value.startsWith("[")) continue;
    if (current) {
      expressions.push(normalizeExpression(current));
      current = null;
    }
    const [term, ...rest] = value.split(":");
    if (cleanLabel(term)) {
      expressions.push({ term: cleanLabel(term), meaning: cleanLabel(rest.join(":").trim()) });
    }
  }

  if (current) expressions.push(normalizeExpression(current));
  return expressions.filter((item) => item.term);
}

function normalizeExpression(item) {
  return {
    term: cleanLabel(item["표현"] || item.term || ""),
    reading: cleanLabel(item.reading || ""),
    meaning: cleanLabel(item["한국어"] || item.meaning || ""),
    note: cleanLabel(item["활용"] || "")
  };
}

function cleanLabel(value) {
  return String(value || "").replace(/^(Hiragana|Pinyin|표현|한국어|활용):\s*/, "").trim();
}

function splitReadingAndOriginal(textLines, language) {
  const lines = textLines.filter(Boolean);
  if ((language === "Japanese" || language === "Chinese") && lines.length >= 2) {
    return { reading: lines[0], original: lines[1] };
  }
  return { reading: "", original: lines[0] || "" };
}

function dateFromFile(file) {
  return (file.match(/\d{4}-\d{2}-\d{2}/) || [""])[0];
}
