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
        chp.execSync('(Stop-Process -Id ' + pid + ' -ErrorAction SilentlyContinue)');
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
        chp.execSync('if [ $(ps h -p ' + pid + ' | wc -l) == 1 ]; then kill -9 ' + pid + '; fi', {shell: '/bin/bash'});
    }
}
