// (C) 2015 Internet of Coins / Metasync / Joachim de Koning
// hcmd - simple command line interface for hybridd

// superglobals
timeoutvalue = 15 * 10; // seconds*10
timeoutcnt = 0;

// required libraries in this context
functions = require("./functions");
var fs = require("fs");
var ini = require("./ini");
global.hybridd = ini.parse(fs.readFileSync("../hybridd.conf", "utf-8"));

var http = require("http");
var path = process.argv;
path.shift(); path.shift(); // shift out the first two cmds

var firstpath = path;
options = {
			  "host": global.hybridd.restbind,
			  "port": global.hybridd.restport,
			  path
		  };

var req = http.get(options, function (response) {

    responder(response);

});
req.on("error", function (err) {

    console.log(`Request error: ${err.message}`);

});

function responder (response, wait) {

    if (typeof wait === "undefined") {

        wait = 0;

    }
    // handle the response
    var res_data = "";
    response.on("data", function (chunk) {

        res_data += chunk;

    });
    response.on("end", function () {

        var P = JSON.parse(res_data);
        var cmd_id = P.id;
        var progress = P.progress;
        var stopped = typeof P.stopped !== "undefined" ? P.stopped : null;
        cmd_data = P.data;
        // if we are returned a processID, we fetch that data...
        if (cmd_id == "id") {

            // DEBUG: console.log("[ returning process data for "+cmd_data+" ]");
            setTimeout(function () {

                options.path = `/proc/${cmd_data}`;
                var req = http.get(options, function (response) {

                    responder(response);

                });
                req.on("error", function (err) {

                    console.log(`Request error: ${err.message}`);

                });

            }, 100);

        } else if (wait < 80 && progress != 1 && stopped == null && cmd_id != undefined && [
            "asset","a",
            "source","s",
        ].indexOf(cmd_id.split("/")[0]) === -1 && String(firstpath).substr(1, 1) !== "p" && String(firstpath).substr(1, 1) !== "l") {

            wait++;
            process.stdout.write(".");
            setTimeout(function () {

                var req = http.get(options, function (response) {

                    responder(response, wait);

                });
                req.on("error", function (err) {

                    process.stdout.write("x\n\nSerious error occurred! Please check if hybridd is still running.\n\n");

                });

            }, 200, wait);

        } else {

            process.stdout.write("\n\n");
            console.log(res_data + (wait == 80 ? "\n\n [!] process is unfinished!" : ""));
            process.stdout.write("\n");

        }

    });

}