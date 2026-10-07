"""Train on unique recordings; keep the test recordings out of training.

Run from the project root: venv/bin/python scripts/train_voice_model_wav.py
The data has no subject IDs, so this is a recording-level evaluation only.
"""
import hashlib
import json
import pickle
import sys
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.features import extract_voice_features, VOICE_FEATURE_VERSION, VOICE_FEATURE_NAMES


def main():
    unique = {}
    all_rows = []
    for folder, label in [('Healthy', 0), ('Parkinsons', 1)]:
        for path in sorted((ROOT / 'Voice_Dataset' / folder).glob('*.wav')):
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            row = {'path': str(path.relative_to(ROOT)), 'label': label, 'sha256': digest}
            all_rows.append(row)
            if digest in unique and unique[digest]['label'] != label:
                raise ValueError(f'Identical audio has conflicting labels: {path}')
            unique.setdefault(digest, row)
    rows = list(unique.values())
    if not rows:
        raise ValueError('Voice_Dataset/Healthy and Voice_Dataset/Parkinsons are required.')
    print(f'{len(all_rows)} files; {len(rows)} unique recordings', flush=True)
    reports = ROOT / 'reports'
    reports.mkdir(exist_ok=True)
    cache_path = reports / 'voice-features.npz'
    digests = [row['sha256'] for row in rows]
    X = None
    if cache_path.exists():
        with np.load(cache_path, allow_pickle=False) as cache:
            if cache['hashes'].tolist() == digests and str(cache['version']) == VOICE_FEATURE_VERSION:
                X = cache['X']
    if X is None:
        features = []
        for index, row in enumerate(rows):
            features.append(extract_voice_features(str(ROOT / row['path']))[0])
            if index % 50 == 0:
                print(f'Features: {index+1}/{len(rows)}', flush=True)
        X = np.asarray(features, dtype=np.float32)
        np.savez_compressed(cache_path, X=X, hashes=np.asarray(digests), version=VOICE_FEATURE_VERSION)
    y = np.asarray([row['label'] for row in rows])
    train, test = train_test_split(np.arange(len(rows)), test_size=0.2, random_state=42, stratify=y)
    assert not set(np.asarray(digests)[train]) & set(np.asarray(digests)[test])
    scaler = StandardScaler().fit(X[train])
    model = VotingClassifier(estimators=[
        ('rf', RandomForestClassifier(n_estimators=500, class_weight='balanced', n_jobs=-1, random_state=42)),
        ('gb', GradientBoostingClassifier(n_estimators=300, learning_rate=0.08, max_depth=5, subsample=0.8, random_state=42)),
        ('svm', SVC(kernel='rbf', C=10, gamma='scale', probability=True, class_weight='balanced', random_state=42)),
    ], voting='soft', weights=[3, 2, 2])
    print(f'Training: {len(train)} unique recordings; testing: {len(test)}', flush=True)
    model.fit(scaler.transform(X[train]), y[train])
    predicted = model.predict(scaler.transform(X[test]))
    scores = model.predict_proba(scaler.transform(X[test]))[:, 1]
    report = {
        'feature_version': VOICE_FEATURE_VERSION, 'feature_count': 193,
        'source_files': len(all_rows), 'unique_recordings': len(rows),
        'duplicates_removed': len(all_rows)-len(rows), 'train_count': len(train), 'test_count': len(test),
        'split': 'Stratified 80/20 split of SHA-256-deduplicated recordings; random_state=42',
        'limitations': 'No subject identifiers are available. This is not a patient-independent or clinical validation.',
        'accuracy': float(accuracy_score(y[test], predicted)),
        'confusion_matrix': confusion_matrix(y[test], predicted, labels=[0,1]).tolist(),
        'classification_report': classification_report(y[test], predicted, target_names=['healthy','parkinson'], output_dict=True),
        'train': [rows[i] for i in train],
        'test': [dict(rows[i], prediction=int(pred), parkinson_score=float(score)) for i,pred,score in zip(test,predicted,scores)],
    }
    # Each file replacement is atomic; restart the server after training completes.
    model_dir = ROOT / 'models'
    model_dir.mkdir(exist_ok=True)
    for name, value in [('parkinsons_voice_model.pkl',model), ('voice_scaler.pkl',scaler)]:
        temp = model_dir / (name + '.tmp')
        temp.write_bytes(pickle.dumps(value))
        temp.replace(model_dir / name)
    (model_dir / 'voice_feature_count.txt').write_text('193\n')
    (model_dir / 'voice_feature_names.txt').write_text('\n'.join(VOICE_FEATURE_NAMES) + '\n')
    report['model_sha256'] = hashlib.sha256((model_dir/'parkinsons_voice_model.pkl').read_bytes()).hexdigest()
    report['scaler_sha256'] = hashlib.sha256((model_dir/'voice_scaler.pkl').read_bytes()).hexdigest()
    (reports / 'voice-evaluation.json').write_text(json.dumps(report,indent=2))
    (model_dir / 'voice_metadata.json').write_text(json.dumps({key:value for key,value in report.items() if key not in ('train','test')},indent=2))
    print(json.dumps({key:report[key] for key in ['accuracy','confusion_matrix','train_count','test_count']},indent=2), flush=True)


if __name__ == '__main__':
    main()
