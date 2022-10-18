const { Parser } = require('node-sql-parser')
const parser = new Parser()

module.exports = async (query) => {
  const ast = parser.astify(query, { database: 'sqlite' })
  function deepEqual (a, b) {
    if (a === b) return true
    if (a == null || typeof a !== 'object' || b == null || typeof b !== 'object') return false
    const propsInA = Object.keys(a).length
    let propsInB = 0
    for (const prop in b) {
      propsInB += 1
      if (!(prop in a) || !deepEqual(a[prop], b[prop])) return false
    }
    return propsInA === propsInB
  }
  let nameCount = 1
  async function deepModify (obj) {
    for (const key in obj) {
      const val = obj[key]
      if (typeof val === 'object' && val !== null) {
        if (deepEqual(val, { type: 'origin', value: '?' })) {
          for (const key in obj) {
            if (deepEqual(obj[key], { type: 'origin', value: '?' })) {
              obj[key] = { type: 'var', name: nameCount, members: [], quoted: null, prefix: '$' }
              nameCount++
            }
          }
        } else {
          deepModify(val)
        }
      }
    }
  }
  await deepModify(ast)

  return parser.sqlify(ast, { database: 'Postgresql' })
}
