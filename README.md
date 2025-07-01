# EchoPath

A full-stack web application with a React + Vite frontend and FastAPI backend.

## Project Structure

```
echopath/
├── client/          # React + Vite frontend
│   ├── src/
│   ├── package.json
│   └── ...
├── server/          # FastAPI backend
│   ├── main.py
│   ├── requirements.txt
│   └── ...
└── README.md
```

## Features

- **Frontend**: React 19 with Vite, Tailwind CSS for styling
- **Backend**: FastAPI with automatic API documentation
- **Communication**: RESTful API with JSON
- **Styling**: Modern UI with Tailwind CSS and dark mode support
- **Development**: Hot reload for both frontend and backend

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python (v3.8 or higher)
- npm or yarn

### Quick Start

For the fastest setup, use the development script:

```bash
./start-dev.sh
```

This will start both the FastAPI server and React development server simultaneously.

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

The React app will be available at `http://localhost:5174` (or another port if 5173 is in use)

## API Endpoints

- `GET /` - Root endpoint
- `GET /api/health` - Health check
- `POST /api/echo` - Echo message endpoint
- `GET /api/info` - Server information
- `GET /docs` - FastAPI automatic documentation (Swagger UI)

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

#### Backend
The FastAPI server is production-ready. For deployment, consider using:
- Gunicorn with Uvicorn workers
- Docker containers
- Cloud platforms (AWS, GCP, Azure)

## Technologies Used

### Frontend
- React 19
- Vite
- Tailwind CSS
- Axios for HTTP requests

### Backend
- FastAPI
- Uvicorn (ASGI server)
- Pydantic for data validation
- Python CORS middleware

## License

MIT License
