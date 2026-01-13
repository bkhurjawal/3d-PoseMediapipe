import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Container,
  Grid,
  Typography,
  Chip,
  Stack,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import { getAllVideos, deleteVideo, getVideoUrl } from '../services/api';
import type { VideoHistoryItem } from '../services/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const VideoHistory: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllVideos();
      // Filter to only show completed videos
      const completedVideos = data.filter(v => v.status === 'completed');
      setVideos(completedVideos);
    } catch (err) {
      setError('Failed to load video history');
      console.error('Error loading videos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const handleDeleteClick = (taskId: string) => {
    setDeletingTaskId(taskId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTaskId) return;

    try {
      setDeleting(true);
      await deleteVideo(deletingTaskId);
      setVideos(videos.filter(v => v.task_id !== deletingTaskId));
      setDeleteDialogOpen(false);
      setDeletingTaskId(null);
    } catch (err) {
      alert('Failed to delete video');
      console.error('Error deleting video:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeletingTaskId(null);
  };

  const handlePlay = (taskId: string) => {
    navigate(`/viewer/${taskId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading videos...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Video History</Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {videos.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No videos uploaded yet
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/')}
            sx={{ mt: 2 }}
          >
            Upload Your First Video
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {videos.map((video) => (
            <Grid item xs={12} sm={6} md={4} key={video.task_id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardMedia
                  component="div"
                  sx={{
                    height: 200,
                    bgcolor: '#0a0a0a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    backgroundImage: video.thumbnail_url
                      ? `url(${API_BASE_URL}${video.thumbnail_url})`
                      : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {!video.thumbnail_url && (
                    <PlayArrowIcon sx={{ fontSize: 60, color: 'white', opacity: 0.5 }} />
                  )}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(0,0,0,0.3)',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                      '&:hover': {
                        opacity: 1,
                      },
                    }}
                  >
                    <IconButton
                      sx={{
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.9)',
                        },
                      }}
                      onClick={() => handlePlay(video.task_id)}
                    >
                      <PlayArrowIcon sx={{ fontSize: 40 }} />
                    </IconButton>
                  </Box>
                </CardMedia>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={video.status}
                        color={getStatusColor(video.status)}
                        size="small"
                      />
                      {video.metadata && (
                        <Typography variant="caption" color="text.secondary">
                          {video.metadata.resolution}
                        </Typography>
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(video.created_at)}
                    </Typography>
                    {video.metadata && (
                      <Typography variant="caption" color="text.secondary">
                        {video.metadata.duration.toFixed(1)}s • {video.metadata.fps} fps
                      </Typography>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => handlePlay(video.task_id)}
                    >
                      View
                    </Button>
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteClick(video.task_id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

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
    </Container>
  );
};
