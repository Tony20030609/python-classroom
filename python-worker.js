/* The Python interpreter lives here, never on the UI thread. */
let python;
let pythonRepr;
let currentRun = null;
let executionCount = 0;
let streamBytes = 0;
let streamMessages = 0;
let streamTruncated = false;
const MAX_STREAM_BYTES = 100 * 1024;
const MAX_STREAM_MESSAGES = 500;

function emit(type, text) {
  if (currentRun) self.postMessage({ type, text, ...currentRun });
}

async function initialize() {
  const runtimeURL = new URL('./runtime/', self.location.href).href;
  importScripts(`${runtimeURL}pyodide.js`);
  python = await loadPyodide({ indexURL: runtimeURL });
  pythonRepr = python.runPython('repr');
  const attachStream = (type) => {
    const decoder = new TextDecoder();
    return {
      write(buffer) {
        if (!currentRun || streamTruncated) return buffer.length;
        if (streamBytes + buffer.length > MAX_STREAM_BYTES || streamMessages >= MAX_STREAM_MESSAGES) {
          streamTruncated = true;
          emit('stderr', '\n输出过多，后续输出已截断；代码仍在运行，可点击停止并重启。\n');
          return buffer.length;
        }
        streamBytes += buffer.length;
        const text = decoder.decode(buffer, { stream: true });
        if (text) {
          streamMessages += 1;
          emit(type, text);
        }
        return buffer.length;
      },
      isatty: false,
    };
  };
  python.setStdout(attachStream('stdout'));
  python.setStderr(attachStream('stderr'));
  if (python.runPython('1 + 1') !== 2) throw new Error('Python 初始化自检失败。');
  self.postMessage({ type: 'ready', pythonVersion: python.runPython('import sys; sys.version.split()[0]') });
}

const initialization = initialize().catch((error) => {
  self.postMessage({ type: 'init-error', text: error.message || String(error) });
  throw error;
});
// The error is reported above; an explicit catch avoids an unhandled rejection.
initialization.catch(() => {});

self.onmessage = async ({ data }) => {
  if (data.type !== 'execute') return;
  const { runId, cellId, code } = data;
  try {
    await initialization;
  } catch {
    return;
  }
  if (currentRun) {
    self.postMessage({ type: 'done', runId, cellId, ok: false, executionCount, error: 'Python 正在执行另一个单元格。' });
    return;
  }
  currentRun = { runId, cellId };
  streamBytes = 0;
  streamMessages = 0;
  streamTruncated = false;
  executionCount += 1;
  let value;
  try {
    value = await python.runPythonAsync(String(code), { filename: `单元格_${cellId}.py` });
    if (value !== undefined && value !== null) {
      emit('result', String(pythonRepr(value)));
    }
    self.postMessage({ type: 'done', ...currentRun, ok: true, executionCount });
  } catch (error) {
    const text = error.message || String(error);
    emit('error', text);
    self.postMessage({ type: 'done', ...currentRun, ok: false, executionCount, error: text });
  } finally {
    if (value && typeof value.destroy === 'function') value.destroy();
    currentRun = null;
  }
};
