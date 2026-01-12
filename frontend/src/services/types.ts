export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface VideoMetadata {
  duration: number;
  fps: number;
  resolution: string;
  total_frames: number;
}

export interface ProcessingResult {
  original_url: string;
  processed_url: string;
  pose_3d_url: string;
  metadata: VideoMetadata;
}

export interface VideoUploadResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface ProcessingStatusResponse {
  task_id: string;
  status: TaskStatus;
  progress: number;
  message: string;
  result?: ProcessingResult;
  error?: string;
}

export interface VideoUrlRequest {
  video_url: string;
}
