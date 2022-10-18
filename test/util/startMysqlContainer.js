const path = require('path')
const { spawnSync } = require('child_process')

module.exports = async () => {
  const multiDbPath = path.join(__dirname, '../..')

  spawnSync('docker', ['run', '--name', 'mysql-multidb-tests', '-e', 'MYSQL_ROOT_PASSWORD=password', '-e', 'MYSQL_USER=mysql_multi_db_tests_user', '-e', 'MYSQL_PASSWORD=mysql_multi_db_tests_password', '-e', 'MYSQL_DATABASE=mysql_multi_db_tests_database', '-p', '3307:3306', '-v', `${multiDbPath}:/multi-db`, '-v', `${multiDbPath}/coverage:/multi-db/coverage`, '-d', 'mysql:9.0.1'], { shell: false })

  return new Promise((resolve, reject) => {
    const check = async (retry = 0) => {
      if (retry > 20) process.exit(1)
      const checkMysqlContainerStatus = spawnSync('docker', ['exec', '-i', 'mysql-multidb-tests', 'bin/bash', '-c', 'mysqladmin -uroot -ppassword ping'], { shell: false })
      if (checkMysqlContainerStatus.stdout.toString().includes('mysqld is alive')) {
        const installNode = spawnSync('docker', ['exec', '-i', 'mysql-multidb-tests', 'bin/bash', '-c', 'microdnf install nodejs'], { shell: false })
        if (installNode.stdout.toString().includes('Complete.')) resolve('MySQL container started.')
      } else setTimeout(() => check(retry + 1), 5000)
    }
    check()
  })
}
