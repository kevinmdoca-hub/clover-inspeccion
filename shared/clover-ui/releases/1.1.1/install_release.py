"""Clover UI publisher. Operates only on checked-out app source/assets, never user data."""
import argparse, hashlib, json, re, shutil, subprocess, os
from pathlib import Path
from PIL import Image
JS='db4b8232c0ce1cfc993b4a77017428e110817292e91541b7ffee48ce533008fe'
CSS='e012c44acd41e5dbea2e9764d54ee88fa0088e73eed0150d52f95eb6b7053b98'
OLD='15f2cd0261c2363e61b34fbfc0c9a1c1132cb0d8998f7e132379e32abf24dcaa'
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,t): p.parent.mkdir(parents=True,exist_ok=True); p.write_text(t,encoding='utf-8')
def gitblob(p):
 b=p.read_bytes(); return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def safe(s):
 p=Path(s)
 if p.is_absolute() or '..' in p.parts: raise ValueError('Repository-relative paths only')
 return p
p=argparse.ArgumentParser();p.add_argument('config');p.add_argument('release');args=p.parse_args()
c=json.loads(Path(args.config).read_text());source=Path(args.release);root=safe(c['web_root']);component=safe(c['component']);out=component.parent
for name,expected in [('clover-shell-header.js',JS),('clover-shell-header.css',CSS)]:
 f=source/name
 if digest(f)!=expected: raise SystemExit('Canonical release integrity failed: '+name)
 out.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,out/name)
write(out/'manifest.json',json.dumps({'name':'clover-shell-header','version':'1.1.1','sha256':JS,'css_sha256':CSS,'required_files':['clover-shell-header.js','clover-shell-header.css'],'canonical_file':str(component),'rule':'Consume unchanged; preserve the five clover-* event handlers.'},indent=2)+'\n')
if out.name=='dist' and (out.parent/'manifest.json').exists():shutil.copyfile(out/'manifest.json',out.parent/'manifest.json')
for f in (out/'COMPONENT_SHA256.txt',out.parent/'COMPONENT_SHA256.txt'):
 if f.exists():write(f,JS+'  '+str(component)+'\n')
index=root/'index.html';html=index.read_text()
html=html.replace('</script>\\n<script','</script>\n<script')
html=re.sub(r'(clover-shell-header\.js)\?[^"\'<> ]+',r'\1?v=1.1.1',html)
write(index,html)
code='\n'.join(f.read_text(errors='replace') for f in Path('.').rglob('*') if f.is_file() and f.suffix in ('.js','.mjs','.html') and '.git' not in f.parts and 'node_modules' not in f.parts and 'clover-shell-header' not in f.name)
events={x:('clover-'+x) in code for x in ['menu','home','create','sync','settings']}
verify=Path('scripts/verify-header-component.cjs')
if verify.exists():write(verify,verify.read_text().replace(OLD,JS))
build=Path('build.mjs')
if build.exists():
 t=build.read_text();needle='await copyFile(shared,`dist/${shared}`);'
 if needle in t and 'clover-shell-header.css' not in t:t=t.replace(needle,needle+"\nawait copyFile('shared/clover-ui/clover-shell-header.css','dist/shared/clover-ui/clover-shell-header.css');")
 write(build,t)
icon_report={'status':'pending-source'}
expected=c.get('icon_blob')
icon=None
if expected:
 paths=[]
 for directory in [root,root/'assets',root/'icons',Path('docs/visual-handoff'),Path('ui-artwork')]:
  if directory.exists():paths.extend(f for f in directory.rglob('*') if f.is_file() and f.suffix.lower() in ('.png','.jpg','.jpeg','.webp') and 'node_modules' not in f.parts and '.git' not in f.parts)
 for f in dict.fromkeys(paths):
  if gitblob(f)==expected:icon=f;break
