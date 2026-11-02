"""Create a repository manifest for the HTTPS location where this folder is hosted."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('base_url', help='HTTPS URL of this folder, without a trailing filename')
args = parser.parse_args()
base = args.base_url.rstrip('/')
if urlsplit(base).scheme != 'https' or not urlsplit(base).netloc:
    parser.error('An absolute HTTPS base URL is required.')
root = Path(__file__).resolve().parent
manifest = [{
    'id': 'zLibGd', 'name': 'Z-Library GD (experimental)',
    'site': 'https://z-lib.do', 'lang': 'English', 'version': '0.2.4',
    'url': base + '/zLibGd.js', 'iconUrl': base + '/icon.png',
}]
(root / 'plugins.min.json').write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
print('Repository URL: ' + base + '/plugins.min.json')
