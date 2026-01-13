import { Landmark } from '@mediapipe/tasks-vision';

type TransformFn = (lm: Landmark) => { x: number; y: number; z: number };
export const boneColor = 'white';
export const circleRadius = 5;

export enum PersonOrientation {
	FRONT = 'front',
	BACK = 'back',
	LEFT = 'left',
	RIGHT = 'right',
}

export const drawStylizedBone = (
	ctx: CanvasRenderingContext2D,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	topWidth = 24,
	midWidth = 16,
	triangleLength = 20,
	color: string,
) => {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const angle = Math.atan2(dy, dx);

	const nx = Math.cos(angle + Math.PI / 2);
	const ny = Math.sin(angle + Math.PI / 2);

	const tipX = x2 + (dx / Math.hypot(dx, dy)) * triangleLength;
	const tipY = y2 + (dy / Math.hypot(dx, dy)) * triangleLength;

	const getPoints = (scale = 1) => {
		return {
			x1Left: x1 + (nx * topWidth * scale) / 2,
			y1Left: y1 + (ny * topWidth * scale) / 2,
			x1Right: x1 - (nx * topWidth * scale) / 2,
			y1Right: y1 - (ny * topWidth * scale) / 2,
			x2Left: x2 + (nx * midWidth * scale) / 2,
			y2Left: y2 + (ny * midWidth * scale) / 2,
			x2Right: x2 - (nx * midWidth * scale) / 2,
			y2Right: y2 - (ny * midWidth * scale) / 2,
		};
	};

	const shape = getPoints(0.65);
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(shape.x1Left, shape.y1Left);
	ctx.lineTo(shape.x2Left, shape.y2Left);
	ctx.lineTo(tipX, tipY);
	ctx.lineTo(shape.x2Right, shape.y2Right);
	ctx.lineTo(shape.x1Right, shape.y1Right);
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.restore();
};

export function drawSpineLikeReference(
	ctx: CanvasRenderingContext2D,
	landmarks: Landmark[],
	color: string,
) {
	const ls = landmarks[11];
	const rs = landmarks[12];
	const lh = landmarks[23];
	const rh = landmarks[24];

	if ([ls, rs, lh, rh].some(l => l.visibility < 0.75)) return;

	const { width: W, height: H } = ctx.canvas;

	const topX = ((ls.x + rs.x) / 2) * W;
	const topY = ((ls.y + rs.y) / 2) * H;
	const bottomX = ((lh.x + rh.x) / 2) * W;
	const bottomY = ((lh.y + rh.y) / 2) * H;

	const dx = bottomX - topX;
	const dy = bottomY - topY;
	const spineLength = Math.hypot(dx, dy);

	const ux = dx / spineLength;
	const uy = dy / spineLength;

	ctx.save();

	const dashCount = 8;
	const dashLength = spineLength * 0.02;
	const spacing = spineLength / (dashCount + 1);

	ctx.strokeStyle = color;
	ctx.lineWidth = 5;
	ctx.lineCap = 'round';

	for (let i = 0; i < dashCount; i++) {
		const offset = spacing * (i + 1);

		const cx = topX + ux * offset;
		const cy = topY + uy * offset;

		const x1 = cx - ux * (dashLength / 2);
		const y1 = cy - uy * (dashLength / 2);
		const x2 = cx + ux * (dashLength / 2);
		const y2 = cy + uy * (dashLength / 2);

		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}

	ctx.lineWidth = 0.5;
	ctx.setLineDash([]);

	ctx.restore();
}

