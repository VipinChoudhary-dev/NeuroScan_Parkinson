# Planning a real paired cohort

The empty CSV template in `frontend/public/paired-cohort-template.csv` is a collection manifest, not an existing dataset or an upload API. File columns identify files retained under an approved research process. Do not populate it by randomly joining current examples.

Use a stable pseudonymous participant ID, distinct session ID, verified consent reference, and acquisition timestamps/protocol. Collect voice, spiral and wave from the same person/session where possible. Record missing tests explicitly rather than inventing data. A qualified clinical team supplies the independent reference diagnosis; never derive ground truth from these models. Record devices/protocol versions to investigate acquisition effects.

Before enrollment, define the clinical question, intended population, reference standard, inclusion criteria and appropriate consent/data governance. Include relevant alternative conditions if studying differential performance. Determine cohort size from required precision and class prevalence with statistical advice; the existing tiny datasets do not determine an adequate clinical sample size.

Assign all sessions and modalities from one participant to one split. Resolve duplicate recordings and near-duplicate images before splitting. Use development data to select features/models/weights, separate calibration data when appropriate, and hold out the final test cohort. Establish clinical thresholds using explicit error costs and validation evidence. Report sensitivity, specificity, uncertainty and missing-test behaviour, not just accuracy. A new institution/device cohort and prospective evaluation are required to understand real-world performance.

The template intentionally contains no sample patients or clinical labels. A populated manifest alone is not enough to train a clinically valid combined model.
