from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uvicorn
from datetime import timedelta
import os
import io
import tempfile
import base64

# Check Whisper availability
WHISPER_AVAILABLE = False
try:
    import whisper  # type: ignore
    WHISPER_AVAILABLE = True
except ImportError:
    print("Warning: openai-whisper not available. Install with: pip install openai-whisper")

# Whisper model cache
_WHISPER_MODEL = None
_WHISPER_MODEL_NAME = "small.en"  # Upgraded for better accuracy (base.en < small.en < medium.en)

def _get_whisper_model(name: str = None):
    global _WHISPER_MODEL, _WHISPER_MODEL_NAME
    if name is None:
        name = _WHISPER_MODEL_NAME
    if _WHISPER_MODEL is None or name != _WHISPER_MODEL_NAME:
        import whisper  # type: ignore
        print(f"Loading Whisper model: {name}")
        _WHISPER_MODEL = whisper.load_model(name)
        _WHISPER_MODEL_NAME = name
    return _WHISPER_MODEL

# Import our authentication modules
from auth import (
    authenticate_user, create_access_token, verify_token, create_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, Token, User, UserCreate, GoogleAuthRequest,
    verify_google_token, create_google_user, FirebaseAuthRequest, verify_firebase_token
)

# Import Firebase service
from firebase_service import firebase_service

# Translation related imports
try:
    from googletrans import Translator
    GOOGLETRANS_AVAILABLE = True
except ImportError:
    GOOGLETRANS_AVAILABLE = False
    print("Warning: googletrans not available. Install with: pip install googletrans==4.0.0rc1")

# Map UI language codes to googletrans ISO codes
GTRANS_CODE_MAP = {
    "en": "en",
    "hi": "hi",
    "ka": "kn",  # Kannada
    "ta": "ta",
    "te": "te",
    "ma": "ml",  # Malayalam
    "be": "bn",  # Bengali
}

def _map_gtrans(code: str) -> str:
    return GTRANS_CODE_MAP.get(code, code)

# Try to load IndicTrans2 service
try:
    from indictrans_service import IndicTransService, is_available as _indic_is_available
    INDIC_AVAILABLE = _indic_is_available()
except Exception as _e:
    INDIC_AVAILABLE = False
    IndicTransService = None  # type: ignore
    print(f"Warning: IndicTrans2 service not available: {_e}")

try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False
    print("Warning: speech_recognition not available. Install with: pip install SpeechRecognition")

try:
    from PIL import Image
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("Warning: OCR not available. Install with: pip install pillow pytesseract")

# Check TTS availability (using gTTS for better quality)
TTS_AVAILABLE = False
try:
    from gtts import gTTS as _gTTS
    TTS_AVAILABLE = True
except ImportError:
    print("Warning: gTTS not available. Install with: pip install gTTS")

# Preload models at startup for lower first-latency if available
@asynccontextmanager
async def lifespan(app: FastAPI):
    if 'IndicTransService' in globals() and INDIC_AVAILABLE:
        try:
            svc = IndicTransService.get()
            info = svc.preload_all()
            print(f"IndicTrans2 preloaded on {info.get('device')}.")
        except Exception as e:
            print(f"IndicTrans2 preload failed: {e}")
    yield

