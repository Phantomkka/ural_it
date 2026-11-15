"""Reproduce office model downloads from the exact reviewed manifest, without changing hashes."""
import hashlib,json,pathlib,shutil,subprocess,struct,tempfile
root=pathlib.Path(__file__).resolve().parent.parent/'apps/client/public/assets'
manifest=json.loads((root/'manifest.json').read_text())
curl=shutil.which('curl.exe') or shutil.which('curl')
assert curl,'curl with normal HTTPS certificate validation is required'
for entry in manifest:
    if not entry['file'].startswith('office_') or entry['file']=='office_facade.glb':continue
    assert entry['license']=='CC0-1.0'
    assert entry['source'].startswith('https://raw.githubusercontent.com/shorepine/kenney/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/furniture/')
    with tempfile.TemporaryDirectory() as tmp:
        target=pathlib.Path(tmp)/'model.glb'
        subprocess.run([curl,'--fail','--location','--silent','--show-error','--max-time','30',entry['source'],'--output',str(target)],check=True)
        data=target.read_bytes();assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['file']
        doc=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
        assert all(not i.get('uri') for i in doc.get('images',[]))
        (root/'models'/entry['file']).write_bytes(data)
print('Reviewed office models reproduced; manifest unchanged.')
