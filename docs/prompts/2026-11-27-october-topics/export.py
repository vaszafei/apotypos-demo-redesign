import json, numpy as np
from pathlib import Path
OUT = Path("/home/zafnitlab/Documents/apotypos-demo-redesign/docs/redesign/prototypes/scripts/october-topics.json")
EN = {
 "Κόμματα και δημοσκοπήσεις": "Parties and polls", "Επιχειρήσεις και επενδύσεις": "Business and investment",
 "Αστυνομικά: επιθέσεις και κακοποίηση": "Crime: assaults and abuse", "Τηλεόραση και showbiz": "TV and showbiz",
 "Αγορές και τιμές ενέργειας": "Markets and energy prices", "Ταραχές στη Γαλλία": "Unrest in France",
 "Χρηστικά: επιδόματα, συντάξεις, εορτολόγιο": "Service news: benefits, pensions, name days", "Πόλεμος στην Ουκρανία": "War in Ukraine",
 "Τροχαία, πτήσεις και συμβάντα": "Road, air and other incidents", "Πολιτισμός": "Culture", "Ποδόσφαιρο: αγώνες": "Football: matches",
 "Δυστυχήματα και τραγωδίες": "Accidents and disasters", "Μέση Ανατολή και Ιράν": "Middle East and Iran",
 "Σύνοδος ΕΕ και ακρίβεια": "EU summit and cost of living", "Κλοπές, απάτες και ναρκωτικά": "Theft, fraud and drugs",
 "Αθλητικά: ομάδες και πρόσωπα": "Sport: clubs and people", "Σκάνδαλο στο μπάσκετ": "Basketball scandal",
 "Θεσμοί, δικαιοσύνη και διοίκηση": "Institutions, justice and administration", "Εξωτερική πολιτική": "Foreign policy",
 "Διεθνή πρόσωπα": "International figures", "Lifestyle, σπίτι και κουζίνα": "Lifestyle, home and cooking",
 "Τεχνολογία και μεγάλες εταιρείες": "Tech and big companies", "Τουρκολιβυκό, NAVTEX και καλώδιο": "Turkey–Libya deal, NAVTEX and the cable",
 "Κακοκαιρία στη Ρόδο και σεισμοί": "Storm on Rhodes and earthquakes", "Τραμπ και ΗΠΑ": "Trump and the US", "Ανά τον κόσμο": "Around the world",
 "28η Οκτωβρίου και συλλαλητήρια": "28 October and rallies", "Καιρός": "Weather", "Διαδηλώσεις στην Αλβανία": "Protests in Albania",
 "Ναυτιλία και λιμάνια": "Shipping and ports", "Pizza Fan και «Χωριάτικο»": "Pizza Fan and «Choriatiko»", "Υπόθεση Γκίλφοϊλ": "The Guilfoyle affair",
 "Εκλογές στο εξωτερικό": "Elections abroad", "Θάνατοι προσώπων": "Deaths of public figures",
 "Εκρήξεις και ύποπτα αντικείμενα": "Explosions and suspicious objects", "Θάνατος Μαζωνάκη": "Death of Mazonakis", "Υγεία": "Health",
 "Δίκη για τα Τέμπη": "Tempi trial", "Γκράβα και Κυψέλη": "Grava and Kypseli", "Social media και ανήλικοι": "Social media and minors",
}
SOFT = {"Τηλεόραση και showbiz", "Ποδόσφαιρο: αγώνες", "Αθλητικά: ομάδες και πρόσωπα", "Πολιτισμός", "Lifestyle, σπίτι και κουζίνα", "Καιρός",
        "Τεχνολογία και μεγάλες εταιρείες", "Χρηστικά: επιδόματα, συντάξεις, εορτολόγιο", "Ανά τον κόσμο", "Διεθνή πρόσωπα"}
names = json.load(open("out/names.json"))["names"]
assert set(names) == set(EN), set(names) ^ set(EN)
final = np.load("out/final-labels.npy")
ids = np.array(json.load(open("out/meta-k36.json"))["ids"])
order = sorted(range(len(names)), key=lambda k: -(final == k).sum())
topics = [{"el": names[k], "en": EN[names[k]], "soft": names[k] in SOFT, "articles": sorted(ids[final == k].tolist())} for k in order]
OUT.write_text(json.dumps({
  "_note": "The topics of 14-27 Oct 2026 (#214): bge-m3 vectors of the dump manual-20261028T155347Z.dump clustered (full KMeans k=36, seed 1), "
           "8 mixed clusters split in 3 and the parts joined to a named topic by hand. Built by docs/prompts/2026-11-27-october-topics/ "
           "(spike.py, sub.py, names.py, export.py). Each topic lists the ids of its articles in the articles table of the dump.",
  "topics": topics}, ensure_ascii=False, separators=(",", ":")) + "\n")
print(len(topics), "topics", sum(len(t["articles"]) for t in topics), "articles", OUT.stat().st_size // 1024, "KB")
