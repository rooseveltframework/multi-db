const path = require('path')
const createDatabase = require(path.join(__dirname, './createDatabase.js'))

async function printPgliteErrorsDueToBadConfig () {
  await createDatabase('pglite') // create database

  // connect to database
  const db = await require('../../multi-db-driver')({
    default: 'pglite',
    pglite: {
      config: {
        database: './test/path-doesnt-exist/pglite-db'
      }
    },
    loggerConfig: {
      log: false,
      error: false,
      verbose: false
    }
  })

  const result = db.pglite.db
  await db.endConnection() // end connection

  console.log(JSON.stringify(result))
}
printPgliteErrorsDueToBadConfig()
