/* eslint-env mocha */
process.env.MULTI_DB_CONFIG_FILE_SEARCH_ATTEMPTS = 1 // set config search attempts to 1 by default
const assert = require('assert')
const fs = require('fs')
const isDocker = process.argv.includes('--docker') || false
const Logger = require('roosevelt-logger')
const logger = new Logger()
const multiDb = require('../multi-db')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const cleanUp = require(path.join(__dirname, './util/cleanUp.js'))
const createConfigs = path.join(__dirname, './util/createConfigs.js')
const createDatabase = require(path.join(__dirname, './util/createDatabase.js'))
const destroyDatabase = require(path.join(__dirname, './util/destroyDatabase.js'))
const destroyedDatabaseCheck = require(path.join(__dirname, './util/destroyedDatabaseCheck.js'))
const dumpData = require(path.join(__dirname, './util/dumpData.js'))
const dumpSchema = require(path.join(__dirname, './util/dumpSchema.js'))
const executeSqlFile = require(path.join(__dirname, './util/executeSqlFile.js'))
const runQueryWithInvalidSyntax = require(path.join(__dirname, './util/runQueryWithInvalidSyntax.js'))
const startMariaDbContainer = require(path.join(__dirname, './util/startMariaDbContainer.js'))
const startMySqlContainer = require(path.join(__dirname, './util/startMySqlContainer.js'))
const startPostgresContainer = require(path.join(__dirname, './util/startPostgresContainer.js'))
const startSqliteContainer = require(path.join(__dirname, './util/startSqliteContainer.js'))

// values to be used in tests
const values = [
  { name: 'magnus', description: 'chess master' },
  { name: 'nick', description: 'software engineer' },
  { name: 'tua', description: 'quarterback' }
]

before(async function () {
  if (isDocker) {
    const dockerCheck = spawnSync('docker', ['info'], { shell: false })
    if (dockerCheck.error || dockerCheck.stderr?.toString().includes('ERROR: Cannot connect to the Docker daemon')) {
      logger.error('🐳', 'Make sure Docker is installed and running...')
      if (dockerCheck.error) logger.error(dockerCheck.error)
      if (dockerCheck.stderr?.toString()) logger.error(dockerCheck.stderr.toString())
      process.exit(1)
    } else {
      logger.log('🦭', 'Starting MariaDB container...')
      const mdb = await startMariaDbContainer()
      logger.log('✅', mdb + '\n')
      logger.log('🐬', 'Starting MySQL container...')
      const mysql = await startMySqlContainer()
      logger.log('✅', mysql + '\n')
      logger.log('🐘', 'Starting PostgreSQL container...')
      const pg = await startPostgresContainer()
      logger.log('✅', pg + '\n')
      logger.log('🪶', 'Starting SQLite container...')
      const sqlite = await startSqliteContainer()
      logger.log('✅', sqlite + '\n')
    }
  }
  require(createConfigs)()
})

after(async function () {
  await destroyDatabase('mysql')
  await destroyDatabase('pglite')
  await destroyDatabase('postgres')
  await destroyDatabase('sqlite')
  cleanUp()
})

// clean up files on ctrl + c
process.on('SIGINT', () => {
  cleanUp()
  process.exit()
})

