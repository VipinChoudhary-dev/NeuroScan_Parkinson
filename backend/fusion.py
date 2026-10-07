"""Transparent, unvalidated decision-level fusion of existing model scores.

These formulas combine Parkinson's-labelled class scores, never winning-class
confidence. They do not learn from or manufacture paired training records.
"""
import math

MODALITIES = ('voice', 'spiral', 'wave')
VERSION = 'late-fusion-research-v1'


def _number(value, name, maximum):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= maximum:
        raise ValueError(f'{name} must be a finite number between 0 and {maximum}.')
    return float(value)


def fuse_scores(scores, weights=None):
    if not isinstance(scores, dict) or not scores or set(scores) - set(MODALITIES):
        raise ValueError('Provide one or more known modality scores: voice, spiral, wave.')
    scores = {name: _number(value, name, 1) for name, value in scores.items()}
    if weights is not None and (not isinstance(weights, dict) or set(weights) != set(MODALITIES)):
        raise ValueError('Weights must specify voice, spiral and wave.')
    raw = {name: _number((weights or dict.fromkeys(MODALITIES, 1))[name], f'{name} weight', 100) for name in MODALITIES}
    active = [name for name in MODALITIES if name in scores and raw[name] > 0]
    if not active:
        raise ValueError('At least one available modality must have a positive weight.')
    total = sum(raw[name] for name in active)
    effective = {name: raw[name] / total if name in active else 0.0 for name in MODALITIES}

    def combine(names):
        subtotal = sum(raw[name] for name in names)
        w = {name: raw[name] / subtotal for name in names}
        linear = sum(w[name]*scores[name] for name in names)
        geometric = 0.0 if any(scores[name] == 0 for name in names) else math.exp(sum(w[name]*math.log(scores[name]) for name in names))
        return {'linear': round(linear, 6), 'cobb_douglas': round(geometric, 6)}

    values = combine(active) if len(active) >= 2 else {'linear': None, 'cobb_douglas': None}
    near = [name for name in active if abs(scores[name] - 0.5) <= 0.1]
    disagreement = any(scores[name] < 0.5 for name in active) and any(scores[name] > 0.5 for name in active)
    if len(active) < 2:
        pattern = 'Single-modality evidence — no combined index'
    elif disagreement:
        pattern = 'Mixed model signals'
    elif near:
        pattern = 'Scores near an individual model boundary'
    elif all(scores[name] > 0.5 for name in active):
        pattern = 'Included models favour Parkinson’s-labelled patterns'
    else:
        pattern = 'Included models favour healthy-labelled patterns'
    missing = [name for name in MODALITIES if name not in scores]
    reasons = []
    if disagreement: reasons.append('The included models disagree about which class their inputs resemble.')
    if near: reasons.append('Near-boundary scores: ' + ', '.join(near) + '. The ±0.10 review band is an engineering flag, not a validated clinical cutoff.')
    if missing: reasons.append('Missing tests: ' + ', '.join(missing) + '. Only available positive-weight tests contribute.')
    if 'spiral' in active and 'wave' in active:
        reasons.append('Spiral and wave both measure drawing behaviour; they may be correlated and do not count as independent clinical evidence.')
    return {
        'version': VERSION, **values, 'pattern': pattern,
        'available_modalities': [name for name in MODALITIES if name in scores],
        'active_modalities': active, 'missing_modalities': missing,
        'excluded_modalities': [name for name in scores if raw[name] == 0],
        'raw_weights': raw, 'effective_weights': effective,
        'weight_source': 'equal_research_default' if weights is None or len(set(raw.values())) == 1 else 'operator_defined_research_weights',
        'disagreement': disagreement, 'near_boundary': near, 'review_reasons': reasons,
        'leave_one_out': {name: combine([other for other in active if other != name]) for name in active} if len(active) == 3 else {},
        'validated': False, 'combined_accuracy': None, 'clinical_probability': None,
        'interpretation': 'Experimental indices on a 0–1 scale. No paired cohort, calibration, diagnostic threshold or clinical accuracy has been established.',
        'formulas': {'linear': 'L = Σ wᵢ pᵢ', 'cobb_douglas': 'G = ∏ pᵢ^wᵢ (A = 1)', 'constraint': 'wᵢ ≥ 0; active weights sum to 1'},
    }
