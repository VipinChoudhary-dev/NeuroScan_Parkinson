import { BrainCircuit, Database, Cpu, GitBranch } from 'lucide-react';
import AnimatedSection from '../components/AnimatedSection';
import PageTransition from '../components/PageTransition';

const About = () => (
  <PageTransition>
    {/* ── Stats Section ── */}
    <section className="section-dark-1" style={{ paddingTop: '7rem' }}>
      <div className="container">
        <AnimatedSection>
          <AnimatedSection.Item>
            <h2 className="section-title">About This Platform</h2>
            <p className="section-subtitle">
              NeuroScan AI is a research application that classifies voice recordings and drawings using models trained on healthy-labelled and Parkinson’s-labelled examples.
            </p>
          </AnimatedSection.Item>
        </AnimatedSection>

        <AnimatedSection>
          <AnimatedSection.Item>
            <div className="stats-row">
              <div className="stat-item">
                <div className="stat-num">567</div>
                <div className="stat-name">Unique Voice Recordings</div>
              </div>
              <div className="stat-item">
                <div className="stat-num">204</div>
                <div className="stat-name">Spiral + Wave Images</div>
              </div>
              <div className="stat-item">
                <div className="stat-num">193</div>
                <div className="stat-name">Acoustic Features Extracted</div>
              </div>
              <div className="stat-item">
                <div className="stat-num">3</div>
                <div className="stat-name">Trained Classifiers</div>
              </div>
            </div>
          </AnimatedSection.Item>
        </AnimatedSection>
      </div>
    </section>

    {/* ── Technical Architecture ── */}
    <section className="section-purple-glow">
      <div className="container">
        <AnimatedSection>
          <AnimatedSection.Item>
            <h2 className="section-title">Technical Architecture</h2>
            <p className="section-subtitle">
              Shared preprocessing keeps model training and uploaded-file analysis consistent.
            </p>
          </AnimatedSection.Item>
        </AnimatedSection>

        <AnimatedSection className="features-grid">
          <AnimatedSection.Item>
            <div className="feature-card">
              <div className="feature-icon"><Database size={22} /></div>
              <h3>Voice Model</h3>
              <p><strong>Algorithm:</strong> Voting ensemble: Random Forest, Gradient Boosting and SVM<br/>
              <strong>Dataset:</strong> 567 unique recordings (287 healthy, 280 Parkinson’s); 453 training and 114 testing<br/>
              <strong>Features:</strong> MFCC, delta MFCC, spectral statistics and chroma<br/>
              <strong>Preprocessing:</strong> StandardScaler fitted on training data only<br/>
              <strong>Evaluation:</strong> 96.49% on the recording holdout; subject independence is unverified</p>
            </div>
          </AnimatedSection.Item>
          <AnimatedSection.Item>
            <div className="feature-card">
              <div className="feature-icon"><Cpu size={22} /></div>
              <h3>Drawing Models</h3>
              <p><strong>Architecture:</strong> MobileNetV2 (Transfer Learning, ImageNet weights)<br/>
              <strong>Dataset:</strong> 72 training + 30 testing images for each drawing type<br/>
              <strong>Input:</strong> 128×128 RGB images<br/>
              <strong>Preprocessing:</strong> RGB, nearest-neighbor resize, scale to 0–1<br/>
              <strong>Evaluation:</strong> 80% on each supplied test set; some subject IDs occur in both splits</p>
            </div>
          </AnimatedSection.Item>
          <AnimatedSection.Item>
            <div className="feature-card">
              <div className="feature-icon"><GitBranch size={22} /></div>
              <h3>Backend Stack</h3>
              <p><strong>Framework:</strong> Python FastAPI<br/>
              <strong>Audio Processing:</strong> Librosa + bundled FFmpeg (uploaded or recorded audio)<br/>
              <strong>Image Processing:</strong> Pillow<br/>
              <strong>ML Frameworks:</strong> Scikit-learn, TensorFlow/Keras</p>
            </div>
          </AnimatedSection.Item>
          <AnimatedSection.Item>
            <div className="feature-card">
              <div className="feature-icon"><BrainCircuit size={22} /></div>
              <h3>Frontend Stack</h3>
              <p><strong>Framework:</strong> React + Vite<br/>
              <strong>Styling:</strong> Custom CSS (Dark theme)<br/>
              <strong>Icons:</strong> Lucide React<br/>
              <strong>Recording:</strong> MediaRecorder Web API</p>
            </div>
          </AnimatedSection.Item>
        </AnimatedSection>
      </div>
    </section>

    {/* ── Disclaimer ── */}
    <section className="section-dark-2" style={{ paddingBottom: '4rem' }}>
      <div className="container">
        <AnimatedSection>
          <AnimatedSection.Item>
            <div className="glass-card" style={{ maxWidth: 700, margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: '0.5rem' }}>⚠️ Disclaimer</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                This application is for educational and research purposes only. It does not constitute a medical diagnosis. 
                Please consult a qualified healthcare professional for clinical evaluation and advice.
              </p>
            </div>
          </AnimatedSection.Item>
        </AnimatedSection>
      </div>
    </section>
  </PageTransition>
);

export default About;