app = FastAPI(
    title="EchoPath",
    description="A simple FastAPI server for the EchoPath application",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get the current authenticated user."""
    return verify_token(token)

# Pydantic models for request/response
class EchoRequest(BaseModel):
    message: str

class EchoResponse(BaseModel):
    echo: str
    original_message: str
    status: str
    user_email: str

class HealthResponse(BaseModel):
    status: str
    message: str

# Translation models
class TextTranslationRequest(BaseModel):
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"

class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    romanized_text: str | None = None
    source_lang: str
    target_lang: str        
    status: str

class VoiceTranslationResponse(BaseModel):
    transcribed_text: str
    translated_text: str
    romanized_text: str | None = None
    source_lang: str
    target_lang: str
    status: str

class PhotoTranslationResponse(BaseModel):
    extracted_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    status: str

class OCRExtractionResponse(BaseModel):
    extracted_text: str
    transliterated_text: str | None = None
    translated_text: str | None = None
    source_lang: str | None = None
    target_lang: str | None = None
    status: str

class TTSRequest(BaseModel):
    text: str
    lang: str = "en"  # Language code (en, hi, ka, ta, te, ma, be)

class TranslationHistoryItem(BaseModel):
    id: str | None = None
    type: str  # 'text', 'voice', 'photo'
    originalText: str
    translatedText: str
    romanizedText: str | None = None
    sourceLang: str
    targetLang: str
    timestamp: str | None = None

class TranslationHistoryResponse(BaseModel):
    history: list[TranslationHistoryItem]
    total: int

# OAuth2 scheme for JWT tokens


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Welcome to EchoPath API with Authentication"}

@app.post("/api/auth/register", response_model=User)
async def register(user_data: UserCreate):
    """Register a new user"""
    return create_user(user_data)

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login endpoint"""
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/google", response_model=Token)
async def google_auth(request: GoogleAuthRequest):
    """Authenticate with Google OAuth"""
    try:
        # Verify the Google token and get user info
        google_user_info = await verify_google_token(request.access_token)
        
        # Create or update user
        user = create_google_user(google_user_info)
        
        # Create JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google authentication failed: {str(e)}"
        )

@app.post("/api/auth/firebase", response_model=Token)
async def firebase_auth(request: FirebaseAuthRequest):
    """Authenticate with Firebase"""
    try:
        # Verify the Firebase token and get user info
        user = await verify_firebase_token(request.firebase_token)
        
        # Create JWT token for our API
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        token_data = {"sub": user.email}
        if user.uid:
            token_data["uid"] = user.uid
            
        access_token = create_access_token(
            data=token_data, expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Firebase authentication failed: {str(e)}"
        )

@app.get("/api/auth/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        message="FastAPI server is running successfully"
    )

@app.post("/api/echo", response_model=EchoResponse)
async def echo_message(request: EchoRequest, current_user: User = Depends(get_current_user)):
    """Echo back the received message (protected endpoint)"""
    return EchoResponse(
        echo=f"Echo: {request.message}",
        original_message=request.message,
        status="success",
        user_email=current_user.email
    )

