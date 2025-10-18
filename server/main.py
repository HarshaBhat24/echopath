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
# Whisper model cache
_WHISPER_MODEL = None

def _get_whisper_model(name: str = "base.en"):
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        import whisper  # type: ignore
        _WHISPER_MODEL = whisper.load_model(name)
    return _WHISPER_MODEL

# Import our authentication modules
from auth import (
    authenticate_user, create_access_token, verify_token, create_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, Token, User, UserCreate, GoogleAuthRequest,
    verify_google_token, create_google_user, FirebaseAuthRequest, verify_firebase_token
)

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
    """Translate text to the target language"""
    print(f"Translation request - text: '{request.text}', source: {request.source_lang}, target: {request.target_lang}")
    
    # Prefer IndicTrans2 if available, else fallback to googletrans
    if INDIC_AVAILABLE:
        try:
            svc = IndicTransService.get()
            translated, src_tag, tgt_tag = svc.translate(
                request.text, request.source_lang, request.target_lang
            )
            return TranslationResponse(
                original_text=request.text,
                translated_text=translated,
                source_lang=src_tag,
                target_lang=tgt_tag,
                status="success"
            )
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
                        detected_lang = translation.src
                    else:
                        translation = translator.translate(
                            request.text,
                            src=_map_gtrans(request.source_lang),
                            dest=_map_gtrans(request.target_lang),
                        )
                        detected_lang = request.source_lang
                    return TranslationResponse(
                        original_text=request.text,
                        translated_text=translation.text,
                        source_lang=detected_lang,
                        target_lang=request.target_lang,
                        status="success(fallback)"
                    )
                except Exception as fallback_err:
                    print(f"Googletrans fallback error: {fallback_err}")
                    pass
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
                        detected_lang = translation.src
                    else:
                        translation = translator.translate(
                            request.text, src=request.source_lang, dest=request.target_lang
                        )
                        detected_lang = request.source_lang
                    return TranslationResponse(
                        original_text=request.text,
                        translated_text=translation.text,
                        source_lang=detected_lang,
                        target_lang=request.target_lang,
                        status="success(fallback)"
                    )
                except Exception as fallback_err2:
                    print(f"Googletrans fallback error 2: {fallback_err2}")
                    pass
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
                detected_lang = translation.src
            else:
                translation = translator.translate(
                    request.text,
                    src=_map_gtrans(request.source_lang),
                    dest=_map_gtrans(request.target_lang),
                )
                detected_lang = request.source_lang
            return TranslationResponse(
                original_text=request.text,
                translated_text=translation.text,
                source_lang=detected_lang,
                target_lang=request.target_lang,
                status="success"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Translation failed: {str(e)}"
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

        # 1) STT
        if whisper_available:
            try:
                model = _get_whisper_model("base.en")
                try:
                    import torch as _torch  # type: ignore
                    use_fp16 = _torch.cuda.is_available()
                except Exception:
                    use_fp16 = False
                result = model.transcribe(temp_audio_path, language="en", task="transcribe", fp16=use_fp16)
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

        # 3) Romanize for display (optional)
        if HAVE_ROM:
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
    if not OCR_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OCR service is not available. Please install pillow and pytesseract."
        )
    
    try:
        # Read and process image
        image_content = await image.read()
        img = Image.open(io.BytesIO(image_content))
        
        # Simple preprocessing - just convert to RGB to ensure compatibility
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
        
        # Extract text using OCR with specified language
        # Use simple configuration for better compatibility
        extracted_text = pytesseract.image_to_string(img, lang=lang)
        
        if not extracted_text.strip():
            return OCRExtractionResponse(
                extracted_text="",
                status="no_text_found"
            )
        
        extracted_text = extracted_text.strip()
        transliterated = None
        translated = None
        detected_source = source_lang
        
        # Translation if target language is provided
        if target_lang and extracted_text:
            try:
                if INDIC_AVAILABLE:
                    svc = IndicTransService.get()
                    # IndicTrans2 handles auto-detection internally
                    translated, src_tag, tgt_tag = svc.translate(
                        extracted_text, source_lang, target_lang
                    )
                    detected_source = src_tag  # Use the detected source language
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
                print(f"Translation error: {e}")
                # If translation fails, at least return the extracted text
                translated = None
        
        # Transliteration (romanization) of the TRANSLATED text if requested
        if transliterate and translated and target_lang:
            try:
                from indic_transliteration import sanscript as _sanscript
                from indic_transliteration.sanscript import transliterate as _transliterate
                
                # Map language codes to sanscript schemes
                scheme_map = {
                    "ka": _sanscript.KANNADA,
                    "hi": _sanscript.DEVANAGARI,
                    "ta": _sanscript.TAMIL,
                    "te": _sanscript.TELUGU,
                    "ma": _sanscript.MALAYALAM,
                    "be": _sanscript.BENGALI,
                }
                
                if target_lang in scheme_map:
                    # Use ISO 15919 for better romanization (more readable than ITRANS)
                    transliterated = _transliterate(translated, scheme_map[target_lang], _sanscript.ISO)
            except Exception as e:
                print(f"Transliteration error: {e}")
        
        return OCRExtractionResponse(
            extracted_text=extracted_text,
            transliterated_text=transliterated,
            translated_text=translated,
            source_lang=detected_source,
            target_lang=target_lang,
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
            "voice_recognition": SPEECH_RECOGNITION_AVAILABLE,
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
            "/api/translate/photo",
            "/api/ocr/extract"
        ]
    }

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
