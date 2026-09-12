# Research notes — AI RPS

## Evidence-backed architecture

1. Teachable Machine Image exports a URL checkpoint where `model.json` contains the model topology and references model weights; `metadata.json` contains class labels and metadata. The official community library exposes `tmImage.load(checkpoint, metadata)`. 
2. The same library exposes `model.getTotalClasses()`, `model.getClassLabels()`, `model.predict()`, and a webcam helper with `setup()`, `play()`, `update()`, and `stop()`.
3. TensorFlow.js is intended to run ML models in the browser and can be included via a script tag.
4. GitHub Pages can publish a static site directly from repository files, with `index.html` as an entry file. Deploying from a branch and root folder is supported.
5. Webcam access requires a secure context and user permission. A GitHub Pages HTTPS site therefore fits the browser-camera use case.

## Design choices

- Pure HTML/CSS/JavaScript: no npm install and no build step.
- External model URL: easy to replace when the trained Teachable Machine model changes.
- Three-class gesture mapping: Indonesian labels are recommended but English equivalents are accepted.
- Prediction smoothing across multiple webcam frames reduces one-frame misclassifications.
- 60% confidence threshold avoids resolving a round from a weak prediction.
- The AI's gesture is random so the game stays simple and neutral.
- Camera and model loading are separated, so a failed camera permission does not destroy the loaded model.
- Model URL is saved in `localStorage` for convenience; no secret or credential is stored.
