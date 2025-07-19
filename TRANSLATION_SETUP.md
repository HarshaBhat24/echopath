## API Usage

### Text Translation
```bash
curl -X POST "http://localhost:8000/api/translate/text" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "source_lang": "en", "target_lang": "es"}'
```

### Voice Translation
```bash
curl -X POST "http://localhost:8000/api/translate/voice" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "audio=@recording.wav" \
  -F "source_lang=auto" \
  -F "target_lang=es"
```

### Photo Translation
```bash
curl -X POST "http://localhost:8000/api/translate/photo" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@photo.jpg" \
  -F "source_lang=auto" \
  -F "target_lang=es"
```
