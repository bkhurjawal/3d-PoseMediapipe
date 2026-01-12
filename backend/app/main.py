from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.routers import health, video
import os

# Create FastAPI app
app = FastAPI(
    title="OpenPose Video Processing API",
    description="API for processing videos with OpenPose 3D pose reconstruction",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(video.router, prefix="/api/v1", tags=["video"])

# Mount static file serving for videos
if os.path.exists(settings.upload_dir):
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
if os.path.exists(settings.processed_dir):
    app.mount("/processed", StaticFiles(directory=settings.processed_dir), name="processed")


@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    print("🚀 OpenPose Video Processing API started")
    print(f"📁 Upload directory: {settings.upload_dir}")
    print(f"📁 Processed directory: {settings.processed_dir}")
    print(f"🎯 OpenPose model: {settings.openpose_model}")
    print(f"🖥️  GPU enabled: {settings.use_gpu}")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    print("👋 OpenPose Video Processing API shutting down")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "OpenPose Video Processing API",
        "version": "1.0.0",
        "docs": "/docs"
    }
