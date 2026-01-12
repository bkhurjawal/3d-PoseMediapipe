#!/bin/bash
set -e

echo "Starting OpenPose build..."

# Install system dependencies
apt-get update && apt-get install -y \
    git \
    cmake \
    libopencv-dev \
    libgoogle-glog-dev \
    libboost-all-dev \
    libhdf5-dev \
    libatlas-base-dev \
    wget \
    unzip

# Clone OpenPose repository
cd /opt
if [ ! -d "openpose" ]; then
    git clone --depth 1 https://github.com/CMU-Perceptual-Computing-Lab/openpose.git
fi

cd openpose

# Download models
echo "Downloading OpenPose models..."
cd models
if [ ! -f "pose/body_25/pose_iter_584000.caffemodel" ]; then
    bash getModels.sh
fi
cd ..

# Build OpenPose
mkdir -p build
cd build

# Configure with CMake
# Note: GPU support can be enabled by setting BUILD_CUDA=ON if CUDA is available
cmake .. \
    -DBUILD_PYTHON=ON \
    -DGPU_MODE=CPU_ONLY \
    -DUSE_CUDNN=OFF \
    -DBUILD_EXAMPLES=OFF \
    -DBUILD_DOCS=OFF

# Build
make -j$(nproc)

# Install Python bindings
cd python/openpose
python3 setup.py install

echo "OpenPose build completed successfully!"
