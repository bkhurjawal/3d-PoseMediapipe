import { useState, useCallback } from 'react';
import {
  uploadVideo,
  processVideoUrl,
  getProcessingStatus,
  getVideoUrl,
} from '../services/api';
import type { ProcessingStatusResponse, TaskStatus } from '../services/types';
import { usePolling } from './usePolling';

interface UseVideoProcessingReturn {
  taskId: string | null;
  status: TaskStatus | null;
  progress: number;
  message: string;
  error: string | null;
  originalVideoUrl: string | null;
  processedVideoUrl: string | null;
  pose3dVideoUrl: string | null;
  uploadFile: (file: File) => Promise<void>;
  uploadUrl: (url: string) => Promise<void>;
  reset: () => void;
}

const POLLING_INTERVAL = parseInt(
  import.meta.env.VITE_POLLING_INTERVAL || '2000'
);

export const useVideoProcessing = (): UseVideoProcessingReturn => {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(
    null
  );
  const [pose3dVideoUrl, setPose3dVideoUrl] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!taskId) return;

    try {
      const statusResponse = await getProcessingStatus(taskId);
      setStatus(statusResponse.status);
      setProgress(statusResponse.progress);
      setMessage(statusResponse.message);

      if (statusResponse.error) {
        setError(statusResponse.error);
      }

      if (statusResponse.result) {
        // Use URLs from backend response for better compatibility
        const originalUrl = statusResponse.result.original_url;
        const processedUrl = statusResponse.result.processed_url;
        const pose3dUrl = statusResponse.result.pose_3d_url;

        // Ensure URLs are absolute (add base URL if they're relative)
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const makeAbsoluteUrl = (url: string) => {
          if (url.startsWith('http')) return url;
          return `${baseUrl}${url}`;
        };

        const absoluteOriginalUrl = makeAbsoluteUrl(originalUrl);
        const absoluteProcessedUrl = makeAbsoluteUrl(processedUrl);
        const absolutePose3dUrl = makeAbsoluteUrl(pose3dUrl);

        console.log('Video URLs:', {
          original: absoluteOriginalUrl,
          processed: absoluteProcessedUrl,
          pose3d: absolutePose3dUrl
        });

        setOriginalVideoUrl(absoluteOriginalUrl);
        setProcessedVideoUrl(absoluteProcessedUrl);
        setPose3dVideoUrl(absolutePose3dUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      setStatus('failed');
    }
  }, [taskId]);

  // Poll for status when task is in progress
  const shouldPoll = status === 'queued' || status === 'processing';
  usePolling({
    callback: fetchStatus,
    interval: POLLING_INTERVAL,
    enabled: shouldPoll,
  });

  const uploadFile = useCallback(async (file: File) => {
    try {
      setError(null);
      setMessage('Uploading video...');
      const response = await uploadVideo(file);
      setTaskId(response.task_id);
      setStatus('queued');
      setProgress(0);
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video');
      setStatus('failed');
    }
  }, []);

  const uploadUrl = useCallback(async (url: string) => {
    try {
      setError(null);
      setMessage('Downloading video from URL...');
      const response = await processVideoUrl(url);
      setTaskId(response.task_id);
      setStatus('queued');
      setProgress(0);
      setMessage(response.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to process video URL'
      );
      setStatus('failed');
    }
  }, []);

  const reset = useCallback(() => {
    setTaskId(null);
    setStatus(null);
    setProgress(0);
    setMessage('');
    setError(null);
    setOriginalVideoUrl(null);
    setProcessedVideoUrl(null);
    setPose3dVideoUrl(null);
  }, []);

  return {
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
  };
};