# Translation endpoints
@app.post("/api/translate/text", response_model=TranslationResponse)
async def translate_text_endpoint(request: TextTranslationRequest, current_user: User = Depends(get_current_user)):
    """Translate text to the target language with optional romanization"""
    print(f"Translation request - text: '{request.text}', source: {request.source_lang}, target: {request.target_lang}")
    
    # Check for transliteration support
    try:
        from indic_transliteration import sanscript as _sanscript
        from indic_transliteration.sanscript import transliterate as _transliterate
        HAVE_ROM = True
    except Exception:
        HAVE_ROM = False
    
    translated_text = None
    romanized_text = None
    source_lang_tag = request.source_lang
    target_lang_tag = request.target_lang
    
    # Prefer IndicTrans2 if available, else fallback to googletrans
    if INDIC_AVAILABLE:
        try:
            svc = IndicTransService.get()
            translated_text, src_tag, tgt_tag = svc.translate(
                request.text, request.source_lang, request.target_lang
            )
            source_lang_tag = src_tag
            target_lang_tag = tgt_tag
            
            # Romanize for Indic languages (only if target is not English)
            romanized_text = None
            if HAVE_ROM and tgt_tag != "eng_Latn":
                try:
                    tag_to_scheme = {
                        "hin_Deva": _sanscript.DEVANAGARI,
                        "kan_Knda": _sanscript.KANNADA,
                        "tam_Taml": _sanscript.TAMIL,
                        "tel_Telu": _sanscript.TELUGU,
                        "mal_Mlym": _sanscript.MALAYALAM,
                        "ben_Beng": _sanscript.BENGALI,
                    }
                    scheme = tag_to_scheme.get(tgt_tag)
                    if scheme:
                        romanized_text = _transliterate(translated_text, scheme, _sanscript.IAST)
                except Exception as rom_err:
                    print(f"Romanization error: {rom_err}")
                    romanized_text = None
            
        except ValueError as ve:
            print(f"IndicTrans2 ValueError: {ve}")
            # If unsupported code caused failure and googletrans is available, try fallback
            if GOOGLETRANS_AVAILABLE:
                try:
                    translator = Translator()
                    if request.source_lang == "auto":
                        translation = translator.translate(
                            request.text, dest=_map_gtrans(request.target_lang)
                        )
                        source_lang_tag = translation.src
                    else:
                        translation = translator.translate(
                            request.text,
                            src=_map_gtrans(request.source_lang),
                            dest=_map_gtrans(request.target_lang),
                        )
                        source_lang_tag = request.source_lang
                    translated_text = translation.text
                    target_lang_tag = request.target_lang
                except Exception as fallback_err:
                    print(f"Googletrans fallback error: {fallback_err}")
                    pass
            if not translated_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(ve)
                )
        except Exception as e:
            print(f"IndicTrans2 general error: {e}")
            # If IndicTrans2 fails and googletrans is available, try fallback
            if GOOGLETRANS_AVAILABLE:
                try:
                    translator = Translator()
                    if request.source_lang == "auto":
                        translation = translator.translate(request.text, dest=request.target_lang)
                        source_lang_tag = translation.src
                    else:
                        translation = translator.translate(
                            request.text, src=request.source_lang, dest=request.target_lang
                        )
                        source_lang_tag = request.source_lang
                    translated_text = translation.text
                    target_lang_tag = request.target_lang
                except Exception as fallback_err2:
                    print(f"Googletrans fallback error 2: {fallback_err2}")
                    pass
            if not translated_text:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Translation failed: {str(e)}"
                )
    else:
        if not GOOGLETRANS_AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No translation backend available (IndicTrans2/Googletrans)."
            )
        try:
            translator = Translator()
            if request.source_lang == "auto":
                translation = translator.translate(
                    request.text, dest=_map_gtrans(request.target_lang)
                )
                source_lang_tag = translation.src
            else:
                translation = translator.translate(
                    request.text,
                    src=_map_gtrans(request.source_lang),
                    dest=_map_gtrans(request.target_lang),
                )
                source_lang_tag = request.source_lang
            translated_text = translation.text
            target_lang_tag = request.target_lang
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Translation failed: {str(e)}"
            )
    
    # Save to translation history if user has uid
    if hasattr(current_user, 'uid') and current_user.uid:
        try:
            history_data = {
                'type': 'text',
                'originalText': request.text,
                'translatedText': translated_text,
                'romanizedText': romanized_text,
                'sourceLang': source_lang_tag,
                'targetLang': target_lang_tag,
            }
            firebase_service.save_translation_history(current_user.uid, history_data)
        except Exception as e:
            print(f"Failed to save translation history: {e}")
            # Don't fail the request if history save fails
    
    return TranslationResponse(
        original_text=request.text,
        translated_text=translated_text,
        romanized_text=romanized_text,
        source_lang=source_lang_tag,
        target_lang=target_lang_tag,
        status="success"
    )

