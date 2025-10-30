const fs = require('fs')
const isDocker = process.argv.includes('--docker') || false
const path = require('path')
const { spawn } = require('child_process')

module.exports = async (db, file, suppressLogs, enableVerbose) => {
  const data = JSON.parse(fs.readFileSync(path.normalize('.multi-db-driver-config.json')))

  if (db) data.default = db

  // override default in config
  fs.writeFileSync(path.normalize('.multi-db-driver-config.json'), JSON.stringify(data, null, 2))

  let executeSqlFileChildProcess
  if (suppressLogs) executeSqlFileChildProcess = isDocker && (db !== 'pglite' && db !== 'sqlite') ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', `cd multi-db && node cli.js --file' ${file} --suppress-logs --suppress-errors`], { shell: false }) : spawn('node', ['cli.js', '--file', file, '--suppress-logs', '--suppress-errors'], { shell: false }) // run node cli.js --file ./test/db/file.sql as a child process with suppress-logger flags
  else if (enableVerbose) executeSqlFileChildProcess = isDocker && (db !== 'pglite' && db !== 'sqlite') ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', `cd multi-db && node cli.js --file ${file} --enable-verbose`], { shell: false }) : spawn('node', ['cli.js', '--file', file, '--enable-verbose'], { shell: false }) // run node cli.js --file ./test/db/file.sql as a child process
  else executeSqlFileChildProcess = isDocker && (db !== 'pglite' && db !== 'sqlite') ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', `cd multi-db && node cli.js --file ${file}`], { shell: false }) : spawn('node', ['cli.js', '--file', file], { shell: false }) // run node cli.js --file ./test/db/file.sql as a child process
  executeSqlFileChildProcess.stdin.setEncoding('utf-8')
  return new Promise((resolve, reject) => {
    executeSqlFileChildProcess.stdout.on('data', (data) => {
      if (data.toString().includes('🤔')) {
        executeSqlFileChildProcess.stdin.write('y\n') // answers yes to prompt
        executeSqlFileChildProcess.stdin.end()
        executeSqlFileChildProcess.stdout.on('data', (data) => {
          if (data.toString().includes('✅') || data.toString().includes('successfully')) {
            resolve('executed')
          } else if (data.toString().includes('🏃')) {
            // do nothing, don't resolve promise so that next line is print can trigger an on data event
          } else {
            resolve('not executed')
          }
        })
      }
    })
    executeSqlFileChildProcess.stderr.on('data', (data) => {
      if (data.toString().includes('⚠️') || data.toString().includes('wrong database') || data.toString().includes('🪶') || data.toString().includes('initialize')) {
        // do nothing
      } else {
        resolve('error') // if error return 'error'
      }
    })
  })
}
