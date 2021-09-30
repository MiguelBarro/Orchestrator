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

const fork = require('child_process').fork; 
const path = require('path'); 
const servers = require('./servers');
const pid = require('./pid');
const max_number = 10; // maximum number of services

function getEphemeralPort() {
    const min = 49152;
    const max = 65535;
    return Math.floor(Math.random() * (max - min) + min);
}

// allocation of new ports
let pending_ports = [];

function reservePortNumber()
{
    let port = null;
    while(port == null) 
    {
        // make up one
        port = getEphemeralPort();
        // check if pending
        if ( port in pending_ports )
            port = null;
    }

    pending_ports.push(port); 
    return port;
}

function releasePortNumber(port)
{
   pending_ports = pending_ports.filter((p) => {return p != port;}); 
}

// server request management
module.exports.serverAllocation = function serverAllocation(username, response)
{
    try
    {
        // Check if a server is running associated to the request user
        servers.findByUserName(username, function(err, server) {

            if (err != null)
                throw err;
                
            if ( pid.isRunning( server.pId ) )    
            {
                // redirect to the running instance
                response.redirect('/node_red_server/' + server.listeningPort );
            }
            else
            {
                // remove the entry
                servers.removeServer(username);
                throw new Error('Server Not Found')
            }
        });
    }
    catch(err)
    {
        if ( err.message == 'Server Not Found' )
        {
            // Decide if launching a server
            if( servers.activeServices() < max_number )
            {
                let program = path.join(__dirname, '../node_red_client.js');
                program = path.resolve(program);
                let port = reservePortNumber();
                let parameters = [ port , username ];
                let options = {                                     
                    stdio: [ 'ignore', 'ignore', 'ignore', 'ipc' ]    
                };                                                   
                
                let child = fork(program, parameters, options); 

                child.on('message', message => {
                    if ( message == 'ok' )
                    {
                        servers.addServer(username, port, child.pid);
                        // redirect to the running instance
                        response.redirect('/node_red_server/' + port);
                    }
                    else if( message == 'busy port' )
                    { 
                        // retry again
                        serverAllocation(username, response);
                    }

                    releasePortNumber(port);
                });

                child.on('exit', (code) => {
                    // announce failure
                    response.writeHead(500);
                    response.end('Unable to launch a new server: ' + code);
                    releasePortNumber(port);
                });
            }
            else
            {
                response.writeHead(500);
                response.end('All available servers are busy :(');
            }
        }
        else
        {
            response.writeHead(500);
            response.end('Unexpected error: ' + err.message);
        }
    }
}
