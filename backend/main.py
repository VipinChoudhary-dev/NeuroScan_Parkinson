"""NeuroScan research classifier API. Start: python -m uvicorn backend.main:app --reload."""
import hashlib
import io
import json
import logging
from functools import wraps
from threading import RLock
import time
import os
from pathlib import Path
import pickle
import subprocess
import tempfile

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Path as PathParam
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4
import re
from PIL import Image, UnidentifiedImageError

try:
    from .features import drawing_tensor, extract_voice_features, VOICE_FEATURE_COUNT, VOICE_FEATURE_VERSION
except ImportError:  # Also support: cd backend && uvicorn main:app
    from features import drawing_tensor, extract_voice_features, VOICE_FEATURE_COUNT, VOICE_FEATURE_VERSION

try:
    from .fusion import fuse_scores, MODALITIES
    from .quality import image_quality, audio_quality
except ImportError:
    from fusion import fuse_scores, MODALITIES
    from quality import image_quality, audio_quality

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / 'models'
try:
    from .assistant import router as assistant_router
except ImportError:
    from assistant import router as assistant_router

log = logging.getLogger('uvicorn.error')
app = FastAPI(title='NeuroScan AI', version='2.0.0',
              description='Research classifications of voice, spiral and wave samples.')
app.include_router(assistant_router)
app.add_middleware(CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173').split(',') if origin.strip()],
    allow_methods=['GET', 'POST'], allow_headers=['*'])

models = {}
model_errors = {}
voice_scaler = None
voice_metadata = {}
try:
    metadata_path = MODEL_DIR / 'voice_metadata.json'
    if metadata_path.exists():
        voice_metadata = json.loads(metadata_path.read_text())
        if voice_metadata.get('feature_version') != VOICE_FEATURE_VERSION:
            raise ValueError('Voice model preprocessing version mismatch. Run scripts/train_voice_model_wav.py.')
        for name, field in [('parkinsons_voice_model.pkl','model_sha256'), ('voice_scaler.pkl','scaler_sha256')]:
            if hashlib.sha256((MODEL_DIR/name).read_bytes()).hexdigest() != voice_metadata[field]:
                raise ValueError('Voice model/scaler do not match their training metadata. Finish training and restart.')
    with (MODEL_DIR / 'parkinsons_voice_model.pkl').open('rb') as stream:
        voice_model = pickle.load(stream)
    with (MODEL_DIR / 'voice_scaler.pkl').open('rb') as stream:
        voice_scaler = pickle.load(stream)
    if voice_model.n_features_in_ != VOICE_FEATURE_COUNT or voice_scaler.n_features_in_ != VOICE_FEATURE_COUNT:
        raise ValueError('Expected the 193-feature WAV model. Run scripts/train_voice_model_wav.py.')
    if list(voice_model.classes_) != [0, 1]:
        raise ValueError('Voice model class labels must be 0=healthy and 1=parkinson.')
    models['voice'] = voice_model
except Exception as error:
    model_errors['voice'] = str(error)
    log.error('Voice model unavailable: %s', error)

for kind, filename in [('spiral', 'parkinsons_drawing_model.h5'), ('wave', 'parkinsons_wave_model.h5')]:
    try:
        from tensorflow.keras.models import load_model
        model = load_model(MODEL_DIR / filename, compile=False)
        if model.input_shape != (None, 128, 128, 3) or model.output_shape != (None, 1):
            raise ValueError('Unexpected CNN input/output shape.')
        models[kind] = model
    except Exception as error:
        model_errors[kind] = str(error)
        log.error('%s model unavailable: %s', kind, error)


def health_payload():
    return {'status': 'ok' if len(models) == 3 else 'degraded',
            'models': {kind: 'loaded' if kind in models else 'unavailable' for kind in ('voice','spiral','wave')},
            'errors': model_errors}


@app.get('/')
def root():
    return dict(health_payload(), message='NeuroScan research classifier API')


@app.get('/health')
def health():
    return JSONResponse(health_payload(), status_code=200 if len(models) == 3 else 503)


@app.get('/models')
def model_info():
    return dict(health_payload(), voice_evaluation={key: voice_metadata.get(key) for key in
        ('unique_recordings','train_count','test_count','accuracy','limitations')})


