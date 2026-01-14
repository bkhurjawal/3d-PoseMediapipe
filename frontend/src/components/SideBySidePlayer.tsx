import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Slider,
  Typography,
  IconButton,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReplayIcon from '@mui/icons-material/Replay';
import { VideoPlayer, VideoPlayerHandle } from './VideoPlayer';
import { Pose3DViewerSync } from './Pose3DViewerSync';
import { Pose3DViewerBones } from './Pose3DViewerBones';
import { deleteVideo } from '../services/api';

interface SideBySidePlayerProps {
  taskId: string;
  originalVideoUrl: string;
  processedVideoUrl: string;
  onReset?: () => void;
}

const formatTime = (seconds: number) => {
  const pad = (num: number) => num.toString().padStart(2, '0');
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${pad(mins)}:${pad(secs)}`;
};

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
  const [duration, setDuration] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modelType, setModelType] = useState<'humanoid' | 'bones'>('humanoid');
  const FPS = 25; // Default FPS

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

  const handleDurationChange = (dur: number) => {
    setDuration(dur);
  };

  const handleOriginalPlay = () => {
    setIsPlaying(true);
  };

  const handleOriginalPause = () => {
    setIsPlaying(false);
  };

  const handleSeek = (event: Event, newValue: number | number[]) => {
    const time = newValue as number;
    originalRef.current?.seek(time);
    setCurrentTime(time);
    setCurrentFrame(Math.floor(time * FPS));
  };

  const handleStepFrame = (direction: 'next' | 'prev') => {
    const frameTime = 1 / FPS;
    const newTime =
      direction === 'next'
        ? Math.min(currentTime + frameTime, duration)
        : Math.max(currentTime - frameTime, 0);

    originalRef.current?.seek(newTime);
    // Pause if stepping
    if (isPlaying) {
      originalRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const handleOpen3DViewer = () => {
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
    <Box
      sx={{
        maxWidth: '100vw',
        minHeight: '100vh',
        bgcolor: '#121212',
        color: 'white',
        p: 3,
      }}
    >
      <Stack spacing={3} maxWidth={1600} mx="auto">
        {/* Header Navigation */}
        <Stack
          direction="row"
          spacing={2}
          justifyContent="space-between"
          alignItems="center"
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToHistory}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
            variant="outlined"
          >
            Back to History
          </Button>
          <Stack direction="row" spacing={2}>
            {onReset && (
              <Button
                startIcon={<ReplayIcon />}
                onClick={onReset}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                variant="outlined"
              >
                Process New
              </Button>
            )}
            <Button
              startIcon={<OpenInNewIcon />}
              onClick={handleOpen3DViewer}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
              variant="outlined"
            >
              Open 3D Window
            </Button>
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
            >
              Delete
            </Button>
          </Stack>
        </Stack>

        {/* Listeners for Play/Pause sync */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <VideoPlayer
              ref={originalRef}
              videoUrl={originalVideoUrl}
              title="Original Video"
              onTimeUpdate={handleOriginalTimeUpdate}
              onDurationChange={handleDurationChange}
              onPlay={handleOriginalPlay}
              onPause={handleOriginalPause}
              showControls={false}
            />
          </Grid>
          <Grid item xs={12} lg={6}>
            <Stack spacing={1}>
              {/* Model Type Selector */}
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <ToggleButtonGroup
                  value={modelType}
                  exclusive
                  onChange={(e, newValue) => {
                    if (newValue !== null) {
                      setModelType(newValue);
                    }
                  }}
                  size="small"
                  sx={{
                    bgcolor: '#1e1e1e',
                    '& .MuiToggleButton-root': {
                      color: '#b0b0b0',
                      borderColor: '#333',
                      '&.Mui-selected': {
                        bgcolor: '#2196f3',
                        color: 'white',
                        '&:hover': {
                          bgcolor: '#1976d2',
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="humanoid">
                    Humanoid Model
                  </ToggleButton>
                  <ToggleButton value="bones">
                    X-Ray Bones
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* 3D Viewer */}
              <Box
                sx={{
                  height: '100%',
                  minHeight: 400,
                  bgcolor: 'black',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                {modelType === 'humanoid' ? (
                  <Pose3DViewerSync
                    taskId={taskId}
                    currentFrame={currentFrame}
                    height="100%"
                  />
                ) : (
                  <Pose3DViewerBones
                    taskId={taskId}
                    currentFrame={currentFrame}
                    height="100%"
                  />
                )}
              </Box>
            </Stack>
          </Grid>
        </Grid>

        {/* Timeline Control Bar */}
        <Paper
          sx={{
            p: 2,
            bgcolor: '#1e1e1e',
            borderRadius: 2,
            border: '1px solid #333',
          }}
        >
          <Stack spacing={1}>
            <Slider
              value={currentTime}
              min={0}
              max={duration || 100}
              onChange={handleSeek}
              sx={{
                color: '#2196f3',
                height: 8,
                '& .MuiSlider-thumb': {
                  width: 24,
                  height: 24,
                  backgroundColor: '#fff',
                  border: '2px solid currentColor',
                  '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
                    boxShadow: 'inherit',
                  },
                  '&:before': {
                    display: 'none',
                  },
                },
                '& .MuiSlider-track': {
                  border: 'none',
                },
                '& .MuiSlider-rail': {
                  opacity: 0.3,
                  backgroundColor: '#bfbfbf',
                },
              }}
            />

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Box
                sx={{
                  minWidth: 100,
                  color: '#b0b0b0',
                  typography: 'body2',
                }}
              >
                Frame: {currentFrame}
              </Box>

              <Stack direction="row" spacing={2} alignItems="center">
                <IconButton
                  onClick={() => handleStepFrame('prev')}
                  sx={{ color: 'white' }}
                >
                  <SkipPreviousIcon />
                </IconButton>
                <IconButton
                  onClick={handlePlayPause}
                  sx={{
                    color: 'white',
                    bgcolor: 'primary.main',
                    '&:hover': { bgcolor: 'primary.dark' },
                    width: 48,
                    height: 48,
                  }}
                >
                  {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
                <IconButton
                  onClick={() => handleStepFrame('next')}
                  sx={{ color: 'white' }}
                >
                  <SkipNextIcon />
                </IconButton>
              </Stack>

              <Box
                sx={{
                  minWidth: 100,
                  textAlign: 'right',
                  color: '#b0b0b0',
                  typography: 'body2',
                }}
              >
                {formatTime(currentTime)} / {formatTime(duration)}
              </Box>
            </Stack>
          </Stack>
        </Paper>
      </Stack>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        PaperProps={{ sx: { bgcolor: '#1e1e1e', color: 'white' } }}
      >
        <DialogTitle sx={{ color: 'white' }}>Delete Video?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'gray' }}>
            Are you sure you want to delete this video? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} sx={{ color: 'gray' }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
