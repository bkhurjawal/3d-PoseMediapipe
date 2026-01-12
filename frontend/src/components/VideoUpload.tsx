import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Stack,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinkIcon from '@mui/icons-material/Link';

interface VideoUploadProps {
  onFileUpload: (file: File) => void;
  onUrlUpload: (url: string) => void;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({
  onFileUpload,
  onUrlUpload,
}) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.webm', '.mkv'],
    },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024, // 500MB
    onDrop: (acceptedFiles, rejectedFiles) => {
      setError(null);
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError('File size exceeds 500MB limit');
        } else {
          setError('Invalid file type. Please upload a video file.');
        }
        return;
      }
      if (acceptedFiles.length > 0) {
        onFileUpload(acceptedFiles[0]);
      }
    },
  });

  const handleUrlSubmit = () => {
    setError(null);
    if (!videoUrl.trim()) {
      setError('Please enter a video URL');
      return;
    }
    if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }
    onUrlUpload(videoUrl);
  };

  return (
    <Box sx={{ maxWidth: 800, margin: '0 auto', p: 3 }}>
      <Typography variant="h4" gutterBottom align="center">
        OpenPose 3D Pose Reconstruction
      </Typography>
      <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary">
        Upload a video or provide a URL to see whole-body 3D pose estimation
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={3} sx={{ mt: 4 }}>
        {/* File Upload */}
        <Paper
          {...getRootProps()}
          sx={{
            p: 4,
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.400',
            backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
            cursor: 'pointer',
            transition: 'all 0.3s',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'action.hover',
            },
          }}
        >
          <input {...getInputProps()} />
          <Stack alignItems="center" spacing={2}>
            <CloudUploadIcon sx={{ fontSize: 60, color: 'primary.main' }} />
            <Typography variant="h6">
              {isDragActive ? 'Drop video here' : 'Drag & drop a video file'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or click to select a file
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supported formats: MP4, AVI, MOV, WEBM, MKV (Max: 500MB)
            </Typography>
          </Stack>
        </Paper>

        {/* URL Input */}
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <LinkIcon sx={{ mr: 1 }} />
              Or provide a video URL
            </Typography>
            <TextField
              fullWidth
              label="Video URL"
              placeholder="https://example.com/video.mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleUrlSubmit();
                }
              }}
            />
            <Button
              variant="contained"
              onClick={handleUrlSubmit}
              disabled={!videoUrl.trim()}
            >
              Process Video from URL
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};
