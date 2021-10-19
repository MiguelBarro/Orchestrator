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
const fs = require('fs');
const servers = require('./servers');
const pid = require('./pid');
const max_number = 10; // maximum number of services

function getEphemeralPort() {
    const min = 49152;
    const max = 65535;
    return Math.floor(Math.random() * (max - min) + min);
}

function getDomain() {

    // get domains in use
    let domains = servers.activeDomains();

    // get a new one
    let new_domain = null;
    while (new_domain == null)
    {
        new_domain = Math.floor(Math.random() * 100);
        if (domains.includes(new_domain))
            new_domain = null;
    }
   
    return new_domain;
}

// allocation of new ports
let pending_ports = [];
let pending_domains = [];

function reserveSlot(container, generator)
{
    let p = null;
    while(p == null) 
    {
        // make up one
        p = generator();
        // check if pending
        if ( container.includes(p) )
            p = null;
    }

    container.push(p); 
    return p;
}

function releaseSlot(container, slot)
{
   container = container.filter((p) => {return p != slot;}); 
}

// Port API
function reservePortNumber()
{
    return reserveSlot(pending_ports, getEphemeralPort);
}

function releasePortNumber(port)
{
    releaseSlot(pending_ports, port);
}

// Domain API
function reserveDomain()
{
    return reserveSlot(pending_domains, getDomain);
}

function releaseDomain(d)
{
    releaseSlot(pending_domains, d);
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
                // select a new Domain
                let domain = reserveDomain();
                // select new port
                let port = reservePortNumber();

                let program = path.join(__dirname, '../node_red_client.js');
                program = path.resolve(program);
                let parameters = [ port , username, domain ];
                let options = {                                     
                    stdio: [ 'ignore', 'ignore', 'ignore', 'ipc' ]    
                };                                                   
                
                let child = fork(program, parameters, options); 

                child.on('message', message => {
                    if ( message == 'ok' )
                    {
                        servers.addServer(username, port, child.pid, domain);
                        // redirect to the running instance
                        response.redirect('/node_red_server/' + port);
                        // disconnect the child to avoid 'exit' notification
                        child.disconnect();
                        console.log('Server ' + username + ' launched on port ' + port + ' and domain ' + domain);
                    }
                    else if( message == 'busy port' )
                    { 
                        // retry again
                        serverAllocation(username, response);
                    }

                    releasePortNumber(port);
                    releaseDomain(domain);
                });

                child.on('exit', (code) => {
                    if( child.connected )
                    {
                        // announce failure
                        response.writeHead(500);
                        response.end('Unable to launch a new server: ' + code);
                        releasePortNumber(port);
                        releaseDomain(domain);
                        console.log('Server ' + username + ' failed to be launched on port ' + port + ' and domain ' + domain);
                    }
                });
            }
            else
            {
                response.writeHead(500);
                response.end('All available servers are busy :(');
                console.log('All available servers are busy :(');
            }
        }
        else
        {
            response.writeHead(500);
            response.end('Unexpected error: ' + err.message);
            console.log('Unexpected error: ' + err.message);
        }
    }
}

module.exports.serverCleanup = function(log_file_path){

    try
    {
        // retrieve the log file
        let log_data = fs.readFileSync(log_file_path).toString();

        // Traverse the list of servers checking for activity in the log
        servers.foreach((server) => {
            // Check is this server is active
            let regex = new RegExp('/node_red_server/'+ server.listeningPort + '/');
            if(!regex.test(log_data))
            {
                // not in use: remove the server
                servers.removeServer(server.userName);
                pid.killProcess(server.pId);    
                console.log('Server ' + server.userName + ' removed due lack of activity.');
            }
            
            // travese the whole list
            return false;
        });

        // clear the log file contents
        fs.writeFileSync(log_file_path,"");
    }
    catch(err) { 
        console.log('Failure purging the servers...' + err.message);
    }
}
