const path = require('path')
const { spawnSync } = require('child_process')

module.exports = async () => {
  const multiDbPath = path.join(__dirname, '../..')

  spawnSync('docker', ['run', '--name', 'sqlite-multidb-tests', '-v', `${multiDbPath}:/multi-db`, '-d', 'debian:bookworm-slim', 'tail', '-f', '/dev/null'], { shell: false })

  return new Promise((resolve, reject) => {
    const check = async (retry = 0) => {
      if (retry > 20) process.exit(1)
      const checkSqliteContainerStatus = spawnSync('docker', ['exec', '-i', 'sqlite-multidb-tests', 'bin/bash', '-c', 'ls'], { shell: false })
      if (checkSqliteContainerStatus.stdout) {
        const installNodeAndSqlite = spawnSync('docker', ['exec', '-i', 'sqlite-multidb-tests', 'bin/bash', '-c', 'apt-get update && apt-get install curl -y && apt-get install sqlite3 -y && curl -sL https://deb.nodesource.com/setup_21.x | bash && apt-get install nodejs -y'], { shell: false })
        if (installNodeAndSqlite.stdout.toString().includes('Processing triggers for libc-bin')) resolve('SQLite container started.')
      } else setTimeout(() => check(retry + 1), 5000)
    }
    check()
  })
}
