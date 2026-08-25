"""
Inference wrapper for the BiGRU emotion classifier.

Preprocessing mirrors the training notebook exactly:
  - lowercase, keep only [a-zA-Z'] tokens
  - map tokens -> vocab ids (word_index from tokenizer.pkl), OOV -> <unk>
  - pad/truncate (post) to max_len = 50
"""
import os
import re
import pickle
import torch
import torch.nn.functional as F

from .architecture import BiGRUClassifier

MAX_LEN = 50
PAD_TOKEN = "<pad>"
OOV_TOKEN = "<unk>"

# dair-ai/emotion label order (0..5) — matches the notebook's label_names
LABEL_NAMES = ["sadness", "joy", "love", "anger", "fear", "surprise"]

LABEL_META = {
    "sadness":  {"emoji": "😢", "color": "#5B8DEF"},
    "joy":      {"emoji": "😄", "color": "#FFC145"},
    "love":     {"emoji": "💜", "color": "#C77DFF"},
    "anger":    {"emoji": "😠", "color": "#FF5D5D"},
    "fear":     {"emoji": "😨", "color": "#3DDC97"},
    "surprise": {"emoji": "😲", "color": "#FF9F5A"},
}

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH = os.path.join(_THIS_DIR, "BiGRU_Model.pt")
_TOKENIZER_PATH = os.path.join(_THIS_DIR, "tokenizer.pkl")

_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_model = None
_word_index = None


def _simple_tokenize(text: str):
    return re.findall(r"[a-zA-Z']+", text.lower())


def _texts_to_padded_sequence(text: str):
    tokens = _simple_tokenize(text)
    seq = [_word_index.get(tok, _word_index[OOV_TOKEN]) for tok in tokens]
    seq = seq[:MAX_LEN]
    padded = [0] * MAX_LEN
    padded[: len(seq)] = seq
    return padded, tokens


def load_artifacts():
    """Load the tokenizer + model weights once, at process startup."""
    global _model, _word_index

    with open(_TOKENIZER_PATH, "rb") as f:
        _word_index = pickle.load(f)

    checkpoint = torch.load(_MODEL_PATH, map_location=_device, weights_only=False)
    vocab_size = checkpoint["vocab_size"]
    embed_dim = checkpoint["embed_dim"]
    num_classes = checkpoint["num_classes"]

    _model = BiGRUClassifier(vocab_size=vocab_size, embed_dim=embed_dim, num_classes=num_classes)
    _model.load_state_dict(checkpoint["model_state_dict"])
    _model.to(_device)
    _model.eval()
    return _model


def predict(text: str):
    """Return the full probability distribution + top emotion for a piece of text."""
    if _model is None or _word_index is None:
        load_artifacts()

    text = (text or "").strip()
    if not text:
        return None

    padded, tokens = _texts_to_padded_sequence(text)
    tensor = torch.as_tensor([padded], dtype=torch.long).to(_device)

    with torch.no_grad():
        logits = _model(tensor)
        probs = F.softmax(logits, dim=1).cpu().numpy()[0]

    results = []
    for i, label in enumerate(LABEL_NAMES):
        results.append({
            "label": label,
            "probability": float(probs[i]),
            "emoji": LABEL_META[label]["emoji"],
            "color": LABEL_META[label]["color"],
        })
    results.sort(key=lambda r: r["probability"], reverse=True)

    known = sum(1 for t in tokens if t in _word_index and t != OOV_TOKEN)
    coverage = (known / len(tokens)) if tokens else 0.0

    return {
        "text": text,
        "top": results[0],
        "distribution": results,
        "token_count": len(tokens),
        "vocab_coverage": round(coverage, 3),
    }
