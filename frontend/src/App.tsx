import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  Container,
  Alert,
} from '@mui/material';
import { Routes, Route, useParams } from 'react-router-dom';
import { VideoUpload } from './components/VideoUpload';
import { ProcessingStatus } from './components/ProcessingStatus';
import { SideBySidePlayer } from './components/SideBySidePlayer';
import { Pose3DViewer } from './components/Pose3DViewer';
import { VideoHistory } from './components/VideoHistory';
import { useVideoProcessing } from './hooks/useVideoProcessing';
import { getVideoUrl } from './services/api';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function MainPage() {
  const {
    taskId,
    status,
    progress,
    message,
    error,
    originalVideoUrl,
    processedVideoUrl,
    pose3dVideoUrl,
    uploadFile,
    uploadUrl,
    reset,
  } = useVideoProcessing();

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Show upload form when idle */}
      {!status && (
        <VideoUpload onFileUpload={uploadFile} onUrlUpload={uploadUrl} />
      )}

      {/* Show processing status when queued or processing */}
      {(status === 'queued' || status === 'processing') && (
        <ProcessingStatus
          status={status}
          progress={progress}
          message={message}
          error={error}
        />
      )}

      {/* Show error state with option to retry */}
      {status === 'failed' && (
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }} onClose={reset}>
            {error || message || 'Processing failed'}
          </Alert>
          <VideoUpload onFileUpload={uploadFile} onUrlUpload={uploadUrl} />
        </Container>
      )}

      {/* Show side-by-side video players when completed */}
      {status === 'completed' && originalVideoUrl && pose3dVideoUrl && taskId && (
        <SideBySidePlayer
          taskId={taskId}
          originalVideoUrl={originalVideoUrl}
          processedVideoUrl={pose3dVideoUrl}
          onReset={reset}
        />
      )}
    </Container>
  );
}

function Viewer3DPage() {
  // Extract taskId from URL
  const taskId = window.location.pathname.split('/').pop() || '';

  return <Pose3DViewer taskId={taskId} />;
}

function VideoViewerPage() {
  const { taskId } = useParams<{ taskId: string }>();

  if (!taskId) {
    return <Container>Invalid video ID</Container>;
  }

  const originalVideoUrl = getVideoUrl(taskId, 'original');
  const pose3dVideoUrl = getVideoUrl(taskId, '3d');

  return (
    <SideBySidePlayer
      taskId={taskId}
      originalVideoUrl={originalVideoUrl}
      processedVideoUrl={pose3dVideoUrl}
      onReset={() => window.location.href = '/'}
    />
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/history" element={<VideoHistory />} />
        <Route path="/viewer/:taskId" element={<VideoViewerPage />} />
        <Route path="/3d-viewer/:taskId" element={<Viewer3DPage />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
