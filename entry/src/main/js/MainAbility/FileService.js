import file from '@system.file';

const DEMO_DIR = 'internal://app/demo';
const DEMO_FILE_PATH = 'internal://app/demo/demo.txt'

const TEST_SIZE = 50_000;

const WRITE_CHUNK_SIZE = 50_000;
const WRITE_DELAY_MS = 5;

const READ_CHUNK_SIZE = 4096;
const READ_DELAY_MS = 5;

function safeCallback(callback, value) {
    if (typeof callback === 'function') {
        callback(value);
    }
}

export function ensureDemoDir(callback) {
    file.mkdir({
        uri: DEMO_DIR,

        success: () => {
            console.info('[FileService] demo directory created');
            safeCallback(callback, true);
        },

        fail: (data, code) => {
            console.error('[FileService] demo directory already exists or mkdir failed');
            console.error(`[FileService] mkdir code=${code} data=${data}`);

            safeCallback(callback, true);
        }
    });
}

export function createDemoText() {
    let text = '';

    while (text.length < TEST_SIZE) {
        text += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    }

    return text.substring(0, TEST_SIZE);
}

let writeDemoContext = {
    demoText: '',
    position: 0,
    writeCount: 0,
    startMs: 0,
    callback: null,
    lastChunkLength: 0
};

export function writeDemoFile(callback) {
    writeDemoContext.demoText = createDemoText();
    writeDemoContext.position = 0;
    writeDemoContext.writeCount = 0;
    writeDemoContext.startMs = Date.now();
    writeDemoContext.callback = callback;
    writeDemoContext.lastChunkLength = 0;

    ensureDemoDir(onDemoDirReadyForWrite);
}

function onDemoDirReadyForWrite() {
    file.delete({
        uri: DEMO_FILE_PATH,
        success: onOldDemoFileDeleted,
        fail: onOldDemoFileNotFound
    });
}

function onOldDemoFileDeleted() {
    console.info('[FileService] old demo file deleted');
    setTimeout(writeNextDemoChunk, WRITE_DELAY_MS);
}

function onOldDemoFileNotFound() {
    console.info('[FileService] old demo file not found, writing new file');
    setTimeout(writeNextDemoChunk, WRITE_DELAY_MS);
}

function writeNextDemoChunk() {
    if (writeDemoContext.position >= writeDemoContext.demoText.length) {
        finishWriteDemoFile(true, 'done');
        return;
    }

    const chunk = writeDemoContext.demoText.substring(
        writeDemoContext.position,
        writeDemoContext.position + WRITE_CHUNK_SIZE
    );

    writeDemoContext.lastChunkLength = chunk.length;

    file.writeText({
        uri: DEMO_FILE_PATH,
        text: chunk,
        append: writeDemoContext.position !== 0,
        success: onWriteDemoChunkSuccess,
        fail: onWriteDemoChunkFail
    });
}

function onWriteDemoChunkSuccess() {
    writeDemoContext.position += writeDemoContext.lastChunkLength;
    writeDemoContext.writeCount++;

    console.info(
        `[FileService] write demo chunk | count=${writeDemoContext.writeCount} | position=${writeDemoContext.position} | chunkLen=${writeDemoContext.lastChunkLength}`
    );

    setTimeout(writeNextDemoChunk, WRITE_DELAY_MS);
}

function onWriteDemoChunkFail(data, code) {
    console.error(
        `[FileService] write demo failed | code=${code} | data=${data}`
    );

    finishWriteDemoFile(false, 'write_failed');
}

function finishWriteDemoFile(ok, reason) {
    const durationMs = Date.now() - writeDemoContext.startMs;

    console.info(
        `[FileService] write demo file finished | ok=${ok} | reason=${reason} | expectedLen=${TEST_SIZE} | actualLen=${writeDemoContext.demoText.length} | writeCount=${writeDemoContext.writeCount} | durationMs=${durationMs}`
    );

    safeCallback(writeDemoContext.callback, ok);

    writeDemoContext.callback = null;
    writeDemoContext.demoText = '';
    writeDemoContext.position = 0;
    writeDemoContext.writeCount = 0;
    writeDemoContext.lastChunkLength = 0;
}

