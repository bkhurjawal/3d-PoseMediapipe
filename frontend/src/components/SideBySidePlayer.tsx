import { useRef, useState } from 'react';
import { Box, Grid, Button, Stack } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { VideoPlayer, VideoPlayerHandle } from './VideoPlayer';
import { Pose3DViewerSync } from './Pose3DViewerSync';

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
  const originalRef = useRef<VideoPlayerHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
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

  return (
    <Box sx={{ maxWidth: 1600, margin: '0 auto', p: 3 }}>
      <Stack spacing={3}>
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
    </Box>
  );
};
