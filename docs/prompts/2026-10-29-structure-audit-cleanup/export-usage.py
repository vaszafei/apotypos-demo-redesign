import re,glob  # run from docs/redesign/prototypes: python3 -I <this file>
ns={'UI':'components','Dash':'dash','Entity':'entity-cards','Politics':'politics','Mme':'mme','Spread':'spread','Home':'home','Shell':'shell'}
files=glob.glob('*.html')+glob.glob('assets/*.js')
txt={f:open(f,encoding='utf8').read() for f in files}
for n,src in ns.items():
    s=txt[f'assets/{src}.js']
    m=re.search(r'window\.%s\s*=\s*\{(.*)\}'%n,s)
    names=[x.strip().split(':')[0].strip() for x in m.group(1).split(',') if x.strip() and 'get ' not in x]
    # names pulled via destructuring from the namespace in any file (other than defining file)
    destr=set()
    for f,t in txt.items():
        for d in re.findall(r'(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:window\.)?%s\b'%n,t):
            for part in d.split(','):
                destr.add(part.strip().split(':')[0].strip())
    res=[]
    for nm in names:
        ext=sum(len(re.findall(r'\b%s\.%s\b'%(n,nm),t)) for f,t in txt.items() if f!=f'assets/{src}.js')
        inner=len(re.findall(r'\b%s\b'%nm,s))
        used_ext = ext>0 or nm in destr
        res.append((nm,used_ext,inner))
    dead=[a for a,u,i in res if not u and i<=2]
    internal=[a for a,u,i in res if not u and i>2]
    print(f'{n}: {len(res)} exports; DEAD (no outside use, unused inside): {dead}; internal only: {internal}')
