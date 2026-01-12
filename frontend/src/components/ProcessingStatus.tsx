import { Box, LinearProgress, Typography, Paper, Stack, Alert } from '@mui/material';
import type { TaskStatus } from '../services/types';

interface ProcessingStatusProps {
  status: TaskStatus;
  progress: number;
  message: string;
  error?: string | null;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  status,
  progress,
  message,
  error,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'processing':
        return 'primary';
      default:
        return 'inherit';
    }
  };

  return (
    <Box sx={{ maxWidth: 800, margin: '0 auto', p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h5" align="center">
            {status === 'completed' && '✓ Processing Complete!'}
            {status === 'failed' && '✗ Processing Failed'}
            {status === 'processing' && 'Processing Video...'}
            {status === 'queued' && 'Queued for Processing...'}
          </Typography>

          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          {(status === 'processing' || status === 'queued') && (
            <>
              <Box sx={{ width: '100%' }}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  color={getStatusColor() as any}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Typography variant="body1" align="center" color="text.secondary">
                {progress}% - {message}
              </Typography>
            </>
          )}

          {status === 'completed' && (
            <Typography variant="body1" align="center" color="success.main">
              Your video has been processed successfully!
            </Typography>
          )}

          {status === 'failed' && !error && (
            <Typography variant="body1" align="center" color="error.main">
              {message}
            </Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};
