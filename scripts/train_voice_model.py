"""
Train Voice Model — Parkinson's Disease Detection
==================================================
Trains a Random Forest Classifier on the UCI Parkinson's Voice Dataset.
Extracts 22 acoustic features and classifies status (0=Healthy, 1=Parkinson's).

Usage:
    python scripts/train_voice_model.py
"""

import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import pickle
import warnings
warnings.filterwarnings('ignore')

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_PATH = os.path.join(BASE_DIR, 'dataset', 'uci_parkinsons_voice.csv')
MODEL_DIR = os.path.join(BASE_DIR, 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'uci_voice_model.pkl')
SCALER_PATH = os.path.join(MODEL_DIR, 'uci_voice_scaler.pkl')

def main():
    print("=" * 60)
    print("  Parkinson's Disease — Voice Model Training")
    print("=" * 60)

    # 1. Load Data
    if not os.path.exists(DATASET_PATH):
        print(f"\n❌ Dataset not found at: {DATASET_PATH}")
        print("   Please ensure uci_parkinsons_voice.csv is in the dataset/ folder.")
        sys.exit(1)

    df = pd.read_csv(DATASET_PATH)
    print(f"\n📊 Dataset loaded: {df.shape[0]} samples, {df.shape[1]} columns")
    print(f"   Healthy: {(df['status'] == 0).sum()} | Parkinson's: {(df['status'] == 1).sum()}")

    # 2. Feature Selection — drop name column and target
    X = df.drop(columns=['name', 'status'])
    y = df['status']

    feature_names = X.columns.tolist()
    print(f"\n🔬 Features ({len(feature_names)}): {', '.join(feature_names[:6])}... +{len(feature_names)-6} more")

    # 3. Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"\n📂 Split: {X_train.shape[0]} train / {X_test.shape[0]} test")

    # 4. Scale Features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 5. Train Random Forest
    print("\n🌲 Training RandomForestClassifier (n_estimators=200)...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train_scaled, y_train)

    # 6. Evaluate
    y_pred = model.predict(X_test_scaled)
    accuracy = accuracy_score(y_test, y_pred)

    print(f"\n✅ Accuracy: {accuracy:.2%}")
    print(f"\n📋 Classification Report:")
    print(classification_report(y_test, y_pred, target_names=['Healthy', "Parkinson's"]))

    cm = confusion_matrix(y_test, y_pred)
    print(f"📊 Confusion Matrix:")
    print(f"   {'':>15} Pred Healthy  Pred Parkinson's")
    print(f"   {'True Healthy':>15}    {cm[0][0]:>5}         {cm[0][1]:>5}")
    print(f"   {'True Parkinsons':>15}    {cm[1][0]:>5}         {cm[1][1]:>5}")

    # 7. Feature Importances
    importances = model.feature_importances_
    top_features = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)[:5]
    print(f"\n🏆 Top 5 Important Features:")
    for feat, imp in top_features:
        print(f"   {feat:>25}: {imp:.4f}")

    # 8. Save Model & Scaler
    os.makedirs(MODEL_DIR, exist_ok=True)

    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    print(f"\n💾 Model saved to: {MODEL_PATH}")

    with open(SCALER_PATH, 'wb') as f:
        pickle.dump(scaler, f)
    print(f"💾 Scaler saved to: {SCALER_PATH}")

    # 9. Save feature names for backend reference
    feature_path = os.path.join(MODEL_DIR, 'uci_voice_feature_names.txt')
    with open(feature_path, 'w') as f:
        f.write('\n'.join(feature_names))
    print(f"💾 Feature names saved to: {feature_path}")

    print(f"\n{'=' * 60}")
    print(f"  Training Complete! Model accuracy: {accuracy:.2%}")
    print(f"{'=' * 60}\n")

if __name__ == '__main__':
    main()
