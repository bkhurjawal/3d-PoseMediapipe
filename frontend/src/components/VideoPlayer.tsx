import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Box, Typography, Paper } from '@mui/material';

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  showControls?: boolean;
}

export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (
    {
      videoUrl,
      title,
      onTimeUpdate,
      onDurationChange,
      onPlay,
      onPause,
      showControls = true,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      play: () => {
        videoRef.current?.play();
      },
      pause: () => {
        videoRef.current?.pause();
      },
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
      getDuration: () => {
        return videoRef.current?.duration || 0;
      },
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleTimeUpdate = () => {
        if (onTimeUpdate) {
          onTimeUpdate(video.currentTime);
        }
      };

      const handleDurationChange = () => {
        if (onDurationChange) {
          onDurationChange(video.duration);
        }
      };

      const handlePlay = () => {
        if (onPlay) {
          onPlay();
        }
      };

      const handlePause = () => {
        if (onPause) {
          onPause();
        }
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('durationchange', handleDurationChange);
      video.addEventListener('loadedmetadata', handleDurationChange);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('durationchange', handleDurationChange);
        video.removeEventListener('loadedmetadata', handleDurationChange);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }, [onTimeUpdate, onDurationChange, onPlay, onPause]);

    return (
      <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
        <Typography variant="h6" gutterBottom align="center">
          {title}
        </Typography>
        <Box
          sx={{
            position: 'relative',
            paddingTop: '56.25%', // 16:9 aspect ratio
            backgroundColor: 'black',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            controls={showControls}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          />
        </Box>
      </Paper>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
