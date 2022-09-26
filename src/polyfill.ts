/**
 * Suppress ExperimentalWarnings
 * Example (node:32288) ExperimentalWarning: buffer.Blob is an experimental feature.
 */
const warningListeners = process.listeners('warning');

if (warningListeners.length != 1) {
  console.warn(
    `expected 1 listener on the process "warning" event, saw ${warningListeners.length}`
  );
}

if (warningListeners[0]) {
  const originalWarningListener = warningListeners[0];
  process.removeAllListeners('warning');

  process.prependListener('warning', (warning) => {
    if (warning.name != 'ExperimentalWarning') {
      originalWarningListener(warning);
    }
  });
}
