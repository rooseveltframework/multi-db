const path = require('path')
const createDatabase = require(path.join(__dirname, './createDatabase.js'))

async function insertValuesIntoPgliteTable () {
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
    }
  })

  // insert values into table
  let dbBeforeState
  if (process.argv[2] === '--transaction') {
    await db.query(`insert into test_table (
      name,
      description
    ) values (?, ?)`, values)
  } else if (process.argv[2] === '--transaction-rollback') {
    dbBeforeState = await db.query('select * from test_table') // select all values from table
    await db.query(`inser into test_table (
      name,
      description
    ) values (?, ?)`, values)
  } else {
    for (let i = 0; i < values.length; i++) {
      await db.query(`insert into test_table (
        name,
        description
      ) values (?, ?)`, [values[i].name, values[i].description])
    }
  }

  const { rows } = await db.query('select * from test_table') // select all values from table

  await db.endConnection() // end connection

  if (process.argv[2] === '--transaction-rollback') console.log(JSON.stringify(rows), JSON.stringify(dbBeforeState.rows))
  else console.log(JSON.stringify(rows))
}
insertValuesIntoPgliteTable()
