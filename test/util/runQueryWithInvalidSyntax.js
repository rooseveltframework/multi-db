module.exports = async (config) => {
  config.loggerConfig = {
    log: false,
    error: false,
    verbose: false
  }
  const db = await require('../../multi-db-driver')(config) // connect to database
  const result = await db.query('sel all from test_table') // select all values from table
  await db.endConnection() // end connection
  return new Promise((resolve, reject) => resolve(result)) // return result
}
