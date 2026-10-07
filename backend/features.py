"""Preprocessing shared by training, evaluation, and serving.

The existing voice models use 193 values: 80 MFCC statistics, 80 delta
statistics, 20 spectral statistics, 12 chroma means, and one chroma std.
The old code calculated 213 values and discarded everything after 193;
jitter, shimmer, RMS, and pitch are NOT inputs to these saved models.
"""
import numpy as np
from PIL import Image, ImageOps

VOICE_FEATURE_COUNT = 193
VOICE_FEATURE_VERSION = 'librosa-193-8khz-v2'
VOICE_FEATURE_NAMES = [
    f'{feature}_{statistic}_{index+1}'
    for feature in ('mfcc', 'delta_mfcc') for statistic in ('mean', 'std') for index in range(40)
] + [
    f'{feature}_{statistic}'
    for feature in ('spectral_centroid', 'spectral_bandwidth', 'spectral_rolloff') for statistic in ('mean', 'std')
] + [
    f'spectral_contrast_{statistic}_{index+1}' for statistic in ('mean', 'std') for index in range(7)
] + [f'chroma_mean_{index+1}' for index in range(12)] + ['chroma_std_1']
IMAGE_SIZE = (128, 128)


def drawing_tensor(image):
    image = ImageOps.exif_transpose(image)
    if image.mode in ('RGBA', 'LA') or 'transparency' in image.info:
        rgba = image.convert('RGBA')
        background = Image.new('RGBA', rgba.size, 'white')
        image = Image.alpha_composite(background, rgba)
    image = image.convert('RGB')
    # ImageDataGenerator.flow_from_directory used nearest-neighbor resizing.
    image = image.resize(IMAGE_SIZE, Image.Resampling.NEAREST)
    return np.asarray(image, dtype=np.float32)[None, ...] / 255.0


def extract_voice_features(audio_path):
    import librosa
    # Every training recording is 8 kHz. Normalize microphone bandwidth before
    # the original 22.05 kHz feature analysis, keeping training inputs identical.
    y, _ = librosa.load(audio_path, sr=8000, duration=10.0, mono=True)
    sr = 22050
    y = librosa.resample(y, orig_sr=8000, target_sr=sr)
    if len(y) < sr * 0.5:
        raise ValueError('Audio is too short. Record at least 0.5 seconds, preferably 3–5 seconds.')
    if not np.isfinite(y).all():
        raise ValueError('The recording contains invalid audio samples.')
    if np.sqrt(np.mean(y * y)) < 1e-5:
        raise ValueError('The recording is silent or too quiet. Please record again closer to the microphone.')
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
    delta = librosa.feature.delta(mfcc)
    feats = []
    for values in (mfcc, delta):
        feats.extend(np.mean(values, axis=1))
        feats.extend(np.std(values, axis=1))
    for fn in (librosa.feature.spectral_centroid,
               librosa.feature.spectral_bandwidth,
               librosa.feature.spectral_rolloff):
        values = fn(y=y, sr=sr)
        feats.extend([np.mean(values), np.std(values)])
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    feats.extend(np.mean(contrast, axis=1))
    feats.extend(np.std(contrast, axis=1))
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    feats.extend(np.mean(chroma, axis=1))
    feats.append(np.std(chroma, axis=1)[0])
    result = np.asarray(feats, dtype=np.float32).reshape(1, -1)
    if result.shape[1] != VOICE_FEATURE_COUNT or not np.isfinite(result).all():
        raise ValueError('Unable to extract valid acoustic features from this recording.')
    return result
