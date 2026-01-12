import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  Container,
  Alert,
} from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import { VideoUpload } from './components/VideoUpload';
import { ProcessingStatus } from './components/ProcessingStatus';
import { SideBySidePlayer } from './components/SideBySidePlayer';
import { Pose3DViewer } from './components/Pose3DViewer';
import { useVideoProcessing } from './hooks/useVideoProcessing';

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

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/3d-viewer/:taskId" element={<Viewer3DPage />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
