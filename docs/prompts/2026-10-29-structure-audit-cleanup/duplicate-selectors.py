import re,glob,collections
d=collections.defaultdict(set)
for f in glob.glob('assets/*.css'):
    s=re.sub(r'/\*.*?\*/','',open(f,encoding='utf8').read(),flags=re.S)
    for m in re.finditer(r'(?:^|\})\s*([^{}@]+)\{',s):
        for sel in m.group(1).split(','):
            sel=' '.join(sel.split())
            if sel: d[sel].add(f.split('/')[-1])
multi={k:v for k,v in d.items() if len(v)>1}
print(len(multi),'selectors defined in 2+ files')
for k,v in list(sorted(multi.items(), key=lambda x:-len(x[1])))[:12]: print(' ',k,sorted(v))
