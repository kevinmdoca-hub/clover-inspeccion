"""Install only the canonical Clover header and optional MI browser chrome.
Never writes application business logic, authentication, manifests or installed icons.
"""
import ast, hashlib, io, json, re, shutil, subprocess, sys, urllib.request
from pathlib import Path
from PIL import Image
BASE_OLD_JS='db4b8232c0ce1cfc993b4a77017428e110817292e91541b7ffee48ce533008fe'
BASE_OLD_CSS='e012c44acd41e5dbea2e9764d54ee88fa0088e73eed0150d52f95eb6b7053b98'
NEW_JS='3d45770b85171429cbdc76f9533eb087f5cd73a87287768be9cca5e542cb6e87'
NEW_CSS='b73a45c45cb4bab633668b5bd6be28876fe56fdeb48f4d475164bf9167a05a04'
BRAND='5d7096e05bad83996c9c5ea2a56afc4d039b984b67cbb47ad3944dd458e2fc65'
ORIGINAL='8ef7b679b08699f39cf9b00329a097ec8aea0685eece5ff1f89d233e20c646df'
SOURCE='https://raw.githubusercontent.com/kevinmdoca-hub/clover-inspeccion/16a12c10d3a9fe46feaacc59ebd6023e9635a59c/brand-mark.png'
def sha(b): return hashlib.sha256(b).hexdigest()
def save(p,text):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8')
def checked_path(s):
 p=Path(s)
 if p.is_absolute() or '..' in p.parts: raise ValueError('Repository-relative path required')
 return p
release=Path(sys.argv[1]); cfg=json.loads(sys.argv[2]); root=checked_path(cfg['root']); component=checked_path(cfg['component']); folder=component.parent
# Reject unexpected component changes instead of overwriting another workstream.
assert sha(component.read_bytes()) in (BASE_OLD_JS,NEW_JS),'Header changed; reconcile before publishing'
assert sha((folder/'clover-shell-header.css').read_bytes()) in (BASE_OLD_CSS,NEW_CSS),'Header CSS changed; reconcile before publishing'
tracked=[Path(x) for x in subprocess.check_output(['git','ls-files','-z']).decode().split('\0') if x]
protected={str(p):sha(p.read_bytes()) for p in tracked if p.is_file() and (p.suffix.lower() in ('.png','.webp','.jpg','.jpeg','.svg') or p.name=='manifest.webmanifest')}
for filename,want in [('clover-shell-header.js',NEW_JS),('clover-shell-header.css',NEW_CSS)]:
 data=(release/filename).read_bytes();assert sha(data)==want,filename+' integrity failure';(folder/filename).write_bytes(data)
# Reuse the original login PNG exactly; only fully transparent padding is removed.
source=release/'sign-in-brand-mark-original.png'
if source.exists(): data=source.read_bytes()
else:
 with urllib.request.urlopen(SOURCE,timeout=30) as response:data=response.read()
assert sha(data)==ORIGINAL,'Not the approved sign-in Clover'
im=Image.open(io.BytesIO(data)).convert('RGBA');crop=im.crop((85,86,412,412));out=io.BytesIO();crop.save(out,format='PNG',optimize=True)
assert sha(out.getvalue())==BRAND,'Lossless crop encoding differs from canonical PNG'
(folder/'clover-brand-mark-v1.png').write_bytes(out.getvalue())
manifest={'name':'clover-shell-header','version':'1.1.2','sha256':NEW_JS,'css_sha256':NEW_CSS,'brand_sha256':BRAND,'required_files':['clover-shell-header.js','clover-shell-header.css','clover-brand-mark-v1.png'],'canonical_file':str(component),'rule':'Consume unchanged; preserve five clover-* event handlers.','source_brand':{'url':SOURCE,'sha256':ORIGINAL,'crop':[85,86,412,412],'pixel_identity_verified':True}}
save(folder/'manifest.json',json.dumps(manifest,indent=2)+'\n')
if folder.name=='dist' and (folder.parent/'manifest.json').exists():save(folder.parent/'manifest.json',json.dumps(manifest,indent=2)+'\n')
index=root/'index.html';text=index.read_text()
pattern=r'(clover-shell-header\.js)(?:\?[^\s\"\'<>]*)?(?=[\"\'])'
text,n=re.subn(pattern,r'\1?v=1.1.2',text)
if n==0:
 # Service imports the component from its ES-module entry point, not index.html.
 entry=root/'app.js';code=entry.read_text()
 first="import './shared/clover-ui/clover-shell-header.js';"
 assert code.startswith(first),'Expected one verified Service module import'
 save(entry,code.replace(first,"import './shared/clover-ui/clover-shell-header.js?v=1.1.2';",1))
else:
 assert n==1,'Expected one existing header import; refusing to create duplicate headers'
