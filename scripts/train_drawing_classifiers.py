"""Evaluate experimental alternative heads without changing deployed CNN models.

Hyperparameters are selected ONLY within the 72 training drawings, with
subject-like filename groups kept together. The supplied testing folder is
used once for reporting. It shares subject IDs with training; reported test
accuracy must not be interpreted as performance on new patients.
"""
import hashlib
import json
import pickle
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from tensorflow.keras import Model
from tensorflow.keras.models import load_model

ROOT = Path(__file__).resolve().parents[1]


def group(path):
    return re.match(r'V\d+[HP]', path.stem).group()


def main():
    (ROOT/'reports'/'experimental').mkdir(parents=True,exist_ok=True)
    for kind, old_name in [('spiral','drawing'),('wave','wave')]:
        cnn_path = ROOT / 'models' / f'parkinsons_{old_name}_model.h5'
        cnn = load_model(cnn_path, compile=False)
        pooling = next(layer for layer in cnn.layers if layer.__class__.__name__ == 'GlobalAveragePooling2D')
        backbone = Model(cnn.input, pooling.output)
        def features(paths):
            # The base was frozen during original training, retaining ImageNet weights.
            # MobileNetV2's ImageNet convention is RGB scaled to [-1, 1].
            arrays = np.stack([np.asarray(Image.open(p).convert('RGB').resize((128,128),Image.Resampling.NEAREST),dtype=np.float32)/127.5-1 for p in paths])
            return np.concatenate([np.asarray(backbone(arrays[i:i+16],training=False)) for i in range(0,len(arrays),16)])
        train_paths = sorted((ROOT/'dataset'/f'{kind}_drawings'/'training').rglob('*.png'))
        train_y = np.asarray([int(p.parent.name=='parkinson') for p in train_paths])
        groups = [group(p) for p in train_paths]
        X = features(train_paths)
        cv = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=42)
        # Probability calibration is fit only on training data after model selection.
        search = GridSearchCV(make_pipeline(StandardScaler(),SVC(class_weight='balanced',random_state=42)),
            {'svc__kernel':['linear','rbf'], 'svc__C':[0.01,0.1,1.0,10.0]},
            scoring='balanced_accuracy', cv=cv, n_jobs=1)
        search.fit(X,train_y,groups=groups)
        classifier = search.best_estimator_
        classifier.set_params(svc__probability=True)
        classifier.fit(X,train_y)
        print(kind,'training-only group CV:',search.best_score_,search.best_params_,flush=True)
        test_paths = sorted((ROOT/'dataset'/f'{kind}_drawings'/'testing').rglob('*.png'))
        test_y = np.asarray([int(p.parent.name=='parkinson') for p in test_paths])
        test_X = features(test_paths)
        predicted = classifier.predict(test_X)
        scores = classifier.predict_proba(test_X)[:,1]
        overlap = sorted(set(groups) & {group(p) for p in test_paths})
        report = {
            'kind':kind, 'method':'mobilenetv2_svm', 'preprocessing':'rgb-nearest-128-minus1-plus1',
            'train_count':len(train_paths), 'test_count':len(test_paths),
            'selection':'4-fold StratifiedGroupKFold on training folder only; balanced accuracy; random_state=42',
            'cv_balanced_accuracy':float(search.best_score_), 'parameters':search.best_params_,
            'accuracy':float(accuracy_score(test_y,predicted)),
            'confusion_matrix':confusion_matrix(test_y,predicted,labels=[0,1]).tolist(),
            'classification_report':classification_report(test_y,predicted,target_names=['healthy','parkinson'],output_dict=True),
            'overlapping_subject_ids':overlap,
            'limitations':'Small dataset; supplied train/test folders share subject IDs. Scores are not clinical diagnostic probabilities.',
            'backbone_sha256':hashlib.sha256(cnn_path.read_bytes()).hexdigest(),
            'test':[{'path':str(p.relative_to(ROOT)),'label':int(y),'prediction':int(pred),'parkinson_score':float(score)}
                    for p,y,pred,score in zip(test_paths,test_y,predicted,scores)],
            'cv_candidates':[{'parameters':params,'mean_balanced_accuracy':float(mean),'std':float(std)}
                for params,mean,std in zip(search.cv_results_['params'],search.cv_results_['mean_test_score'],search.cv_results_['std_test_score'])],
        }
        model_path=ROOT/'reports'/'experimental'/f'{kind}_classifier.pkl'
        model_path.write_bytes(pickle.dumps(classifier))
        report['classifier_sha256']=hashlib.sha256(model_path.read_bytes()).hexdigest()
        (ROOT/'reports'/'experimental'/f'{kind}-evaluation.json').write_text(json.dumps(report,indent=2))
        (ROOT/'reports'/'experimental'/f'{kind}_metadata.json').write_text(json.dumps({k:v for k,v in report.items() if k not in ('test','cv_candidates')},indent=2))
        print(kind,'test:',report['accuracy'],report['confusion_matrix'],flush=True)


if __name__=='__main__':
    main()
