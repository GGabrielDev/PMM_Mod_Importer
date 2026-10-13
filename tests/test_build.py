import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('build', Path(__file__).resolve().parents[1] / 'scripts/build.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BuildTest(unittest.TestCase):
    def test_identity_is_required(self):
        for identity in [None, '', 'not-an-id', 'bad id@example.org']:
            with self.assertRaises(ValueError):
                module.firefox_manifest({}, identity)

    def test_packages_are_reproducible_and_share_source(self):
        with tempfile.TemporaryDirectory() as directory:
            first, second = Path(directory) / 'first', Path(directory) / 'second'
            module.build('ci-fixture@example.invalid', first)
            module.build('ci-fixture@example.invalid', second)
            for name in ['PMM_Mod_Importer.zip', 'PMM_Mod_Importer-firefox-unsigned.zip', 'SHA256SUMS']:
                self.assertEqual((first / name).read_bytes(), (second / name).read_bytes())
            with zipfile.ZipFile(first / 'PMM_Mod_Importer.zip') as chrome, zipfile.ZipFile(first / 'PMM_Mod_Importer-firefox-unsigned.zip') as firefox:
                for name in ['popup.js', 'content.js', 'popup.html']:
                    self.assertEqual(chrome.read(name), firefox.read(name))
                self.assertNotIn('browser_specific_settings', json.loads(chrome.read('manifest.json')))
                gecko = json.loads(firefox.read('manifest.json'))['browser_specific_settings']['gecko']
                self.assertEqual(gecko['id'], 'ci-fixture@example.invalid')
                self.assertEqual(gecko['data_collection_permissions']['required'], ['browsingActivity', 'websiteContent'])
