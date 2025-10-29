const fs = require('fs')
const isDocker = process.argv.includes('--docker') || false
const path = require('path')
const { spawnSync } = require('child_process')

module.exports = () => {
  if (isDocker) {
    spawnSync('docker', ['rm', '-f', '-v', 'mariadb-multidb-tests'], { shell: false }) // remove docker mariadb container
    spawnSync('docker', ['rm', '-f', '-v', 'mysql-multidb-tests'], { shell: false }) // remove docker mysql container
    spawnSync('docker', ['rm', '-f', '-v', 'postgres-multidb-tests'], { shell: false }) // remove docker postgres container
    spawnSync('docker', ['rm', '-f', '-v', 'sqlite-multidb-tests'], { shell: false }) // remove docker sqlite container
  }
  if (fs.existsSync(path.normalize(path.join(__dirname, '../configs')))) fs.rmSync(path.normalize(path.join(__dirname, '../configs')), { recursive: true, force: true }) // delete config test folder and config files
  if (fs.existsSync(path.normalize(path.join(__dirname, '../db')))) fs.rmSync(path.normalize(path.join(__dirname, '../db')), { recursive: true, force: true }) // delete db test folder and SQL files
  if (fs.existsSync(path.normalize(path.join(__dirname, '../nested-multi-db')))) fs.rmSync(path.normalize(path.join(__dirname, '../nested-multi-db')), { recursive: true, force: true }) // delete nested test folders and nested config
  if (fs.existsSync(path.normalize(path.join(__dirname, '../pglite-db')))) fs.rmSync(path.normalize(path.join(__dirname, '../pglite-db')), { recursive: true, force: true, maxRetries: 10 }) // delete pglite-db folder
  if (fs.existsSync(path.normalize(path.join(__dirname, '../sqlite-db')))) fs.rmSync(path.normalize(path.join(__dirname, '../sqlite-db')), { recursive: true, force: true, maxRetries: 10 }) // delete SQLite test database and sqlite-db folder
  if (fs.existsSync(path.normalize(path.join(__dirname, '../../.multi-db-driver-config.json')))) fs.unlinkSync(path.normalize(path.join(__dirname, '../../.multi-db-driver-config.json'))) // delete .multi-db-driver-config.json
}
