const process = require('process')
const path = require('path')
const fs = require('fs')

module.exports = async (logger, params) => {
  let userConfig = {}
  if (userConfig && params) userConfig = params
  let fileConfig = null

  // sniff env var MULTI_DB_CONFIG_LOCATION for alternate config file name and location
  if (process.env.MULTI_DB_CONFIG_LOCATION) {
    if (fs.existsSync(path.normalize(process.env.MULTI_DB_CONFIG_LOCATION))) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(path.normalize(process.env.MULTI_DB_CONFIG_LOCATION)))
        if (fileConfig.mergeConfig === false) userConfig = fileConfig
        else if (Object.keys(userConfig).length === 0) userConfig = Object.assign(userConfig, fileConfig)
        else userConfig = Object.assign(fileConfig, userConfig)
      } catch (e) {
        logger.error(e)
        logger.error('Attempted to load multi-db config from MULTI_DB_CONFIG_LOCATION environment variable, but there was an error loading the file. Please ensure you have specified the path correctly and that it is valid JSON.')
      }
    } else {
      logger.error('Attempted to load multi-db config from MULTI_DB_CONFIG_LOCATION environment variable, but there was an error loading the file. Please ensure you have specified the path correctly.')
    }
  }

  // find .multi-db-config.json
  // will attempt to find it first by looking up one directory
  // then it will go up two more directories if it doesn't find it before giving up
  let config = fileConfig || {}
  let configDir = process.cwd() + '/'
  const configDirsUp = parseInt(process.env.MULTI_DB_CONFIG_FILE_SEARCH_ATTEMPTS) >= 0 ? parseInt(process.env.MULTI_DB_CONFIG_FILE_SEARCH_ATTEMPTS) : 3 // how many directories up to search for the file
  for (let i = 0; i < configDirsUp; i++) {
    try {
      config = JSON.parse(fs.readFileSync(path.normalize(configDir + '.multi-db-config.json')))
      break
    } catch (e) {
      configDir += '../'
    }
  }
  if (userConfig) {
    if (userConfig.mergeConfig === false) config = userConfig
    else config = Object.assign(config, userConfig) // merge the base config with user supplied configs; the latter will overwrite the former's defaults
  }

  if (params) {
    if ((Object.keys(params).length === 2 && params.admin && params.loggerConfig) || (Object.keys(params).length === 1 && params.loggerConfig) || (Object.keys(params).length === 1 && params.admin)) {
      config = Object.assign(config, params) // merge admin and/or loggerConfig with config if supplied as params
    }
    if (params.mergeConfig === false) {
      config = params // override config with config supplied as params
    }
  }

  if (!config.default) {
    logger.error('Couldn\'t find multi-db config.')
  }

  return config
}
