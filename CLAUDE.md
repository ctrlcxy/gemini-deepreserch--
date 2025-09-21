# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fullstack application demonstrating a research-augmented conversational AI using LangGraph and Google's Gemini models. The system consists of:

- **Frontend**: React application built with Vite, Tailwind CSS, and Shadcn UI
- **Backend**: LangGraph-powered research agent using FastAPI and Google Gemini models

The core research agent (`backend/src/agent/graph.py`) follows a multi-step process: query generation → web research → reflection & gap analysis → iterative refinement → final answer synthesis with citations.

## Development Commands

### Backend Development
```bash
cd backend
pip install .                    # Install dependencies
langgraph dev                   # Start development server (http://127.0.0.1:2024)
```

### Frontend Development  
```bash
cd frontend
npm install                     # Install dependencies
npm run dev                     # Start development server (http://localhost:5173)
npm run build                   # Build for production
npm run lint                    # Run ESLint
```

### Full Stack Development
```bash
make dev                        # Start both frontend and backend concurrently
make dev-frontend              # Start only frontend
make dev-backend               # Start only backend
```

### Testing and Code Quality
```bash
# Backend
cd backend
ruff .                          # Run linter (configured in pyproject.toml)
mypy .                          # Run type checker
pytest                          # Run tests

# Frontend  
cd frontend
npm run lint                    # Run ESLint
npm run build                   # Verify TypeScript compilation
```

### CLI Research Example
```bash
cd backend
python examples/cli_research.py "Your research question here"
```

## Required Configuration

### Backend Environment
Create `backend/.env` from `backend/.env.example`:
```bash
GEMINI_API_KEY=your_actual_api_key
```

### Frontend API Configuration
- Development: Uses `http://localhost:2024` (langgraph dev server)
- Production: Uses `http://localhost:8123` (docker-compose setup)
- API URL is configured in `frontend/src/App.tsx`

## Architecture Overview

### Backend Structure (`backend/src/agent/`)
- `graph.py`: Main LangGraph research agent with nodes and workflow
- `state.py`: TypedDict definitions for agent state management
- `tools_and_schemas.py`: Pydantic schemas and tool definitions
- `prompts.py`: System prompts for different agent phases
- `configuration.py`: Agent configuration and parameters
- `utils.py`: Helper functions for citations, URLs, etc.
- `app.py`: FastAPI application setup

### Frontend Structure (`frontend/src/`)
- `App.tsx`: Main application with LangGraph SDK integration
- `components/`: Reusable UI components (Shadcn UI based)
- Uses `@langchain/langgraph-sdk/react` for real-time streaming

### State Management
The agent uses typed state objects:
- `OverallState`: Main agent state with messages, queries, research results
- `ReflectionState`: Handles knowledge gap analysis and follow-up queries  
- `QueryGenerationState`: Manages search query creation
- `WebSearchState`: Tracks web research results and sources

### Key Integration Points
- LangGraph configuration in `backend/langgraph.json`
- Docker setup for production with Redis/Postgres dependencies
- Real-time event streaming from backend to frontend via WebSocket

## Production Deployment

```bash
# Build Docker image
docker build -t gemini-fullstack-langgraph -f Dockerfile .

# Run with required environment variables
GEMINI_API_KEY=<key> LANGSMITH_API_KEY=<key> docker-compose up
```

Requires Redis and Postgres services (defined in docker-compose.yml) for LangGraph deployment.