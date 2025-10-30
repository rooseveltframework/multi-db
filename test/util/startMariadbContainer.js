const path = require('path')
const { spawnSync } = require('child_process')

module.exports = async () => {
  const multiDbPath = path.join(__dirname, '../..')

  spawnSync('docker', ['run', '--name', 'mariadb-multidb-tests', '-e', 'MYSQL_ROOT_PASSWORD=password', '-e', 'MULTI_DB_DRIVER_CONFIG_LOCATION=./test/configs/.mariadb-config.json', '-e', 'MYSQL_USER=mariadb_multi_db_tests_user', '-e', 'MYSQL_PASSWORD=mariadb_multi_db_tests_password', '-e', 'MYSQL_DATABASE=mariadb_multi_db_tests_database', '-p', '3317:3306', '-v', `${multiDbPath}:/multi-db`, '-v', `${multiDbPath}/coverage:/multi-db/coverage`, '-d', 'mariadb:10.5'], { shell: false })

  return new Promise((resolve, reject) => {
    const check = async (retry = 0) => {
      if (retry > 20) process.exit(1)
      const checkMariadbContainerStatus = spawnSync('docker', ['exec', '-i', 'mariadb-multidb-tests', 'bin/bash', '-c', 'mysqladmin -uroot -ppassword ping'], { shell: false })
      if (checkMariadbContainerStatus.stdout.toString().includes('mysqld is alive')) {
        const installNode = spawnSync('docker', ['exec', '-i', 'mariadb-multidb-tests', 'bin/bash', '-c', 'apt-get update && apt-get install curl -y && curl -sL https://deb.nodesource.com/setup_21.x | bash && apt-get install nodejs -y'], { shell: false })
        if (installNode.stdout.toString().includes('Processing triggers for libc-bin')) resolve('MariaDB container started.')
      } else setTimeout(() => check(retry + 1), 5000)
    }
    check()
  })
}
