![Original logo by Lorc; modified for this project https://game-icons.net/1x1/lorc/octopus.html](multi-db.png)

multi-db
===

A thin abstraction around selected Node.js database drivers to normalize their APIs to one simplified common API. This makes it possible to write a Node.js app that supports multiple databases by configuration with minimal additional boilerplate needed per additional database.

`multi-db` currently supports MariaDB, MySQL, PGlite, PostgreSQL, and SQLite.

## Features and design philosophy

- **Switch to another database without code changes:** Suppose you use `pg` to connect your app to a PostgreSQL database but later want to reconfigure your app to use a MariaDB database instead using the `mariadb` module. To switch to the new database, you're looking at significant code changes to your app because there are significant API differences between the two database driver modules. But if you use `multi-db` instead of working with the database driver directly, you can switch databases with a simple configuration change, similar to an [ORM](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping).
- **Support multiple databases at the same time without committing to the heavy abstractions of an ORM:** If you want the deployer of your app to be able to choose which database to use (e.g. some prefer PostgreSQL, others prefer MySQL, etc), you're often stuck with coding your app using an ORM, but ORMs are too heavy for many use cases. Most SQL queries are fairly universal and will execute in any SQL-based database with little to no modification. For example, every SQL database supports `select * from some_table` with no syntax differences. Why abstract that around an ORM? As such, developers should be able to support multiple databases while still being able to just write SQL instead of committing to an ORM's entire set of abstractions that take the ability to directly write SQL queries away from you.
  - The most common syntax difference between the most common SQL queries is the query parameter syntax difference between PostgreSQL and other databases. Both PGlite and PostgreSQL requires you to use the `$1 $2 $3 etc` syntax for parameterized queries, but other databases permit the use of `?` for parameterized queries instead. To resolve that syntax difference, this module adds support for `?` query parameter syntax to PGlite and PostgreSQL to make it easier to write universal queries that can execute against all supported databases.
  - There will of course be unavoidable syntax differences for advanced queries. So by default `multi-db` will encourage you to write universal queries, but in cases where you need to call out a separate query for a specific database, you can do so with minimal boilerplate so that you only need to add additional complexity to your queries as-needed. See below for simple and advanced usage examples to see how this works.
  - `multi-db` also normalizes the top level query result object structure to one format as well so the way you get the result rows is the same across all database drivers.
- **Reduce boilerplate, even if you only want to support one database:** This module also makes life easier for you when you're using only one database too by automating the database connection procedure, pooling procedure, and providing a set of command line scripts to automate common setup and teardown tasks.
- **Automatic common credential guessing to ease development:** A common problem on development teams with developers that use different operating systems is the default admin credentials on their local instance of PostgreSQL, MySQL, etc might be slightly different on a per instance basis, so no single default config will successfully connect to everyone's local database unless every developer on the team manually resets their admin credentials to something everyone on the team agrees to use. `multi-db` bypasses this problem by attempting to connect with the specified config first, but then if that fails it will attempt to connect with a series of common defaults instead.

This module was built and is maintained by the [Roosevelt web framework](https://github.com/rooseveltframework/roosevelt) [team](https://github.com/orgs/rooseveltframework/people), but it can be used independently of Roosevelt as well.

Usage
---

First mark your desired database drivers as dependencies in your app.

List of currently-supported database drivers:

- [mariadb](https://www.npmjs.com/package/mariadb) for MariaDB.
- [mysql2](https://www.npmjs.com/package/mysql2) for MySQL.
- [pglite](https://www.npmjs.com/package/@electric-sql/pglite) for PGlite.
- [pg](https://www.npmjs.com/package/pg) for PostgreSQL.
- [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) for SQLite.

Then mark `multi-db` as a dependency in your app as well. `multi-db` is generally designed to work with the latest version of each supported database driver.

Then you can configure `multi-db` and connect to your database. 

### Connecting to a database using multi-db

```javascript
const db = await require('multi-db')(config) // config object is optional
```

That will load a `multi-db` config and connect to your chosen database.

By default all config values are sourced from a `.multi-db-config.json` file that should most commonly be placed in the root directory of your app.

`multi-db` will look for that file in up to 3 directories above where the `multi-db` module is located (e.g. looking at parent directories starting with node_modules). You can change this behavior by setting the `MULTI_DB_CONFIG_FILE_SEARCH_ATTEMPTS` environment variable to a number other than 3. The default value of 3 will in most circumstances include the root directory of your app as one of the locations that will be searched for your `multi-db` config, which is why it's the default value.

If you want to set a location for the config file manually, then set the `MULTI_DB_CONFIG_LOCATION` environment variable to the absolute path on your filesystem to where your config is.

It is recommended that you add `.multi-db-config.json` to your `.gitignore` as well.

You can also set any or all config values in the constructor instead if you like too.

### Configuring multi-db

The following params are available when creating your `multi-db` config file or passing params via the constructor:

#### Required params

- `default`: *[String]* Which database your app will use by default.
  - Available options: 
    - `mariadb`
    - `mysql`
    - `pglite`
    - `postgres`
    - `sqlite`

- `[database_name]`: *[Object]* Configs specific to each database.
  - Object key name options *[String]*:
    - `mariadb`
    - `mysql`
    - `pglite`
    - `postgres`
    - `sqlite`

  - Object values:
    - `config`: *[Object]* Which config to attempt to connect to your database with by default. This object will be passed directly to the database driver, so the values should be set to whatever the database driver expects you to use to connect (e.g. host, username, password, database, other database configuration options).
      - It is recommended that you set the user to a less privileged user, typically meaning this user should be able to insert and delete data, but not create, alter, or drop tables.
      - If the credentials you specify do not exist, they can be created from the CLI scripts, which will use the `adminConfig` to connect in order to create the less privileged credentials.

    - `adminConfig`: *[Object]* Same as `config` but you should configure it to use more privileged credentials, e.g. an account that is authorized to create tables, drop tables, administrate other users, etc. This config will be used for the CLI scripts for setup and teardown tasks. The regular, typically less-privileged config will be used for your app's business logic.


#### Optional params

- `admin`: *[Boolean]* Force the use of `adminConfig` for your database instead of the regular `config`.

  - Default: `false`.

- `schema`: *[String]* Relative path to a file with what set of SQL statements you want to execute against your database when it is freshly created, if any.

  - Default: `undefined`.

- `loggerConfig`: *[Object]* Options to suppress various kinds of logging.

  - Default settings:

    - ```json
      loggerConfig: {
        log: true, // regular logs
        error: true, // logging errors
        verbose: true // verbose logging
      }
      ```

- `questionMarkParamsForPostgres`: *[Boolean]* Automatically convert parameterized query placeholders from `?` to `$ + number` within `multi-db` for PostgreSQL queries so you can use the `?` syntax in PostgreSQL queries, which isn't possible in native PostgreSQL queries.

  - Default: `true`.

- `mergeConfig`: *[Boolean]* By default, a config passed via constructor or environment variable will merge with any `.multi-db-config.json` file detected in your app's directory structure. To disable this merging behavior and simply use the config passed via constructor or environment variable verbatim, set this option to `false`.

  - Default: `true`.

#### Example configs

Example for MariaDB:

````json
{
  "default": "mariadb",
  "mariadb": {
    "config": {
      "host": "localhost",
      "port": 3306,
      "user": "app_name",
      "password": "app_password",
      "database": "app_name"
    },
    "adminConfig": {
      "host": "localhost",
      "port": 3306,
      "user": "root",
      "password": "password",
      "database": "mariadb"
    },
    "schema": "db/schema.sql"
  }
}
````

Example for MySQL:

````json
{
  "default": "mysql",
  "mysql": {
    "config": {
      "host": "localhost",
      "port": 3306,
      "user": "app_name",
      "password": "app_password",
      "database": "app_name"
    },
    "adminConfig": {
      "host": "localhost",
      "port": 3306,
      "user": "root",
      "password": "password",
      "database": "mysql"
    },
    "schema": "db/schema.sql"
  }
}
````

Example for PGlite:

```json
{
  "default": "pglite",
  "pglite": {
    "config": {
      "database": "pg-data"
    },
    "schema": "db/schema.sql"
  }
}
```

Example for PostgreSQL:

```json
{
  "default": "postgres",
  "postgres": {
    "config": {
      "host": "localhost",
      "port": 5432,
      "user": "app_name",
      "password": "app_password",
      "database": "app_name"
    },
    "adminConfig": {
      "host": "localhost",
      "port": 5432,
      "username": "admin",
      "password": "admin_password",
      "database": "postgres"
    },
    "schema": "db/schema.sql"
  }
}
```

Example for SQLite:

````json
{
  "default": "sqlite",
  "sqlite": {
    "config": {
      "database": "db.sqlite"
    },
    "schema": "db/schema.sql"
  }
}

````

You could also create a single config that has configs for multiple databases or all of them if you like, but only one can be connected to per instance of `multi-db`.

### CLI scripts

This module also comes with a `cli.js` file to automate common database setup and teardown tasks. It will load your `multi-db` config and connect to the database using the `adminConfig` to perform these tasks.

The `cli.js` file supports the following commands:

- `cli.js --create`: Creates the user and database specified in your config if it does not already exist.
- `cli.js --destroy`: Drops the user and database specified in your config.
- `cli.js --file file.sql`: Executes the SQL statements in the specified SQL file. Will attempt to do so using the regular less privileged config by default and will escalate to the admin config only if the less privileged config is unable to connect.
- `cli.js --dump-schema path/to/schema.sql`: Dumps the connected database's schema to specified SQL file path. Will create file in specified path if it does not already exist.
- `cli.js --dump-data path/to/schema.sql`: Dumps the connected database's schema and data to specified SQL file path. Will create file in specified path if it does not already exist.

For the dump commands to work, you will need to ensure `pg_dump`, `mysqldump`, and `sqlite3` are in your PATH.

#### Options

- Skip the prompts with `--yes`.
- Suppress logs and warnings with `--suppress-logs`.
- Suppress errors with `--suppress-errors`.
- Enable verbose logging with `--enable-verbose`.

#### Integrating the CLI scripts into your app

It is recommended that you create npm scripts in your app's package.json file to run those commands. Example usage of those scripts if you create them would look something like this:

- `npm run create-db`: Executes `node [...]/cli.js --create`.
- `npm run destroy-db`: Executes `node [...]/cli.js --destroy`.
- `npm run db-file -- file.sql`: Executes `node [...]/cli.js --file file.sql`.
- `npm run db-schema-dump -- path/to/schema.sql`: Executes `node [...]/cli.js --dump-schema path/to/schema.sql`.
- `npm run db-data-dump -- path/to/schema.sql`: Executes `node [...]/cli.js --dump-data path/to/schema.sql`.

Replace the `[...]` part in the above examples with the path to where your copy of this module resides, e.g. in node_modules, lib, git_modules, or wherever it happens to be in your app.

### multi-db API

When you connect to a database using `multi-db` like in the below example, the constructor will return a `db` object.

```javascript
const db = await require('multi-db')(config)
```

This is the structure of the `db` object that `multi-db` returns:

- `db.query(...)`: Universal database query method that works on all supported databases.
  - Arguments you can pass:
    - `query`: Takes either a string or an object:
      - When supplied a string as an argument, it will execute the query string against the default driver.
      - When supplied an object as an argument, you can supply the following keys:
        - `default`: A query string to execute against whichever database is the default.
        - `mariadb`: A query string that will only execute against MariaDB databases.
        - `mysql`: A query string that will only execute against MySQL databases.
        - `pglite`: A query string that will only execute against SQLite databases.
        - `postgres`: A query string that will only execute against PostgreSQL databases.
        - `sqlite`: A query string that will only execute against SQLite databases.
        - `disableQuestionMarkParamsForPostgres`: Set to true to prevent the query from attempting to normalize parameterized query placeholders from `?` syntax to `$1 $2 $3 etc` syntax for PGlite and PostgreSQL queries.
    - `params`: Optional array of parameters to supply values to the query.
    - `next(...)`: Optional callback function to execute when the query is finished.
      - Arguments provided:
        - `db`: Which database the query was executed against.
        - `result`: The resulting object from the query the database driver gives you.
- `db.config`: Object representing the config loaded.
- `db.driver`: The object the default database driver module returns in case you need to interact with it directly.
- `db.drivers`: Object collection of all the driver modules currently loaded.
- `db.mariadb`: MariaDB-specific APIs.
  - `driver`: The object the `mariadb` module returns in case you need to interact with it directly.
  - `pool`: The pool instance returned by [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs)'s createPool method once instantiated.
  - `conn`: The connection instance returned by the pool instance's getConnection method once instantiated.
  - `username`: Username of the current active connection, if a connection is active.
  - `database`: Which database the currently active connection is connected to, if a connection is active.
  - `query(queryString)`: Function that takes a query string and executes it against the `mariadb` driver.
- `db.mysql`: MySQL-specific APIs.
  - `driver`: The object the `mysql2` module returns in case you need to interact with it directly.
  - `pool`: The pool instance returned by [mysql2's createPool](https://github.com/sidorares/node-mysql2#using-connection-pools) method once instantiated.
  - `conn`: The connection instance returned by the pool instance's getConnection method once instantiated.
  - `username`: Username of the current active connection, if a connection is active.
  - `database`: Which database the currently active connection is connected to, if a connection is active.
  - `query(queryString)`: Function that takes a query string and executes it against the `mysql2` driver.
- `db.pglite`: PGlite-specific APIs.
  - `driver`: The object the `@electric-sql/pglite` module returns in case you need to interact with it directly.
  - `db`: The database instance returned by [@electric-sql/pglite's Database constructor](https://github.com/electric-sql/pglite?tab=readme-ov-file#main-constructor) once instantiated.
  - `query(queryString)`: Function that takes a query string and executes it against the `@electric-sql/pglite` driver.
- `db.postgres`: PostgreSQL-specific APIs.
  - `driver`: The object the `pg` module returns in case you need to interact with it directly.
  - `pool`: The instance of [pg.Pool](https://node-postgres.com/apis/pool) created by multi-db once instantiated.
  - `client`: The instance of [pg.Client](https://node-postgres.com/apis/client) created by multi-db once instantiated.
  - `username`: Username of the current active connection, if a connection is active.
  - `database`: Which database the currently active connection is connected to, if a connection is active.
  - `query(queryString)`: Function that takes a query string and executes it against the `pg` driver.
- `db.sqlite`: SQLite-specific APIs.
  - `driver`: The object the `better-sqlite3` module returns in case you need to interact with it directly.
  - `db`: The database instance returned by [better-sqlite3's Database constructor](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#new-databasepath-options) once instantiated.
  - `query(queryString)`: Function that takes a query string and executes it against the `better-sqlite3` driver.

## Usage examples

The below examples show how to use `multi-db` to query your database(s) from the simplest usage to the most complex, demonstrating how this module focuses on adding complexity only when needed as a progressive enhancement atop simpler, more concise syntax.

------

Example of one universal query that works with any database you set in your config:

```javascript
const simpleQuery = await db.query('select * from some_table')
```

- This usage is basically as concise as any standalone database driver would be, except it will work with any database that uses the same SQL syntax for this specific query and similar basic ones.

---

Universal query but with parameters:

```javascript
const noNormalizingNeeded = await db.query('select * from some_table where something = ?', ['some value'])
```
- The second argument is optional if you don't need params.

---

Universal query with parameters and a callback function for post-processing:

```javascript
const normalizedDataUniversalQuery = await db.query('select * from some_table where something = ?', ['some value'], function (db, result) {
  switch (db) {
    case 'mysql':
      // do stuff if it was a mysql query
      return result
    default:
      // do stuff if it was a query to any other kind of database
      return result
  }
})
```

- The third argument is optional if you don't need a post-processing function.
- The post-processing function is useful if you need to call out specific post-processing behaviors for certain databases.

---

Default query with special query for a specific database:

```javascript
const normalizedDataMultipleQueries = await db.query(

// queries object
{
  default: 'select * from some_table where something = ?',
  mysql: 'some mysql-specific version of the query where something = ?'
},

// values array
['some value'],

// postprocess function
function (db, result) {
  switch (db) {
    case 'mysql':
      // do stuff if it was a mysql query
      return result
    default:
      // do stuff if it was any other kind of query
      return result
  }
})
```
- Do this by supplying an object instead of a string to the query argument.
- Also combines all the other above features too, showing a maximally featureful and flexible version of the query method.
- By default `multi-db` will rewrite the query under the hood to use `$1` instead of `?` for queries being executed against PGlite and PostgreSQL. You can disable this behavior by setting `questionMarkParamsForPostgres` to `false` in your `multi-db` config, or by setting `disableQuestionMarkParamsForPostgres` to `true` at the query level in the query object. 

## Writing code for multi-db

Here's how to set up a development environment to hack on `multi-db`'s code and run the tests:

### Run the tests with Docker

- Install Node.js / npm.
- Fork/clone this repo.
- `npm ci`
- Install Docker.
- `npm run docker-test` to run the tests or `npm run docker-coverage` to see test coverage.

### Run the tests natively

- Install Node.js / npm.
- Fork/clone this repo.
- `npm ci`
- Install MySQL (this is used to test both MySQL and MariaDB drivers):
  - Windows:
    - Install from: https://dev.mysql.com/downloads/mysql/
    - Use `password` for the root password.
  - Mac
    - Install from: https://dev.mysql.com/downloads/mysql/
    - Use `password` for the root password.
    - Add `/usr/local/mysql/bin` to your PATH.
  - Ubuntu:
    - `sudo apt install mysql-server`
    - `sudo mysqld --initialize`
    - `sudo mysql -u root`
    - `ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';`
- Install PostgreSQL:
  - Windows: 
    - Install from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
    - Use `postgres` for the superuser password.
  - Mac:
    - Install from: https://postgresapp.com/
    - Open Postgres.app and initialize.
  - Ubuntu:
    - `sudo apt install postgresql`
    - `sudo -u postgres psql postgres`
      - Note: default database password is `postgres`.
    - `ALTER USER postgres WITH PASSWORD 'postgres';`
    - `quit`
    - Change line in pg_hba.conf file under `# "local" is for Unix domain socket connections only` to `local all all trust`.
- Install SQLite:
  - Windows: 
    - Download `sqlite-tools-....zip` listed under `Precompiled Binaries for Windows` from: https://www.sqlite.org/download.html
    - Create a new folder named `sqlite` anywhere on your machine.
    - Extract contents of `sqlite-tools-....zip` into your created `sqlite` folder.
  - Mac:
    - Comes pre-installed.
  - Ubuntu:
    - `sudo apt install sqlite3`
- `npm t` to run the tests or `npm run coverage` to see test coverage.