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

const path = require('path')
const JSONBackup = require('./json-backup');
const state_dir = path.join(__dirname, "../node_red_data");
let JB = new JSONBackup(path.join(state_dir, "servers.json"));

/*
 * Server format:
const servers = [
  { userName: 'Guybrush', listeningPort: 1880, pId: 4536 },
];
*/

module.exports.addServer = (usrnm, port, pid) => {
    // data enough
    if(!usrnm || isNaN(parseInt(port)) || isNaN(parseInt(pid)))
    {
        throw new Error('Insufficient server data')
    }

    // avoid duplicities
    if(JB.find_element((x) => { return x.userName == usrnm
                                    || x.listeningPort == port
                                    || x.pId == pid;}))
    {
        throw new Error('There is already a user registered with ' + usrnm + ' name.')
    }

    // add the server
    JB.add_element({ userName: usrnm, listeningPort: port, pId: pid});
}

module.exports.removeServer = (usrnm) => {

    let id = JB.find_element((x) => { return x.username == usrnm;});

    if (id)
    {
        JB.remove_element(id);
    }
    else
    {
        throw new Error('Server Not Found');
    }
}

module.exports.findById = (id, done) => {

    try {
        return JB.get_element(id,done);      
    } catch (err) {
        return done(new Error('Server Not Found'));
    }

};

module.exports.returnNextId = (id) => {
    return JB.next_id(id);
};

module.exports.findByUserName = (username, done) => {

    let id = JB.find_element((x) => { return x.userName == username;});

    if (done == null)
    { // if not functor is provided return id
       return id; 
    }
    else if (id)
    {
        return JB.get_element(id, done);
    }

    return done(new Error('Server Not Found'));
};

module.exports.activeServices = () => {
    let count = 0;
    let id = JB.next_id(null);

    while(id != null)
    {
        ++count;
        id = JB.next_id(id);
    }

    return count;
};