@app.post("/api/translate/voice", response_model=VoiceTranslationResponse)
async def translate_voice_endpoint(
    audio: UploadFile = File(...),
    source_lang: str = Form("auto"),
    target_lang: str = Form("en"),
    current_user: User = Depends(get_current_user)
):
    """Transcribe audio (offline Whisper if available) and translate via IndicTrans2.

    Returns transcribed_text (English), translated_text (native script), and romanized_text (IAST) when available.
    """
    # Prefer Whisper offline
    whisper_available = False
    try:
        import whisper  # type: ignore
        whisper_available = True
    except Exception:
        whisper_available = False

    # Load IndicTrans service
    svc = None
    if INDIC_AVAILABLE:
        try:
            svc = IndicTransService.get()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"IndicTrans2 init failed: {e}")
    else:
        raise HTTPException(status_code=503, detail="IndicTrans2 not available on server")

    # Romanization support (optional)
    romanized = None
    try:
        from indic_transliteration import sanscript as _sanscript  # type: ignore
        from indic_transliteration.sanscript import transliterate as _transliterate  # type: ignore
        HAVE_ROM = True
    except Exception:
        HAVE_ROM = False

    temp_audio_path = None
    try:
        # Persist uploaded audio with best-guess extension
        filename = getattr(audio, 'filename', 'upload') or 'upload'
        _, ext = os.path.splitext(filename)
        ext = ext if ext else ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_audio:
            content = await audio.read()
            temp_audio.write(content)
            temp_audio_path = temp_audio.name

        # 1) STT with improved Whisper parameters
        if whisper_available:
            try:
                model = _get_whisper_model()  # Uses small.en for better accuracy
                try:
                    import torch as _torch  # type: ignore
                    use_fp16 = _torch.cuda.is_available()
                except Exception:
                    use_fp16 = False
                
                # Improved transcription parameters for better accuracy
                result = model.transcribe(
                    temp_audio_path,
                    language="en",
                    task="transcribe",
                    fp16=use_fp16,
                    temperature=0.0,  # More deterministic output
                    best_of=5,        # Try multiple decodings, pick best
                    beam_size=5,      # Beam search for better results
                    patience=1.0,     # Wait longer for better results
                    condition_on_previous_text=True,  # Use context
                    compression_ratio_threshold=2.4,
                    logprob_threshold=-1.0,
                    no_speech_threshold=0.6
                )
                transcribed_text = (result.get("text") or "").strip()
            except Exception as we:
                raise HTTPException(status_code=500, detail=f"Whisper failed: {we}")
        else:
            # Fallback minimal SR path (may be online if using Google)
            if not SPEECH_RECOGNITION_AVAILABLE:
                raise HTTPException(status_code=503, detail="No STT backend available (install whisper or SpeechRecognition)")
            try:
                r = sr.Recognizer()
                with sr.AudioFile(temp_audio_path) as source:
                    audio_data = r.record(source)
                try:
                    transcribed_text = r.recognize_sphinx(audio_data)
                except Exception:
                    transcribed_text = r.recognize_google(audio_data)
            except Exception as se:
                raise HTTPException(status_code=500, detail=f"STT failed: {se}")

        if not transcribed_text:
            raise HTTPException(status_code=400, detail="No speech detected in audio")

        # 2) MT via IndicTrans2
        try:
            translated, src_tag, tgt_tag = svc.translate(transcribed_text, "en", target_lang)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as te:
            raise HTTPException(status_code=500, detail=f"Translation failed: {te}")

        # 3) Romanize for display (only for Indic target languages, not English)
        if HAVE_ROM and tgt_tag != "eng_Latn":
            try:
                tag_to_scheme = {
                    "hin_Deva": _sanscript.DEVANAGARI,
                    "kan_Knda": _sanscript.KANNADA,
                    "tam_Taml": _sanscript.TAMIL,
                    "tel_Telu": _sanscript.TELUGU,
                    "mal_Mlym": _sanscript.MALAYALAM,
                    "ben_Beng": _sanscript.BENGALI,
                }
                scheme = tag_to_scheme.get(tgt_tag)
                if scheme:
                    romanized = _transliterate(translated, scheme, _sanscript.IAST)
            except Exception:
                romanized = None
        
        # Save to translation history if user has uid
        if hasattr(current_user, 'uid') and current_user.uid:
            try:
                history_data = {
                    'type': 'voice',
                    'originalText': transcribed_text,
                    'translatedText': translated,
                    'romanizedText': romanized,
                    'sourceLang': src_tag,
                    'targetLang': tgt_tag,
                }
                firebase_service.save_translation_history(current_user.uid, history_data)
            except Exception as e:
                print(f"Failed to save translation history: {e}")

        return VoiceTranslationResponse(
            transcribed_text=transcribed_text,
            translated_text=translated,
            romanized_text=romanized,
            source_lang=src_tag,
            target_lang=tgt_tag,
            status="success"
        )
    finally:
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
            except Exception:
                pass