export function drawShoulders(
	ctx: CanvasRenderingContext2D,
	landmarks: Landmark[],
	transform: TransformFn,
	color: string,
) {
	const right = landmarks[11];
	const left = landmarks[12];

	if (
		!right ||
		!left ||
		(right.visibility ?? 0) < 0.75 ||
		(left.visibility ?? 0) < 0.75
	)
		return;

	const p1 = transform(right);
	const p2 = transform(left);

	const midX = (p1.x + p2.x) / 2;
	const midY = (p1.y + p2.y) / 2;

	ctx.save();

	ctx.beginPath();
	ctx.moveTo(midX, midY);
	ctx.quadraticCurveTo(midX + (p1.x - midX) * 0.3, midY + 10, p1.x, p1.y);
	ctx.strokeStyle = color;
	ctx.lineWidth = 4;
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(midX, midY);
	ctx.quadraticCurveTo(midX + (p2.x - midX) * 0.3, midY + 10, p2.x, p2.y);
	ctx.stroke();

	ctx.beginPath();
	ctx.arc(midX, midY, 5, 0, 2 * Math.PI);
	ctx.fillStyle = color;
	ctx.fill();

	ctx.restore();
}

export function drawHip(
	ctx: CanvasRenderingContext2D,
	landmarks: Landmark[],
	transform: TransformFn,
	color: string,
) {
	const left = landmarks[23];
	const right = landmarks[24];
	if (
		!left ||
		!right ||
		(left.visibility ?? 0) < 0.75 ||
		(right.visibility ?? 0) < 0.75
	)
		return;

	const p1 = transform(left);
	const p2 = transform(right);

	const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
	const mid = {
		x: (p1.x + p2.x) / 2,
		y: (p1.y + p2.y) / 2,
	};

	const hipRadius = 18;
	const curveDepth = 12;

	const nx = Math.cos(angle + Math.PI / 2);
	const ny = Math.sin(angle + Math.PI / 2);

	const p1Outer = { x: p1.x + nx * hipRadius, y: p1.y + ny * hipRadius };

	const p2Outer = { x: p2.x + nx * hipRadius, y: p2.y + ny * hipRadius };

	ctx.save();
	ctx.beginPath();

	ctx.moveTo(p1Outer.x, p1Outer.y);
	ctx.quadraticCurveTo(mid.x, mid.y + curveDepth, p2Outer.x, p2Outer.y);

	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();

	// Rounded end circles at p1 and p2
	// ctx.beginPath();
	// ctx.arc(p1.x, p1.y, hipRadius / 2.5, 0, 2 * Math.PI);
	// ctx.fill();

	// ctx.beginPath();
	// ctx.arc(p2.x, p2.y, hipRadius / 2.5, 0, 2 * Math.PI);
	// ctx.fill();

	ctx.restore();
}

// Define a function to draw spine lines that works with your existing structure
export function drawSpineLines(
	ctx: CanvasRenderingContext2D,
	landmarks: Landmark[],
	transform: TransformFn,
	color: string,
	lineWidth = 2,
	visibilityMin = 0.75,
) {
	const ls = landmarks[11];
	const rs = landmarks[12];
	const lh = landmarks[23];
	const rh = landmarks[24];

	if (
		!ls ||
		!rs ||
		!lh ||
		!rh ||
		ls.visibility < visibilityMin ||
		rs.visibility < visibilityMin ||
		lh.visibility < visibilityMin ||
		rh.visibility < visibilityMin
	) {
		return;
	}

	const shoulderMid = {
		x: (transform(ls).x + transform(rs).x) / 2,
		y: (transform(ls).y + transform(rs).y) / 2,
	};

	const hipMid = {
		x: (transform(lh).x + transform(rh).x) / 2,
		y: (transform(lh).y + transform(rh).y) / 2,
	};

	ctx.beginPath();
	ctx.moveTo(shoulderMid.x, shoulderMid.y);
	ctx.lineTo(hipMid.x, hipMid.y);
	ctx.strokeStyle = color;
	ctx.lineWidth = lineWidth;
	ctx.stroke();
}

