# NeuroScan methodology and evidence

Updated 7 October 2026. This is a local research workflow, not a clinically validated diagnostic device.

## What the application does

Three independently trained classifiers compare a voice recording, spiral drawing and wave drawing with healthy-labelled and Parkinson's-labelled examples. The assessment route accepts any subset, preserves individual outputs, checks basic acquisition quality, and calculates two experimental indices when at least two positive-weight models succeed. A single available model produces its individual result only. All inputs and model artifacts have SHA-256 fingerprints in the exported report.

The prediction API runs the saved classifiers or returns an explicit model-unavailable error. It does not substitute heuristic or placeholder results. Predictions do not inspect filenames or dataset labels.

## Integration methods

Let p_i be the model's score for the **Parkinson's-labelled class**, not its confidence in whichever class wins. For example, 95% confidence in a healthy-like classification corresponds to a PD score near 0.05, not 0.95.

Given nonnegative operator weights a_i, use only available successful tests with positive weights, and normalize w_i = a_i / sum(a_j) over those tests.

* Linear integration: L = sum(w_i * p_i).
* Cobb–Douglas form: G = A * product(p_i ** w_i), with A = 1 and sum(w_i) = 1. This is a weighted geometric mean.

The initial raw weights are all 1. Equal weights are a neutral mathematical starting point, **not a claim that all tests have equal clinical usefulness**. A clinician or researcher can explore other weights; those choices remain operator preferences until evaluated on appropriate data. Zero weight excludes a test. Missing or failed modalities are not filled with invented values; the report states their exclusion and effective weights. A zero class score with positive weight makes G zero. No arbitrary epsilon is used to conceal it.

For p = (0.2, 0.5, 0.8), equal-weight L = 0.5 and G ≈ 0.430887. The geometric mean is lower than or equal to the arithmetic mean; it can be strongly suppressed by one low score. This property does not make it more clinically accurate. Neither formula is a disease probability or a validated diagnostic threshold. Scores are not clinically calibrated. There is no trained fusion model and no measured combined accuracy.

With three included tests, the report recalculates both indices after leaving out each test. This is a sensitivity illustration, not a confidence interval. A +/-0.10 band around the individual 0.5 class boundary is an engineering review flag, not a clinical cutoff. Spiral and wave may measure correlated motor behaviour: adding both does not create independent clinical evidence.

## Why separate datasets can support inference, but not combined validation

Independent classifiers can be trained on different cohorts and later applied to three samples collected from the same new participant. Decision-level fusion can combine their outputs. However, the existing datasets do not establish how these scores behave jointly in the same people. There are **zero verified three-modality paired records** here.

Randomly pairing healthy files together or Parkinson's files together would manufacture a patient cohort. Do not train or evaluate a clinical fusion system on those artificial pairs. Bundled examples are always labelled an unpaired demonstration. The same-person mode requires an operator confirmation, but the software cannot verify that assertion.

To learn weights, calibrate outputs, choose a referral threshold or estimate combined sensitivity/specificity, obtain a paired cohort with an independent clinical reference standard. Preserve participant groups across sessions and modalities when splitting. Fit all preprocessing only on training data; select hyperparameters on development/validation data; reserve independent calibration data as required; keep the final test participants untouched. Report missing-modality performance, acquisition/device variation, uncertainty, subgroup coverage and an external/prospective evaluation. A relevant comparison cohort must contain alternative conditions, not just healthy controls.