@app.post("/api/tts/synthesize")
async def text_to_speech(
    request: TTSRequest,
    current_user: User = Depends(get_current_user)
):
    """Convert text to speech using Google Text-to-Speech (gTTS).
    
    Provides high-quality, natural-sounding voices for Indian languages:
    - en: English
    - hi: Hindi
    - ka: Kannada (kn)
    - ta: Tamil
    - te: Telugu
    - ma: Malayalam (ml)
    - be: Bengali (bn)
    
    Returns audio file as base64 encoded MP3 data.
    """
    if not TTS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Text-to-speech not available. Install gTTS."
        )
    
    # Map our language codes to gTTS language codes
    lang_to_gtts = {
        "en": "en",
        "hi": "hi",
        "ka": "kn",  # Kannada
        "ta": "ta",
        "te": "te",
        "ma": "ml",  # Malayalam
        "be": "bn"   # Bengali
    }
    
    temp_audio_path = None
    try:
        from gtts import gTTS
        
        # Get the appropriate language code for gTTS
        tts_lang = lang_to_gtts.get(request.lang, "en")
        
        # Create gTTS instance with slow=False for natural speed
        tts = gTTS(text=request.text, lang=tts_lang, slow=False)
        
        # Generate audio to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_audio:
            temp_audio_path = temp_audio.name
        
        # Save the audio
        tts.save(temp_audio_path)
        
        # Read the generated audio file
        with open(temp_audio_path, 'rb') as audio_file:
            audio_data = audio_file.read()
        
        # Encode as base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        return {
            "audio_data": audio_base64,
            "format": "mp3",
            "text": request.text,
            "lang": request.lang,
            "status": "success"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Text-to-speech failed: {str(e)}"
        )
    finally:
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
            except Exception:
                pass