export const handBonePairs = [
	{ points: [0, 1], thickness: 1.8 },
	{ points: [1, 2], thickness: 1.6 },
	{ points: [2, 3], thickness: 1.4 },
	{ points: [3, 4], thickness: 1.2 },

	{ points: [0, 5], thickness: 1.8 },
	{ points: [5, 6], thickness: 1.6 },
	{ points: [6, 7], thickness: 1.4 },
	{ points: [7, 8], thickness: 1.2 },

	{ points: [0, 9], thickness: 1.8 },
	{ points: [9, 10], thickness: 1.6 },
	{ points: [10, 11], thickness: 1.4 },
	{ points: [11, 12], thickness: 1.2 },

	{ points: [0, 13], thickness: 1.8 },
	{ points: [13, 14], thickness: 1.6 },
	{ points: [14, 15], thickness: 1.4 },
	{ points: [15, 16], thickness: 1.2 },

	{ points: [0, 17], thickness: 1.8 },
	{ points: [17, 18], thickness: 1.6 },
	{ points: [18, 19], thickness: 1.4 },
	{ points: [19, 20], thickness: 1.2 },

	{ points: [5, 9], thickness: 2.0 },
	{ points: [9, 13], thickness: 2.0 },
	{ points: [13, 17], thickness: 2.0 },
];

export function drawHandJoint(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	color: string,
) {
	const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.5);
	gradient.addColorStop(0, color);
	gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

	ctx.beginPath();
	ctx.arc(x, y, radius * 1.5, 0, 2 * Math.PI);
	ctx.fillStyle = gradient;
	ctx.fill();

	ctx.beginPath();
	ctx.arc(x, y, radius, 0, 2 * Math.PI);
	ctx.fillStyle = color;
	ctx.fill();

	ctx.beginPath();
	ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.4, 0, 2 * Math.PI);
	ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
	ctx.fill();
}

const exerciseToJointMap = {
	'Right Shoulder Flexion': 12,
	'Right Shoulder Extension': 12,
	'Right Elbow Flexion': 14,
	'Right Elbow Extension': 14,
	'Right Shoulder Internal Rotation': 12,
	'Right Shoulder External Rotation': 12,
	'Right Shoulder Abduction': 12,
	'Right Wrist Flexion': 16,
	'Right Wrist Extension': 16,
	'Right Wrist Ulnar Deviation': 16,
	'Right Wrist Radial Deviation': 16,
	'Right Wrist Pronation': 16,
	'Right Wrist Supination': 16,
	'Left Shoulder Flexion': 11,
	'Left Shoulder Extension': 11,
	'Left Elbow Flexion': 13,
	'Left Elbow Extension': 13,
	'Left Shoulder Internal Rotation': 11,
	'Left Shoulder External Rotation': 11,
	'Left Shoulder Abduction': 11,
	'Left Wrist Flexion': 15,
	'Left Wrist Extension': 15,
	'Left Wrist Ulnar Deviation': 15,
	'Left Wrist Radial Deviation': 15,
	'Left Wrist Pronation': 15,
	'Left Wrist Supination': 15,
	Squat: [25, 26],
	'Left Knee Flexion': 25,
	'Left Knee Extension': 25,
	'Left Hip Internal Rotation': 23,
	'Left Hip External Rotation': 23,
	'Left Hip Supine Flexion': 23,
	'Right Knee Flexion': 26,
	'Right Knee Extension': 26,
	'Right Hip Internal Rotation': 24,
	'Right Hip External Rotation': 24,
	'Right Hip Supine Flexion': 24,
	'Lumbar Extension': 33,
	'Lumbar Flexion': 33,
	'Lumbar Left Lateral Flexion': 33,
	'Lumbar Right Lateral Flexion': 33,
	'Lumbar Left Rotation': 33,
	'Lumbar Right Rotation': 33,
	'Neck Flexion': 34,
	'Neck Extension': 34,
	'Neck Left Lateral Flexion': 34,
	'Neck Right Lateral Flexion': 34,
	'Neck Left Rotation': 34,
	'Neck Right Rotation': 34,
};

export const getJointToHighlight = (exerciseName: string) => {
	if (!exerciseName) return null;
	if (exerciseName in exerciseToJointMap) {
		return exerciseToJointMap[exerciseName as keyof typeof exerciseToJointMap];
	}
	return null;
};




