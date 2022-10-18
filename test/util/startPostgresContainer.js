const path = require('path')
const { spawnSync } = require('child_process')

module.exports = async () => {
  const multiDbPath = path.join(__dirname, '../..')

  spawnSync('docker', ['run', '--name', 'postgres-multidb-tests', '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_PASSWORD=postgres', '-p', '5442:5432', '-v', `${multiDbPath}:/multi-db`, '-d', 'postgres:14.6'], { shell: false })

  return new Promise((resolve, reject) => {
    const check = async (retry = 0) => {
      if (retry > 20) process.exit(1)
      const checkPostgresContainerStatus = spawnSync('docker', ['exec', '-i', 'postgres-multidb-tests', 'bin/bash', '-c', 'pg_isready -U postgres'], { shell: false })
      if (checkPostgresContainerStatus.stdout.toString().includes('accepting connections')) {
        const installNode = spawnSync('docker', ['exec', '-i', 'postgres-multidb-tests', 'bin/bash', '-c', 'apt-get update && apt-get install curl -y && curl -sL https://deb.nodesource.com/setup_21.x | bash && apt-get install nodejs -y'], { shell: false })
        if (installNode.stdout.toString().includes('Processing triggers for libc-bin')) resolve('PostgreSQL container started.')
      } else setTimeout(() => check(retry + 1), 5000)
    }
    check()
  })
}
