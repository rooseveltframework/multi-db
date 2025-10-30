const path = require('path')
const createDatabase = require(path.join(__dirname, './createDatabase.js'))

async function deleteValuesFromPgliteTable () {
  const values = [
    { name: 'magnus', description: 'chess master' },
    { name: 'nick', description: 'software engineer' },
    { name: 'tua', description: 'quarterback' }
  ]

  await createDatabase('pglite') // create database

  // connect to database
  const db = await require('../../multi-db-driver')({
    default: 'pglite',
    pglite: {
      config: {
        database: './test/pglite-db'
      }
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

  await db.query('delete from test_table')
  const { rows } = await db.query('select * from test_table') // select all values from table
  await db.endConnection() // end connection

  console.log(rows)
}
deleteValuesFromPgliteTable()
