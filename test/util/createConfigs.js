const fs = require('fs')
const path = require('path')

module.exports = () => {
  // create .multi-db-driver-config.json in root directory
  fs.writeFileSync(path.normalize(path.resolve(__dirname, '../..', '.multi-db-driver-config.json')), JSON.stringify({
    default: '',
    mysql: {
      config: {
        host: 'localhost',
        port: 3306,
        user: 'mysql_multi_db_tests_user',
        password: 'mysql_multi_db_tests_password',
        database: 'mysql_multi_db_tests_database'
      },
      adminConfig: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'password',
        database: 'mysql'
      },
      schema: './test/db/mariadb_and_mysql_schema.sql'
    },
    pglite: {
      config: {
        database: './test/pglite-db'
      },
      schema: './test/db/pglite_postgres_and_sqlite_schema.sql'
    },
    postgres: {
      config: {
        host: 'localhost',
        port: 5432,
        user: 'postgres_multi_db_tests_user',
        password: 'postgres_multi_db_tests_password',
        database: 'postgres_multi_db_tests_database'
      },
      adminConfig: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'postgres'
      },
      schema: './test/db/pglite_postgres_and_sqlite_schema.sql'
    },
    sqlite: {
      config: {
        database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
      },
      schema: './test/db/pglite_postgres_and_sqlite_schema.sql'
    }
  }, null, 2))

  // create db directory if it doesn't already exist and create various SQL files in directory
  if (!fs.existsSync(path.normalize(path.join(__dirname, '../db')))) {
    fs.mkdirSync(path.normalize(path.join(__dirname, '../db')))
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../db', 'mariadb_and_mysql_file.sql')), `
      DROP TABLE IF EXISTS test_table;
      CREATE TABLE test_table (
        name VARCHAR(64) PRIMARY KEY,
        description TEXT
      );
    `)
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../db', 'mariadb_and_mysql_schema.sql')), `
      DROP TABLE IF EXISTS test_table;
      CREATE TABLE test_table (
        name VARCHAR(64) PRIMARY KEY,
        description TEXT
      );
    `)
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../db', 'pglite_postgres_and_sqlite_file.sql')), `
    DROP TABLE IF EXISTS test_table;
    CREATE TABLE test_table (
      name TEXT PRIMARY KEY,
      description TEXT
    );
  `)
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../db', 'pglite_postgres_and_sqlite_schema.sql')), `
      DROP TABLE IF EXISTS test_table;
      CREATE TABLE test_table (
        name TEXT PRIMARY KEY,
        description TEXT
      );
    `)
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../db', 'invalid_schema.sql')), `
      DROP TABLE IF EXIST test_table;
      CRETE TABLE test_tabl (
        name TEXT PRIMARY KEY,
        description TEXT
      );
    `)
  }

  if (!fs.existsSync(path.normalize(path.join(__dirname, '../sqlite-db')))) fs.mkdirSync(path.join(__dirname, '../sqlite-db')) // create sqlite-db folder

  if (!fs.existsSync(path.normalize(path.join(__dirname, '../configs')))) {
    fs.mkdirSync(path.normalize(path.join(__dirname, '../configs'))) // create configs folder
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../configs', '.alternate-config.json')), JSON.stringify({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/alternate_config_sqlite_multi_db_tests_database.sqlite'
        },
        schema: './test/db/pglite_postgres_and_sqlite_schema.sql'
      }
    }, null, 2))
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../configs', '.multi-db-driver-config-no-schema.json')), JSON.stringify({
      default: 'postgres',
      postgres: {
        config: {
          host: 'localhost',
          port: 5432,
          user: 'no_schema_config_test_user',
          password: 'no_schema_config_test_password',
          database: 'no_schema_config_test_database'
        },
        adminConfig: {
          host: 'localhost',
          port: 5432,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres'
        }
      }
    }, null, 2))
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../configs', '.multi-db-driver-config-invalid-schema.json')), JSON.stringify({
      default: 'postgres',
      postgres: {
        config: {
          host: 'localhost',
          port: 5432,
          user: 'invalid_schema_config_test_user',
          password: 'invalid_schema_config_test_password',
          database: 'invalid_schema_config_test_database'
        },
        adminConfig: {
          host: 'localhost',
          port: 5432,
          user: 'postgres',
          password: 'postgres',
          database: 'postgres'
        },
        schema: './test/db/invalid_schema.sql'
      }
    }, null, 2))
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../configs', '.multi-db-driver-config-invalid-schema-path.json')), JSON.stringify({
      default: 'sqlite',
      sqlite: {
        config: {
          database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
        },
        schema: './test/invalid_schema_path.sql'
      }
    }, null, 2))
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../configs', '.mariadb-config.json')), JSON.stringify({
      default: 'mariadb',
      mariadb: {
        config: {
          host: 'localhost',
          port: 3306,
          user: 'mariadb_multi_db_tests_user',
          password: 'mariadb_multi_db_tests_password',
          database: 'mariadb_multi_db_tests_database'
        },
        adminConfig: {
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'password',
          database: 'mysql'
        },
        schema: './test/db/mariadb_and_mysql_schema.sql'
      }
    }, null, 2))
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../configs', '.invalid-config.json')), JSON.stringify({
      default: '',
      sqlite: {
        config: {
          database: './test/sqlite-db/sqlite_multi_db_tests_database.sqlite'
        },
        schema: './test/db/pglite_postgres_and_sqlite_schema.sql'
      }
    }, null, 2))
    fs.writeFileSync(path.normalize(path.resolve(__dirname, '../configs', 'invalid-config.txt')), 'not valid json')
  }
}
