"""Run a reproducible group-separated fine-tuning experiment; never deploy automatically.

Filename-derived subject groups are a conservative proxy, not verified patient IDs.
The classifier head is reset, and only the originally frozen ImageNet backbone is
copied from the old model. Neither its trained head nor its evaluation results are
used to select this candidate. Stage selection uses validation loss, never test data.
"""
import hashlib
import json
import re
from pathlib import Path
import numpy as np
from PIL import Image
import tensorflow as tf
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, log_loss, roc_auc_score, brier_score_loss

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'reports/enhancement/fine-tuning'


def metrics(y,p):
    predicted=(p>0.5).astype(int)
    matrix=confusion_matrix(y,predicted,labels=[0,1])
    return {'accuracy':float(accuracy_score(y,predicted)),
        'balanced_accuracy':float(balanced_accuracy_score(y,predicted)),
        'sensitivity':float(matrix[1,1]/matrix[1].sum()),
        'specificity':float(matrix[0,0]/matrix[0].sum()),
        'log_loss':float(log_loss(y,p,labels=[0,1])),
        'brier_score':float(brier_score_loss(y,p)),
        'roc_auc':float(roc_auc_score(y,p)), 'confusion_matrix':matrix.tolist()}


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    for kind, old in [('spiral','drawing'),('wave','wave')]:
        tf.keras.backend.clear_session()
        tf.keras.utils.set_random_seed(42)
        paths=sorted((ROOT/'dataset'/f'{kind}_drawings').rglob('*.png'))
        y=np.asarray([int(p.parent.name=='parkinson') for p in paths])
        groups=np.asarray([re.match(r'V\d+[HP]',p.stem).group() for p in paths])
        outer=StratifiedGroupKFold(n_splits=4,shuffle=True,random_state=42)
        development,test=next(outer.split(paths,y,groups))
        inner=StratifiedGroupKFold(n_splits=3,shuffle=True,random_state=17)
        train_local,val_local=next(inner.split(development,y[development],groups[development]))
        train,val=development[train_local],development[val_local]
        assert not (set(groups[train]) & set(groups[val]) or set(groups[train]) & set(groups[test]) or set(groups[val]) & set(groups[test]))
        X=np.stack([np.asarray(Image.open(p).convert('RGB').resize((128,128),Image.Resampling.NEAREST),dtype=np.float32)/127.5-1 for p in paths])
        source_path=ROOT/'models'/f'parkinsons_{old}_model.h5'
        source=tf.keras.models.load_model(source_path,compile=False)
        base=tf.keras.applications.MobileNetV2(weights=None,include_top=False,input_shape=(128,128,3))
        for layer in base.layers:
            if layer.weights:
                old_layer=source.get_layer(layer.name)
                if old_layer.trainable:
                    raise ValueError('Source backbone is not frozen; use clean ImageNet weights instead.')
                layer.set_weights(old_layer.get_weights())
        base.trainable=False
        inputs=tf.keras.Input((128,128,3))
        augment=tf.keras.Sequential([
            tf.keras.layers.RandomRotation(0.03,fill_mode='nearest',seed=42),
            tf.keras.layers.RandomTranslation(0.03,0.03,fill_mode='nearest',seed=43),
        ])
        values=base(augment(inputs),training=False)
        values=tf.keras.layers.GlobalAveragePooling2D()(values)
        values=tf.keras.layers.Dropout(0.3,seed=44)(values)
        output=tf.keras.layers.Dense(1,activation='sigmoid',kernel_regularizer=tf.keras.regularizers.l2(0.001))(values)
        model=tf.keras.Model(inputs,output)
        model.compile(optimizer=tf.keras.optimizers.Adam(0.001),loss='binary_crossentropy')
        # Explicit small tf.data thread pools keep CPU training usable on laptops.
        def dataset(indices,training=False):
            ds=tf.data.Dataset.from_tensor_slices((X[indices],y[indices]))
            if training: ds=ds.shuffle(len(indices),seed=42)
            options=tf.data.Options();options.threading.private_threadpool_size=1
            return ds.batch(8).with_options(options)
        train_ds,val_ds=dataset(train,True),dataset(val)
        print(kind,{'train':len(train),'validation':len(val),'test':len(test)},flush=True)
        history=model.fit(train_ds,validation_data=val_ds,epochs=18,verbose=2,
            callbacks=[tf.keras.callbacks.EarlyStopping(monitor='val_loss',patience=4,restore_best_weights=True)])
        frozen_weights=model.get_weights()
        frozen_val=np.asarray(model(X[val],training=False)).ravel()
        frozen_loss=float(log_loss(y[val],frozen_val,labels=[0,1]))
        base.trainable=True
        for layer in base.layers[:-20]: layer.trainable=False
        for layer in base.layers:
            if isinstance(layer,tf.keras.layers.BatchNormalization): layer.trainable=False
        model.compile(optimizer=tf.keras.optimizers.Adam(0.00001),loss='binary_crossentropy')
        tuning=model.fit(train_ds,validation_data=val_ds,epochs=10,verbose=2,
            callbacks=[tf.keras.callbacks.EarlyStopping(monitor='val_loss',patience=3,restore_best_weights=True)])
        tuned_val=np.asarray(model(X[val],training=False)).ravel()
        tuned_loss=float(log_loss(y[val],tuned_val,labels=[0,1]))
        selected='fine_tuned' if tuned_loss < frozen_loss else 'frozen_backbone'
        if selected=='frozen_backbone': model.set_weights(frozen_weights)
        test_scores=np.asarray(model(X[test],training=False)).ravel()
        artifact=OUT/f'{kind}-candidate.keras'
        model.save(artifact)
        report={
            'kind':kind,'deployed':False,'clinical_validation':False,
            'selected_stage':selected,'selection_metric':'validation log loss',
            'preprocessing':'RGB nearest resize 128x128; divide by 127.5 then subtract 1',
            'seed':42,'group_definition':'Filename prefix V<number>H or V<number>P; unverified subject-ID proxy',
            'split_method':'Outer 4-fold StratifiedGroupKFold first fold; inner 3-fold first fold',
            'train_count':len(train),'validation_count':len(val),'test_count':len(test),
            'groups':{name:sorted(set(groups[index])) for name,index in [('train',train),('validation',val),('test',test)]},
            'frozen_validation':metrics(y[val],frozen_val),'fine_tuned_validation':metrics(y[val],tuned_val),
            'test_metrics':metrics(y[test],test_scores),
            'history':{'head':history.history,'fine_tuning':tuning.history},
            'source_backbone_sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
            'candidate_sha256':hashlib.sha256(artifact.read_bytes()).hexdigest(),
            'test_predictions':[{'path':str(paths[i].relative_to(ROOT)),'label':int(y[i]),'score':float(p)} for i,p in zip(test,test_scores)],
            'limitations':['Small group holdout; wide uncertainty.','Filename grouping is not independently verified.','No prospective or external validation.','This candidate is not automatically used by the API.'],
        }
        (OUT/f'{kind}-experiment.json').write_text(json.dumps(report,indent=2))
        print(kind,'selected',selected,'test',report['test_metrics'],flush=True)

if __name__=='__main__': main()
