/**
 * Suppress ExperimentalWarnings
 * Example (node:32288) ExperimentalWarning: buffer.Blob is an experimental feature.
 */
const { emitWarning } = process;

process.emitWarning = (warning, ...args) => {
	if (args[0] === 'ExperimentalWarning') {
		return;
	}

	if (args[0] && typeof args[0] === 'object' && args[0].type === 'ExperimentalWarning') {
		return;
	}

	return emitWarning(warning, ...args);
};
