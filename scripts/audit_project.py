"""Audit every dataset file and evaluate the saved drawing models without training."""
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports'


def main():
    OUT.mkdir(exist_ok=True)
    report = {'images': [], 'audio': [], 'errors': [], 'drawing_evaluation': {}}
    hashes = defaultdict(list)
    for base in ['dataset', 'Voice_Dataset', 'test_samples', 'images', 'frontend/public']:
        for path in sorted((ROOT / base).rglob('*')):
            if not path.is_file() or path.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.wav'}:
                continue
            relative = str(path.relative_to(ROOT))
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            hashes[digest].append(relative)
            try:
                if path.suffix.lower() == '.wav':
                    y, sr = sf.read(path, always_2d=True)
                    report['audio'].append({'path': relative, 'sha256': digest, 'sample_rate': sr,
                        'channels': y.shape[1], 'seconds': len(y)/sr,
                        'rms': float(np.sqrt(np.mean(y*y))),
                        'peak': float(np.max(np.abs(y))), 'finite': bool(np.isfinite(y).all())})
                else:
                    with Image.open(path) as image:
                        image.load()
                        report['images'].append({'path': relative, 'sha256': digest,
                            'size': list(image.size), 'mode': image.mode})
            except Exception as error:
                report['errors'].append({'path': relative, 'error': str(error)})
    report['duplicates'] = [paths for paths in hashes.values() if len(paths) > 1]
    report['counts'] = dict(Counter(str(Path(row['path']).parent) for row in report['images'] + report['audio']))
    for kind in ['spiral', 'wave']:
        paths = sorted((ROOT / 'dataset' / f'{kind}_drawings').rglob('*.png'))
        sheet = Image.new('RGB', (1200, ((len(paths)+7)//8)*150), 'white')
        draw = ImageDraw.Draw(sheet)
        for index, path in enumerate(paths):
            x, y = (index % 8)*150, (index//8)*150
            image = Image.open(path).convert('RGB')
            image.thumbnail((145, 120))
            sheet.paste(image, (x, y))
            draw.text((x+2, y+121), f'{path.parent.parent.name[:4]}/{path.parent.name[:4]}', fill='black')
            draw.text((x+2, y+134), path.name, fill='black')
        sheet.save(OUT / f'{kind}-contact-sheet.jpg')
    (OUT / 'dataset-audit.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'counts': report['counts'], 'errors': report['errors'],
        'duplicate_groups': len(report['duplicates'])}), flush=True)

    from tensorflow.keras.models import load_model
    from sklearn.metrics import confusion_matrix, accuracy_score
    for kind, name in [('spiral', 'drawing'), ('wave', 'wave')]:
        model = load_model(ROOT / 'models' / f'parkinsons_{name}_model.h5', compile=False)
        results = {}
        for interpolation, resample in [('training_nearest', Image.Resampling.NEAREST), ('old_api_bicubic', Image.Resampling.BICUBIC)]:
            for split in ['training', 'testing']:
                paths = sorted((ROOT / 'dataset' / f'{kind}_drawings' / split).rglob('*.png'))
                X = np.stack([np.asarray(Image.open(p).convert('RGB').resize((128,128),resample),dtype=np.float32)/255 for p in paths])
                scores = np.concatenate([np.asarray(model(X[i:i+16], training=False)).ravel() for i in range(0,len(X),16)])
                labels = [int(p.parent.name == 'parkinson') for p in paths]
                predicted = (scores > 0.5).astype(int)
                key = f'{split}/{interpolation}'
                results[key] = {'accuracy': float(accuracy_score(labels,predicted)),
                    'confusion_matrix': confusion_matrix(labels,predicted,labels=[0,1]).tolist(),
                    'predictions': [{'path':str(p.relative_to(ROOT)), 'label':int(label),
                        'prediction':int(pred), 'parkinson_score':float(score)}
                        for p,label,pred,score in zip(paths,labels,predicted,scores)]}
                print(kind,key,results[key]['accuracy'],results[key]['confusion_matrix'], flush=True)
        report['drawing_evaluation'][kind] = results
    (OUT / 'dataset-audit.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
