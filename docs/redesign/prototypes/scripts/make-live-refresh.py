"""Read the live pages /topics and /media of apotypos.org again and rewrite the fixtures of Θέματα, Μέσα and Ιστορίες.

Usage: python3 -I make-live-refresh.py <cache-dir> <out-dir>

It uses make-fixtures.py and make-mme.py. The Israeli set and the Gaza files are no longer on the live site, so those parts of the fixtures stay as they are.
"""

import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
cache, out = Path(sys.argv[1]), Path(sys.argv[2])
cache.mkdir(parents=True, exist_ok=True)
sys.argv = sys.argv[:1]


def module(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), HERE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


fixtures = module("make-fixtures")
raw, meta = {}, {}
for name in ("topics_facts", "topics_volume", "media_facts", "media_outlet", "groups"):
    raw[name], meta[name] = fixtures.fetch(cache, name, fixtures.FILES[name])
for key, fn in (("home", fixtures.home), ("media", fixtures.media), ("stories", fixtures.stories), ("storyDetail", fixtures.story_detail),
                ("outlet", fixtures.outlet), ("groups", fixtures.groups), ("peopleMatrix", fixtures.people_matrix)):
    print(f"{fixtures.write(out, key, fn(raw, meta)):>9} {key}.js")

mme = module("make-mme")
media = (out / "media.js").read_text()
media = json.loads(media[media.index("=", media.index('["media"]')) + 1:].strip().rstrip(";"))
groups = {o["slug"]: o.get("group") for o in media["outlets"]}
old = (out / "mme.js").read_text()
old = json.loads(old[old.index("=", old.index('["mme"]')) + 1:].strip().rstrip(";"))
old["sets"]["gr"] = mme.build(cache, "gr", groups)
text = json.dumps(old, ensure_ascii=False, separators=(",", ":"))
(out / "mme.js").write_text(f'window.FIXTURES=window.FIXTURES||{{}};window.FIXTURES["mme"]={text};\n')
print(f"{len(text.encode()):>9} mme.js")