@app.post("/api/ocr/extract", response_model=OCRExtractionResponse)
async def extract_text_from_image(
    image: UploadFile = File(...),
    lang: str = Form("eng"),
    source_lang: str = Form("auto"),
    target_lang: str = Form(None),
    transliterate: bool = Form(False)
):
    """Extract text from image using OCR with optional translation and transliteration
    
    OCR languages:
    - eng: English
    - kan: Kannada
    - hin: Hindi
    - tam: Tamil
    - tel: Telugu
    - mal: Malayalam
    - ben: Bengali
    - kan+eng: Kannada + English combined
    
    Optional parameters:
    - source_lang: Source language code (default: "auto" for auto-detection by IndicTrans2)
    - target_lang: Target language code for translation
    - transliterate: If True, also provide romanized/transliterated version of the TRANSLATED text
    """
    import sys
    print("=" * 80, flush=True)
    print(f"[OCR ENDPOINT CALLED] lang={lang}, source={source_lang}, target={target_lang}, transliterate={transliterate}", flush=True)
    print("=" * 80, flush=True)
    sys.stdout.flush()
    
    if not OCR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OCR service is not available. Please install pillow and pytesseract."
        )
    
    try:
        # Read and process image
        image_content = await image.read()
        print(f"[OCR] Image size: {len(image_content)} bytes", flush=True)
        
        img = Image.open(io.BytesIO(image_content))
        print(f"[OCR] Image mode: {img.mode}, size: {img.size}", flush=True)
        
        # Preprocessing for better OCR
        from PIL import ImageEnhance, ImageFilter
        
        # Convert to grayscale for better OCR
        if img.mode != 'L':
            img = img.convert('L')
            print(f"[OCR] Converted to grayscale", flush=True)
        
        # Upscale if image is small (improves OCR accuracy)
        width, height = img.size
        if width < 1000 or height < 300:
            scale_factor = 3
            new_size = (width * scale_factor, height * scale_factor)
            img = img.resize(new_size, Image.LANCZOS)
            print(f"[OCR] Upscaled image to {img.size}", flush=True)
        
        # Apply slight sharpening
        img = img.filter(ImageFilter.SHARPEN)
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.5)
        print(f"[OCR] Applied sharpening and contrast enhancement", flush=True)
        
        # Extract text using OCR with specified language
        # Try with different PSM modes for better results
        print(f"[OCR] Calling pytesseract with lang={lang}", flush=True)
        
        # Try PSM 6 first (uniform block of text)
        custom_config = r'--oem 3 --psm 6'
        extracted_text = pytesseract.image_to_string(img, lang=lang, config=custom_config)
        
        # If empty, try PSM 3 (fully automatic)
        if not extracted_text.strip():
            print(f"[OCR] PSM 6 failed, trying PSM 3", flush=True)
            custom_config = r'--oem 3 --psm 3'
            extracted_text = pytesseract.image_to_string(img, lang=lang, config=custom_config)
        
        # If still empty, try PSM 11 (sparse text)
        if not extracted_text.strip():
            print(f"[OCR] PSM 3 failed, trying PSM 11", flush=True)
            custom_config = r'--oem 3 --psm 11'
            extracted_text = pytesseract.image_to_string(img, lang=lang, config=custom_config)
        
        # If still empty, try with binary threshold (convert to pure black & white)
        if not extracted_text.strip():
            print(f"[OCR] PSM 11 failed, trying with binary threshold", flush=True)
            # Convert to binary (black and white only)
            threshold = 128
            img_binary = img.point(lambda p: p > threshold and 255)
            custom_config = r'--oem 3 --psm 6'
            extracted_text = pytesseract.image_to_string(img_binary, lang=lang, config=custom_config)
        
        print(f"[OCR] Pytesseract returned: '{extracted_text[:200]}'", flush=True)
        print(f"[OCR] Text length: {len(extracted_text)}, stripped length: {len(extracted_text.strip())}", flush=True)
        
        if not extracted_text.strip():
            print(f"[OCR] No text found in image!", flush=True)
            return OCRExtractionResponse(
                extracted_text="",
                status="no_text_found"
            )
        
        extracted_text = extracted_text.strip()
        transliterated = None
        translated = None
        detected_source = source_lang
        final_target_lang = target_lang
        
        print(f"[OCR] Extracted text: {extracted_text[:100]}...", flush=True)
        print(f"[OCR] Source lang: {source_lang}, Target lang: {target_lang}", flush=True)
        
        # Helper to convert IndicTrans2 tags back to short codes
        def tag_to_short_code(tag: str) -> str:
            tag_to_code = {
                "eng_Latn": "en",
                "hin_Deva": "hi",
                "kan_Knda": "ka",
                "tam_Taml": "ta",
                "tel_Telu": "te",
                "mal_Mlym": "ma",
                "ben_Beng": "be",
            }
            return tag_to_code.get(tag, tag)
        
        # Translation if target language is provided
        if target_lang and extracted_text:
            try:
                if INDIC_AVAILABLE:
                    print(f"[OCR] Using IndicTrans2 for translation", flush=True)
                    svc = IndicTransService.get()
                    # IndicTrans2 handles auto-detection internally
                    translated, src_tag, tgt_tag = svc.translate(
                        extracted_text, source_lang, target_lang
                    )
                    # Convert tags back to short codes for consistency
                    detected_source = tag_to_short_code(src_tag)
                    final_target_lang = tag_to_short_code(tgt_tag)
                    print(f"[OCR] Translation successful: {src_tag} ({detected_source}) -> {tgt_tag} ({final_target_lang})", flush=True)
                    print(f"[OCR] Translated text: {translated[:100] if translated else 'None'}...", flush=True)
                elif GOOGLETRANS_AVAILABLE:
                    translator = Translator()
                    if source_lang == "auto":
                        translation = translator.translate(
                            extracted_text,
                            dest=_map_gtrans(target_lang)
                        )
                        detected_source = translation.src
                    else:
                        translation = translator.translate(
                            extracted_text,
                            src=_map_gtrans(source_lang),
                            dest=_map_gtrans(target_lang)
                        )
                    translated = translation.text
            except Exception as e:
                print(f"Translation error: {e}", flush=True)
                import traceback
                traceback.print_exc()
                # If translation fails, at least return the extracted text
                translated = None
        
        # Transliteration (romanization) of the TRANSLATED text if requested
        if transliterate and translated and final_target_lang:
            try:
                from indic_transliteration import sanscript as _sanscript
                from indic_transliteration.sanscript import transliterate as _transliterate
                
                print(f"[OCR] Attempting transliteration for target lang: {final_target_lang}", flush=True)
                
                # Map language codes to sanscript schemes
                scheme_map = {
                    "ka": _sanscript.KANNADA,
                    "hi": _sanscript.DEVANAGARI,
                    "ta": _sanscript.TAMIL,
                    "te": _sanscript.TELUGU,
                    "ma": _sanscript.MALAYALAM,
                    "be": _sanscript.BENGALI,
                }
                
                if final_target_lang in scheme_map:
                    # Use ISO 15919 for better romanization (more readable than ITRANS)
                    transliterated = _transliterate(translated, scheme_map[final_target_lang], _sanscript.ISO)
                    print(f"[OCR] Transliteration successful: {transliterated[:100] if transliterated else 'None'}...", flush=True)
                else:
                    print(f"[OCR] Target language {final_target_lang} not in scheme_map (no transliteration needed)", flush=True)
            except Exception as e:
                print(f"Transliteration error: {e}", flush=True)
                import traceback
                traceback.print_exc()
        
        return OCRExtractionResponse(
            extracted_text=extracted_text,
            transliterated_text=transliterated,
            translated_text=translated,
            source_lang=detected_source,
            target_lang=final_target_lang,
            status="success"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text extraction failed: {str(e)}"
        )

