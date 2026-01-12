# Multi-stage Dockerfile for OpenPose + FastAPI backend

# ============================================
# Stage 1: Build OpenPose
# ============================================
FROM ubuntu:22.04 as openpose-builder

ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies
RUN apt-get update && apt-get install -y \
    git \
    cmake \
    build-essential \
    libopencv-dev \
    libgoogle-glog-dev \
    libboost-all-dev \
    libhdf5-dev \
    libatlas-base-dev \
    libprotobuf-dev \
    protobuf-compiler \
    python3 \
    python3-pip \
    python3-dev \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy and run build script
COPY openpose_setup/build_openpose.sh /tmp/build_openpose.sh
RUN chmod +x /tmp/build_openpose.sh && /tmp/build_openpose.sh

# ============================================
# Stage 2: Runtime Image
# ============================================
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libopencv-dev \
    libgoogle-glog0v5 \
    libboost-all-dev \
    libhdf5-dev \
    libatlas-base-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy OpenPose from builder stage
COPY --from=openpose-builder /opt/openpose /opt/openpose
COPY --from=openpose-builder /usr/local/lib/python3.10/dist-packages /usr/local/lib/python3.10/dist-packages

# Set OpenPose environment variables
ENV OPENPOSE_ROOT=/opt/openpose
ENV LD_LIBRARY_PATH=/opt/openpose/build/python/openpose:$LD_LIBRARY_PATH
ENV PYTHONPATH=/opt/openpose/build/python:$PYTHONPATH

# Create app directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app

# Create necessary directories
RUN mkdir -p /app/shared/uploads /app/shared/processed /app/shared/temp

# Expose port
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
