/*
 * @license
 * Getting Started with Web Serial Codelab (https://todo)
 * Copyright 2019 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */
'use strict';

let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;
var grossRead = 0;
var blnConnected = false;


/**
 * @name connect
 * Opens a Web Serial connection to a micro:bit and sets up the input and
 * output stream.
 */
async function connect() {

    try {

        // CODELAB: Add code to request & open port here.
        // - Request a port and open a connection.
        port = await navigator.serial.requestPort();
        // - Wait for the port to open.
        await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none", flowControl:"none" });

        // CODELAB: Add code setup the output stream here.

        // CODELAB: Send CTRL-C and turn off echo on REPL
        //writeToStream('IP');

        // CODELAB: Add code to read the stream here.
        let decoder = new TextDecoderStream();        
        inputDone = port.readable.pipeTo(decoder.writable);
        inputStream = decoder.readable;

        reader = inputStream.pipeThrough(new TransformStream(new LineBreakTransformer())).getReader();
        readLoop();       

    }
    catch (err) {
        blnConnected = false;
        grossRead = 0;
        console.log("Connect error.");
    }    

}

function readAllChunks(readableStream) {
    const reader = readableStream.getReader();  
    return pump();
    function pump() {
        return reader.read().then(({ value, done }) => {
            if (done) {
                return chunks;
            }

            chunks.push(value);
            return pump();
        });
    }
}


/**
 * @name disconnect
 * Closes the Web Serial connection.
 */
async function disconnect() {

    try {


        // CODELAB: Close the input stream (reader).
        if (reader) {
            await reader.cancel();
            await inputDone.catch(() => { });
            reader = null;
            inputDone = null;
        }

        // CODELAB: Close the output stream.
        if (outputStream) {
            await outputStream.getWriter().close();
            await outputDone;
            outputStream = null;
            outputDone = null;
        }

        // CODELAB: Close the port.
        await port.close();
        port = null;

    }
    catch (err) {
        blnConnected = false
        grossRead = 0;

        alertify.alert("<i class='fas fa-info-circle fa-2x text-success'></i>&nbsp;&nbsp;&nbsp;Error communicating with port. Please refresh page.")
        .setHeader('<strong>INFORMATION MESSAGE </strong> ')        
        .set({ transition: 'zoom' });
        console.log("Disconnect error.");
    }

}


/**
 * @name clickConnect
 * Click handler for the connect/disconnect button.
 */
async function clickConnect() {

    try {
        // CODELAB: Add disconnect code here.
        if (port) {
            await disconnect();
            toggleUIConnected(false);
            return;
        }

        // CODELAB: Add connect code here.
        await connect();


        toggleUIConnected(true);
    }
    catch (err) {
        blnConnected = false
        grossRead = 0;
        console.log("clickConnect error.");

    }

    
}


/**
 * @name readLoop
 * Reads data from the input stream and displays it on screen.
 */
async function readLoop() {

    try {        
        
        
        // CODELAB: Add read loop here.
        while (true) {
            
            const { value, done } = await reader.read();
            
            if (done) {
                console.log('[readLoop] DONE', done);             
                grossRead = 0;
                reader.releaseLock();
                break;
            }            

            if (value) {
                //log.textContent += value + '\n';
                if (value.trim() == "") {

                }
                else {        
                    grossRead = value.trim().replace(/\n/g, "").replace(/\?/g, "").replace(/KGM/gi, "").replace(/KG/gi, "").replace(/K/gi, "").replace(/G/gi, "").replace(/M/gi, "").replace(/L/gi, "");
                    //console.log(value.trim());

                }

            }
            
        }
       

    }
    catch (err) {
        blnConnected = false
        grossRead = 0;
        console.log("read loop error");
    }

    

}


/**
 * @name writeToStream
 * Gets a writer from the output stream and send the lines to the micro:bit.
 * @param  {...string} lines lines to send to the micro:bit
 */
async function writeToStream(lines) {

    try {

        

        // CODELAB: Write to output stream 

        var a = lines.split('');
        var result = a.map(function (x) {
            return x.charCodeAt(0);
        });

        result.push(13)
        result.push(10)

        const writer = port.writable.getWriter();

        const data = new Uint8Array(result); // hello
        await writer.write(data);

        // Allow the serial port to be closed later.
        writer.releaseLock();

    }
    catch (err) {
        blnConnected = false
        grossRead = 0;
        console.log("write stream error");
    }

    

}


function toggleUIConnected(connected) {

    try {
        let lbl = 'Connect';
        if (connected) {
            lbl = 'Disconnect';

        }
        else {
            grossRead = 0;
        }
        blnConnected = connected;

    }
    catch (err) {
        blnConnected = false
        grossRead = 0;
        console.log("toggleUIConnected error");
    }
   
}

class LineBreakTransformer {
    constructor() {
        // A container for holding stream data until a new line.
        this.chunks = "";
    }

    transform(chunk, controller) {
        // Append new chunks to existing chunks.
        this.chunks += chunk;
        // For each line breaks in chunks, send the parsed lines out.
        const lines = this.chunks.split("\r\n");
        this.chunks = lines.pop();
        lines.forEach((line) => controller.enqueue(line));
    }

    flush(controller) {
        // When the stream is closed, flush any remaining chunks out.
        controller.enqueue(this.chunks);
    }
}







