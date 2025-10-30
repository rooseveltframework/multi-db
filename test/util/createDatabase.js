const fs = require('fs')
const isDocker = process.argv.includes('--docker') || false
const path = require('path')
const { spawn } = require('child_process')

module.exports = async (db, suppressLogs, enableVerbose) => {
  const data = JSON.parse(fs.readFileSync(path.normalize('.multi-db-driver-config.json')))

  if (db) data.default = db

  // override default in config
  fs.writeFileSync(path.normalize('.multi-db-driver-config.json'), JSON.stringify(data, null, 2))

  let createDatabaseChildProcess
  if (suppressLogs) createDatabaseChildProcess = isDocker && (db !== 'pglite' && db !== 'sqlite') ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', 'cd multi-db && node cli.js --create --suppress-logs --suppress-errors'], { shell: false }) : spawn('node', ['cli.js', '--create', '--suppress-logs', '--suppress-errors'], { shell: false }) // run node cli.js --create as a child process with suppress-logger flags
  else if (enableVerbose) createDatabaseChildProcess = isDocker && (db !== 'pglite' && db !== 'sqlite') ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', 'cd multi-db && node cli.js --create --enable-verbose'], { shell: false }) : spawn('node', ['cli.js', '--create', '--enable-verbose'], { shell: false }) // run node cli.js --create as a child process
  else createDatabaseChildProcess = isDocker && (db !== 'pglite' && db !== 'sqlite') ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', 'cd multi-db && node cli.js --create'], { shell: false }) : spawn('node', ['cli.js', '--create'], { shell: false }) // run node cli.js --create as a child process
  createDatabaseChildProcess.stdin.setEncoding('utf-8')
  return new Promise((resolve, reject) => {
    let result
    createDatabaseChildProcess.stdout.on('data', (data) => {
      if (data.toString().includes('🤔')) {
        createDatabaseChildProcess.stdin.write('y\n') // answers yes to prompt
        createDatabaseChildProcess.stdin.end()
        createDatabaseChildProcess.stdout.on('data', (data) => {
          if (data.toString().includes('✅') || data.toString().includes('successfully')) {
            result = 'created'
          } else if (data.toString().includes('💀') || data.toString().includes('🎂') || data.toString().includes('Dropping') || data.toString().includes('Creating') || data.toString().includes('connected')) {
            // do nothing, don't resolve promise so that next line is print can trigger an on data event
          } else {
            result = 'not created'
          }
        })
      }
    })
    createDatabaseChildProcess.stderr.on('data', (data) => {
      if (data.toString().includes('🪶') || data.toString().includes('initialize')) {
        // do nothing
      } else {
        resolve('error') // if error return 'error'
      }
    })
    createDatabaseChildProcess.on('exit', () => {
      resolve(result)
    })
  })
}
