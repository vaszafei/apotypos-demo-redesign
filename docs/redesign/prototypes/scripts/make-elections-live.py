"""Read the live page /elections of apotypos.org and write data/elections.js. Its Nuxt payload holds the whole page, as "elections-facts".

Usage: python3 -I make-elections-live.py <cache-dir> <out-dir>
"""

import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).parent
cache, out = Path(sys.argv[1]), Path(sys.argv[2])
cache.mkdir(parents=True, exist_ok=True)
sys.argv = sys.argv[:1]
spec = importlib.util.spec_from_file_location("make_politics_world", HERE / "make-politics-world.py")
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)
raw, _ = world.base.fetch(cache, "page_elections", "/elections")
print(f"{world.base.write(out, 'elections', world.nuxt_payload(raw.read_text())['data']['elections-facts']):>8} elections.js")
