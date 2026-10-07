"""Real-model regression checks, including the previous fake-98% failure."""
import io
import json
from pathlib import Path
import subprocess
import tempfile

import imageio_ffmpeg
import numpy as np
from PIL import Image
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from backend import main
from backend.features import drawing_tensor

ROOT = Path(__file__).resolve().parents[2]
client = TestClient(main.app)


def upload(endpoint, path, filename=None):
    with path.open('rb') as stream:
        return client.post(endpoint, files={'file': (filename or path.name, stream)})


def test_all_models_ready():
    response = client.get('/health')
    assert response.status_code == 200, response.text
    assert set(response.json()['models'].values()) == {'loaded'}


@pytest.mark.parametrize('kind,endpoint', [('spiral','drawing'),('wave','wave')])
def test_every_drawing_test_image_matches_actual_cnn(kind, endpoint):
    paths = sorted((ROOT/'dataset'/f'{kind}_drawings'/'testing').rglob('*.png'))
    if not paths:
        pytest.skip('Optional original drawing test dataset is not distributed; bundled sample tests still run.')
    statuses, correct = [], 0
    for path in paths:
        with Image.open(path) as image:
            expected = float(np.asarray(main.models[kind](drawing_tensor(image),training=False))[0,0])
        response = upload(f'/predict/{endpoint}', path)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data['method'] == f'mobilenetv2_cnn_{kind}'
        assert data['parkinson_score'] == pytest.approx(expected, abs=0.000051)
        assert data['status'] == int(expected > 0.5)
        statuses.append(data['status'])
        correct += data['status'] == int(path.parent.name == 'parkinson')
    assert set(statuses) == {0,1}  # Regression: no constant Parkinson's fallback.
    assert correct == 24  # Measured 24/30; errors remain visible, never overridden by filenames.


@pytest.mark.parametrize('endpoint,name', [
    ('drawing','healthy_spiral_1.png'), ('wave','healthy_wave_1.png'), ('voice','healthy_voice_1.wav')])
def test_filename_does_not_determine_diagnosis(endpoint, name):
    path = ROOT/'test_samples'/name
    healthy_name = upload(f'/predict/{endpoint}',path,'healthy'+path.suffix).json()
    parkinson_name = upload(f'/predict/{endpoint}',path,'parkinson'+path.suffix).json()
    assert healthy_name == parkinson_name
    assert healthy_name['status'] == 0


@pytest.mark.parametrize('endpoint,kind', [('drawing','spiral'),('wave','wave'),('voice','voice')])
def test_missing_model_returns_error_never_heuristic(monkeypatch, endpoint, kind):
    monkeypatch.delitem(main.models,kind)
    response = client.post(f'/predict/{endpoint}',files={'file':('sample','bytes')})
    assert response.status_code == 503
    assert 'confidence' not in response.json()
    assert client.get('/health').status_code == 503


@pytest.mark.parametrize('endpoint', ['drawing','wave','voice'])
def test_empty_and_corrupt_uploads(endpoint):
    for content in [b'',b'not an image or an audio recording']:
        response=client.post(f'/predict/{endpoint}', files={'file':('sample.wav',content)})
        assert response.status_code == 422, response.text
        assert 'confidence' not in response.json()


def test_blank_drawing():
    data=io.BytesIO()
    Image.new('RGB',(128,128),'white').save(data,format='PNG')
    assert client.post('/predict/drawing',files={'file':('blank.png',data.getvalue())}).status_code==422


def test_silent_and_short_recordings():
    for values in [np.zeros(22050),np.ones(100)*0.1]:
        data=io.BytesIO();sf.write(data,values,22050,format='WAV')
        response=client.post('/predict/voice',files={'file':('audio.wav',data.getvalue())})
        assert response.status_code==422,response.text


def test_real_voice_samples():
    for label in ['healthy','parkinson']:
        for number in [1,2]:
            response=upload('/predict/voice',ROOT/'test_samples'/f'{label}_voice_{number}.wav')
            assert response.status_code==200,response.text
            assert response.json()['status']==int(label=='parkinson')


def test_browser_webm_conversion_and_temp_cleanup(tmp_path, monkeypatch):
    recording=tmp_path/'recording.webm'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-nostdin','-y','-i',
        str(ROOT/'test_samples/healthy_voice_1.wav'),'-c:a','libopus',str(recording)],
        capture_output=True,check=True)
    temp_root=tmp_path/'server-temp';temp_root.mkdir()
    monkeypatch.setattr(tempfile,'tempdir',str(temp_root))
    response=upload('/predict/voice',recording)
    assert response.status_code==200,response.text
    assert response.json()['status']==0
    assert list(temp_root.iterdir())==[]


def test_voice_train_test_audio_do_not_overlap():
    report=json.loads((ROOT/'reports/voice-evaluation.json').read_text())
    assert not {r['sha256'] for r in report['train']} & {r['sha256'] for r in report['test']}
    assert report['unique_recordings']==567
    assert report['accuracy'] > 0.90


def test_recording_sample_rate_normalization(tmp_path):
    import librosa
    from backend.features import extract_voice_features
    original = ROOT/'test_samples/healthy_voice_1.wav'
    signal, sample_rate = sf.read(original)
    higher_rate = librosa.resample(signal, orig_sr=sample_rate, target_sr=48000)
    path = tmp_path/'microphone.wav'
    sf.write(path,higher_rate,48000,subtype='FLOAT')
    old_result=upload('/predict/voice',original).json()
    new_result=upload('/predict/voice',path).json()
    assert old_result['status']==new_result['status']==0
    assert abs(old_result['confidence']-new_result['confidence']) < 0.10
    assert extract_voice_features(str(path)).shape==(1,193)


def test_legacy_demo_cannot_feed_22_features_to_193_feature_model():
    assert client.get('/predict/voice/demo/healthy').status_code==410


def test_concurrent_analysis_returns_busy_without_running_model(monkeypatch):
    from threading import Event, Thread
    acquired, release = Event(), Event()
    def hold_lock():
        with main._analysis_lock:
            acquired.set()
            release.wait(5)
    holder = Thread(target=hold_lock)
    holder.start()
    assert acquired.wait(2)
    try:
        def must_not_run(*args, **kwargs):
            raise AssertionError('Busy request must not run a model')
        monkeypatch.setattr(main, 'classify_drawing', must_not_run)
        response = client.post('/predict/drawing', files={'file': ('image.png', b'data')})
        assert response.status_code == 503
        assert response.headers['retry-after'] == '10'
        assert 'in progress' in response.json()['detail']
    finally:
        release.set()
        holder.join(2)
