"""
BiGRU Emotion Classifier — architecture definition.

This mirrors the exact model class used to train BiGRU_Model.pt so the
saved state_dict loads cleanly:

  Embedding(vocab_size, embed_dim, padding_idx=0)
    -> BiGRU(embed_dim -> 128, bidirectional)      [gru1]
    -> Dropout(0.5)
    -> BiGRU(256 -> 64, bidirectional)              [gru2]
    -> Dropout(0.5)
    -> Linear(128 -> num_classes)                   [fc]
"""
import torch
import torch.nn as nn


class BiGRUClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, num_classes, pad_idx=0):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=pad_idx)
        self.gru1 = nn.GRU(embed_dim, 128, batch_first=True, bidirectional=True)
        self.dropout1 = nn.Dropout(0.5)
        self.gru2 = nn.GRU(128 * 2, 64, batch_first=True, bidirectional=True)
        self.dropout2 = nn.Dropout(0.5)
        self.fc = nn.Linear(64 * 2, num_classes)

    def forward(self, x):
        x = self.embedding(x)
        x, _ = self.gru1(x)
        x = self.dropout1(x)
        _, hn = self.gru2(x)
        x = torch.cat((hn[-2], hn[-1]), dim=1)
        x = self.dropout2(x)
        return self.fc(x)