@app.post("/api/translate/photo", response_model=PhotoTranslationResponse)
async def translate_photo_endpoint(
    image: UploadFile = File(...),
    source_lang: str = Form("auto"),
    target_lang: str = Form("en"),
    current_user: User = Depends(get_current_user)
):
    """Extract text from image and translate to target language"""
    if not OCR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OCR service is not available. Please install pillow and pytesseract."
        )
    
    if not GOOGLETRANS_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Translation service is not available. Please install googletrans."
        )
    
    try:
        # Read and process image
        image_content = await image.read()
        img = Image.open(io.BytesIO(image_content))
        
        # Extract text using OCR
        extracted_text = pytesseract.image_to_string(img)
        
        if not extracted_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No text found in the image"
            )
        
        # Translate extracted text
        translator = Translator()
        if source_lang == "auto":
            translation = translator.translate(
                extracted_text, dest=_map_gtrans(target_lang)
            )
            detected_lang = translation.src
        else:
            translation = translator.translate(
                extracted_text,
                src=_map_gtrans(source_lang),
                dest=_map_gtrans(target_lang),
            )
            detected_lang = source_lang
        
        # Save to translation history if user has uid
        if hasattr(current_user, 'uid') and current_user.uid:
            try:
                history_data = {
                    'type': 'photo',
                    'originalText': extracted_text.strip(),
                    'translatedText': translation.text,
                    'romanizedText': None,
                    'sourceLang': detected_lang,
                    'targetLang': target_lang,
                }
                firebase_service.save_translation_history(current_user.uid, history_data)
            except Exception as e:
                print(f"Failed to save translation history: {e}")
        
        return PhotoTranslationResponse(
            extracted_text=extracted_text.strip(),
            translated_text=translation.text,
            source_lang=detected_lang,
            target_lang=target_lang,
            status="success"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Photo translation failed: {str(e)}"
        )

