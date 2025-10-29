const fs = require('fs')
const isDocker = process.argv.includes('--docker') || false
const path = require('path')
const { spawn } = require('child_process')

module.exports = async (db, schemaPath, bypassDocker) => {
  const data = JSON.parse(fs.readFileSync(path.normalize('.multi-db-driver-config.json')))

  if (db) data.default = db

  // override default in config
  fs.writeFileSync(path.normalize('.multi-db-driver-config.json'), JSON.stringify(data, null, 2))

  const executeDumpDataChildProcess = isDocker && !bypassDocker ? spawn('docker', ['exec', '-i', `${db}-multidb-tests`, 'bin/bash', '-c', `cd multi-db && node cli.js --dump-data ${schemaPath}`], { shell: false }) : spawn('node', ['cli.js', '--dump-data', schemaPath], { shell: false }) // run node cli.js --dump-schema schemaPath as a child process
  executeDumpDataChildProcess.stdin.setEncoding('utf-8')
  return new Promise((resolve, reject) => {
    executeDumpDataChildProcess.stdout.on('data', (data) => {
      if (data.toString().includes('🤔')) {
        executeDumpDataChildProcess.stdin.write('y\n') // answers yes to prompt
        executeDumpDataChildProcess.stdin.end()
        executeDumpDataChildProcess.stdout.on('data', (data) => {
          if (data.toString().includes('✅') || data.toString().includes('successfully')) {
            resolve('executed')
          } else {
            resolve('not executed')
          }
        })
      }
    })
    executeDumpDataChildProcess.stderr.on('data', (data) => {
      if (data.toString().includes('[Warning]') || data.toString().includes('🪶') || data.toString().includes('initialize')) {
        // do nothing
      } else {
        resolve('error') // if error return 'error'
      }
    })
  })
}
