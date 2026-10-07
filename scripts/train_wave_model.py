"""
Train Wave Drawing Model — Parkinson's Disease Detection
=========================================================
Trains a MobileNetV2-based CNN on wave drawing images.
Binary classification: Healthy vs Parkinson's.

Usage:
    python scripts/train_wave_model.py
"""

import os
import sys
import numpy as np
import warnings
warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAIN_DIR = os.path.join(BASE_DIR, 'dataset', 'wave_drawings', 'training')
TEST_DIR  = os.path.join(BASE_DIR, 'dataset', 'wave_drawings', 'testing')
MODEL_DIR = os.path.join(BASE_DIR, 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'parkinsons_wave_model.h5')

IMG_SIZE   = (128, 128)
BATCH_SIZE = 16
EPOCHS     = 15

def main():
    print("=" * 60)
    print("  Parkinson's Disease — Wave Drawing Model Training")
    print("=" * 60)

    if not os.path.exists(TRAIN_DIR):
        print(f"\n❌ Training data not found at: {TRAIN_DIR}")
        sys.exit(1)

    try:
        import tensorflow as tf
        from tensorflow.keras.preprocessing.image import ImageDataGenerator
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
        from tensorflow.keras.models import Model
        from tensorflow.keras.optimizers import Adam
        from tensorflow.keras.callbacks import EarlyStopping
    except ImportError:
        print("\n❌ TensorFlow is required. Install with: pip install tensorflow")
        sys.exit(1)

    tf.get_logger().setLevel('ERROR')

    print("\n📂 Loading wave drawing images...")
    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=15,
        width_shift_range=0.1,
        height_shift_range=0.1,
        shear_range=0.1,
        zoom_range=0.15,
        horizontal_flip=True,
        fill_mode='nearest',
        validation_split=0.2
    )
    val_datagen = ImageDataGenerator(rescale=1.0 / 255, validation_split=0.2)
    test_datagen = ImageDataGenerator(rescale=1.0 / 255)

    train_gen = train_datagen.flow_from_directory(
        TRAIN_DIR, target_size=IMG_SIZE, batch_size=BATCH_SIZE,
        class_mode='binary', interpolation='nearest', classes=['healthy', 'parkinson'],
        subset='training', shuffle=True, seed=42
    )
    val_gen = val_datagen.flow_from_directory(
        TRAIN_DIR, target_size=IMG_SIZE, batch_size=BATCH_SIZE,
        class_mode='binary', interpolation='nearest', classes=['healthy', 'parkinson'],
        subset='validation', shuffle=False, seed=42
    )
    test_gen = test_datagen.flow_from_directory(
        TEST_DIR, target_size=IMG_SIZE, batch_size=BATCH_SIZE,
        class_mode='binary', interpolation='nearest', classes=['healthy', 'parkinson'], shuffle=False
    )

    print(f"   Training samples : {train_gen.samples}")
    print(f"   Validation samples: {val_gen.samples}")
    print(f"   Test samples      : {test_gen.samples}")

    print("\n🧠 Building MobileNetV2 model (transfer learning)...")
    base_model = MobileNetV2(weights='imagenet', include_top=False,
                             input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3))
    base_model.trainable = False

    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(128, activation='relu')(x)
    x = Dropout(0.5)(x)
    x = Dense(64, activation='relu')(x)
    x = Dropout(0.3)(x)
    output = Dense(1, activation='sigmoid')(x)

    model = Model(inputs=base_model.input, outputs=output)
    model.compile(optimizer=Adam(learning_rate=0.001),
                  loss='binary_crossentropy', metrics=['accuracy'])

    print(f"\n🏋️ Training for up to {EPOCHS} epochs...")
    early_stop = EarlyStopping(monitor='val_accuracy', patience=5,
                               restore_best_weights=True, verbose=1)
    model.fit(train_gen, validation_data=val_gen, epochs=EPOCHS,
              callbacks=[early_stop], verbose=1)

    print("\n📊 Evaluating on test set...")
    _, test_acc = model.evaluate(test_gen, verbose=0)
    print(f"   Test Accuracy: {test_acc:.2%}")

    from sklearn.metrics import classification_report, confusion_matrix
    preds = (model.predict(test_gen, verbose=0) > 0.5).astype(int).flatten()
    print(classification_report(test_gen.classes, preds, target_names=['Healthy', "Parkinson's"]))

    os.makedirs(MODEL_DIR, exist_ok=True)
    model.save(MODEL_PATH)
    print(f"\n💾 Model saved to: {MODEL_PATH}")
    print(f"\n{'=' * 60}")
    print(f"  Training Complete! Test accuracy: {test_acc:.2%}")
    print(f"{'=' * 60}\n")

if __name__ == '__main__':
    main()
