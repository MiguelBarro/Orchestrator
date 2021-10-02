// Copyright 2021 Proyectos y Sistemas de Mantenimiento SL (eProsima).
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* Validate the arguments:
    - listening port number
    - username associated with this server
*/

'use strict';

if (process.argv.length != 4) throw "Wrong number of arguments";
if (isNaN(parseInt(process.argv[2]))) throw "The first argument is the listening port number";
if (typeof process.argv[3] != 'string') throw "The second argument is the username";

let cookieSession = require('cookie-session');
var fs = require('fs');
var http = require('http');
var express = require("express");
var RED = require("node-red");

// Create an Express app
var app = express();

// load the settings file to recover the secrets to encode data and session cookies
let global_settings = JSON.parse(fs.readFileSync(__dirname + '/settings/settings.json')); 

// set up the browser cookie session
app.use(cookieSession(global_settings.cookies));

// redirect non authenticated users towards the 
app.use((req, res, next) => {
    // The orchestrator authentication process generates the browser side encrypted cookies
    // that keep the user identity
    console.log(req.session.userId);
    console.log(process.argv[3]);

    if (req.session.userId == process.argv[3])
    {
        // already authenticated go on
        next();
    }
    else
    {
        // request authentication to the orchestrator 
        res.redirect(global_settings.orchestrator_uri);
    }
});

// Create a server
var server = http.createServer(app);

// Create the settings object - see default settings.js file for other options
let settings = {
    // uiPort is ignored because app must relay the traffic
    httpAdminRoot:"/",
    httpNodeRoot: "/red-nodes",
    userDir: __dirname + "/node_red_data/" + process.argv[3],
    credentialSecret: global_settings.node_red_secret
};

// Create the associated directory if doesn't exist yet
fs.mkdirSync(settings.userDir, { recursive: true });

server.listen(process.argv[2], function(){

    // Initialise the runtime with a server and settings
    RED.init(server,settings);

    // Serve the editor UI
    app.use(settings.httpAdminRoot,RED.httpAdmin);

    // Serve the http nodes UI
    app.use(settings.httpNodeRoot,RED.httpNode);

    // Start the runtime
    RED.start();

    // notify success after some time for red-node startup
    setTimeout(function(){
        if (process.send )
            process.send("ok");
    }, 1000);

} );

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    // notify failure
    if (process.send )
        process.send("busy port");
  }
  throw e;
});