export function readDemoFileDirect(callback) {
    const startMs = Date.now();

    console.info('[FileService] direct read demo started');
    file.readText({
        uri: DEMO_FILE_PATH,

        success: (res) => {
            const text = res && res.text ? res.text : '';
            const durationMs = Date.now() - startMs;
            const ok = text.length === TEST_SIZE;

            console.info(
                `[FileService] direct read demo finished | expectedLen=${TEST_SIZE} | actualLen=${text.length}
                | ok=${ok} | durationMs=${durationMs}`
            );

            if (!ok) {
                console.info('[FileService] direct read incomplete');
            }

            safeCallback(callback, {
                ok: ok,
                length: text.length,
                durationMs: durationMs
            });
        },

        fail: (data, code) => {
            const durationMs = Date.now() - startMs;

            console.info(
                `[FileService] direct read demo failed | code=${code} | data=${data}
                | durationMs=${durationMs}`
            );

            safeCallback(callback, {
                ok: false,
                length: 0,
                durationMs: durationMs
            });
        }
    });
}

let chunkedReadContext = {
    position: 0,
    readCount: 0,
    result: '',
    startMs: 0,
    callback: null
};

export function readDemoFileChunked(callback) {
    chunkedReadContext.position = 0;
    chunkedReadContext.readCount = 0;
    chunkedReadContext.result = '';
    chunkedReadContext.startMs = Date.now();
    chunkedReadContext.callback = callback;

    console.info(
        `[FileService] chunked read demo started | chunkSize=${READ_CHUNK_SIZE} | delay=${READ_DELAY_MS}`
    );

    readNextDemoChunk(chunkedReadContext.position);
}

function readNextDemoChunk(position) {
    file.readText({
        uri: DEMO_FILE_PATH,
        length: READ_CHUNK_SIZE,
        position: position,

        success: onReadDemoChunkSuccess,
        fail: onReadDemoChunkFail
    });
}

function onReadDemoChunkSuccess(res) {
    const text = res && res.text ? res.text : '';

    console.info(
        `[FileService] read demo chunk | count=${chunkedReadContext.readCount + 1} | position=${chunkedReadContext.position} | chunkLen=${text.length}`
    );

    if (!text || text.length === 0) {
        finishChunkedRead('success_empty', '', '');
        return;
    }

    chunkedReadContext.result += text;
    chunkedReadContext.readCount++;

    if (text.length < READ_CHUNK_SIZE) {
        finishChunkedRead('last_chunk', '', '');
        return;
    }

    chunkedReadContext.position += READ_CHUNK_SIZE;

    readNextDemoChunk(chunkedReadContext.position);
}

function onReadDemoChunkFail(data, code) {
    finishChunkedRead('fail_or_eof', code, data);
}

function finishChunkedRead(reason, code, data) {
    const durationMs = Date.now() - chunkedReadContext.startMs;
    const actualLen = chunkedReadContext.result.length;
    const ok = actualLen === TEST_SIZE;

    console.info(
        `[FileService] chunked read demo finished | reason=${reason} | expectedLen=${TEST_SIZE} | actualLen=${actualLen} | ok=${ok} | readCount=${chunkedReadContext.readCount} | position=${chunkedReadContext.position} | durationMs=${durationMs} | code=${code || ''} | data=${data || ''}`
    );

    if (!ok) {
        console.info('[FileService] chunked read length mismatch');
    }

    safeCallback(chunkedReadContext.callback, {
        ok: ok,
        length: actualLen,
        durationMs: durationMs
    });

    chunkedReadContext.callback = null;
}