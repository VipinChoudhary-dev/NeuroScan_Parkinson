# Labelled upload examples

Start both servers using the root README, then upload the corresponding image/audio in the app.

- `healthy_spiral_1.png`, `healthy_spiral_2.png`: healthy-labelled spiral examples.
- `parkinson_spiral_1.png`, `parkinson_spiral_2.png`: Parkinson’s-labelled spiral examples.
- `healthy_wave_1.png`, `healthy_wave_2.png`: healthy-labelled wave examples.
- `parkinson_wave_1.png`, `parkinson_wave_2.png`: Parkinson’s-labelled wave examples.
- `healthy_voice_1.wav`, `healthy_voice_2.wav`: healthy-labelled recordings.
- `parkinson_voice_1.wav`, `parkinson_voice_2.wav`: Parkinson’s-labelled recordings.
- `healthy_voice_sample.wav`, `parkinson_voice_sample.wav`: older synthetic demo files; do not use them to establish model accuracy.

Names describe **dataset labels**, not guaranteed predictions. The preserved drawing CNNs currently misclassify `parkinson_spiral_1.png` and `parkinson_wave_1.png`; the `_2` Parkinson’s examples are classified correctly. All four numbered voice examples classify correctly with the rebuilt model. See the full test-set confusion matrices in the root README and detailed predictions in `reports/`.

The API only reads file contents. Renaming a file does not change its prediction.
