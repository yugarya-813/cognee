"""Vercel serverless entrypoint for the Engram FastAPI backend.

The backend modules (main, seed, cognee_engine) live at the repo root, one level
up from this file, so we add that to the path and re-export the ASGI `app`.
Vercel's Python runtime serves the exported `app` directly.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402,F401
