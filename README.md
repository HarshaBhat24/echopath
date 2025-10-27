# EchoPath

A full-stack web application for the translation of any text of indian languages.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python (v3.8 or higher)
- npm or yarn


### Manual Setup

#### Backend (FastAPI)

1. Navigate to the server directory:
```bash
cd server
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Run the FastAPI server:
```bash
python main.py
```

The API server will be available at `http://localhost:8000`

#### Frontend (React + Vite)

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The React app will be available at `http://localhost:5173` (or another port if 5173 is in use)


## Development

### Running Both Servers

You can run both the frontend and backend simultaneously:

1. Start the FastAPI server (Terminal 1):
```bash
cd server && python main.py
```

2. Start the React dev server (Terminal 2):
```bash
cd client && npm run dev
```

### Building for Production

#### Frontend
```bash
cd client
npm run build
```

## License

MIT License
