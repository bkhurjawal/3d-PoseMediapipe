import React from 'react';
import { useParams } from 'react-router-dom';
import { Pose3DViewer } from '../components/Pose3DViewer';

export const Pose3DViewerPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();

  if (!taskId) {
    return <div>Invalid task ID</div>;
  }

  return <Pose3DViewer taskId={taskId} />;
};
