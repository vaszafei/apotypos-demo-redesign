"""Read each UN speech of a running Apotypos app and write one small fixture for the page of one speech.

Usage: python3 -I make-speeches-local.py [app-base] [out-dir]   (default http://localhost:3002 and ../data/speeches)

The page speech-v2.html loads only the file of its speech, so a visitor never downloads the other 191.
compare comes from the index of all speeches: the share of each topic here, the mean of the others, the rank and how many others spoke of it.
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3002"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE.parent / "data" / "speeches"
DOMESTIC = "Domestic affairs"
COMPARE = 8


def get(path):
    with urllib.request.urlopen(f"{BASE}/data/speeches/unga81/{path}", timeout=60) as r:
        return json.load(r)


def speech(vid):
    """The file of a speech. The server cannot serve a few names, for example one with a leading dash: those return None and get no page."""
    try:
        return get(f"{vid}.json")
    except urllib.error.HTTPError as e:
        print(f"skip {vid}: {e.code}")
        return None


def from_index(s):
    press = s.get("press") or {}
    return {
        "video": {"title": ""}, "speaking_seconds": s["seconds"], "words_spoken": s["words"],
        "topics": [{"topic": x["topic"], "share": x["said"], "seconds": x["said"] * s["seconds"]} for x in s.get("svr", [])],
        "timeline": [], "transcript": [], "greece": [], "stances": {k: [{"stance": v}] for k, v in s.get("stances", {}).items()},
        "claims": s.get("claims", []), "promises": s.get("promises", []), "attacks": s.get("attacks", []),
        "said_vs_reported": [{"topic": x["topic"], "said_share": x["said"], "reported_share": x["reported"], "articles": x["articles"]} for x in s.get("svr", [])],
        "pickup": [{"outlet": x["outlet"], "published_at": x.get("published_at", ""), "title": x["title"], "url": x["url"], "tone": x.get("tone")} for x in press.get("headlines", [])],
    }


def compare(speaker, everyone):
    rows = []
    others = len(everyone) - 1
    for topic, share in sorted(speaker["shares"].items(), key=lambda kv: -kv[1]):
        if topic == DOMESTIC or len(rows) == COMPARE:
            continue
        values = [s["shares"].get(topic, 0) for s in everyone if s["vid"] != speaker["vid"]]
        rows.append({"topic": topic, "share": round(share, 4), "mean": round(sum(values) / others, 4),
                     "rank": 1 + sum(v > share for v in values), "others": sum(v > 0 for v in values)})
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    everyone = get("index.json")["speakers"]
    total = 0
    for s in everyone:
        # A speech with no file (its id starts with a dash): the index holds all but the title, the minutes on the timeline and the text.
        d = speech(s["vid"]) or from_index(s)
        data = {
            "vid": s["vid"], "speaker": s["speaker"], "role": s["role"], "country": s["country"], "region": s["region"], "url": s["url"], "date": s["date"],
            "title": d["video"]["title"], "seconds": round(d["speaking_seconds"]), "words": d["words_spoken"], "counts": s["counts"],
            "topics": [{"topic": x["topic"], "share": round(x["share"], 4), "seconds": round(x["seconds"])} for x in d["topics"]],
            "timeline": [[round(x["start"]), round(x["end"]), x["topic"]] for x in d["timeline"]],
            "stances": {k: v[0]["stance"] for k, v in d.get("stances", {}).items() if v},
            "claims": [{"t": round(x["t"]), "quote": x["quote"], "topic": x["topic"], "kind": x.get("kind")} for x in d.get("claims", [])],
            "promises": [{"t": round(x["t"]), "quote": x["quote"], "topic": x["topic"], "kind": x.get("kind")} for x in d.get("promises", [])],
            "attacks": [{"t": round(x["t"]), "quote": x["quote"], "topic": x["topic"], "target": x.get("target_canon") or x.get("target")} for x in d.get("attacks", [])],
            "greece": [{"t": round(x["t"]), "quote": x["quote"], "refers": x["refers_to"], "tone": x["tone"], "el": x.get("summary_el"), "en": x.get("summary_en")} for x in d.get("greece", [])],
            "said": [{"topic": x["topic"], "said": round(x["said_share"], 4), "reported": round(x["reported_share"], 4), "articles": x["articles"]} for x in d.get("said_vs_reported", [])],
            "pickup": [{"outlet": x["outlet"], "date": x["published_at"][:10], "title": x["title"], "url": x["url"], "tone": x.get("tone")} for x in d.get("pickup", [])],
            "transcript": [{"t": round(x["start"]), "topic": x["topic"], "text": x["text"]} for x in d["transcript"]],
            "compare": compare(s, everyone),
        }
        text = 'window.FIXTURES=window.FIXTURES||{};window.FIXTURES["speech"]=' + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
        (OUT / f"{s['vid']}.js").write_text(text)
        total += len(text.encode())
    print(f"{len(everyone)} speeches, {total // 1024} KB")


main()