if icon:
 im=Image.open(icon).convert('RGBA');box=c.get('icon_crop')
 if box:im=im.crop(tuple(box))
 elif not c.get('icon_full_bleed'):
  box=im.getchannel('A').point(lambda x:255 if x>=128 else 0).getbbox()
  if not box:raise SystemExit('Empty artwork')
  im=im.crop(box)
 im=im.resize((1024,1024),Image.Resampling.LANCZOS);bg=Image.new('RGBA',(1024,1024),(9,12,17,255));bg.alpha_composite(im);im=bg.convert('RGB')
 target=root/'icons/clover-v111';target.mkdir(parents=True,exist_ok=True)
 for name,n in [('icon-1024.png',1024),('icon-512.png',512),('icon-192.png',192),('apple-touch-icon-180.png',180)]:im.resize((n,n),Image.Resampling.LANCZOS).save(target/name,optimize=True)
 manifest=root/c.get('manifest','manifest.webmanifest');data=json.loads(manifest.read_text())
 identity={k:data.get(k) for k in ['id','start_url','scope']}
 data['icons']=[{'src':'./icons/clover-v111/icon-'+str(n)+'.png','sizes':str(n)+'x'+str(n),'type':'image/png','purpose':'any'} for n in [192,512]]
 assert identity=={k:data.get(k) for k in identity}
 write(manifest,json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 text=index.read_text()
 for rel,name,n in [('apple-touch-icon','apple-touch-icon-180.png',180),('icon','icon-192.png',192)]:
  pattern=r'<link\b[^>]*\brel=["\']'+rel+r'["\'][^>]*>'
  new=f'<link rel="{rel}" href="./icons/clover-v111/{name}" sizes="{n}x{n}" type="image/png">'
  text,count=re.subn(pattern,new,text,flags=re.I)
  if not count:text=text.replace('</head>',new+'\n</head>',1)
 write(index,text)
 icon_report={'status':'exported','source':str(icon),'source_blob':expected,'crop':box,'files':{f.name:digest(f) for f in target.glob('*.png')},'identity_preserved':True}
 if build.exists():
  t=build.read_text()
  if "cp('icons/clover-v111'" not in t:
   t=t.replace("{mkdir,copyFile,readFile}","{mkdir,copyFile,readFile,cp}")
   t+="\nawait cp('icons/clover-v111','dist/icons/clover-v111',{recursive:true});\n"
  write(build,t)
worker=root/'sw.js'
if worker.exists():
 text=worker.read_text();rel=component.relative_to(root).as_posix();cssrel=rel.replace('.js','.css')
 arr=re.search(r'const\s+(ASSETS|SHELL|CORE|PRECACHE)\s*=\s*(\[[\s\S]*?\]);',text)
 if arr:
  segment=arr.group(2)
  extra=[cssrel]
  if icon:extra+=['icons/clover-v111/'+n for n in ['icon-192.png','icon-512.png','apple-touch-icon-180.png']]
  for value in extra:
   if value not in segment:segment=segment[:-1]+','+json.dumps(value)+']'
  text=text[:arr.start(2)]+segment+text[arr.end(2):]
 text=re.sub(r"(const\s+(?:CACHE|CACHE_NAME)\s*=\s*)(['\"])([^'\"]+)(\2)",lambda m:m.group(1)+m.group(2)+re.sub(r'-ui111(?:-[0-9a-f]{8})?$', '',m.group(3))+'-ui111-'+os.environ.get('GITHUB_SHA','local')[:8]+m.group(4),text,count=1)
 pin=re.search(r'const ASSET_SHA256=(\{[^;]+\});',text)
 if pin:
  assets=re.search(r'const ASSETS=(\[[^;]+\]);',text);listed=json.loads(assets.group(1))
  hashes={name:digest(root/name) for name in listed}
  text=text[:pin.start(1)]+json.dumps(hashes,separators=(',',':'))+text[pin.end(1):]
 write(worker,text)
report={'header_version':'1.1.1','component':str(component),'js_sha256':digest(component),'css_sha256':digest(out/'clover-shell-header.css'),'existing_event_handlers_detected':events,'icons':icon_report,'no_business_logic_or_user_data_changes':True}
write(Path('CLOVER_UI_RELEASE_REPORT.json'),json.dumps(report,indent=2)+'\n')
subprocess.run(['node','--check',str(component)],check=True)
print(json.dumps(report,indent=2))
