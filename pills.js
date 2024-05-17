// Generics to be used in case of need

import * as R from "ramda"
import path from "path"
import fs from 'fs-extra'
import stringify from "json-stringify-pretty-compact"

// Assign `fn` as a callback for promise `pr`
export const then = fn => pr => pr.then(fn);

export const delay = ms => new Promise(res => setTimeout(res, ms))

// Read file as json data
export const read = R.compose(JSON.parse, fs.readFileSync)

// Write json `data` to `file`
export const write = file => data => fs.writeFileSync(
  file,
  stringify(data, { maxLength: 120 })
)

//// Location of country files
export const fileLocation = (dir, extension) => country => path.resolve(
  // Make sure the given folder exists and return it.
  R.either(R.curryN(1, fs.ensureDirSync), R.identity)(dir),
  R.concat(country, extension)
)
