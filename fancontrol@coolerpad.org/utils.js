const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

var readFile = (file) => {
    return new Promise((resolve, reject) => {
        file.load_contents_async(
            null,
            (file_, result) => {
                try {
                    resolve(file.load_contents_finish(result));
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

var writeFile = (file, content) => {
    return new Promise((resolve, reject) => {
        file.replace_contents_bytes_async(
            new GLib.Bytes(content),
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
            (file_, result) => {
                try {
                    resolve(file.replace_contents_finish(result));
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

var validateJSON = (body) => {
    try {
    if(body instanceof Uint8Array) {
        body = ByteArray.toString(body);
    }
    const json = JSON.parse(body); 
    return json;
    } catch(error) {
        return null;
    }
}


var setTimeout = (func, delay, ...args) => {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
        func(...args);
        return GLib.SOURCE_REMOVE;
    });
};


var readOutput = (stream, lineBuffer) => {
    stream.read_line_async(0, null, (stream, res) => {
        try {
            let line = stream.read_line_finish_utf8(res)[0];

            if (line !== null) {
                lineBuffer.push(line);
                readOutput(stream, lineBuffer);
            }
        } catch (e) {
            logError(`_readOutput error: ${e}`);
        }
    });
}

var runCommandAsync = (commandArray = [], workingDirectory = null, scriptName = null ) => {
    return new Promise((resolve, reject) => {
        try {
            if (scriptName) {
                commandArray = [`./${scriptName}`];
            }

            const [, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
                // Working directory, passing %null to use the parent's
                workingDirectory,
                // An array of arguments
                commandArray,
                // Process ENV, passing %null to use the parent's
                null,
                // Flags; we need to use PATH so `ls` can be found and also need to know
                // when the process has finished to check the output and status.
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                // Child setup function
                null
            );

            // Any unsused streams still have to be closed explicitly, otherwise the
            // file descriptors may be left open
            GLib.close(stdin);

            // Okay, now let's get output stream for `stdout`
            let stdoutStream = new Gio.DataInputStream({
                base_stream: new Gio.UnixInputStream({
                    fd: stdout,
                    close_fd: true
                }),
                close_base_stream: true
            });

            // We'll read the output asynchronously to avoid blocking the main thread
            let stdoutLines = [];
            readOutput(stdoutStream, stdoutLines);

            let stderrStream = new Gio.DataInputStream({
                base_stream: new Gio.UnixInputStream({
                    fd: stderr,
                    close_fd: true
                }),
                close_base_stream: true
            });

            let stderrLines = [];
            readOutput(stderrStream, stderrLines);

            // Watch for the process to finish, being sure to set a lower priority than
            // we set for the read loop, so we get all the output
            GLib.child_watch_add(GLib.PRIORITY_DEFAULT_IDLE, pid, (pid, status) => {
                let result;
                if (status === 0) {
                    result = stdoutLines.join('\n');
                    // log(`Completed _runCommandAsync`);
                    resolve(result);
                } else {
                    result = stderrLines.join('\n');
                    // logError(`Failed _runCommandAsync`);
                    reject(result);
                }

                // Ensure we close the remaining streams and process
                stdoutStream.close(null);
                stderrStream.close(null);
                GLib.spawn_close_pid(pid);
            });

        } catch (error) {
            reject(error);
        }
    });
}

var checkSubstringInString = (substring, string) => {
    try {
        const parent = String(string)
          .toLowerCase();
        const child = String(substring)
          .toLowerCase();
          
        return parent.includes(child);  
    } catch (error) {
        return false;
    }
}

var defaultValues = {
        update_time: 5,
        fan_speed_threshold: 3000,
        gpu_temperature_threshold: 55,
        usb_hub: "1-5.4.2",
        usb_port: 3,
        default_state: "off",
        usb_options: {
            on: "On",
            off: "Off",
            auto: "Auto"
        }
    }

