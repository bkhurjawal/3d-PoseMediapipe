import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { VideoPlayer, VideoPlayerHandle } from './VideoPlayer';
import { Pose3DViewerSync } from './Pose3DViewerSync';
import { deleteVideo } from '../services/api';

interface SideBySidePlayerProps {
  taskId: string;
  originalVideoUrl: string;
  processedVideoUrl: string;
  onReset?: () => void;
}

export const SideBySidePlayer: React.FC<SideBySidePlayerProps> = ({
  taskId,
  originalVideoUrl,
  processedVideoUrl,
  onReset,
}) => {
  const navigate = useNavigate();
  const originalRef = useRef<VideoPlayerHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const FPS = 25; // Default FPS, should be fetched from backend metadata

  const handlePlayPause = () => {
    if (isPlaying) {
      originalRef.current?.pause();
    } else {
      originalRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleOriginalTimeUpdate = (time: number) => {
    setCurrentTime(time);
    setCurrentFrame(Math.floor(time * FPS));
  };

  const handleOriginalPlay = () => {
    setIsPlaying(true);
  };

  const handleOriginalPause = () => {
    setIsPlaying(false);
  };

  const handleOpen3DViewer = () => {
    // Open interactive 3D viewer in a new window
    window.open(`/3d-viewer/${taskId}`, '_blank', 'width=1400,height=900');
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      await deleteVideo(taskId);
      setDeleteDialogOpen(false);
      // Navigate to history page after deletion
      navigate('/history');
    } catch (error) {
      alert('Failed to delete video. Please try again.');
      console.error('Delete error:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleBackToHistory = () => {
    navigate('/history');
  };

  return (
    <Box sx={{ maxWidth: 1600, margin: '0 auto', p: 3 }}>
      <Stack spacing={3}>
        {/* Top Navigation */}
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToHistory}
          >
            Back to History
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteClick}
          >
            Delete Video
          </Button>
        </Stack>

        {/* Synchronized Controls */}
        <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            onClick={handlePlayPause}
            size="large"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<OpenInNewIcon />}
            onClick={handleOpen3DViewer}
            size="large"
          >
            Open 3D in New Window
          </Button>
          {onReset && (
            <Button
              variant="outlined"
              startIcon={<ReplayIcon />}
              onClick={onReset}
              size="large"
            >
              Process New Video
            </Button>
          )}
        </Stack>

        {/* Video Players and 3D Viewer */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <VideoPlayer
              ref={originalRef}
              videoUrl={originalVideoUrl}
              title="Original Video"
              onTimeUpdate={handleOriginalTimeUpdate}
              onPlay={handleOriginalPlay}
              onPause={handleOriginalPause}
            />
          </Grid>
          <Grid item xs={12} lg={6}>
            <Box sx={{ height: '100%', minHeight: 500 }}>
              <Pose3DViewerSync
                taskId={taskId}
                currentFrame={currentFrame}
                height="100%"
              />
            </Box>
          </Grid>
        </Grid>
      </Stack>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Video?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this video? This action cannot be undone.
            All associated files including the original video, processed video, and 3D pose data will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            autoFocus
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
