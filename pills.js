// Generics to be used in case of need
import * as R from "ramda"
import path from "path"
import fs from 'fs-extra'
import stringify from "json-stringify-pretty-compact"

// Assign `fn` as a callback for promise `pr`
export const then = fn => pr => pr.then(fn);

// Read file as json data
export const read = R.compose(JSON.parse, fs.readFileSync)

// Write json `data` to `file`
const write = file => data => fs.writeFileSync(
  file,
  stringify(data, { maxLength: 120 })
)

//// Location of country files
const fileLocation = (dir, extension) => country => path.resolve(
  // Make sure the given folder exists and return it.
  R.either(R.curryN(1, fs.ensureDirSync), R.identity)(dir),
  R.concat(country, extension)
)

// Downloaded osm pbf file
export const pbfFile = fileLocation("data/osm_pbf", "-latest.osm.pbf")

// Temporary file used to explore the contents of the pbf file.
export const inspectFile = fileLocation("data/osm_inspect", ".json")

// Extracted but not processed output file for country
export const rawFile = fileLocation("data/osm_raw", ".json")

// Extracted, parsed and manually modified file for country.
export const countryFile = fileLocation("data/countries", ".json")

// Not all countries of the world have an entry due to missing street names or
// other reasons. Return only those that we currently know about.
export const availableCountries = () => R.pipe(  
  fs.readdirSync,
  R.map(R.replace(".json", ""))
)("data/countries")

export const writeCountry  = R.compose(write, countryFile)
export const readCountry   = R.compose(read, countryFile)








