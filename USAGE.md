## Install

First mark your desired database drivers as dependencies in your app.

List of currently-supported database drivers:

- [mariadb](https://www.npmjs.com/package/mariadb) for MariaDB.
- [mysql2](https://www.npmjs.com/package/mysql2) for MySQL.
- [pg](https://www.npmjs.com/package/pg) for PostgreSQL.
- [pglite](https://www.npmjs.com/package/@electric-sql/pglite) for PGlite.
- [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) for SQLite.

Then mark the `multi-db-driver` npm package as a dependency in your app as well. Multi-DB is generally designed to work with the latest version of each supported database driver.

Then you can configure Multi-DB and connect to your database.

## Connect to a database using Multi-DB

```javascript
const db = await require('multi-db-driver')(config)
```

If you do not supply a `config` object in the constructor, Multi-DB will attempt to load your config from a `.multi-db-config.json` file that should most commonly be placed in the root directory of your app.

Multi-DB will look for that file in up to 3 directories above where the Multi-DB module is located (e.g. looking at parent directories starting with node_modules). You can change this behavior by setting the `MULTI_DB_CONFIG_FILE_SEARCH_ATTEMPTS` environment variable to a number other than 3. The default value of 3 will in most circumstances include the root directory of your app as one of the locations that will be searched for your Multi-DB config, which is why it's the default value.

If you want to set a location for the config file manually, then set the `MULTI_DB_CONFIG_LOCATION` environment variable to the absolute path on your filesystem to where your config is.

It is recommended that you add `.multi-db-config.json` to your .gitignore as well because it will typically contain database credentials.

See "Configuration" for information about how to set up a Multi-DB config.

## Performing database queries

The below examples show how to use Multi-DB to query your database(s) from the simplest usage to the most complex, demonstrating how this module focuses on adding complexity only when needed as a progressive enhancement atop simpler, more concise syntax.

### Example of one universal query that works with any database you set in your config

```javascript
const simpleQuery = await db.query('select * from some_table')
```

This usage is basically as concise as any standalone database driver would be, except it will work with any database that uses the same SQL syntax for this specific query and similar basic ones.

### Universal query but with parameters

```javascript
const noNormalizingNeeded = await db.query('select * from some_table where something = ?', ['some value'])
```

The second argument is optional if you don't need params.

### Universal query with parameters and a callback function for post-processing

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

The third argument is optional if you don't need a post-processing function.

The post-processing function is useful if you need to call out specific post-processing behaviors for certain databases.

### Default query with special query for a specific database

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

This supplies an object instead of a string to the query argument.

It also combines all the other above features too, showing a maximally featureful and flexible version of the query method.

By default Multi-DB will rewrite the query under the hood to use `$1` instead of `?` for queries being executed against PostgreSQL and PGlite. You can disable this behavior by setting `questionMarkParamsForPostgres` to `false` in your Multi-DB config, or by setting `disableQuestionMarkParamsForPostgres` to `true` at the query level in the query object.

## CLI scripts

This module also comes with a `cli.js` file to automate common database setup and teardown tasks. It will load your Multi-DB config and connect to the database using the `adminConfig` to perform these tasks.

The `cli.js` file supports the following commands:

- `cli.js --create`: Creates the user and database specified in your config if it does not already exist.
- `cli.js --destroy`: Drops the user and database specified in your config.
- `cli.js --file file.sql`: Executes the SQL statements in the specified SQL file. Will attempt to do so using the regular less privileged config by default and will escalate to the admin config only if the less privileged config is unable to connect.
- `cli.js --dump-schema path/to/schema.sql`: Dumps the connected database's schema to specified SQL file path. Will create file in specified path if it does not already exist.
- `cli.js --dump-data path/to/schema.sql`: Dumps the connected database's schema and data to specified SQL file path. Will create file in specified path if it does not already exist.

For the dump commands to work, you will need to ensure `pg_dump`, `mysqldump`, and `sqlite3` are in your PATH.

### Options

- Skip the prompts with `--yes`.
- Suppress logs and warnings with `--suppress-logs`.
- Suppress errors with `--suppress-errors`.
- Enable verbose logging with `--enable-verbose`.

### Integrating the CLI scripts into your app

It is recommended that you create npm scripts in your app's package.json file to run those commands. Example usage of those scripts if you create them would look something like this:

- `npm run create-db`: Executes `node [...]/cli.js --create`.
- `npm run destroy-db`: Executes `node [...]/cli.js --destroy`.
- `npm run db-file -- file.sql`: Executes `node [...]/cli.js --file file.sql`.
- `npm run db-schema-dump -- path/to/schema.sql`: Executes `node [...]/cli.js --dump-schema path/to/schema.sql`.
- `npm run db-data-dump -- path/to/schema.sql`: Executes `node [...]/cli.js --dump-data path/to/schema.sql`.

Replace the `[...]` part in the above examples with the path to where your copy of this module resides, e.g. in `node_modules`, lib, `git_modules`, or wherever it happens to be in your app.
