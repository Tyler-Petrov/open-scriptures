"""Load the public-domain KJV into a user cache for asset build scripts.

The Scripture corpus is deployment data in Convex. Strong's and semantic
indexes still need the exact source text when they are regenerated, so those
one-off builders download it without writing a copy into the repository.
"""

import json
import re
import time
from pathlib import Path
from urllib.request import urlopen


WORKSPACE = Path(__file__).resolve().parents[3]
CACHE = Path.home() / ".cache" / "open-scripture-kjv"
RAW_BASE = "https://raw.githubusercontent.com/aruljohn/Bible-kjv/master"


def book_order():
    source = (WORKSPACE / "packages/core/src/books.ts").read_text()
    rows = re.findall(r'\["([^"]+)", "([^"]+)", (\d+)\]', source)
    if len(rows) != 66:
        raise RuntimeError(f"Expected 66 books in packages/core/src/books.ts, found {len(rows)}")
    return [(abbrev, name.replace(" ", "")) for abbrev, name, _chapters in rows]


def load_book(filename):
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{filename}.json"
    if not cached.exists():
        url = f"{RAW_BASE}/{filename}.json"
        error = None
        for attempt in range(4):
            try:
                with urlopen(url, timeout=30) as response:
                    cached.write_bytes(response.read())
                break
            except Exception as exc:
                error = exc
                time.sleep(attempt + 1)
        else:
            raise RuntimeError(f"Could not download {url}") from error

    raw = json.loads(cached.read_text())
    chapters = [
        [re.sub(r"\s+", " ", str(verse["text"])).strip() for verse in chapter["verses"]]
        for chapter in raw["chapters"]
    ]
    return {"name": raw.get("book", filename), "chapters": chapters}
