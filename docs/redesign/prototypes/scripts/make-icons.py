"""Copy the Heroicons that the prototypes use into one JavaScript file, so a page never requests an icon.

Usage: python3 -I make-icons.py <heroicons-package-dir> <out-file>
Get the package with: npm pack heroicons@2.1.5 && tar xzf heroicons-2.1.5.tgz
"""

import json
import re
import sys
from pathlib import Path

NAMES = [
    "magnifying-glass", "bars-3", "x-mark", "chevron-right",
    "exclamation-triangle", "inbox", "arrow-path", "arrow-top-right-on-square",
]


def main():
    src, out = Path(sys.argv[1]) / "24" / "outline", Path(sys.argv[2])
    icons = {}
    for name in NAMES:
        svg = (src / f"{name}.svg").read_text()
        icons[name] = "".join(re.findall(r"<path[^>]*/>", svg))
    out.write_text("window.ICONS=" + json.dumps(icons, separators=(",", ":")) + ";\n")
    print(f"{len(icons)} icons, {out.stat().st_size} bytes")


if __name__ == "__main__":
    main()
