"""
Train Drawing Model — Parkinson's Disease Detection
====================================================
Trains a MobileNetV2-based CNN on spiral drawing images.
Binary classification: Healthy vs Parkinson's.

Usage:
    python scripts/train_drawing_model.py
"""

import os
import sys
import numpy as np
import warnings
warnings.filterwarnings('ignore')

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAIN_DIR = os.path.join(BASE_DIR, 'dataset', 'spiral_drawings', 'training')
TEST_DIR = os.path.join(BASE_DIR, 'dataset', 'spiral_drawings', 'testing')
MODEL_DIR = os.path.join(BASE_DIR, 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'parkinsons_drawing_model.h5')

IMG_SIZE = (128, 128)
BATCH_SIZE = 16
EPOCHS = 15

def main():
    print("=" * 60)
    print("  Parkinson's Disease — Drawing Model Training")
    print("=" * 60)

    # Check dataset exists
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

    # Suppress TF warnings
    tf.get_logger().setLevel('ERROR')

    # 1. Data Augmentation & Loading
    print("\n📂 Loading training images...")
    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=20,
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

    train_generator = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='binary', interpolation='nearest',
        classes=['healthy', 'parkinson'],
        subset='training',
        shuffle=True,
        seed=42
    )

    val_generator = val_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='binary', interpolation='nearest',
        classes=['healthy', 'parkinson'],
        subset='validation',
        shuffle=False,
        seed=42
    )

    test_generator = test_datagen.flow_from_directory(
        TEST_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='binary', interpolation='nearest',
        classes=['healthy', 'parkinson'],
        shuffle=False
    )

    print(f"   Training samples: {train_generator.samples}")
    print(f"   Validation samples: {val_generator.samples}")
    print(f"   Test samples: {test_generator.samples}")
    print(f"   Classes: {train_generator.class_indices}")

    # 2. Build Model — Transfer Learning with MobileNetV2
    print("\n🧠 Building MobileNetV2 model (transfer learning)...")
    base_model = MobileNetV2(
        weights='imagenet',
        include_top=False,
        input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3)
    )

    # Freeze the base model
    base_model.trainable = False

    # Add custom classification head
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(128, activation='relu')(x)
    x = Dropout(0.5)(x)
    x = Dense(64, activation='relu')(x)
    x = Dropout(0.3)(x)
    output = Dense(1, activation='sigmoid')(x)

    model = Model(inputs=base_model.input, outputs=output)

    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )

    print(f"   Total parameters: {model.count_params():,}")
    print(f"   Trainable parameters: {sum(tf.keras.backend.count_params(w) for w in model.trainable_weights):,}")

    # 3. Train
    print(f"\n🏋️ Training for {EPOCHS} epochs...")
    early_stop = EarlyStopping(
        monitor='val_accuracy',
        patience=5,
        restore_best_weights=True,
        verbose=1
    )

    history = model.fit(
        train_generator,
        validation_data=val_generator,
        epochs=EPOCHS,
        callbacks=[early_stop],
        verbose=1
    )

    # 4. Evaluate on Test Set
    print("\n📊 Evaluating on test set...")
    test_loss, test_accuracy = model.evaluate(test_generator, verbose=0)
    print(f"   Test Loss: {test_loss:.4f}")
    print(f"   Test Accuracy: {test_accuracy:.2%}")

    # Detailed predictions
    predictions = model.predict(test_generator, verbose=0)
    y_pred = (predictions > 0.5).astype(int).flatten()
    y_true = test_generator.classes

    from sklearn.metrics import classification_report, confusion_matrix
    print(f"\n📋 Classification Report:")
    print(classification_report(y_true, y_pred, target_names=['Healthy', "Parkinson's"]))

    cm = confusion_matrix(y_true, y_pred)
    print(f"📊 Confusion Matrix:")
    print(f"   {'':>15} Pred Healthy  Pred Parkinson's")
    print(f"   {'True Healthy':>15}    {cm[0][0]:>5}         {cm[0][1]:>5}")
    print(f"   {'True Parkinsons':>15}    {cm[1][0]:>5}         {cm[1][1]:>5}")

    # 5. Save Model
    os.makedirs(MODEL_DIR, exist_ok=True)
    model.save(MODEL_PATH)
    print(f"\n💾 Model saved to: {MODEL_PATH}")

    print(f"\n{'=' * 60}")
    print(f"  Training Complete! Test accuracy: {test_accuracy:.2%}")
    print(f"{'=' * 60}\n")

if __name__ == '__main__':
    main()
