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

const chp = require('child_process');
const os = require('os');

if( os.platform() == 'win32')
{
    process.env.ComSpec = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'

    module.exports.isRunning = function IsRunning(pid)
    {
        return 1 == chp.execSync('(Get-Process -Id ' + pid + ' -ErrorAction SilentlyContinue).Count', {encoding: 'utf8'}); 
    }

    module.exports.killProcess = function killProcess(pid)
    {
        // it kills all the descendants too
        chp.execSync('(Stop-Process -Id ' + pid + 
            ' -ErrorAction SilentlyContinue); Get-Process | select -ExpandProperty Parent | Get-Process | ? Id -like ' +
            pid + ' | Stop-Process');
    }
}
else
{
    module.exports.isRunning = function IsRunning(pid)
    {
        return 1 == chp.execSync('ps h -p ' + pid + ' | wc -l');
    }

    module.exports.killProcess = function killProcess(pid)
    {
        // it kills all the descendants too
        chp.execSync('if [ $(ps h --pid ' + pid + ' --ppid ' + pid + ' | wc -l) >= 1 ]; then kill -9 $(ps h --pid ' + pid + ' --ppid ' + pid + ' -o pid); fi',
            {shell: '/bin/bash'});
    }
}
