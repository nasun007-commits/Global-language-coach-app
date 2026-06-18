import re
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
INDEX = APP_DIR / "index.html"
SW = APP_DIR / "sw.js"


def main():
    index_text = INDEX.read_text(encoding="utf-8")
    sw_text = SW.read_text(encoding="utf-8")
    versions = [int(value) for value in re.findall(r"\?v=(\d+)", index_text)]
    versions += [int(value) for value in re.findall(r"global-language-coach-v(\d+)", sw_text)]
    next_version = max(versions or [0]) + 1

    index_text = re.sub(r"\?v=\d+", f"?v={next_version}", index_text)
    sw_text = re.sub(r"global-language-coach-v\d+", f"global-language-coach-v{next_version}", sw_text)
    sw_text = re.sub(r"\?v=\d+", f"?v={next_version}", sw_text)

    INDEX.write_text(index_text, encoding="utf-8")
    SW.write_text(sw_text, encoding="utf-8")
    print(f"Updated app cache version to v{next_version}")


if __name__ == "__main__":
    main()