def require_model(kind):
    if kind not in models:
        raise HTTPException(503, f'The {kind} model is unavailable. Check backend startup logs and repair the model environment.')
    return models[kind]



# One analysis per worker bounds concurrent tensor/audio allocations. It does not
# make a single analysis fit into an undersized hosting plan.
_analysis_lock = RLock()

def single_analysis(function):
    @wraps(function)
    def guarded(*args, **kwargs):
        if not _analysis_lock.acquire(blocking=False):
            raise HTTPException(503, 'Another analysis is in progress. Please wait and try again.', headers={'Retry-After': '10'})
        started = time.monotonic()
        log.info('Analysis started: %s', function.__name__)
        try:
            return function(*args, **kwargs)
        finally:
            log.info('Analysis finished: %s (%.2fs)', function.__name__, time.monotonic() - started)
            _analysis_lock.release()
    return guarded


def read_upload(file, limit):
    content = file.file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(413, f'File exceeds the {limit // (1024*1024)} MB upload limit.')
    if not content:
        raise HTTPException(422, 'The uploaded file is empty.')
    return content


def prediction_result(score, method):
    score = float(score)
    if not np.isfinite(score) or not 0 <= score <= 1:
        raise RuntimeError('Model returned an invalid score.')
    status = int(score > 0.5)
    return {
        'prediction': "Parkinson's-like pattern" if status else 'Healthy-like pattern',
        'status': status,
        'confidence': round(score if status else 1-score, 4),
        'parkinson_score': round(score, 4),
        'method': method,
        'detail': 'This sample resembles the Parkinson’s-labelled training examples.' if status else
                  'This sample resembles the healthy-labelled training examples.',
        'score_description': 'Model confidence in this classification; not a probability of having Parkinson’s disease.',
    }


def classify_drawing(file, kind):
    model = require_model(kind)
    content = read_upload(file, 12 * 1024 * 1024)
    try:
        with Image.open(io.BytesIO(content)) as image:
            if image.width * image.height > 20_000_000:
                raise ValueError('Image is too large. Please use an image below 20 megapixels.')
            if min(image.size) < 32:
                raise ValueError('Image is too small. Please upload a clear drawing at least 32 pixels across.')
            quality = image_quality(image)
            tensor = drawing_tensor(image)
            if float(np.std(tensor)) < 0.005:
                raise ValueError('No visible drawing was found. Please upload a clear drawing on paper.')
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(422, f'Invalid drawing: {error}') from error
    try:
        score = np.asarray(model(tensor, training=False))[0, 0]
        return dict(prediction_result(score, f'mobilenetv2_cnn_{kind}'), quality=quality)
    except Exception as error:
        log.exception('%s inference failed', kind)
        raise HTTPException(500, 'The drawing model could not complete analysis. Check the backend logs.') from error


@app.post('/predict/drawing')
@single_analysis
def predict_drawing(file: UploadFile = File(...)):
    return classify_drawing(file, 'spiral')


@app.post('/predict/wave')
@single_analysis
def predict_wave(file: UploadFile = File(...)):
    return classify_drawing(file, 'wave')


@app.post('/predict/voice')
@single_analysis
def predict_voice(file: UploadFile = File(...)):
    model = require_model('voice')
    content = read_upload(file, 25 * 1024 * 1024)
    # A temporary directory guarantees cleanup of both original and converted files.
    with tempfile.TemporaryDirectory(prefix='neuroscan-') as directory:
        source = Path(directory) / 'input.audio'
        source.write_bytes(content)
        audio_path = source
        try:
            import soundfile as sf
            sf.info(source)  # WAV/FLAC/OGG etc. can be decoded directly, regardless of filename.
        except (RuntimeError, OSError):
            import imageio_ffmpeg
            audio_path = Path(directory) / 'decoded.wav'
            try:
                converted = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-nostdin', '-y',
                    '-i', str(source), '-vn', '-t', '10', '-ac', '1', '-c:a', 'pcm_s16le', str(audio_path)],
                    capture_output=True, timeout=30)
                if converted.returncode:
                    raise ValueError('Audio could not be decoded. Upload a valid WAV, MP3, OGG, M4A or WebM recording.')
            except subprocess.TimeoutExpired as error:
                raise HTTPException(422, 'Audio conversion took too long. Use a shorter recording.') from error
            except ValueError as error:
                raise HTTPException(422, str(error)) from error
        try:
            quality = audio_quality(audio_path)
            features = extract_voice_features(str(audio_path))
        except (ValueError, RuntimeError, OSError) as error:
            raise HTTPException(422, str(error)) from error
        try:
            score = model.predict_proba(voice_scaler.transform(features))[0, 1]
            return dict(prediction_result(score, 'voice_voting_ensemble_193'), quality=quality)
        except Exception as error:
            log.exception('Voice inference failed')
            raise HTTPException(500, 'The voice model could not complete analysis. Check the backend logs.') from error


