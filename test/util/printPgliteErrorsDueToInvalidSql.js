const path = require('path')
const createDatabase = require(path.join(__dirname, './createDatabase.js'))
const runQueryWithInvalidSyntax = require(path.join(__dirname, './runQueryWithInvalidSyntax.js'))

async function printPgliteErrorsDueToInvalidSql () {
  await createDatabase('pglite') // create database

  // run query with invalid syntax
  const result = await runQueryWithInvalidSyntax({
    default: 'pglite',
    pglite: {
      config: {
        database: './test/pglite-db'
      }
    }
  })

  console.log(JSON.stringify(result))
}
printPgliteErrorsDueToInvalidSql()
