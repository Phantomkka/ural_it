#!/usr/bin/env python3
"""Read-only host preflight. Never prints container env, secrets or full proxy files."""
import json,os,pathlib,re,shutil,subprocess

def run(args):
    env=os.environ.copy()
    for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(key,None)
    result=subprocess.run(args,text=True,capture_output=True,timeout=15,env=env)
    return result.returncode,result.stdout.strip(),result.stderr.strip()

def report(name,value):print(json.dumps({name:value},ensure_ascii=False))
report('host',{'hostname':os.uname().nodename,'kernel':os.uname().release,'architecture':os.uname().machine,'uid':os.getuid(),'cpu':os.cpu_count()})
for name,args in [('disk',['df','-h','/']),('memory',['free','-m']),('listeners',['ss','-lnt']),('addresses',['ip','-brief','address'])]:
    if shutil.which(args[0]):code,out,_=run(args);report(name,out if code==0 else 'unavailable')
docker=['docker','--host=unix:///var/run/docker.sock']
if shutil.which('docker'):
    code,out,err=run(docker+['info','--format','{{.ServerVersion}}'])
    if code and shutil.which('sudo'):
        docker=['sudo','-n','docker','--host=unix:///var/run/docker.sock'];code,out,err=run(docker+['info','--format','{{.ServerVersion}}'])
    report('docker',out if code==0 else 'requires access to local Docker daemon')
    if code==0:
        _,out,_=run(docker+['ps','--format','{{json .}}']);report('containers',[{k:v for k,v in json.loads(line).items() if k in ['Names','Image','Status','Ports','Networks']} for line in out.splitlines() if line])
        _,out,_=run(docker+['ps','-q'])
        if out:
            _,raw,_=run(docker+['inspect',*out.splitlines()]);records=json.loads(raw);routes=[]
            for item in records:
                labels=item.get('Config',{}).get('Labels') or {}
                for key,value in labels.items():
                    if key.endswith('.rule'):
                        for domain in re.findall(r'Host\([`"\']([a-zA-Z0-9.-]+)[`"\']\)',value):routes.append({'container':item['Name'],'domain':domain})
                for env in item.get('Config',{}).get('Env') or []:
                    if env.startswith(('VIRTUAL_HOST=','LETSENCRYPT_HOST=','NETCITY_SITE=','DOMAIN=','APP_DOMAIN=')):
                        for domain in env.split('=',1)[1].split(','):
                            if re.fullmatch(r'[a-zA-Z0-9.-]+',domain):routes.append({'container':item['Name'],'domain':domain})
            report('proxy_domains',routes)
for folder in ['/etc/nginx/sites-enabled','/etc/nginx/conf.d']:
    directory=pathlib.Path(folder)
    if directory.exists():
        for file in directory.iterdir():
            if file.is_file():
                try:
                    content=file.read_text();domains=re.findall(r'(?m)^\s*server_name\s+([^;]+);',content)
                    report('nginx_site',{'file':str(file),'domains':domains})
                except (OSError,UnicodeError):report('nginx_site',{'file':str(file),'requires_privilege':True})
file=pathlib.Path('/etc/caddy/Caddyfile')
if file.exists():
    try:
        domains=[]
        for line in file.read_text().splitlines():
            match=re.match(r'^([a-zA-Z0-9][a-zA-Z0-9.:,-]*)\s*\{',line)
            if match:domains.append(match[1])
        report('caddy_domains',domains)
    except OSError:report('caddy_domains','requires privilege')