@app.get('/predict/voice/demo/{sample_type}')
def removed_legacy_demo(sample_type: str):
    raise HTTPException(410, 'The old 22-feature demo is retired. Upload a real recording to /predict/voice.')

# Fingerprints are captured when these model objects are loaded, not recomputed
# from potentially replaced model files for every assessment.
MODEL_FILES = {'voice': 'parkinsons_voice_model.pkl', 'spiral': 'parkinsons_drawing_model.h5', 'wave': 'parkinsons_wave_model.h5'}
MODEL_FINGERPRINTS = {kind: hashlib.sha256((MODEL_DIR / filename).read_bytes()).hexdigest()
                      for kind, filename in MODEL_FILES.items() if kind in models}


def evidence_cards():
    manifest_path = MODEL_DIR / 'drawing_evaluation.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    cards = {}
    for kind in MODALITIES:
        data = voice_metadata if kind == 'voice' else manifest.get(kind, {})
        verified = data.get('model_sha256' if kind == 'voice' else 'sha256') == MODEL_FINGERPRINTS.get(kind) and kind in models
        matrix = data.get('confusion_matrix') if verified else None
        cards[kind] = {'name': kind.title(), 'loaded': kind in models,
            'artifact': MODEL_FILES[kind], 'sha256': MODEL_FINGERPRINTS.get(kind),
            'evaluation_matches_artifact': verified,
            'accuracy': data.get('accuracy') if verified else None,
            'test_count': data.get('test_count') if verified else None,
            'train_count': data.get('train_count') if verified else None,
            'confusion_matrix': matrix,
            'sensitivity': matrix[1][1] / sum(matrix[1]) if matrix and sum(matrix[1]) else None,
            'specificity': matrix[0][0] / sum(matrix[0]) if matrix and sum(matrix[0]) else None,
            'limitations': 'Recording-disjoint after exact deduplication; patient identities are unavailable.' if kind == 'voice' else 'Supplied image split contains overlapping filename-derived subject IDs.',
            'calibrated': False, 'clinical_validation': False}
    return cards


@app.get('/evidence')
def evidence():
    experiments = {}
    for kind in ('spiral', 'wave'):
        path = ROOT / 'reports/enhancement/fine-tuning' / f'{kind}-experiment.json'
        if path.exists():
            record = json.loads(path.read_text())
            experiments[kind] = {key: record[key] for key in ('selected_stage', 'train_count', 'validation_count', 'test_count', 'test_metrics', 'frozen_validation', 'fine_tuned_validation', 'limitations', 'deployed')}
    return {'models': evidence_cards(), 'fine_tuning': experiments,
        'fusion': {'validated': False, 'paired_cohort_size': 0, 'accuracy': None,
                   'requirement': 'Same participants, labelled clinical outcomes and subject-disjoint development/calibration/test cohorts are needed to evaluate or learn fusion weights.'},
        'dataset': {'unique_voice_recordings': 567, 'voice_filenames': 1134, 'spiral_images': 102, 'wave_images': 102,
                    'paired_identity_verified': False},
        'privacy': 'Uploads are processed by the analysis backend. Raw files are not retained by the assessment service; exports stay under the user’s control.'}


