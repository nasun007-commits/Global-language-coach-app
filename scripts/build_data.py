import json
import re
from datetime import datetime, timezone
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = APP_DIR.parents[1]
LANGUAGES = ["English", "Japanese", "Chinese"]


def main():
    data = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "daily": {},
        "issues": {},
        "vocabulary": {},
    }
    for language in LANGUAGES:
        data["daily"][language] = read_lesson_folder("01_Daily Sentences", language, parse_daily)
        data["issues"][language] = read_lesson_folder("02_World Issues", language, parse_issue)

    out_dir = APP_DIR / "data"
    out_dir.mkdir(exist_ok=True)
    (out_dir / "lessons.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read_lesson_folder(section, language, parser):
    folder = ROOT_DIR / section / language
    return [parser(path.read_text(encoding="utf-8"), path.name, language) for path in sorted(folder.glob("*.md"))]


def parse_daily(raw, file_name, language):
    meta = read_frontmatter(raw)
    body = strip_frontmatter(raw)
    sentence_section = between(body, "## Sentences", "## 오늘 바로 써볼 문장")
    if not sentence_section:
        sentence_section = re.sub(r"^# .+\n*", "", body).split("## 오늘 바로 써볼 문장")[0].strip()

    sentences = []
    for block in [part.strip() for part in re.split(r"\n(?=\d+\.\s)", sentence_section) if part.strip()]:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        text_lines = []
        for line in lines:
            if line.startswith(("한국어:", "고난이도", "- ")):
                break
            text_lines.append(re.sub(r"^\d+\.\s*", "", line))
        reading, original = split_reading_and_original(text_lines, language)
        korean = next((line.replace("한국어:", "", 1).strip() for line in lines if line.startswith("한국어:")), "")
        expressions = extract_bullet_expressions(block)
        sentences.append({"reading": reading, "original": original, "korean": korean, "expressions": expressions})

    practice_match = re.search(r"-\s*(.+)", between(body, "## 오늘 바로 써볼 문장", ""))
    date = meta.get("date") or date_from_file(file_name)
    return {
        "date": date,
        "language": language,
        "title": f"{language} Daily Sentences - {date}",
        "practice": practice_match.group(1) if practice_match else (sentences[0]["original"] if sentences else ""),
        "sentences": sentences,
        "expressions": [expr for sentence in sentences for expr in sentence["expressions"]],
        "sourceFile": file_name,
    }


def parse_issue(raw, file_name, language):
    meta = read_frontmatter(raw)
    body = strip_frontmatter(raw)
    issue_section = between(body, "## Issue", "## 내 의견 한 줄")
    korean_match = re.search(r"한국어:\s*(.+)", issue_section)
    korean = korean_match.group(1) if korean_match else ""
    expressions = extract_bullet_expressions(issue_section)
    opinion_section = between(body, "## 내 의견 한 줄", "")
    practice_match = re.search(r"-\s*(?:English|Japanese|Chinese):\s*(.+)", opinion_section) or re.search(r"-\s*한국어:\s*(.+)", opinion_section)
    lines = [line.strip() for line in issue_section.splitlines() if line.strip()]
    text_lines = [
        line for line in lines
        if not line.startswith(("한국어:", "고난이도", "-", "Sources:"))
    ]
    reading, original = split_reading_and_original(text_lines, language)
    date = meta.get("date") or date_from_file(file_name)
    return {
        "date": date,
        "language": language,
        "title": f"{language} World Issue - {date}",
        "topic": meta.get("topic", ""),
        "practice": practice_match.group(1) if practice_match else korean,
        "issueCards": [{
            "title": meta.get("topic", "") or "World Issue",
            "reading": reading,
            "original": original or korean,
            "korean": korean,
            "expressions": expressions,
        }],
        "expressions": expressions,
        "sources": [line for line in issue_section.splitlines() if line.strip().startswith("- [")],
        "sourceFile": file_name,
    }


def read_frontmatter(raw):
    match = re.match(r"^---\n([\s\S]*?)\n---", raw)
    if not match:
        return {}
    meta = {}
    for line in match.group(1).splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip()
    return meta


def strip_frontmatter(raw):
    return re.sub(r"^---\n[\s\S]*?\n---\n*", "", raw)


def between(text, start_heading, end_heading):
    start = text.find(start_heading)
    if start == -1:
        return ""
    body_start = start + len(start_heading)
    end = text.find(end_heading, body_start) if end_heading else -1
    return text[body_start:(len(text) if end == -1 else end)].strip()


def extract_bullet_expressions(block):
    expressions = []
    current = None
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if line.startswith("- Hiragana:") or line.startswith("- Pinyin:"):
            if current:
                expressions.append(normalize_expression(current))
            label, _, value = line[2:].partition(":")
            current = {"readingLabel": label.strip(), "reading": value.strip()}
            continue

        if current and line.startswith(("표현:", "한국어:", "활용:")):
            label, _, value = line.partition(":")
            current[label.strip()] = value.strip()
            continue

        if not line.startswith("- "):
            continue
        value = line[2:]
        if value.startswith("["):
            continue
        if current:
            expressions.append(normalize_expression(current))
            current = None
        term, _, meaning = value.partition(":")
        term = clean_label(term)
        if term:
            expressions.append({"term": term, "meaning": clean_label(meaning)})
    if current:
        expressions.append(normalize_expression(current))
    return expressions


def normalize_expression(item):
    term = item.get("표현") or item.get("term") or ""
    meaning = item.get("한국어") or item.get("meaning") or ""
    note = item.get("활용") or ""
    return {
        "term": clean_label(term),
        "reading": clean_label(item.get("reading", "")),
        "meaning": clean_label(meaning),
        "note": clean_label(note),
    }


def clean_label(value):
    return re.sub(r"^(Hiragana|Pinyin|표현|한국어|활용):\s*", "", value or "").strip()


def split_reading_and_original(text_lines, language):
    text_lines = [line for line in text_lines if line]
    if language in {"Japanese", "Chinese"} and len(text_lines) >= 2:
        return text_lines[0], text_lines[1]
    return "", text_lines[0] if text_lines else ""


def date_from_file(file_name):
    match = re.search(r"\d{4}-\d{2}-\d{2}", file_name)
    return match.group(0) if match else ""


if __name__ == "__main__":
    main()
