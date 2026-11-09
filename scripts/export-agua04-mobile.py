"""Copy audited AGUA-04 exports without training, inference, or network access.

Run from any directory: python scripts/export-agua04-mobile.py [--check]
--check verifies the inventory, embedded bytes and provenance without writing.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'analytics/agro-agua/outputs/agua04'
DEST = ROOT / 'apps/mobile/assets/agua04'
FILES = ['integration-example.json', 'training_monthly_reference.csv',
         'monthly_indicators.csv', 'historical_indicators.csv',
         'thresholds.csv', 'audit.json', 'inventory.json']


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    inventory = {row['file']: row for row in json.loads(
        (SOURCE / 'inventory.json').read_text(encoding='utf-8'))}
    for name in FILES:
        if name in inventory:
            expected = inventory[name]
            if (SOURCE / name).stat().st_size != expected['bytes'] or digest(SOURCE / name) != expected['sha256']:
                raise ValueError(f'Inventory mismatch: {name}')
    contract = json.loads((SOURCE / FILES[0]).read_text(encoding='utf-8'))
    if contract['schema_version'] != 'agua04-1.0':
        raise ValueError('Unsupported contract version')
    manifest = {
        'package_version': 'agua04-mobile-1',
        'schema_version': contract['schema_version'],
        'data_as_of': contract['data_as_of'],
        'generated_at_utc': contract['generated_at_utc'],
        'source_directory': 'analytics/agro-agua/outputs/agua04',
        'delivery': 'bundled_versioned_export_no_endpoint',
        'files': {name: digest(SOURCE / name) for name in FILES},
    }
    if args.check:
        for name in FILES:
            if digest(DEST / name) != manifest['files'][name]:
                raise ValueError(f'Embedded file differs: {name}')
        if json.loads((DEST / 'provenance.json').read_text(encoding='utf-8')) != manifest:
            raise ValueError('Provenance differs')
        print('OK: 7 embedded files match audited exports and provenance.')
    else:
        DEST.mkdir(parents=True, exist_ok=True)
        for name in FILES:
            shutil.copyfile(SOURCE / name, DEST / name)
        (DEST / 'provenance.json').write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('Exported AGUA-04 package; no pipeline mutation, fit, predict, or network.')


if __name__ == '__main__':
    main()
