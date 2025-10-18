"""
IndicTrans2-based translation service.

Loads Hugging Face checkpoints for IndicTrans2 and exposes a simple
translate(text, src_lang, tgt_lang) function with light language-code mapping
and auto-detection support for a few common languages used in the client.

Requirements:
  - transformers
  - torch
  - indictranstoolkit
  - sentencepiece
  - langdetect (optional: for source language auto-detect)

Model checkpoints (distilled for lighter inference):
  - En->Indic:  ai4bharat/indictrans2-en-indic-dist-200M
  - Indic->En:  ai4bharat/indictrans2-indic-en-dist-200M
  - Indic<->Indic: ai4bharat/indictrans2-indic-indic-dist-320M
"""

from __future__ import annotations

from typing import Optional, Tuple

_IMPORT_ERROR = None

try:
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    from IndicTransToolkit import IndicProcessor
    HAS_INDIC = True
except Exception as e:  # pragma: no cover - lazy import guard
    HAS_INDIC = False
    _IMPORT_ERROR = e

try:
    from langdetect import detect  # simple heuristic for auto-detect
    HAS_LANGDETECT = True
except Exception:
    HAS_LANGDETECT = False


class IndicTransService:
    """Singleton service for IndicTrans2 models."""

    _instance: Optional["IndicTransService"] = None

    # HF checkpoints (distilled variants for speed/memory)
    CKPT_EN_INDIC = "ai4bharat/indictrans2-en-indic-dist-200M"
    CKPT_INDIC_EN = "ai4bharat/indictrans2-indic-en-dist-200M"
    CKPT_INDIC_INDIC = "ai4bharat/indictrans2-indic-indic-dist-320M"

    # Map short codes used by the client -> IndicTrans2 language tags
    CODE_TO_TAG = {
        "en": "eng_Latn",
        "hi": "hin_Deva",
        "ka": "kan_Knda",
        "ta": "tam_Taml",
        "te": "tel_Telu",
        # Client uses 'ma' labeled as Malayalam in UI
        "ma": "mal_Mlym",  # Malayalam
        # Client uses 'be' for Bengali in UI
        "be": "ben_Beng",
    }

    # For langdetect -> our short code
    LANGDETECT_TO_SHORT = {
        "en": "en",
        "hi": "hi",
        "bn": "be",  # Bengali -> 'be' in UI
        "ta": "ta",
        "te": "te",
        "ml": "ma",  # Malayalam -> 'ma' in UI
        "kn": "ka",
        # Add a few more likely ones mapping to Devanagari where possible
        "mr": "hi",  # fallback to Devanagari family (approx)
        "gu": "hi",
        "pa": "hi",
        "or": "hi",
        "sa": "hi",
    }

    def __init__(self) -> None:
        if not HAS_INDIC:  # pragma: no cover - simple guard
            raise RuntimeError(
                "IndicTrans2 dependencies not installed: transformers, torch, indictranstoolkit. "
                f"Original import error: {_IMPORT_ERROR}"
            )

        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # Lazy-initialized models/tokenizers/processors
        self._ip: Optional[IndicProcessor] = None
        self._tok_en_indic = None
        self._mdl_en_indic = None
        self._tok_indic_en = None
        self._mdl_indic_en = None
        self._tok_indic_indic = None
        self._mdl_indic_indic = None

    @classmethod
    def get(cls) -> "IndicTransService":
        if cls._instance is None:
            cls._instance = IndicTransService()
        return cls._instance

    def _iproc(self) -> IndicProcessor:
        if self._ip is None:
            self._ip = IndicProcessor(inference=True)
        return self._ip

    def _load_en_indic(self):
        if self._tok_en_indic is None:
            self._tok_en_indic = AutoTokenizer.from_pretrained(
                self.CKPT_EN_INDIC, trust_remote_code=True
            )
        if self._mdl_en_indic is None:
            self._mdl_en_indic = AutoModelForSeq2SeqLM.from_pretrained(
                self.CKPT_EN_INDIC, trust_remote_code=True
            ).to(self.device)
            self._mdl_en_indic.eval()

    def _load_indic_en(self):
        if self._tok_indic_en is None:
            self._tok_indic_en = AutoTokenizer.from_pretrained(
                self.CKPT_INDIC_EN, trust_remote_code=True
            )
        if self._mdl_indic_en is None:
            self._mdl_indic_en = AutoModelForSeq2SeqLM.from_pretrained(
                self.CKPT_INDIC_EN, trust_remote_code=True
            ).to(self.device)
            self._mdl_indic_en.eval()

    def _load_indic_indic(self):
        if self._tok_indic_indic is None:
            self._tok_indic_indic = AutoTokenizer.from_pretrained(
                self.CKPT_INDIC_INDIC, trust_remote_code=True
            )
        if self._mdl_indic_indic is None:
            self._mdl_indic_indic = AutoModelForSeq2SeqLM.from_pretrained(
                self.CKPT_INDIC_INDIC, trust_remote_code=True
            ).to(self.device)
            self._mdl_indic_indic.eval()

    def _short_to_tag(self, code: str) -> Optional[str]:
        return self.CODE_TO_TAG.get(code)

    def _auto_detect_short(self, text: str) -> str:
        if HAS_LANGDETECT:
            try:
                ld = detect(text)
                return self.LANGDETECT_TO_SHORT.get(ld, "en")
            except Exception:
                return "en"
        # fallback default
        return "en"

    def translate(self, text: str, src_short: str, tgt_short: str) -> Tuple[str, str, str]:
        """
        Translate given text from src_short -> tgt_short.

        Returns: (translated_text, src_lang_tag, tgt_lang_tag)
        """
        if not text or not text.strip():
            return "", src_short, tgt_short

        if src_short == "auto":
            src_short = self._auto_detect_short(text)

        src_tag = self._short_to_tag(src_short)
        tgt_tag = self._short_to_tag(tgt_short)

        if src_tag is None or tgt_tag is None:
            # Provide a more helpful message listing supported codes
            supported = sorted(self.CODE_TO_TAG.keys())
            raise ValueError(
                f"Unsupported language codes: src={src_short}, tgt={tgt_short}. Supported: {supported}"
            )

        ip = self._iproc()

        # Decide direction/model
        src_is_en = src_tag == "eng_Latn"
        tgt_is_en = tgt_tag == "eng_Latn"

        if src_is_en and not tgt_is_en:
            # En -> Indic
            self._load_en_indic()
            tokenizer = self._tok_en_indic
            model = self._mdl_en_indic
        elif (not src_is_en) and tgt_is_en:
            # Indic -> En
            self._load_indic_en()
            tokenizer = self._tok_indic_en
            model = self._mdl_indic_en
        else:
            # Indic <-> Indic
            self._load_indic_indic()
            tokenizer = self._tok_indic_indic
            model = self._mdl_indic_indic

        # Preprocess -> tokenize -> generate -> decode -> postprocess
        batch_inputs = ip.preprocess_batch([text], src_lang=src_tag, tgt_lang=tgt_tag)
        print(f"[IndicTrans] Preprocessed batch: {batch_inputs}")
        
        batch_tokens = tokenizer(
            batch_inputs,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        print(f"[IndicTrans] Tokenization result keys: {batch_tokens.keys()}")
        
        # Defensive checks
        input_ids = batch_tokens.get("input_ids")
        if input_ids is None or input_ids.numel() == 0:
            raise ValueError("Tokenization produced empty input. Please check the text input.")
        print(f"[IndicTrans] Input IDs shape: {input_ids.shape}")
        
        attention_mask = batch_tokens.get("attention_mask")
        print(f"[IndicTrans] Attention mask: {attention_mask}")
        if attention_mask is None:
            # Create a default attention mask if missing
            attention_mask = torch.ones_like(input_ids)
            batch_tokens["attention_mask"] = attention_mask
            print(f"[IndicTrans] Created default attention mask")
        
        batch_tokens = {k: v.to(self.device) for k, v in batch_tokens.items()}
        print(f"[IndicTrans] After moving to device, input_ids shape: {batch_tokens['input_ids'].shape}")
        print(f"[IndicTrans] After moving to device, attention_mask shape: {batch_tokens['attention_mask'].shape}")

        # Ensure pad token defined for generation on some models
        if getattr(tokenizer, "pad_token_id", None) is None and getattr(tokenizer, "eos_token_id", None) is not None:
            tokenizer.pad_token_id = tokenizer.eos_token_id
        
        print(f"[IndicTrans] Tokenizer pad_token_id: {tokenizer.pad_token_id}")
        print(f"[IndicTrans] Tokenizer eos_token_id: {tokenizer.eos_token_id}")

        gen_kwargs = {
            "input_ids": batch_tokens["input_ids"],
            "attention_mask": batch_tokens["attention_mask"],
            "num_beams": 5,
            "num_return_sequences": 1,
            "max_length": 256,
            "use_cache": False,  # Disable KV caching to avoid past_key_values issues
        }
        
        # Only add pad_token_id if it's defined
        if tokenizer.pad_token_id is not None:
            gen_kwargs["pad_token_id"] = tokenizer.pad_token_id
        
        print(f"[IndicTrans] gen_kwargs keys: {gen_kwargs.keys()}")
        print(f"[IndicTrans] About to call model.generate()")

        try:
            with torch.inference_mode():
                outputs = model.generate(**gen_kwargs)
            print(f"[IndicTrans] Generation successful, outputs shape: {outputs.shape}")
        except Exception as gen_err:
            print(f"[IndicTrans] Generation error type: {type(gen_err)}")
            print(f"[IndicTrans] Generation error: {gen_err}")
            import traceback
            traceback.print_exc()
            raise ValueError(f"Generation failed: {gen_err}")

        decoded = tokenizer.batch_decode(
            outputs, skip_special_tokens=True, clean_up_tokenization_spaces=True
        )
        post = ip.postprocess_batch(decoded, lang=tgt_tag)
        translated = post[0] if post else ""
        return translated, src_tag, tgt_tag

    def preload_all(self) -> dict:
        """Eagerly load all tokenizers and models into memory."""
        self._iproc()
        self._load_en_indic()
        self._load_indic_en()
        self._load_indic_indic()
        return {
            "device": self.device,
            "en_indic_loaded": self._mdl_en_indic is not None,
            "indic_en_loaded": self._mdl_indic_en is not None,
            "indic_indic_loaded": self._mdl_indic_indic is not None,
        }

    def warmup(self) -> dict:
        """Run small no-op translations to initialize caches/graphs."""
        results = {"device": self.device}
        try:
            self.preload_all()
            # simple warm translations
            en_hi, _, _ = self.translate("Hello", "en", "hi")
            hi_en, _, _ = self.translate("नमस्ते", "hi", "en")
            ka_ta, _, _ = self.translate("ನಮಸ್ಕಾರ", "ka", "ta")
            results.update({
                "en_hi": en_hi,
                "hi_en": hi_en,
                "ka_ta": ka_ta,
            })
        except Exception as e:
            results["error"] = str(e)
        return results


def is_available() -> bool:
    return HAS_INDIC