if cfg.get('mi'):
 for ext in ('js','css'):
  src=release/('shell-browser-chrome.'+ext);dest=root/'foundation'/src.name;shutil.copyfile(src,dest)
 tags=[('apple-mobile-web-app-capable','yes'),('apple-mobile-web-app-status-bar-style','black-translucent')]
 for name,value in tags:
  p=r'<meta\b[^>]*\bname=[\"\']'+name+r'[\"\'][^>]*>';tag=f'<meta name="{name}" content="{value}">'
  if re.search(p,text,re.I):text=re.sub(p,tag,text,flags=re.I)
  else:text=text.replace('</head>',tag+'\n</head>',1)
 for ext,tag in [('css','<link rel="stylesheet" href="foundation/shell-browser-chrome.css?v=1.1.2">'),('js','<script defer src="foundation/shell-browser-chrome.js?v=1.1.2"></script>')]:
  if 'foundation/shell-browser-chrome.'+ext not in text:text=text.replace('</head>',tag+'\n</head>',1)
save(index,text)
# Update integrity tests to the new immutable release; never remove or bypass tests.
for directory in ['tests','scripts']:
 d=Path(directory)
 if not d.exists():continue
 for p in d.rglob('*'):
  if not p.is_file() or p.suffix not in ('.js','.cjs','.mjs','.py'):continue
  text=p.read_text();new=text.replace(BASE_OLD_JS,NEW_JS).replace(BASE_OLD_CSS,NEW_CSS)
  if 'clover-shell-header' in text and new!=text:
   new=new.replace('1.1.1','1.1.2').replace('1\\.1\\.1','1\\.1\\.2')
   save(p,new)
for p in [folder/'COMPONENT_SHA256.txt',folder.parent/'COMPONENT_SHA256.txt']:
 if p.exists():save(p,p.read_text().replace(BASE_OLD_JS,NEW_JS).replace(BASE_OLD_CSS,NEW_CSS))
# Ensure explicitly allowlisted Routes builds ship the newly required brand PNG.
if cfg.get('routes'):
 p=Path('build.mjs');text=p.read_text();needle="await copyFile('shared/clover-ui/clover-shell-header.css','dist/shared/clover-ui/clover-shell-header.css');"
 assert needle in text,'Unexpected Routes build structure'
 if 'clover-brand-mark-v1.png' not in text:text=text.replace(needle,needle+"\nawait copyFile('shared/clover-ui/clover-brand-mark-v1.png','dist/shared/clover-ui/clover-brand-mark-v1.png');")
 save(p,text)
# Keep each app's existing cache/activation behavior; change only version and static list.
# MI's legacy worker only unregisters itself and is not part of the review build.
for worker_name in (() if cfg.get('mi') else ('sw.js','service-worker.js')):
 worker=root/worker_name
 if not worker.exists():continue
 text=worker.read_text();match=re.search(r'const\s+(ASSETS|SHELL|CORE|PRECACHE)\s*=\s*(\[[\s\S]*?\]);',text)
 assert match,'Unsupported cache structure: '+str(worker)
 assets=ast.literal_eval(match.group(2));relative=component.relative_to(root).as_posix();css=relative.replace('.js','.css');brand=str(Path(relative).parent/'clover-brand-mark-v1.png')
 assets=[re.sub(r'(clover-shell-header\.js)\?[^\s]+',r'\1?v=1.1.2',x) for x in assets]
 prefix='/' if any(x=='/index.html' for x in assets) else './' if any(x=='./index.html' for x in assets) else ''
 for value in [relative,relative+'?v=1.1.2',css,css+'?v=1.1.2',brand]:
  value=prefix+value
  if value not in assets:assets.append(value)
 text=text[:match.start(2)]+json.dumps(assets,separators=(',',':'))+text[match.end(2):]
 if 'const CACHE = PREFIX + RELEASE;' in text:text=text.replace('const CACHE = PREFIX + RELEASE;',"const CACHE = PREFIX + RELEASE + '-header112';")
 else:
  text,n=re.subn(r"(const\s+CACHE\s*=\s*)(['\"`])([^'\"`]+)(\2)",lambda m:m.group(1)+m.group(2)+m.group(3).removesuffix('-header112')+'-header112'+m.group(4),text,count=1)
  assert n,'Cache version not found'
 pin=re.search(r'const ASSET_SHA256=(\{[^;]+\});',text)
 if pin:
  hashes={name:sha((root/name.split('?')[0].lstrip('./')).read_bytes()) for name in assets}
  text=text[:pin.start(1)]+json.dumps(hashes,separators=(',',':'))+text[pin.end(1):]
 save(worker,text);subprocess.run(['node','--check',str(worker)],check=True)
# A header release must never modify the approved installation icon family.
assert all(Path(p).exists() and sha(Path(p).read_bytes())==s for p,s in protected.items()),'Approved icon or manifest altered'
subprocess.run(['node','--check',str(component)],check=True)
report_path=Path('CLOVER_UI_RELEASE_REPORT.json')
report=json.loads(report_path.read_text()) if report_path.exists() else {}
report.update({'header_version':'1.1.2','component':str(component),'js_sha256':NEW_JS,'css_sha256':NEW_CSS,'brand_sha256':BRAND,'sign_in_brand_source_sha256':ORIGINAL,'approved_app_icons_unchanged':True,'manifest_identity_unchanged':True,'header_business_handlers_unchanged':True,'mi_browser_chrome_adapter':bool(cfg.get('mi')),'physical_header_acceptance':'pending','no_business_logic_or_user_data_changes':True})
save(report_path,json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
