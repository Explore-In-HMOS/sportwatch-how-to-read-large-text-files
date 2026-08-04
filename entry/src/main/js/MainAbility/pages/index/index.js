import { writeDemoFile, readDemoFileDirect, readDemoFileChunked } from '../../FileService';

export default {
    data: {
        status: 'Ready',
        directResult: '-',
        directBench: '-',
        chunkedResult: '-'
    },
    onInit() {
        console.info('Application onInit()');
    },

    prepareDemoFile() {
        this.status = 'Preparing File...';

        writeDemoFile((ok)=> {
            this.status = ok ? 'Demo File Ready' : 'Write Failed';
        })
    },

    readDirect() {
        this.status = 'Direct Reading...';

        readDemoFileDirect((res) => {
            this.status = res.ok ? 'Direct Read OK' : 'Direct Read Incomplete';
            this.directResult = `${res.length} chars / ${res.durationMs} ms`;
            this.directBench = `${res.durationMs} ms`;
        });
    },

    readChunked() {
        this.status = 'Chunked reading...';

        readDemoFileChunked((res) => {
            this.status = res.ok ? 'Chunked read OK' : 'Chunked read failed';
            this.chunkedResult = `${res.length} chars / ${res.durationMs} ms`;
        });
    }
};