// CLI tests
describe('CLI', function () {
  it('should run --create CLI script and create MariaDB user, database and table', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.mariadb-config.json' // env var for config location
    const result = await createDatabase('mariadb', false, true) // create database
    await destroyDatabase('mariadb') // destroy database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'created') // check if result equals 'created'
  })

  it('should run --destroy CLI script and destroy MariaDB database', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.mariadb-config.json' // env var for config location
    await createDatabase('mariadb') // create database
    const droppedDatabase = await destroyDatabase('mariadb') // destroy database
    if (isDocker) {
      const mariaDbConfig = JSON.parse(fs.readFileSync(path.normalize('./test/configs/.mariadb-config.json')))
      mariaDbConfig.mariadb.config.port = 3317
      mariaDbConfig.mariadb.adminConfig.port = 3317
      fs.writeFileSync(path.normalize('./test/configs/.mariadb-config.json'), JSON.stringify(mariaDbConfig, null, 2))
    }
    const result = await destroyedDatabaseCheck('mariadb', droppedDatabase) // destroy database
    if (isDocker) {
      const mariadbDbConfig = JSON.parse(fs.readFileSync(path.normalize('./test/configs/.mariadb-config.json')))
      mariadbDbConfig.mariadb.config.port = 3306
      mariadbDbConfig.mariadb.adminConfig.port = 3306
      fs.writeFileSync(path.normalize('./test/configs/.mariadb-config.json'), JSON.stringify(mariadbDbConfig, null, 2))
    }
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'destroyed') // check if result equals 'destroyed'
  })

  it('should run --file CLI script against a MariaDB database', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.mariadb-config.json' // env var for config location
    await createDatabase('mariadb') // create database
    const result = await executeSqlFile('mariadb', './test/db/mariadb_and_mysql_file.sql', false, true) // execute SQL file; also test verbose logging
    await destroyDatabase('mariadb') // destroy database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'executed') // check if result equals 'executed'
  })

  it('should run --dump-schema CLI script and dump schema of connected MariaDB database to defined path', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.mariadb-config.json' // env var for config location
    await createDatabase('mariadb') // create database
    const result = await dumpSchema('mariadb', './test/db/schema.sql') // dump schema
    await destroyDatabase('mariadb') // destroy database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'executed')
  })

  it('should run --dump-data CLI script and dump data connected MariaDB database to defined path', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.mariadb-config.json' // env var for config location
    await createDatabase('mariadb') // create database
    const result = await dumpData('mariadb', './test/db/schema.sql') // dump data
    await destroyDatabase('mariadb') // destroy database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'executed')
  })

  it('should run MariaDB --dump-schema CLI script and print error due to mysqldump command not being in PATH', async function () {
    const pathEnv = process.env.PATH

    // remove mysql from PATH
    const command = os.platform() === 'win32' ? 'where' : 'which'
    const args = os.platform() === 'win32' ? ['mysql'] : ['-a', 'mysql']
    const mysqlPath = spawnSync(command, args, { shell: false })
    const mysqlPathArr = mysqlPath.stdout.toString().trim().split('\n')
    const splitPath = os.platform() === 'win32' ? process.env.PATH.split(';') : process.env.PATH.split(':')
    for (let i = 0; i < mysqlPathArr.length; i++) {
      const splitMysqlPath = os.platform() === 'win32' ? mysqlPathArr[i].split('\\') : mysqlPathArr[i].split('/')
      splitMysqlPath.splice(splitMysqlPath.length - 1, 1)
      const joinMysqlPath = os.platform() === 'win32' ? splitMysqlPath.join('\\') : splitMysqlPath.join('/')
      for (let j = 0; j < splitPath.length; j++) {
        if (splitPath[j] === joinMysqlPath) splitPath.splice(j, 1)
      }
    }
    const joinPathNoMysql = os.platform() === 'win32' ? splitPath.join(';') : splitPath.join(':')
    process.env.PATH = joinPathNoMysql

    // run dump schema script
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.mariadb-config.json' // env var for config location
    let result
    if (isDocker) {
      const mariadbConfig = JSON.parse(fs.readFileSync(path.normalize('./test/configs/.mariadb-config.json')))
      mariadbConfig.mariadb.config.port = 3307
      mariadbConfig.mariadb.adminConfig.port = 3307
      fs.writeFileSync(path.normalize('./test/configs/.mariadb-config.json'), JSON.stringify(mariadbConfig, null, 2))

      result = await dumpSchema('mariadb', './test/db/schema.sql', true)

      mariadbConfig.mariadb.config.port = 3306
      mariadbConfig.mariadb.adminConfig.port = 3306
      fs.writeFileSync(path.normalize('./test/configs/.mariadb-config.json'), JSON.stringify(mariadbConfig, null, 2))
    } else {
      result = await dumpSchema('mariadb', './test/db/schema.sql')
    }

    process.env.PATH = pathEnv // reset PATH for rest of tests
    await destroyDatabase('mariadb') // destroy database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'error') // check if result equals 'error'
  })

  it('should run --create CLI script and create MySQL user, database, and table', async function () {
    const result = await createDatabase('mysql', false, true) // create database; also test verbose logs
    assert.equal(result, 'created') // check if result equals 'created'
  })

  it('should run --destroy CLI script and destroy MySQL database', async function () {
    await createDatabase('mysql') // create database
    const droppedDatabase = await destroyDatabase('mysql') // destroy database
    if (isDocker) {
      const mySqlConfig = JSON.parse(fs.readFileSync(path.normalize('.multi-db-config.json')))
      mySqlConfig.mysql.config.port = 3307
      mySqlConfig.mysql.adminConfig.port = 3307
      fs.writeFileSync(path.normalize('.multi-db-config.json'), JSON.stringify(mySqlConfig, null, 2))
    }
    const result = await destroyedDatabaseCheck('mysql', droppedDatabase) // destroy database
    if (isDocker) {
      const mySqlConfig = JSON.parse(fs.readFileSync(path.normalize('.multi-db-config.json')))
      mySqlConfig.mysql.config.port = 3306
      mySqlConfig.mysql.adminConfig.port = 3306
      fs.writeFileSync(path.normalize('.multi-db-config.json'), JSON.stringify(mySqlConfig, null, 2))
    }
    assert.equal(result, 'destroyed') // check if result equals 'destroyed'
  })

  it('should run --file CLI script against a MySQL database', async function () {
    await createDatabase('mysql') // create database
    const result = await executeSqlFile('mysql', './test/db/mariadb_and_mysql_file.sql', false, true) // execute SQL file; also test verbose logging
    assert.equal(result, 'executed') // check if result equals 'executed'
  })

  it('should run --dump-schema CLI script and dump schema of connected MySQL database to defined path', async function () {
    await createDatabase('mysql') // create database
    const result = await dumpSchema('mysql', './test/db/schema.sql')
    assert.equal(result, 'executed')
  })

  it('should run --dump-data CLI script and dump data connected MySQL database to defined path', async function () {
    await createDatabase('mysql') // create database
    const result = await dumpData('mysql', './test/db/schema.sql')
    assert.equal(result, 'executed')
  })

  it('should run MySQL --dump-schema CLI script and print error due to invalid path', async function () {
    await createDatabase('mysql') // create database
    const result = await dumpSchema('mysql', './test/invalid/schema.sql')
    assert.equal(result, 'error')
  })

  it('should run MySQL --dump-data CLI script and print error due to invalid path', async function () {
    await createDatabase('mysql') // create database
    const result = await dumpData('mysql', './test/invalid/schema.sql')
    assert.equal(result, 'error')
  })

  it('should run MySQL --dump-schema CLI script and print error due to mysqldump command not being in PATH', async function () {
    const pathEnv = process.env.PATH

    // remove mysql from PATH
    const command = os.platform() === 'win32' ? 'where' : 'which'
    const args = os.platform() === 'win32' ? ['mysql'] : ['-a', 'mysql']
    const mysqlPath = spawnSync(command, args, { shell: false })
    const mysqlPathArr = mysqlPath.stdout.toString().trim().split('\n')
    const splitPath = os.platform() === 'win32' ? process.env.PATH.split(';') : process.env.PATH.split(':')
    for (let i = 0; i < mysqlPathArr.length; i++) {
      const splitMysqlPath = os.platform() === 'win32' ? mysqlPathArr[i].split('\\') : mysqlPathArr[i].split('/')
      splitMysqlPath.splice(splitMysqlPath.length - 1, 1)
      const joinMysqlPath = os.platform() === 'win32' ? splitMysqlPath.join('\\') : splitMysqlPath.join('/')
      for (let j = 0; j < splitPath.length; j++) {
        if (splitPath[j] === joinMysqlPath) splitPath.splice(j, 1)
      }
    }
    const joinPathNoMysql = os.platform() === 'win32' ? splitPath.join(';') : splitPath.join(':')
    process.env.PATH = joinPathNoMysql

    // run dump schema script
    let result
    if (isDocker) {
      const mysqlConfig = JSON.parse(fs.readFileSync(path.normalize('.multi-db-config.json')))
      mysqlConfig.mysql.config.port = 3307
      mysqlConfig.mysql.adminConfig.port = 3307
      fs.writeFileSync(path.normalize('.multi-db-config.json'), JSON.stringify(mysqlConfig, null, 2))

      result = await dumpSchema('mysql', './test/db/schema.sql', true)

      mysqlConfig.mysql.config.port = 3306
      mysqlConfig.mysql.adminConfig.port = 3306
      fs.writeFileSync(path.normalize('.multi-db-config.json'), JSON.stringify(mysqlConfig, null, 2))
    } else {
      result = await dumpSchema('mysql', './test/db/schema.sql')
    }

    process.env.PATH = pathEnv // reset PATH for rest of tests
    assert.equal(result, 'error') // check if result equals 'error'
  })

  it('should run --create CLI script and create PGlite database', async function () {
    const result = await createDatabase('pglite', true) // create database
    await destroyDatabase('pglite')
    assert.equal(result, 'created') // check if result equals 'created'
  })

  it('should run --destroy CLI script and destroy PGlite database', async function () {
    await createDatabase('pglite') // create database
    const droppedDatabase = await destroyDatabase('pglite') // destroy database
    const result = await destroyedDatabaseCheck('pglite', droppedDatabase) // check if database was destroyed
    assert.equal(result, 'destroyed') // check if result equals 'destroyed'
  })

  it('should run --file CLI script against a PGlite database', async function () {
    await createDatabase('pglite') // create database
    const result = await executeSqlFile('pglite', './test/db/pglite_postgres_and_sqlite_file.sql', true) // execute SQL file
    await destroyDatabase('pglite')
    assert.equal(result, 'executed') // check if result equals 'executed'
  })

  it('should run --create CLI script and create PostgreSQL user, database, and table', async function () {
    const result = await createDatabase('postgres', true) // create database
    assert.equal(result, 'created') // check if result equals 'created'
  })

  it('should run --destroy CLI script and destroy PostgreSQL database', async function () {
    await createDatabase('postgres') // create database
    const droppedDatabase = await destroyDatabase('postgres') // destroy database
    if (isDocker) {
      const postgresConfig = JSON.parse(fs.readFileSync(path.normalize('.multi-db-config.json')))
      postgresConfig.postgres.config.port = 5442
      postgresConfig.postgres.adminConfig.port = 5442
      fs.writeFileSync(path.normalize('.multi-db-config.json'), JSON.stringify(postgresConfig, null, 2))
    }
    const result = await destroyedDatabaseCheck('postgres', droppedDatabase)
    if (isDocker) {
      const postgresConfig = JSON.parse(fs.readFileSync(path.normalize('.multi-db-config.json')))
      postgresConfig.postgres.config.port = 5432
      postgresConfig.postgres.adminConfig.port = 5432
      fs.writeFileSync(path.normalize('.multi-db-config.json'), JSON.stringify(postgresConfig, null, 2))
    }
    assert.equal(result, 'destroyed') // check if result equals 'destroyed'
  })

  it('should run --file CLI script against a PostgreSQL database', async function () {
    await createDatabase('postgres') // create database
    const result = await executeSqlFile('postgres', './test/db/pglite_postgres_and_sqlite_file.sql') // execute SQL file
    assert.equal(result, 'executed') // check if result equals 'executed'
  })

  it('should run --dump-schema CLI script and dump schema of connected PostgreSQL database to defined path', async function () {
    await createDatabase('postgres') // create database
    const result = await dumpSchema('postgres', './test/db/schema.sql')
    assert.equal(result, 'executed')
  })

  it('should run --dump-data CLI script and dump data of connected PostgreSQL database to defined path', async function () {
    await createDatabase('postgres') // create database
    const result = await dumpData('postgres', './test/db/schema.sql')
    assert.equal(result, 'executed')
  })

  it('should run PostgreSQL --dump-schema CLI script and print error due to invalid path', async function () {
    await createDatabase('postgres') // create database
    const result = await dumpSchema('postgres', './test/invalid/schema.sql')
    assert.equal(result, 'error')
  })

  it('should run PostgreSQL --dump-data CLI script and print error due to invalid path', async function () {
    await createDatabase('postgres') // create database
    const result = await dumpData('postgres', './test/invalid/schema.sql')
    assert.equal(result, 'error')
  })

  it('should run PostgreSQL --dump-schema CLI script and print error due to pg_dump command not being in PATH', async function () {
    const pathEnv = process.env.PATH

    // remove psql from PATH
    const command = os.platform() === 'win32' ? 'where' : 'which'
    const args = os.platform() === 'win32' ? ['psql'] : ['-a', 'psql']
    const psqlPath = spawnSync(command, args, { shell: false })
    const psqlPathArr = psqlPath.stdout.toString().trim().split('\n')
    const splitPath = os.platform() === 'win32' ? process.env.PATH.split(';') : process.env.PATH.split(':')
    for (let i = 0; i < psqlPathArr.length; i++) {
      const splitPsqlPath = os.platform() === 'win32' ? psqlPathArr[i].split('\\') : psqlPathArr[i].split('/')
      splitPsqlPath.splice(splitPsqlPath.length - 1, 1)
      const joinPsqlPath = os.platform() === 'win32' ? splitPsqlPath.join('\\') : splitPsqlPath.join('/')
      for (let j = 0; j < splitPath.length; j++) {
        if (splitPath[j] === joinPsqlPath) splitPath.splice(j, 1)
      }
    }
    const joinPathNoPsql = os.platform() === 'win32' ? splitPath.join(';') : splitPath.join(':')
    process.env.PATH = joinPathNoPsql

    let result
    if (isDocker) {
      const postgresConfig = JSON.parse(fs.readFileSync(path.normalize('.multi-db-config.json')))
      postgresConfig.postgres.config.port = 5442
      postgresConfig.postgres.adminConfig.port = 5442
      fs.writeFileSync(path.normalize('.multi-db-config.json'), JSON.stringify(postgresConfig, null, 2))

      result = await dumpSchema('postgres', './test/db/schema.sql', true)

      postgresConfig.postgres.config.port = 5432
      postgresConfig.postgres.adminConfig.port = 5432
      fs.writeFileSync(path.normalize('.multi-db-config.json'), JSON.stringify(postgresConfig, null, 2))
    } else {
      result = await dumpSchema('postgres', './test/db/schema.sql')
    }

    process.env.PATH = pathEnv // reset PATH for rest of tests
    assert.equal(result, 'error')
  })

  it('should run --create CLI script and create SQLite database, and table', async function () {
    const result = await createDatabase('sqlite') // create database
    assert.equal(result, 'created') // check if result equals 'created'
  })

  it('should run --destroy CLI script and destroy SQLite database', async function () {
    await createDatabase('sqlite') // create database
    const droppedDatabase = await destroyDatabase('sqlite') // destroy database
    const result = await destroyedDatabaseCheck('sqlite', droppedDatabase) // destroy database check
    assert.equal(result, 'destroyed') // check if result equals 'destroyed'
  })

  it('should run --file CLI script against a SQLite database', async function () {
    await createDatabase('sqlite') // create database
    const result = await executeSqlFile('sqlite', './test/db/pglite_postgres_and_sqlite_file.sql', null, null, true) // execute SQL file
    assert.equal(result, 'executed') // check if result equals 'executed'
  })

  it('should run --dump-schema CLI script and dump schema of connected SQLite database to defined path', async function () {
    await createDatabase('sqlite') // create database
    const result = await dumpSchema('sqlite', './test/db/schema.sql')
    assert.equal(result, 'executed')
  })

  it('should run --dump-data CLI script and dump data connected SQLite database to defined path', async function () {
    await createDatabase('sqlite') // create database
    const result = await dumpData('sqlite', './test/db/schema.sql')
    assert.equal(result, 'executed')
  })

  it('should run SQLite --dump-schema CLI script and print error due to pg_dump command not being in PATH', async function () {
    const pathEnv = process.env.PATH

    // remove sqlite3 from PATH
    const command = os.platform() === 'win32' ? 'where' : 'which'
    const args = os.platform() === 'win32' ? ['sqlite3'] : ['-a', 'sqlite3']
    const sqlitePath = spawnSync(command, args, { shell: false })
    const sqlitePathArr = sqlitePath.stdout.toString().trim().split('\n')
    const splitPath = os.platform() === 'win32' ? process.env.PATH.split(';') : process.env.PATH.split(':')
    for (let i = 0; i < sqlitePathArr.length; i++) {
      const splitSqlitePath = os.platform() === 'win32' ? sqlitePathArr[i].split('\\') : sqlitePathArr[i].split('/')
      splitSqlitePath.splice(splitSqlitePath.length - 1, 1)
      const joinSqlitePath = os.platform() === 'win32' ? splitSqlitePath.join('\\') : splitSqlitePath.join('/')
      for (let j = 0; j < splitPath.length; j++) {
        if (splitPath[j] === joinSqlitePath) splitPath.splice(j, 1)
      }
    }
    const joinPathNoSqlite = os.platform() === 'win32' ? splitPath.join(';') : splitPath.join(':')
    process.env.PATH = joinPathNoSqlite

    const result = isDocker ? await dumpSchema('sqlite', './test/db/schema.sql', true) : await dumpSchema('sqlite', './test/db/schema.sql')
    process.env.PATH = pathEnv // reset PATH for rest of tests
    assert.equal(result, 'error')
  })

  it('should run --create CLI script and print error due to undefined schema', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.multi-db-config-no-schema.json' // env var for config location
    const result = await createDatabase('sqlite') // create database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'error') // check if result equals 'executed'
  })

  it('should run --create CLI script and print error due to invalid schema syntax', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.multi-db-config-invalid-schema.json' // env var for config location
    const result = await createDatabase('sqlite') // create database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'error') // check if result equals 'executed'
  })

  it('should run --create CLI script and print error due to invalid schema file path', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.multi-db-config-invalid-schema-path.json' // env var for config location
    const result = await createDatabase('sqlite') // create database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'error') // check if result equals 'executed'
  })

  it('should run --file CLI script and print error due to invalid file', async function () {
    await createDatabase('sqlite') // create database
    const result = await executeSqlFile('sqlite', './test/db/error_file.sql') // execute invalid SQL file
    assert.equal(result, 'error') // check if result equals 'executed'
  })
})

