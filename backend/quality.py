"""Technical acquisition checks; these do not validate disease or sample identity."""
import numpy as np
import soundfile as sf


def image_quality(image):
    gray = np.asarray(image.convert('L'), dtype=np.float32)
    warnings = []
    if min(image.size) < 128: warnings.append('Low resolution: a sharper image may preserve more drawing detail.')
    contrast = float(np.percentile(gray, 95) - np.percentile(gray, 5))
    if contrast < 20: warnings.append('Low contrast: check lighting and make the strokes clearly visible.')
    return {'kind': 'image', 'width': image.width, 'height': image.height,
            'contrast_5_95': round(contrast, 2), 'warnings': warnings,
            'scope': 'Technical checks only; cannot verify that this is the correct drawing type or a clinically usable image.'}


def audio_quality(path):
    info = sf.info(path)
    audio, rate = sf.read(path, frames=int(info.samplerate * 10), dtype='float32', always_2d=True)
    rms = float(np.sqrt(np.mean(audio * audio)))
    clipped = float(np.mean(np.abs(audio) >= 0.999))
    warnings = []
    if info.duration < 2: warnings.append('Short recording: aim for 3–5 seconds of a sustained vowel.')
    if info.duration > 10: warnings.append('Only the first 10 seconds are analysed.')
    if rms < 0.003: warnings.append('Quiet recording: move closer to the microphone and record again.')
    if clipped > 0.01: warnings.append('Possible clipping: lower microphone gain or move farther away.')
    return {'kind': 'audio', 'duration_seconds': round(info.duration, 2),
            'source_sample_rate': rate, 'channels': info.channels, 'rms': round(rms, 6),
            'clipped_fraction': round(clipped, 6), 'analysed_seconds': round(min(info.duration, 10), 2),
            'warnings': warnings, 'scope': 'Technical checks only; does not establish a usable voice biomarker or identify background noise reliably.'}
