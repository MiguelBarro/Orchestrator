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

'use strict';

let fs = require('fs');
let cookieSession = require('cookie-session');
let ClientOAuth2 = require('client-oauth2');
let express = require('express');
let bodyParser = require('body-parser');
const request = require('request');
const handler = require('./utils/server_manager');
let app = express();

const port = process.env.PORT || 11811;

// load from a json file the authorization config and cookie settings
let settings = JSON.parse(fs.readFileSync(__dirname + '/settings/settings.json')); 

// set up the authorization client
let githubAuth = new ClientOAuth2(settings.authorization);

// set up the browser cookie session
app.use(cookieSession(settings.cookies));

// user endpoint
app.get('/', function (req, res) {

    if (req.session.userId)
    {
        // already authenticated
        handler.serverAllocation(req.session.userId, res); 
    }
    else
    {
        // request authentication 
        var uri = githubAuth.code.getUri();
        res.redirect(uri);
    }
});

// token redirection
app.get('/auth/callback', function (req, res) {

  githubAuth.code.getToken(req.originalUrl)
    .then(function (token) {

        //TODO: This code must be udpated to match RAMP specific APIs
        let options = token.sign({
            method: 'GET',
            uri: settings.resource_api
        });

        request(options, (error, response, body) => {
              if (!error && response.statusCode == 200) {
                const info = JSON.parse(body);
                req.session.userId = info.userId;
                res.redirect('/');
              }
        });
    });
});

// periodical server clean up
setInterval(
    handler.serverCleanup,
    15*60*1000,
    settings.log_file_path
    );

app.listen(port);
