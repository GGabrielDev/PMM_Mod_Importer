"""Build reproducible Chrome and unsigned Firefox artifacts from shared source."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ('manifest.json', 'popup.html', 'popup.js', 'content.js', 'icon128.png')


def firefox_manifest(manifest, addon_id):
    if not addon_id or not (
            (len(addon_id) <= 80 and re.fullmatch(r'[a-zA-Z0-9._-]*@[a-zA-Z0-9._-]+', addon_id)) or
            re.fullmatch(r'\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}', addon_id)):
        raise ValueError('FIREFOX_ADDON_ID must be a stable distributor-owned add-on ID')
    result = dict(manifest)
    result['browser_specific_settings'] = {'gecko': {
        'id': addon_id, 'strict_min_version': '140.0',
        'data_collection_permissions': {'required': ['browsingActivity', 'websiteContent']}
    }, 'gecko_android': {'strict_min_version': '142.0'}}
    return result


def build(addon_id, output=None):
    output = Path(output or ROOT / 'dist')
    manifest = json.loads((ROOT / 'PMM_Mod_Importer/manifest.json').read_text())
    firefox = firefox_manifest(manifest, addon_id)  # Validate before changing output.
    shutil.rmtree(output, ignore_errors=True)
    checksums = []
    for browser, browser_manifest in [('chrome', manifest), ('firefox', firefox)]:
        folder = output / browser
        folder.mkdir(parents=True)
        for name in FILES:
            if name == 'manifest.json':
                content = (json.dumps(browser_manifest, indent=2, ensure_ascii=False) + '\n').encode()
            else:
                content = (ROOT / 'PMM_Mod_Importer' / name).read_bytes()
            (folder / name).write_bytes(content)
        archive = output / ('PMM_Mod_Importer.zip' if browser == 'chrome' else 'PMM_Mod_Importer-firefox-unsigned.zip')
        with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as zipped:
            for name in sorted(FILES):
                info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                zipped.writestr(info, (folder / name).read_bytes())
        checksums.append(f'{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}')
    (output / 'SHA256SUMS').write_text('\n'.join(checksums) + '\n')
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    (output / 'build.json').write_text(json.dumps({'revision': revision, 'version': manifest['version'],
        'firefox_addon_id': addon_id, 'firefox_signed': False}, indent=2) + '\n')


if __name__ == '__main__':
    build(os.environ.get('FIREFOX_ADDON_ID'))
