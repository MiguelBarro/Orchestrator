'use strict';

let fs = require('fs');
let cookieSession = require('cookie-session');
let ClientOAuth2 = require('client-oauth2');
let express = require('express');
let bodyParser = require('body-parser');
const request = require('request');
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
        res.send("The current user is: " + req.session.userId);
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

app.listen(port);