Background: [Multimodal Machine Learning: A Survey and Taxonomy](https://arxiv.org/abs/1705.09406), [scikit-learn calibration](https://scikit-learn.org/stable/modules/calibration.html), [cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html).

## Dataset inventory and deployed models

* Voice: 1,134 WAV filenames, 567 distinct recordings (287 healthy, 280 PD). Exact duplicates excluded before a 453/114 split. Patient IDs are unavailable, so this is recording-disjoint, not demonstrated participant-disjoint. The 193-feature scaler and voting ensemble share checked metadata and fingerprints. Test accuracy 110/114 (96.49%), matrix [[55,3],[1,55]].
* Spiral: 102 images, supplied 72/30 split; saved MobileNetV2 classifier. Test accuracy 24/30 (80%), matrix [[15,0],[6,9]].
* Wave: 102 images, supplied 72/30 split; saved MobileNetV2 classifier. Test accuracy 24/30 (80%), matrix [[13,2],[4,11]].
* The supplied drawing splits overlap in filename-derived subject identifiers. Their 80% figures are not independent-patient estimates.
* The legacy UCI voice CSV contains 195 rows of precomputed acoustic features. It is a separate experiment, not interchangeable with the deployed waveform feature extractor.
* Some bundled labelled drawings are misclassified. Their labels are not used to override predictions.

Matrices use true healthy / PD rows and predicted healthy / PD columns. Accuracy alone hides different false-positive and false-negative rates. The Evidence page reports sensitivity and specificity and only shows evaluation numbers when the manifest matches the loaded artifact hash.

## Fine-tuning performed

`scripts/fine_tune_drawings.py` runs a reproducible experiment (seed 42) on each 102-image dataset. It groups by filename prefix V<number>H/P, an **unverified identity proxy**, and uses separate training, validation and test groups. It extracts the original frozen ImageNet backbone, discards the old trained head, trains a new head with augmentation, then fine-tunes the last backbone layers with a small learning rate and frozen batch-normalization statistics. Inputs use the MobileNetV2 -1 to 1 convention for these new candidates; the deployed original models retain their original 0 to 1 preprocessing.

Stage selection uses validation log loss. Candidate test predictions are evaluated after selection; candidates are never automatically deployed.

| Candidate | Train / validation / test | Selected stage | Test accuracy | Sensitivity | Specificity |
|---|---|---|---|---|---|
| Spiral | 48 / 27 / 27 | Fine-tuned | 19/27 = 70.37% | 58.33% | 80% |
| Wave | 48 / 27 / 27 | Frozen backbone + new head | 18/27 = 66.67% | 75% | 60% |

The wave fine-tuning stage did not win validation selection. The candidate test split differs from the supplied original split, so comparison against the original 80% is not an apples-to-apples experiment. These results do not establish improvement. Test sets are tiny and grouping metadata uncertain. Full predictions, group membership, losses, Brier scores, AUC, training histories and candidate artifacts are in `reports/enhancement/fine-tuning/`. Deployed CNN artifacts remain unchanged.

The next controlled model comparison needs confirmed participant identities, a prespecified split and multiple development-only candidates with an untouched final test. Avoid repeatedly optimizing against the now-inspected test examples. [TensorFlow transfer learning guide](https://www.tensorflow.org/guide/keras/transfer_learning).

## Clinical scope and overlapping symptoms

The datasets only encode healthy versus Parkinson's labels. They cannot train a reliable multiclass differential diagnosis for diseases absent from the data. Essential tremor, atypical or secondary parkinsonism, and other movement disorders can overlap with parts of the observed presentation. The app's clinical-context page is a sourced, non-exhaustive reference, not a model output. [NICE recommends clinical diagnosis and specialist assessment](https://www.nice.org.uk/guidance/ng71/chapter/recommendations). No healthy-like score excludes disease, and no PD-like score establishes it.

## Acquisition, privacy and operational limits

Image checks cover dimensions and contrast; audio checks cover duration, level and clipping. These do not reliably identify the wrong drawing type, unrelated photos, speech suitability, all noise, device shift, or out-of-distribution samples. Clear recording/photo instructions improve consistency but do not confer validation.

The assessment service processes files locally, removes temporary decoded audio, and does not create a patient database. Reports are saved only by explicit browser export/print. Browser input state is cleared on reset or page disposal. Normal HTTP access logs exist. Do not use personal identifiers or regard this prototype as a secure medical-record system. Authentication, managed retention, clinical governance and prospective validation would be separate requirements before a clinical deployment.

Exports include input/model hashes, raw class scores, selected/effective weights, failures, technical warnings, mode, time and operator observations. Notes are not model features. Changing inputs or weights marks displayed results stale and disables export until reanalysis. The two numeric indices are displayed on a 0–1 scale, without fabricated combined percentages or disease labels.
