# NeuroScan, explained simply

## 1. Is there a new combined ML model?

**No. There are three independent classifier pipelines: voice, spiral and wave.**

Each pipeline produces its own score. Two mathema tical formulas then combine those scores. The formulas do not learn from data and are not a fourth trained classifier.

The medical chatbot is a separate, general-purpose Gemini language model. We did not train it, and it has no role in calculating predictions or fusion scores. It cannot see your uploads or assessment results.

## 2. What data do we have?

| Test | Available data | Development / test split |
|---|---|---|
| Voice | 1,134 WAV files, but only **567 unique recordings**: 287 healthy-labelled and 280 Parkinson's-labelled | 453 unique recordings used for fitting; 114 held out for testing |
| Spiral | 102 images | 72 in the supplied training/development folder; 30 in the testing folder |
| Wave | 102 images | 72 in the supplied training/development folder; 30 in the testing folder |

The drawing training scripts reserve 20% of each class in the 72-image development folder for validation: **58 fitting images and 14 validation images**. Validation helps choose when to stop training. The 30 test images are separate from that process. These are the supplied script settings; the original saved drawing models do not include a complete historical training log, so their exact completed epoch counts are not known.

The voice duplicates were removed before splitting, so identical recordings cannot occur on both sides. Voice participant identities are unknown. Drawing filenames indicate some subject overlap in the original split. Consequently, these tests do not establish accuracy on completely new patients.

There is also an older 195-row UCI voice CSV with precomputed measurements. It is a separate experiment and is not the current audio-upload model.

## 3. How was the voice model trained?

It was fitted on this project's audio features, **not adapted from a pretrained speech model**.

1. Read a recording and normalize its sampling bandwidth to match training.
2. Extract **193 numbers** describing the sound: MFCC statistics, changes in MFCCs, spectral characteristics and chroma. The deployed extractor does not calculate jitter or shimmer.
3. Fit a StandardScaler using only the 453 training recordings, then transform the features.
4. Train a Random Forest, Gradient Boosting classifier and support-vector machine (SVM).
5. Combine their class probabilities using soft voting, with relative weights **3:2:2**.

So “one voice model” is an **ensemble containing three algorithms**. Those internal voice weights are different from the voice/spiral/wave sliders in the website.

Its measured recording-holdout accuracy is **110/114 = 96.49%**. This is dataset performance, not a guarantee on new people, microphones or rooms.

## 4. How were the drawing models trained?

Both use **transfer learning** from MobileNetV2, a neural network pretrained on ImageNet's general images. ImageNet is not a Parkinson's dataset.

The original pipeline freezes that pretrained backbone and adds a new classification head: global average pooling, Dense(128), dropout, Dense(64), dropout, and one sigmoid output. Only the new head learns the healthy/PD drawing task. Spiral and wave have separately fitted heads and separate saved model files.

The supplied scripts use image augmentation, Adam, binary cross-entropy and up to 15 epochs with early stopping. A transformed/rotated training image is not a new participant. Existing deployed models use RGB images resized to **128 × 128**, nearest-neighbour interpolation, and pixel values divided by 255, matching their original pipeline.

Each deployed drawing model scored **24/30 = 80%** on its supplied test images. Errors remain visible; filenames never override predictions.

## 5. What happens when I press Analyse?

The backend checks the file, applies the same preprocessing used by that classifier, and runs the saved model. **Models are not retrained when you submit.**

Each returns a score `p` for the Parkinson's-labelled class:

- `p > 0.5`: Parkinson's-like pattern.
- `p <= 0.5`: healthy-like pattern.
- Displayed individual classification confidence is `max(p, 1-p)`.

Example: `p = 0.10` means a healthy-like classification with confidence 0.90. Fusion uses **0.10**, not 0.90. These scores are not calibrated probabilities that the person has the disease.

A missing/broken model returns an error, not a fabricated fallback score. Technical quality flags cover basic image/audio properties; they cannot identify every unsuitable input.

## 6. How do the two combined indices work?

Give each contributing test a nonnegative importance weight. The app normalizes the available positive weights to sum to one. Equal weights are the default, not proven clinical importance.

**Linear:** `L = w_voice*p_voice + w_spiral*p_spiral + w_wave*p_wave`.

**Cobb–Douglas:** `G = p_voice^w_voice × p_spiral^w_spiral × p_wave^w_wave`, with scale factor A = 1. This is a weighted geometric mean.

For scores 0.2, 0.5 and 0.8 with equal weights, **L = 0.500** and **G ≈ 0.431**. Low scores can suppress the geometric mean. Neither formula is automatically better or medically more accurate.

Missing/failed tests are excluded explicitly and remaining weights renormalized. A zero weight excludes a test. At least two contributing tests are needed for a combined index; otherwise only the individual result is shown. Three-test reports also show what happens when each test is left out.

## 7. Can we combine datasets from different people?

We can train independent models on different cohorts, then apply them to samples collected from the **same new person**. But we cannot use unrelated people's files to measure same-person combined accuracy or learn reliable clinical weights.

There are **no verified three-test paired records** in the current datasets. Randomly matching examples would not solve that. Demo mode explicitly labels bundled examples as unpaired.

## 8. What about the fine-tuning experiments?

New drawing candidates were trained and saved separately: reset the classifier head, train it on frozen pretrained features, then try small-learning-rate backbone fine-tuning. Group-separated development/validation/test sets were used, with filename prefixes as an unverified participant proxy. Each task used **48 / 27 / 27** images.

Validation loss selected the candidate stage. Spiral's selected fine-tuned candidate scored **19/27 (70.37%)** on the test set. Wave's selected frozen-backbone candidate scored **18/27 (66.67%)**; fine-tuning did not win its validation comparison.

These are different test splits from the old 80% figures, so they do not demonstrate an improvement or a controlled decline. **Neither candidate is deployed.** The existing three classifier pipelines remain active.

## 9. What can we honestly claim?

The software runs real trained classifiers, exposes their evidence and combines scores transparently. It is a research/education tool. It does not establish a diagnosis, rule out Parkinson's, identify all similar diseases, or provide a validated combined accuracy.

The next scientific step requires a verified paired cohort, independent clinical labels, participant-separated evaluation and calibration. More visual polish or a chatbot cannot replace those data.

For technical detail, see `docs/METHODOLOGY.md`; for collecting paired data, see `docs/DATA_COLLECTION.md`. Website model metrics are on `/evidence`.
