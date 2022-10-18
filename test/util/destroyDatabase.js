const fs = require('fs')
const isDocker = process.argv.includes('--docker') || false
const path = require('path')
const { spawn } = require('child_process')

// function that destroys database using CLI script
module.exports = async (db, suppressLogs, enableVerbose) => {
  const data = JSON.parse(fs.readFileSync(path.normalize('.multi-db-config.json')))

  if (db) data.default = db

  // override default in config
  if (db) fs.writeFileSync(path.normalize('.multi-db-config.json'), JSON.stringify(data, null, 2))

  let destroyDatabaseChildProcess
  if (suppressLogs) destroyDatabaseChildProcess = isDocker && (db !== 'pglite' && db !== 'sqlite') ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', 'cd multi-db && node cli.js --destroy --suppress-logs --suppress-errors'], { shell: false }) : spawn('node', ['cli.js', '--destroy', '--suppress-logs', '--suppress-errors'], { shell: false }) // run node cli.js --destroy as a child process with suppress-logger flags
  else if (enableVerbose) destroyDatabaseChildProcess = isDocker && (db !== 'pglite' && db !== 'sqlite') ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', 'cd multi-db && node cli.js --destroy --enable-verbose'], { shell: false }) : spawn('node', ['cli.js', '--destroy', '--enable-verbose'], { shell: false }) // run node cli.js --destroy as a child process
  else destroyDatabaseChildProcess = isDocker && (db !== 'pglite' && db !== 'sqlite') ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', 'cd multi-db && node cli.js --destroy'], { shell: false }) : spawn('node', ['cli.js', '--destroy'], { shell: false }) // run node cli.js --destroy as a child process
  destroyDatabaseChildProcess.stdin.setEncoding('utf-8')
  return new Promise((resolve, reject) => {
    let droppedDatabase
    destroyDatabaseChildProcess.stdout.on('data', (data) => {
      if (data.toString().includes('🤔')) {
        destroyDatabaseChildProcess.stdin.write('y\n') // answers yes to prompt
        destroyDatabaseChildProcess.stdin.end()
        destroyDatabaseChildProcess.stdout.on('data', (data) => {
          if (data.toString().includes('💀') || data.toString().includes('Dropping')) {
            const splitDroppedData = data.toString().split(' ')
            droppedDatabase = db === 'pglite' || db === 'sqlite' ? splitDroppedData[3] : splitDroppedData[6]
          }
        })
      }
    })
    destroyDatabaseChildProcess.stderr.on('data', (data) => {
      if (data.toString().includes('🪶') || data.toString().includes('initialize')) {
        // do nothing
      } else {
        resolve('error') // if error return 'error'
      }
    })
    destroyDatabaseChildProcess.on('exit', () => {
      resolve(droppedDatabase)
    })
  })
}
