import axios from 'axios';
import type {
  VideoUploadResponse,
  ProcessingStatusResponse,
  VideoUrlRequest,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadVideo = async (file: File): Promise<VideoUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<VideoUploadResponse>(
    '/api/v1/video/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
};

export const processVideoUrl = async (
  videoUrl: string
): Promise<VideoUploadResponse> => {
  const payload: VideoUrlRequest = { video_url: videoUrl };
  const response = await api.post<VideoUploadResponse>(
    '/api/v1/video/process-url',
    payload
  );

  return response.data;
};

export const getProcessingStatus = async (
  taskId: string
): Promise<ProcessingStatusResponse> => {
  const response = await api.get<ProcessingStatusResponse>(
    `/api/v1/video/status/${taskId}`
  );

  return response.data;
};

export const getVideoUrl = (taskId: string, type: 'original' | 'processed' | '3d'): string => {
  return `${API_BASE_URL}/api/v1/video/serve/${type}/${taskId}`;
};

export const deleteVideo = async (taskId: string): Promise<void> => {
  await api.delete(`/api/v1/video/${taskId}`);
};

export const getLandmarks = async (taskId: string): Promise<any> => {
  const response = await api.get(`/api/v1/video/landmarks/${taskId}`);
  return response.data;
};
