[![npm](https://img.shields.io/npm/v/multi-db-driver.svg)](https://www.npmjs.com/package/multi-db-driver)

<img src="https://media.githubusercontent.com/media/rooseveltframework/multi-db/refs/heads/main/multi-db.png" alt="Multi-DB logo" title="Multi-DB logo" class="float-right rounded-edges">

A thin abstraction around selected Node.js database drivers to normalize their APIs to one simplified common API. This makes it possible to write a Node.js app that supports multiple databases by configuration with minimal additional boilerplate needed per additional database.

Multi-DB currently supports MariaDB, MySQL, PostgreSQL, PGlite, and SQLite.

## Features and design philosophy

### Switch to another database without code changes

Suppose you use `pg` to connect your app to a PostgreSQL database but later want to reconfigure your app to use a MariaDB database instead using the `mariadb` module. To switch to the new database, you're looking at significant code changes to your app because there are significant API differences between the two database driver modules. But if you use Multi-DB instead of working with the database driver directly, you can switch databases with a simple configuration change, similar to an [ORM](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping).

### Support multiple databases at the same time without committing to the heavy abstractions of an ORM

If you want the deployer of your app to be able to choose which database to use (e.g. some prefer PostgreSQL, others prefer MySQL, etc), you're often stuck with coding your app using an ORM, but ORMs are too heavy for many use cases. Most SQL queries are fairly universal and will execute in any SQL-based database with little to no modification. For example, every SQL database supports `select * from some_table` with no syntax differences. Why abstract that around an ORM? As such, developers should be able to support multiple databases while still being able to just write SQL instead of committing to an ORM's entire set of abstractions that take the ability to directly write SQL queries away from you.

The most common syntax difference between the most common SQL queries is the query parameter syntax difference between PostgreSQL and other databases. Both PostgreSQL and PGlite requires you to use the `$1 $2 $3 etc` syntax for parameterized queries, but other databases permit the use of `?` for parameterized queries instead. To resolve that syntax difference, this module adds support for `?` query parameter syntax to PostgreSQL and PGlite to make it easier to write universal queries that can execute against all supported databases.

There will of course be unavoidable syntax differences for advanced queries. So by default Multi-DB will encourage you to write universal queries, but in cases where you need to call out a separate query for a specific database, you can do so with minimal boilerplate so that you only need to add additional complexity to your queries as-needed.

Multi-DB also normalizes the top level query result object structure to one format as well so the way you get the result rows is the same across all database drivers.

### Reduce boilerplate, even if you only want to support one database

This module also makes life easier for you when you're using only one database too by automating the database connection procedure, pooling procedure, and providing a set of command line scripts to automate common setup and teardown tasks.

### Automatic common credential guessing to ease development

A common problem on development teams with developers that use different operating systems is the default admin credentials on their local instance of PostgreSQL, MySQL, etc might be slightly different on a per instance basis, so no single default config will successfully connect to everyone's local database unless every developer on the team manually resets their admin credentials to something everyone on the team agrees to use. Multi-DB bypasses this problem by attempting to connect with the specified config first, but then if that fails it will attempt to connect with a series of common defaults instead.

This module was built and is maintained by the [Roosevelt web framework](https://rooseveltframework.org) [team](https://rooseveltframework.org/contributors), but it can be used independently of Roosevelt as well.

<details open>
  <summary>Documentation</summary>
  <ul>
    <li><a href="./USAGE.md">Usage</a></li>
    <li><a href="./CONFIGURATION.md">CONFIGURATION</a></li>
  </ul>
</details>