@app.get('/demo-samples/{kind}/{label}/{number}')
def demo_sample(kind: Literal['voice', 'spiral', 'wave'], label: Literal['healthy', 'parkinson'], number: int = PathParam(ge=1, le=2)):
    extension = 'wav' if kind == 'voice' else 'png'
    path = ROOT / 'test_samples' / f'{label}_{kind}_{number}.{extension}'
    if not path.exists():
        raise HTTPException(404, 'Demo sample unavailable.')
    return FileResponse(path, media_type='audio/wav' if kind == 'voice' else 'image/png', filename=path.name)


@app.post('/assessments')
@single_analysis
def create_assessment(
    voice: UploadFile | None = File(None),
    spiral: UploadFile | None = File(None),
    wave: UploadFile | None = File(None),
    mode: Literal['same_person', 'demo'] = Form('same_person'),
    same_person_confirmed: bool = Form(False),
    weights: str = Form('{"voice":1,"spiral":1,"wave":1}'),
    session_code: str = Form('session', max_length=40),
    reviewer_note: str = Form('', max_length=2000),
):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,40}', session_code):
        raise HTTPException(422, 'Use a session code containing only letters, numbers, hyphens or underscores.')
    if mode == 'same_person' and not same_person_confirmed:
        raise HTTPException(422, 'Confirm that the supplied files were collected from the same person and session, or select demonstration mode.')
    uploads = {kind: file for kind, file in [('voice',voice),('spiral',spiral),('wave',wave)] if file is not None}
    if not uploads:
        raise HTTPException(422, 'Add at least one recording or drawing.')
    try:
        parsed_weights = json.loads(weights)
        if not isinstance(parsed_weights, dict):
            raise ValueError('Weights must be an object containing voice, spiral and wave.')
        fuse_scores(dict.fromkeys(uploads, 0.5), parsed_weights)
    except (ValueError, TypeError) as error:
        raise HTTPException(422, str(error)) from error
    results, errors = {}, {}
    for kind, file in uploads.items():
        try:
            # Read through the existing limit before hashing; never accept arbitrary paths.
            content = read_upload(file, (25 if kind == 'voice' else 12) * 1024 * 1024)
            digest = hashlib.sha256(content).hexdigest()
            file.file.seek(0)
            result = predict_voice(file) if kind == 'voice' else classify_drawing(file, kind)
            results[kind] = dict(result, input_sha256=digest,
                filename=Path(file.filename or 'upload').name, model_sha256=MODEL_FINGERPRINTS.get(kind))
        except HTTPException as error:
            errors[kind] = {'status_code': error.status_code, 'detail': error.detail}
    if not results:
        unavailable = all(error['status_code'] == 503 for error in errors.values())
        raise HTTPException(503 if unavailable else 422, 'No input could be analysed. ' + ' '.join(f'{kind}: {error["detail"]}' for kind,error in errors.items()))
    try:
        fusion = fuse_scores({kind: result['parkinson_score'] for kind,result in results.items()}, parsed_weights)
    except ValueError as error:
        raise HTTPException(422, 'Successful inputs have no positive weight. ' + str(error)) from error
    if errors:
        fusion['review_reasons'].append('Failed inputs were excluded and weights renormalized: ' + ', '.join(errors) + '.')
    quality_warnings = [f'{kind}: {warning}' for kind,result in results.items() for warning in result.get('quality', {}).get('warnings', [])]
    return {
        'schema_version': 'neuroscan-assessment-v1', 'assessment_id': str(uuid4()),
        'created_at': datetime.now(timezone.utc).isoformat(), 'session_code': session_code,
        'mode': mode, 'same_person_basis': 'operator_confirmed' if mode == 'same_person' else 'not_asserted_demo',
        'reviewer_note': reviewer_note, 'reviewer_note_used_by_models': False,
        'results': results, 'errors': errors, 'fusion': fusion, 'quality_warnings': quality_warnings,
        'model_evidence': {kind: evidence_cards()[kind] for kind in results},
        'scope': 'Unpaired sample demonstration — no patient interpretation.' if mode == 'demo' else 'Exploratory same-person assessment; fusion has not been clinically validated.',
        'storage': 'No assessment history or raw upload is stored by the service. Save the JSON report yourself if needed.',
    }
