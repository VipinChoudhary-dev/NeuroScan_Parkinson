"""Fusion mathematics and real-model session regressions."""
import json
import math
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.fusion import fuse_scores
from backend import main

client = TestClient(main.app)
ROOT = Path(__file__).resolve().parents[2]


def test_weighted_formulas_use_class_scores():
    result = fuse_scores({'voice': .2, 'spiral': .5, 'wave': .8})
    assert result['linear'] == .5
    assert result['cobb_douglas'] == pytest.approx((.2*.5*.8)**(1/3), abs=1e-6)
    assert len(result['leave_one_out']) == 3
    assert result['disagreement']
    assert result['clinical_probability'] is None
    assert result['combined_accuracy'] is None


def test_missing_zero_and_single_inputs():
    result = fuse_scores({'voice': .2, 'wave': .8}, {'voice': 1, 'spiral': 99, 'wave': 3})
    assert result['linear'] == .65
    assert result['effective_weights'] == {'voice': .25, 'spiral': 0, 'wave': .75}
    assert result['missing_modalities'] == ['spiral']
    assert fuse_scores({'voice': .2})['linear'] is None
    assert fuse_scores({'voice': 0, 'spiral': .9})['cobb_douglas'] == 0
    excluded = fuse_scores({'voice': 0, 'spiral': .8, 'wave': .2}, {'voice': 0, 'spiral': 1, 'wave': 1})
    assert excluded['cobb_douglas'] == .4
    assert excluded['excluded_modalities'] == ['voice']


@pytest.mark.parametrize('value', [True, '1', -1, 101, math.nan, math.inf])
def test_invalid_weights_rejected(value):
    with pytest.raises(ValueError):
        fuse_scores({'voice': .5}, {'voice': value, 'spiral': 1, 'wave': 1})


def test_no_active_weights_rejected():
    with pytest.raises(ValueError):
        fuse_scores({'voice': .5}, {'voice': 0, 'spiral': 1, 'wave': 1})


def samples(label='healthy', kinds=('voice', 'spiral', 'wave')):
    return {kind: (f'{label}_{kind}_2.' + ('wav' if kind == 'voice' else 'png'),
                  (ROOT/'test_samples'/f'{label}_{kind}_2.{"wav" if kind == "voice" else "png"}').read_bytes()) for kind in kinds}


@pytest.mark.parametrize('label,expected', [('healthy',0),('parkinson',1)])
def test_actual_three_model_assessment(label, expected):
    response = client.post('/assessments', data={'mode':'demo'}, files=samples(label))
    assert response.status_code == 200, response.text
    report = response.json()
    assert {row['status'] for row in report['results'].values()} == {expected}
    assert report['fusion']['linear'] == pytest.approx(sum(row['parkinson_score'] for row in report['results'].values())/3, abs=1e-6)
    assert report['same_person_basis'] == 'not_asserted_demo'
    assert all(len(row['model_sha256']) == len(row['input_sha256']) == 64 for row in report['results'].values())
    assert all(row['evaluation_matches_artifact'] for row in report['model_evidence'].values())


def test_confirmation_and_partial_failure():
    files = samples(kinds=('spiral',))
    assert client.post('/assessments', files=files).status_code == 422
    files['voice'] = ('broken.wav', b'invalid audio')
    response = client.post('/assessments', data={'same_person_confirmed':'true', 'reviewer_note':'Review this sample'}, files=files)
    assert response.status_code == 200, response.text
    report = response.json()
    assert report['same_person_basis'] == 'operator_confirmed'
    assert report['errors']['voice']['status_code'] == 422
    assert report['fusion']['linear'] is None
    assert report['fusion']['effective_weights']['spiral'] == 1
    assert report['reviewer_note_used_by_models'] is False


@pytest.mark.parametrize('weights', ['null', '{bad', '{"voice":0,"spiral":0,"wave":0}', '{"voice":1}'])
def test_assessment_invalid_weights(weights):
    assert client.post('/assessments', data={'mode':'demo','weights':weights}, files=samples(kinds=('spiral',))).status_code == 422


def test_demo_routes_and_evidence():
    assert client.get('/demo-samples/spiral/healthy/1').status_code == 200
    assert client.get('/demo-samples/spiral/healthy/3').status_code == 422
    assert client.get('/demo-samples/unknown/healthy/1').status_code == 422
    evidence = client.get('/evidence').json()
    assert evidence['fusion']['paired_cohort_size'] == 0
    assert all(not experiment['deployed'] for experiment in evidence['fine_tuning'].values())
    assert all(model['evaluation_matches_artifact'] for model in evidence['models'].values())


def test_missing_models_never_generate_combined_score(monkeypatch):
    for kind in tuple(main.models): monkeypatch.delitem(main.models, kind)
    response = client.post('/assessments', data={'mode':'demo'}, files=samples())
    assert response.status_code == 503
    assert 'fusion' not in response.json()