describe('multi-db', function () {
  it('should print error due to invalid config file', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/invalid-config.txt' // env var for config location
    const result = await createDatabase('sqlite') // create database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'error') // check if invalid config was used and returns error
  })

  it('should print error due to invalid config path', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = '.files/.alternate-config.json' // env var for config location
    const result = await createDatabase('sqlite') // create database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'error') // check if invalid config path was used and returns error
  })

  it('should print error due to config with no default value', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.invalid-config.json' // env var for config location
    const result = await createDatabase('sqlite') // create database
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    assert.equal(result, 'error') // check if invalid config was used and returns error
  })

  it('should use env var for alternate config name and location', async function () {
    process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.alternate-config.json' // env var for config location
    const altConfig = require('./configs/.alternate-config.json') // alternate config variable
    await createDatabase('sqlite') // create database

    // connect to database with loggerConfig
    const db = await require('../multi-db')({
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
    await db.endConnection() // end connection
    assert.equal(JSON.stringify(db.config[db.config.default]).trim(), JSON.stringify(altConfig[altConfig.default]).trim()) // check if alternate config was used in db connection
  })

  it('should go up 2 directories to find config', async function () {
    await createDatabase('sqlite') // create database
    process.env.MULTI_DB_CONFIG_FILE_SEARCH_ATTEMPTS = null // set config search attempts to null

    // create nested folders
    if (!fs.existsSync(path.normalize(path.join(__dirname, '/nested-multi-db')))) {
      fs.mkdirSync(path.normalize(path.join(__dirname, '/nested-multi-db')))
      fs.mkdirSync(path.normalize(path.join(__dirname, '/nested-multi-db', '/nested-multi-db-2')))
      fs.mkdirSync(path.normalize(path.join(__dirname, '/nested-multi-db', '/nested-multi-db-2', '/nested-multi-db-3')))
    }

    // create multi-db-config.json
    async function createConfig () {
      const configString = JSON.stringify({
        default: 'sqlite',
        sqlite: {
          config: {
            database: './test/sqlite-db/3_dirs_up_sqlite_multi_db_tests_database.sqlite'
          },
          schema: './test/db/pglite_postgres_and_sqlite_schema.sql'
        }
      }, null, 2)
      const filePath = path.resolve(__dirname, 'nested-multi-db', '.multi-db-config.json') // Use path.resolve to go up 1 directories from the current directory
      fs.writeFileSync(path.normalize(filePath), configString)
    }

    await createConfig()
    const nestedConfig = require('./nested-multi-db/.multi-db-config.json') // .multi-db-config.json in nested-multi-db dir
    process.chdir('./test/nested-multi-db/nested-multi-db-2/nested-multi-db-3') // change dir to nested-multi-db-3

    // connect to database with loggerConfig
    const db = await multiDb({
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    process.chdir('../../../../') // change dir back to multi-db
    await db.endConnection() // end connection
    process.env.MULTI_DB_CONFIG_FILE_SEARCH_ATTEMPTS = 1 // reset search attempts env var
    assert.equal(JSON.stringify(db.config[db.config.default]).trim(), JSON.stringify(nestedConfig[nestedConfig.default]).trim()) // check if nested config was used in db connection
  })

  it('should print error due to falsey query', async function () {
    await createDatabase('sqlite') // create database

    // connect to database with loggerConfig
    const db = await require('../multi-db')({
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // run falsey query
    const result = await db.query({
      falsey: 'select * from test_table'
    })

    await db.endConnection() // end connection
    assert.equal(!!result, false) // check if result is falsey
  })

  it('should print error due to malformed query', async function () {
    await createDatabase('sqlite') // create database

    // connect to database with loggerConfig
    const db = await require('../multi-db')({
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // run malformed query
    const result = await db.query({
      sqlite: ['select * from test_table']
    })

    await db.endConnection() // end connection
    assert.equal(!!result, false) // check if result is falsey
  })

  it('should print error due to invalid query type', async function () {
    await createDatabase('sqlite') // create database

    // connect to database with loggerConfig
    const db = await require('../multi-db')({
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    const result = await db.query(1) // run invalid type of query
    await db.endConnection() // end connection
    assert.equal(!!result, false) // check if result is falsey
  })

  it('should print an error due to invalid driver', async function () {
    multiDb.drivers.sqlite = 'bad driver' // change MySQL driver

    // connect to database
    const db = await multiDb({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    multiDb.drivers.sqlite = 'better-sqlite3' // change SQLite driver back
    await db.endConnection() // end connection
    assert.equal(!!db.sqlite.db, false) // check db.sqlite.db is falsey
  })

  it('should check the "default" member of the query object', async function () {
    await createDatabase('sqlite') // create database

    // connect to database
    const db = await multiDb({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }

    // run "default" query
    const { rows } = await db.query({
      default: 'select * from test_table'
    })

    await db.endConnection() // end connection
    assert.deepEqual(rows, values) // check if rows from test_table equal inserted values
  })

  it('should run argument 2 in the query as a post-process function', async function () {
    await createDatabase('sqlite') // create database

    // connect to database
    const db = await multiDb({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }

    // run query with postprocess function as second argument
    const result = await db.query('select * from test_table', function (db, result) {
      const rows = result.rows
      return rows
    })
    await db.endConnection() // end connection
    assert.deepEqual(result, values) // check if error was printed due to falsey query
  })

  it('should test database connection using testConnection method', async function () {
    await createDatabase('postgres', 'localhost', 5432) // create database

    // connect to database
    const db = await require('../multi-db')({
      default: 'postgres',
      postgres: {
        config: {
          host: 'localhost',
          port: isDocker ? 5442 : 5432,
          user: 'postgres_multi_db_tests_user',
          password: 'postgres_multi_db_tests_password',
          database: 'postgres_multi_db_tests_database'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    const result = await db.testConnection() // test connection
    await db.endConnection() // end connection
    assert.equal(!!result, true) // check if connection was successfully tested
  })

  it('should print error due to failed connection test', async function () {
    await createDatabase('postgres', 'localhost', 5432) // create database
    for (const key in multiDb.defaultCredentials.postgres) multiDb.defaultCredentials.postgres[key].host = 'foo' // change host value in for each credential
    // connect to database
    const db = await multiDb({
      default: 'postgres',
      postgres: {
        config: {
          host: 'foo',
          port: isDocker ? 5442 : 5432,
          user: 'postgres_multi_db_tests_user',
          password: 'postgres_multi_db_tests_password',
          database: 'postgres_multi_db_tests_database'
        },
        adminConfig: {
          host: 'bar',
          port: isDocker ? 5442 : 5432,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres'
        },
        schema: 'test/db/pglite_postgres_and_sqlite_schema.sql'
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    const result = await db.testConnection()

    for (const key in multiDb.defaultCredentials.postgres) multiDb.defaultCredentials.postgres[key].host = 'localhost' // change host values back
    await db.endConnection() // end connection
    assert.equal(!!result, false) // check if result is falsey
  })
})

// MariaDB tests
describe('MariaDB', function () {
  afterEach(async function () {
    await destroyDatabase('mariadb')
    delete process.env.MULTI_DB_CONFIG_LOCATION // delete env var
  })

  it('should insert values into table', async function () {
    if (!isDocker) process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.mariadb-config.json' // env var for config location
    await createDatabase('mariadb') // create database

    // connect to database
    const db = await require('../multi-db')({
      default: 'mariadb',
      mariadb: {
        config: {
          host: 'localhost',
          port: isDocker ? 3317 : 3306,
          user: 'mariadb_multi_db_tests_user',
          password: 'mariadb_multi_db_tests_password',
          database: 'mariadb_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: isDocker ? 3317 : 3306,
          user: 'root',
          password: 'password',
          database: 'mysql'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }

    const results = await db.query('select * from test_table') // select all values from table
    const resultsArray = []
    for (let i = 0; i < values.length; i++) resultsArray.push(results.rows[i])
    await db.endConnection() // end connection
    assert.deepEqual(resultsArray, values) // check if results match inserted values
  })

  it('should delete all values from table', async function () {
    if (!isDocker) process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.mariadb-config.json' // env var for config location
    await createDatabase('mariadb') // create database

    // connect to database
    const db = await require('../multi-db')({
      default: 'mariadb',
      mariadb: {
        config: {
          host: 'localhost',
          port: isDocker ? 3317 : 3306,
          user: 'mariadb_multi_db_tests_user',
          password: 'mariadb_multi_db_tests_password',
          database: 'mariadb_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: isDocker ? 3317 : 3306,
          user: 'root',
          password: 'password',
          database: 'mysql'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }

    await db.query('delete from test_table') // delete values from table
    const results = await db.query('select * from test_table') // select all values from table
    await db.endConnection() // end connection
    assert.equal(results.rows.length, 0) // check if table has 0 rows
  })

  it('should print errors due to invalid SQL syntax', async function () {
    if (!isDocker) process.env.MULTI_DB_CONFIG_LOCATION = './test/configs/.mariadb-config.json' // env var for config location
    await createDatabase('mariadb') // create database

    // run query with invalid syntax
    const result = await runQueryWithInvalidSyntax({
      default: 'mariadb',
      mariadb: {
        config: {
          host: 'localhost',
          port: isDocker ? 3317 : 3306,
          user: 'mariadb_multi_db_tests_user',
          password: 'mariadb_multi_db_tests_password',
          database: 'mariadb_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: isDocker ? 3317 : 3306,
          user: 'root',
          password: 'password',
          database: 'mysql'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    assert.equal(!!result, false) // check if result is falsey
  })

  it('should print errors due to bad config', async function () {
    await createDatabase('mariadb') // create database

    // change host value in for each credential
    for (const key in multiDb.defaultCredentials.mariadb) {
      multiDb.defaultCredentials.mariadb[key].host = 'foo'
      multiDb.defaultCredentials.mariadb[key].acquireTimeout = 100
      multiDb.defaultCredentials.mariadb[key].initializationTimeout = 1000
    }

    // connect to database
    const db = await require('../multi-db')({
      default: 'mariadb',
      mariadb: {
        config: {
          host: 'foo',
          port: isDocker ? 3317 : 3306,
          user: 'mariadb_multi_db_tests_user',
          password: 'mariadb_multi_db_tests_password',
          database: 'mariadb_multi_db_tests_database'
        },
        adminConfig: {
          host: 'foo',
          port: isDocker ? 3317 : 3306,
          user: 'root',
          password: 'password',
          database: 'mysql'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    for (const key in multiDb.defaultCredentials.mariadb) multiDb.defaultCredentials.mariadb[key].host = 'localhost' // change host values back
    const result = db.mariadb.conn
    await db.endConnection() // end connection
    assert.equal(!!result, false) // check if result is falsey
  })
})

// MySQL tests
describe('MySQL', function () {
  afterEach(async function () {
    await destroyDatabase('mysql')
  })

  it('should insert values into table', async function () {
    await createDatabase('mysql') // create database

    // connect to database
    const db = await multiDb({
      default: 'mysql',
      mysql: {
        config: {
          host: 'localhost',
          port: isDocker ? 3307 : 3306,
          user: 'mysql_multi_db_tests_user',
          password: 'mysql_multi_db_tests_password',
          database: 'mysql_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: isDocker ? 3307 : 3306,
          user: 'root',
          password: 'password',
          database: 'mysql'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }

    const result = await db.query('select * from test_table') // select all values from table
    await db.endConnection() // end connection
    assert.deepEqual(result.rows, values) // check if results match inserted values
  })

  it('should delete all values from table', async function () {
    await createDatabase('mysql') // create database

    // connect to database
    const db = await multiDb({
      default: 'mysql',
      mysql: {
        config: {
          host: 'localhost',
          port: isDocker ? 3307 : 3306,
          user: 'mysql_multi_db_tests_user',
          password: 'mysql_multi_db_tests_password',
          database: 'mysql_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: isDocker ? 3307 : 3306,
          user: 'root',
          password: 'password',
          database: 'mysql'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }

    await db.query('delete from test_table') // delete values from table
    const result = await db.query('select * from test_table') // select all values from table
    await db.endConnection() // end connection
    assert.equal(result.rows, 0) // check if table has 0 rows
  })

  it('should print errors due to invalid SQL syntax', async function () {
    await createDatabase('mysql') // create database

    // run query with invalid syntax
    const result = await runQueryWithInvalidSyntax({
      default: 'mysql',
      mysql: {
        config: {
          host: 'localhost',
          port: isDocker ? 3307 : 3306,
          user: 'mysql_multi_db_tests_user',
          password: 'mysql_multi_db_tests_password',
          database: 'mysql_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: isDocker ? 3307 : 3306,
          user: 'root',
          password: 'password',
          database: 'mysql'
        }
      }
    })

    assert.equal(!!result, false) // check if result is false
  })

  it('should print errors due to bad config', async function () {
    await createDatabase('mysql') // create database
    for (const key in multiDb.defaultCredentials.mysql) multiDb.defaultCredentials.mysql[key].host = 'foo' // change host value in for each credential

    // connect to database
    const db = await multiDb({
      default: 'mysql',
      mysql: {
        config: {
          host: 'foo',
          port: isDocker ? 3307 : 3306,
          user: 'mysql_multi_db_tests_user',
          password: 'mysql_multi_db_tests_password',
          database: 'mysql_multi_db_tests_database'
        },
        adminConfig: {
          host: 'foo',
          port: isDocker ? 3307 : 3306,
          user: 'root',
          password: 'password',
          database: 'mysql'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    for (const key in multiDb.defaultCredentials.mysql) multiDb.defaultCredentials.mysql[key].host = 'localhost' // change host values back
    const result = db.mysql.conn
    await db.endConnection() // end connection
    assert.equal(!!result, false) // check if result is falsey
  })
})

// PGlite tests
describe('PGlite', function () {
  afterEach(async function () {
    await destroyDatabase('pglite')
  })

  it('should insert values into table', async function () {
    const insertValues = spawnSync('node', ['./test/util/insertValuesIntoPgliteTable.js'], { shell: false })
    const result = insertValues.stdout.toString()
    assert.deepEqual(result.trimEnd(), JSON.stringify(values))
  })

  it('should delete all values from table', async function () {
    const deleteValues = spawnSync('node', ['./test/util/deleteValuesFromPgliteTable.js'], { shell: false })
    const result = deleteValues.stdout.toString()
    assert.equal(result.trimEnd(), '[]')// check if table has 0 rows
  })

  it('should print errors due to invalid SQL syntax', async function () {
    const printInvalidSqlErrors = spawnSync('node', ['./test/util/printPgliteErrorsDueToInvalidSql.js'], { shell: false })
    const result = printInvalidSqlErrors.stdout.toString()
    assert.equal(result.trimEnd(), 'undefined') // check if result equals undefined
  })

  it('should print errors due to bad config', async function () {
    const printBadConfigErrors = spawnSync('node', ['./test/util/printPgliteErrorsDueToBadConfig.js'], { shell: false })
    const result = printBadConfigErrors.stdout.toString()
    assert.equal(result.trimEnd(), 'undefined') // check if result equals undefined
  })
})

// PostgreSQL tests
describe('PostgreSQL', function () {
  afterEach(async function () {
    await destroyDatabase('postgres')
  })

  it('should insert values into table', async function () {
    await createDatabase('postgres') // create database

    // connect to database
    const db = await require('../multi-db')({
      default: 'postgres',
      postgres: {
        config: {
          host: 'localhost',
          port: isDocker ? 5442 : 5432,
          user: 'postgres_multi_db_tests_user',
          password: 'postgres_multi_db_tests_password',
          database: 'postgres_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: isDocker ? 5442 : 5432,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres'
        },
        schema: 'test/db/pglite_postgres_and_sqlite_schema.sql'
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }

    // select all values from table
    const { rows } = await db.query({
      postgres: 'select * from test_table'
    })

    await db.endConnection() // end connection
    assert.deepEqual(rows, values) // check if rows match inserted values
  })

  it('should delete all values from table', async function () {
    await createDatabase('postgres') // create database

    // connect to database
    const db = await require('../multi-db')({
      default: 'postgres',
      postgres: {
        config: {
          host: 'localhost',
          port: isDocker ? 5442 : 5432,
          user: 'postgres_multi_db_tests_user',
          password: 'postgres_multi_db_tests_password',
          database: 'postgres_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: isDocker ? 5442 : 5432,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres'
        },
        schema: 'test/db/pglite_postgres_and_sqlite_schema.sql'
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      },
      questionMarkParamsForPostgres: false
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values ($1, $2)`, [values[i].name, values[i].description])
    }

    await db.query('delete from test_table') // delete values from table
    const { rows } = await db.query('select * from test_table') // select all values from table
    await db.endConnection() // end connection
    assert.equal(rows.length, 0) // check if table has 0 rows
  })

  it('should print errors due to invalid SQL syntax', async function () {
    await createDatabase('postgres') // create database

    // run query with invalid syntax
    const result = await runQueryWithInvalidSyntax({
      default: 'postgres',
      postgres: {
        config: {
          host: 'localhost',
          port: isDocker ? 5442 : 5432,
          user: 'postgres_multi_db_tests_user',
          password: 'postgres_multi_db_tests_password',
          database: 'postgres_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: isDocker ? 5442 : 5432,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres'
        },
        schema: 'test/db/pglite_postgres_and_sqlite_schema.sql'
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    assert.equal(!!result, false) // check if result is false
  })

  it('should print errors due to bad config', async function () {
    await createDatabase('postgres') // create database
    for (const key in multiDb.defaultCredentials.postgres) multiDb.defaultCredentials.postgres[key].host = 'foo' // change host value in for each credential

    // connect to database
    const db = await multiDb({
      default: 'postgres',
      postgres: {
        config: {
          host: 'foo',
          port: isDocker ? 5442 : 5432,
          user: 'postgres_multi_db_tests_user',
          password: 'postgres_multi_db_tests_password',
          database: 'postgres_multi_db_tests_database'
        },
        adminConfig: {
          host: 'bar',
          port: isDocker ? 5442 : 5432,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres'
        },
        schema: 'test/db/pglite_postgres_and_sqlite_schema.sql'
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    for (const key in multiDb.defaultCredentials.postgres) multiDb.defaultCredentials.postgres[key].host = 'localhost' // change host values back
    const result = db.postgres.client
    await db.endConnection() // end connection
    assert.equal(!!result, false) // check if result is falsey
  })
})

// SQLite tests
describe('SQLite', function () {
  afterEach(async function () {
    await destroyDatabase('sqlite')
  })

  it('should insert values into table', async function () {
    await createDatabase('sqlite') // create database

    // connect to database
    const db = await require('../multi-db')({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }

    const result = await db.query('select * from test_table') // select all values from table
    await db.endConnection() // end connection
    assert.deepEqual(result.rows, values) // check if rows match inserted values
  })

  it('should delete all values from table', async function () {
    await createDatabase('sqlite') // create database

    // connect to database
    const db = await require('../multi-db')({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    // insert values into table
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }

    await db.query('delete from test_table') // delete all values from table
    const result = await db.query('select * from test_table') // select all values from table
    await db.endConnection() // end connection
    assert.deepEqual(result.rows.length, 0) // check if table has 0 rows
  })

  it('should print errors due to invalid SQL syntax', async function () {
    await createDatabase('sqlite') // create database

    // run invalid sql
    const result = await runQueryWithInvalidSyntax({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
        }
      }
    })

    assert.equal(!!result, false) // check if result is falsey
  })

  it('should print errors due to bad config', async function () {
    await createDatabase('sqlite') // create database

    // connect to database
    const db = await multiDb({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/path-doesnt-exist/sqlite_multi_db_automated_tests.sqlite'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    const result = db.sqlite.db
    await db.endConnection() // end connection
    assert.equal(!!result, false) // check if result equals error
  })

  it('should catch error due to invalid driver', async function () {
    await createDatabase('sqlite') // create database
    multiDb.drivers.sqlite = 'invalid driver'

    // connect to database
    const db = await multiDb({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
        }
      },
      loggerConfig: {
        log: false,
        error: false,
        verbose: false
      }
    })

    multiDb.drivers.sqlite = 'better-sqlite3'
    const result = db.sqlite.db
    await db.endConnection() // end connection
    assert.equal(!!result, false) // check if result is falsey
  })
})
