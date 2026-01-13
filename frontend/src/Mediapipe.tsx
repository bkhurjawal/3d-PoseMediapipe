import {
	FilesetResolver,
	Landmark,
	NormalizedLandmark,
	PoseLandmarker,
	PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import EventEmitter from '@services/EventEmitter';
import {
	boneColor,
	drawSpineLines,
	PersonOrientation,
} from '@utils/SkeletonMedia';
import { memo, useCallback, useEffect, useRef } from 'react';
import { drawOptions, videoSize } from '../constants';
import { PosturalAnalytics, UseControls } from '../context/Controls.context';
import { UseFullScreen } from '../context/FullScreen.context';
import { UseSwitchVideo } from '../context/SwitchVideo.context';

let poseLandmarker: PoseLandmarker | null = null;
let animationFrameId: number;
const fps = 120;
const fpsInMiliceconds = 1000 / fps;
let timeOutId: NodeJS.Timeout;

function throttle<T extends (...args: any[]) => void>(
	func: T,
	delay: number,
): (...args: Parameters<T>) => void {
	let lastCall = 0;
	return function (...args: Parameters<T>): void {
		const now = performance.now();
		if (now - lastCall < delay) {
			return;
		}
		lastCall = now;
		func(...args);
	};
}

interface MediapipeProps {
	isSkeletonVisible?: boolean;
}

export const landmarksToRemove = {
	front: [
		0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22, 29, 30, 31, 32,
	],
	back: [
		0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22, 29, 30, 31, 32,
	],
	left: [
		0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 17, 18, 19, 20, 21, 22, 28, 29, 30, 31, 32,
		12, 14, 16, 24, 26, 28, 13, 15,
	],
	right: [
		0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 17, 18, 19, 20, 21, 22, 27, 29, 30, 31, 32,
		11, 13, 15, 23, 25, 27, 14, 16,
	],
};

const postureBoneMap: Record<string, [number, number][]> = {
	front: [
		[11, 13],
		[11, 12],
		[13, 15],
		[12, 14],
		[14, 16],
		[23, 25],
		[25, 27],
		[24, 26],
		[26, 28],
		[23, 24],
	],
	back: [
		[11, 13],
		[11, 12],
		[13, 15],
		[12, 14],
		[14, 16],
		[23, 25],
		[25, 27],
		[24, 26],
		[26, 28],
		[23, 24],
	],
	left: [
		[23, 25],
		[25, 27],
		[7, 11],
		[11, 23],
	],
	right: [
		[24, 26],
		[26, 28],
		[8, 12],
		[12, 24],
	],
};

const JOINT_ERROR_COLOR = '#FF3B30';

function Mediapipe() {
	const { isFullScreen } = UseFullScreen();

	const { cameraId } = UseSwitchVideo();
	const { onGetCurrent, isSkeletonVisible, setCanvasDimensions } =
		UseControls();
	const current = onGetCurrent() as Partial<PosturalAnalytics>;

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const skeletonVisibleRef = useRef<boolean>(isSkeletonVisible);
	const currenPostureRef = useRef<PersonOrientation>(PersonOrientation.FRONT);

	useEffect(() => {
		skeletonVisibleRef.current = isSkeletonVisible;
	}, [isSkeletonVisible]);

	const triggerResultsEvent = (
		eventName: string,
		data: NormalizedLandmark[],
	) => {
		EventEmitter.emit(eventName, data);
	};

	useEffect(() => {
		if (current) {
			if (current.view) {
				currenPostureRef.current = current.view as PersonOrientation;
			}
		}
	}, [current]);

	const throttledTriggerResultsEvent = throttle(triggerResultsEvent, 250);

	const drawCallback = useCallback(
		(results: PoseLandmarkerResult) => {
			if (!results.landmarks[0] || !canvasRef.current || !videoRef.current)
				return;

			throttledTriggerResultsEvent('results', results.landmarks[0]);

			const canvas = canvasRef.current;
			const ctx = canvas.getContext('2d');
			const video = videoRef.current;
			if (!ctx) return;

			const width = (canvas.width = video.videoWidth);
			const height = (canvas.height = video.videoHeight);

			ctx.save();
			ctx.clearRect(0, 0, width, height);

			const landmarks = results.landmarks[0];
			// drawCenterLine(ctx, '#00AAFF', 5);

			const transform = (
				landmark: Landmark,
			): { x: number; y: number; z: number } => ({
				x: landmark.x * canvas.width,
				y: landmark.y * canvas.height,
				z: landmark.z ? landmark.z * canvas.width : 0,
			});

			landmarks.forEach((lm, idx) => {
				if (
					landmarksToRemove[currenPostureRef.current].includes(idx) ||
					lm.visibility < drawOptions.visibilityMin
				)
					return;

				const { x, y } = transform(lm);
				const circleRadius = 5;

				ctx.beginPath();
				ctx.arc(x, y, circleRadius, 0, 2 * Math.PI);
				ctx.fillStyle = skeletonVisibleRef.current
					? boneColor
					: JOINT_ERROR_COLOR;
				ctx.fill();
			});
			if (!skeletonVisibleRef.current) {
				ctx.restore();
				return;
			}
			const posture = currenPostureRef.current;
			const bonePairs: [number, number][] = postureBoneMap[posture] || [];
			const lineWidth = 2;

			bonePairs.forEach(([startIdx, endIdx]) => {
				const start = landmarks[startIdx];
				const end = landmarks[endIdx];

				if (
					start.visibility < drawOptions.visibilityMin ||
					end.visibility < drawOptions.visibilityMin
				)
					return;

				const p1 = transform(start);
				const p2 = transform(end);

				// Simple line draw
				ctx.beginPath();
				ctx.moveTo(p1.x, p1.y);
				ctx.lineTo(p2.x, p2.y);
				ctx.strokeStyle = boneColor;
				ctx.lineWidth = lineWidth;
				ctx.stroke();
			});

			if (posture === 'front' || posture === 'back') {
				drawSpineLines(
					ctx,
					landmarks,
					transform,
					boneColor,
					lineWidth,
					drawOptions.visibilityMin,
				);
			}

			ctx.restore();
		},
		[throttledTriggerResultsEvent],
	);

	const predictWebcam = useCallback(() => {
		if (videoRef?.current && poseLandmarker) {
			timeOutId = setTimeout(() => {
				try {
					poseLandmarker?.detectForVideo(
						videoRef.current as HTMLVideoElement,
						performance.now(),
						drawCallback,
					);
					animationFrameId = requestAnimationFrame(predictWebcam);
				} catch (error) {
					console.error('Error on predictWebcam:', error);
					cancelAnimationFrame(animationFrameId);
					if (timeOutId) clearTimeout(timeOutId);
				}
			}, fpsInMiliceconds);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const stopStreamedVideo = useCallback(() => {
		cancelAnimationFrame(animationFrameId);
		if (timeOutId) clearTimeout(timeOutId);

		if (videoRef?.current) {
			const stream = videoRef.current.srcObject as MediaStream;
			if (stream) {
				const tracks = stream.getTracks();

				tracks.forEach(track => {
					track.stop();
				});
			}

			videoRef.current.srcObject = null;
			videoRef.current.removeEventListener('loadeddata', () => {});
		}
	}, []);

	const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

	const setupCamera = useCallback(() => {
		if (!hasGetUserMedia()) {
			console.warn('getUserMedia() is not supported by your browser');
			return;
		}

		if (!poseLandmarker) {
			console.warn('Wait! poseLandmaker not loaded yet.');
			setTimeout(setupCamera, 1000);
			return;
		}

		const constraints = {
			video: {
				deviceId: {
					exact: cameraId as string,
				},
				width: videoSize.width,
				height: videoSize.height,
				frameRate: {
					ideal: 15,
					max: 20,
				},
			},
			audio: false,
		};

		navigator.mediaDevices.getUserMedia(constraints).then(stream => {
			if (videoRef?.current) {
				videoRef.current.srcObject = stream;
				videoRef.current.addEventListener('loadeddata', predictWebcam);
			}
		});
	}, [cameraId, predictWebcam]);

	const createPoseLandmarker = useCallback(async () => {
		const vision = await FilesetResolver.forVisionTasks(
			'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
		);
		poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath:
					'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
				delegate: 'CPU',
			},
			runningMode: 'VIDEO',
			numPoses: 1,
			minPoseDetectionConfidence: 0.6,
			minTrackingConfidence: 0.6,
		});
	}, []);

	useEffect(() => {
		createPoseLandmarker();
		return () => {
			stopStreamedVideo();
		};
	}, [createPoseLandmarker, stopStreamedVideo]);

	useEffect(() => {
		if (cameraId) {
			stopStreamedVideo();
			setTimeout(() => {
				setupCamera();
			}, 1000);
		}
	}, [cameraId, setupCamera, stopStreamedVideo]);

	return (
		<div id="printscreen_posture_analytics">
			<video
				id="romVideo"
				ref={videoRef}
				autoPlay
				playsInline
				muted
				onLoadedMetadata={() => {
					if (canvasRef.current && videoRef.current) {
						canvasRef.current.width = videoRef.current.videoWidth;
						canvasRef.current.height = videoRef.current.videoHeight;
						setCanvasDimensions({
							width: videoRef?.current.videoWidth,
							height: videoRef.current.videoHeight,
						});
					}
				}}
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					objectFit: 'contain',
					zIndex: 1,
					maxWidth: isFullScreen ? '100%' : 1280,
					pointerEvents: 'none',
				}}
			/>
			<canvas
				id="romOverlay"
				ref={canvasRef}
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					maxWidth: isFullScreen ? '100%' : 1280,
					width: '100%',
					height: '100%',
					objectFit: 'contain',
					zIndex: 2,
					pointerEvents: 'none',
				}}
			/>
		</div>
	);
}

export default memo(Mediapipe);
