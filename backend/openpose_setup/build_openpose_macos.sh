#!/bin/bash
set -e

echo "Starting OpenPose build for macOS..."

# Create openpose directory in user's home
OPENPOSE_DIR="$HOME/openpose"
mkdir -p "$OPENPOSE_DIR"

# Clone OpenPose repository
cd "$OPENPOSE_DIR"
if [ ! -d "openpose" ]; then
    echo "Cloning OpenPose repository..."
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

# Configure with CMake for macOS
echo "Configuring CMake..."
cmake .. \
    -DBUILD_PYTHON=ON \
    -DGPU_MODE=CPU_ONLY \
    -DUSE_CUDNN=OFF \
    -DBUILD_EXAMPLES=OFF \
    -DBUILD_DOCS=OFF \
    -DOpenCV_DIR=$(brew --prefix opencv)/lib/cmake/opencv4 \
    -DCMAKE_PREFIX_PATH=$(brew --prefix)

# Build (use sysctl to get CPU count on macOS)
echo "Building OpenPose..."
make -j$(sysctl -n hw.ncpu)

# Install Python bindings
echo "Installing Python bindings..."
cd python/openpose
python3 setup.py install --user

echo "OpenPose build completed successfully!"
echo "OpenPose installed at: $OPENPOSE_DIR/openpose"
