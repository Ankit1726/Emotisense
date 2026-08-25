import os
import time
import logging

from flask import Flask, request, jsonify, render_template

from model.inference import predict, load_artifacts, LABEL_NAMES

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("emotisense")

app = Flask(__name__, static_folder="static", template_folder="templates")

_MODEL_READY = False


def _ensure_model_loaded():
    global _MODEL_READY
    if not _MODEL_READY:
        logger.info("Loading BiGRU model + tokenizer ...")
        load_artifacts()
        _MODEL_READY = True
        logger.info("Model ready.")


@app.route("/")
def index():
    return render_template("index.html", labels=LABEL_NAMES)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "model_loaded": _MODEL_READY})


@app.route("/api/predict", methods=["POST"])
def api_predict():
    _ensure_model_loaded()

    data = request.get_json(silent=True) or {}
    text = data.get("text", "")

    if not text or not text.strip():
        return jsonify({"error": "Please provide some text to analyze."}), 400

    if len(text) > 2000:
        return jsonify({"error": "Text is too long (max 2000 characters)."}), 400

    start = time.time()
    result = predict(text)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)

    return jsonify(result)


# Load model eagerly at import time so the first request isn't slow
# and so gunicorn workers are ready immediately.
_ensure_model_loaded()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
