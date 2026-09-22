export const TARGET_FPS = 30; //standard target fps for the benchmark, used to determine if a step is stable or not
export let CHART_MAX_FPS = 60;

export function detectChartMaxFps(sampleCount = 45) {
	return new Promise((resolve) => {
		const timestamps = [];

		const sample = (timestamp) => {
			timestamps.push(timestamp);
			if (timestamps.length < sampleCount) {
				requestAnimationFrame(sample);
				return;
			}

			const intervals = timestamps.slice(1).map((time, index) => time - timestamps[index]);
			const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
			const measuredFps = 1000 / averageInterval;
			CHART_MAX_FPS = Math.max(TARGET_FPS, Math.ceil(measuredFps / 10) * 10);
			resolve(CHART_MAX_FPS);
		};

		requestAnimationFrame(sample);
	});
}