@app.get("/api/info")
async def server_info():
    """Get server information"""
    return {
        "server": "FastAPI",
        "version": "1.0.0",
        "framework": "FastAPI with Uvicorn",
        "authentication": "JWT Bearer Token",
        "supported_auth_providers": ["email", "google", "firebase"],
        "translation_services": {
            "text_translation": INDIC_AVAILABLE or GOOGLETRANS_AVAILABLE,
            "voice_recognition": WHISPER_AVAILABLE or SPEECH_RECOGNITION_AVAILABLE,
            "whisper_available": WHISPER_AVAILABLE,
            "text_to_speech": TTS_AVAILABLE,
            "ocr": OCR_AVAILABLE
        },
        "endpoints": [
            "/",
            "/api/auth/register",
            "/api/auth/login", 
            "/api/auth/google",
            "/api/auth/firebase",
            "/api/auth/me",
            "/api/health",
            "/api/echo",
            "/api/info",
            "/api/translate/text",
            "/api/translate/voice",
            "/api/tts/synthesize",
            "/api/translate/photo",
            "/api/ocr/extract",
            "/api/translation/history",
            "/api/translation/history/clear"
        ]
    }

# Translation History endpoints
@app.get("/api/translation/history", response_model=TranslationHistoryResponse)
async def get_translation_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get user's translation history"""
    if not hasattr(current_user, 'uid') or not current_user.uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User UID not found in token"
        )
    
    try:
        history = firebase_service.get_translation_history(current_user.uid, limit)
        return TranslationHistoryResponse(
            history=[TranslationHistoryItem(**item) for item in history],
            total=len(history)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch translation history: {str(e)}"
        )

@app.delete("/api/translation/history/{history_id}")
async def delete_translation_history(
    history_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a specific translation from history"""
    if not hasattr(current_user, 'uid') or not current_user.uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User UID not found in token"
        )
    
    try:
        success = firebase_service.delete_translation_history_item(current_user.uid, history_id)
        if success:
            return {"message": "Translation deleted successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete translation"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete translation: {str(e)}"
        )

@app.post("/api/translation/history/clear")
async def clear_translation_history(current_user: User = Depends(get_current_user)):
    """Clear all translation history for the user"""
    if not hasattr(current_user, 'uid') or not current_user.uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User UID not found in token"
        )
    
    try:
        success = firebase_service.clear_translation_history(current_user.uid)
        if success:
            return {"message": "Translation history cleared successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to clear translation history"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear translation history: {str(e)}"
        )

@app.post("/api/translate/warmup")
async def warmup_translation(current_user: User = Depends(get_current_user)):
    if not INDIC_AVAILABLE:
        raise HTTPException(status_code=503, detail="IndicTrans2 not available")
    try:
        svc = IndicTransService.get()
        return svc.warmup()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/google/test")
async def test_google_config():
    """Test Google OAuth configuration"""
    return {
        "google_client_id_configured": bool(os.getenv("GOOGLE_CLIENT_ID")),
        "google_client_secret_configured": bool(os.getenv("GOOGLE_CLIENT_SECRET")),
        "client_id_preview": os.getenv("GOOGLE_CLIENT_ID", "")[:20] + "..." if os.getenv("GOOGLE_CLIENT_ID") else "Not set"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
