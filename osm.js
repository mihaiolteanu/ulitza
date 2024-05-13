import {Transform} from "stream"
import path from "path"
import fs from 'fs-extra'
import osm_parser from 'osm-pbf-parser'
import stringify from "json-stringify-pretty-compact"
import * as R from "ramda"
import { equivalentStreet } from "./equivalents.js"
import {stripAffixes} from "./affixes.js"
import { minStreetFrequency, countryRegion } from "./regions.js"
// import { then } from "./pills.js"

export const osmPath = country => path.resolve("data/osm_pbf", country + "-latest.osm.pbf")
const inspectPath = country => path.resolve("data/osm_inspect", country + "-inspect.json") 

// RW json data
const write = file => data =>
  fs.writeFileSync(file, stringify(data, { maxLength: 120 }))
const read = R.compose(JSON.parse, fs.readFileSync)
const then = fn => pr => pr.then(fn);

// RW out files
const rawPath       = path.resolve(fs.ensureDirSync("data/osm_raw") || "data/osm_raw")
const rawFile       = country => path.resolve(rawPath, country + ".json")
const readRaw       = country => read(rawFile(country))
export const countriesPath = "data/countries"
const countryFile   = country => path.resolve(countriesPath, country + ".json")
const writeCountry  = R.compose(write, countryFile)
export const readCountry   = R.compose(read, countryFile)

export const downloadOsm = (country) => R.pipe(
  countryRegion,
  region => `http://download.geofabrik.de/${region}/${country}-latest.osm.pbf`,  
  fetch,
  then(v => v.arrayBuffer()),
  then(Buffer.from),
  then(buffer => fs.createWriteStream(osmPath(country)).write(buffer)),  
)(country)

// Get the file modified date from the OS; good enough to get a glimpse of the
// freshness of osm data; the alternative is to extract the modified date from
// the osm file (more complicated)
const modifiedDateOSM = country => R.pipe(
  osmPath,
  fs.statSync,
  f => f.mtime.toDateString().substring(4),
)(country)

// Explore the osm data.  I've used this to explore what osm fields contain
// street data.
export const inspectOsmData = (country, regex) => fs.createReadStream(osmPath(country))
  .on("open", () => fs.writeFileSync(inspectPath(country), "create new file"))
  .pipe(new osm_parser())
  .pipe(new Transform({
    objectMode: true,
    transform: (chunk, _encoding, callback) =>
      R.pipe(
        R.map(JSON.stringify),
        R.filter(R.test(new RegExp(regex, "i"))),
        R.map(JSON.parse),
        // Ignore non-interesting fields
        R.map(R.omit(["id", "lat", "lon", "info", "refs", "members"])),
        out => out.length > 0 ?
          fs.appendFileSync(inspectPath(country), JSON.stringify(out, null, 2))
          : "ignore",
        () => callback(null, null)
      )(chunk)
  }))

export const extractOsmData = (country) => {
  const streets = fs.createWriteStream(rawFile(country))
  // Add metadata; only the osm last modified date, for now
  streets.write(`[["${modifiedDateOSM(country)}"]`)
  fs.createReadStream(osmPath(country))
    .pipe(new osm_parser())
    .pipe(new Transform({
      objectMode: true,
      transform: (chunk, _encoding, callback) =>
        R.pipe(
          // Keep only pbf entries of type `node` and `way`.  If other pbf entries
          // are found to contain relevant street name data, include them here.      
          R.filter(R.compose(
            R.includes(R.__, ["node", "way"]),
            R.prop("type")
          )),
          // Extract the `tags` key. If it exists, this key contains the street
          // names.  If not, ignore this entry.
          R.filter(R.prop("tags")),
          R.map(R.prop("tags")),
          // There are multiple keys that contain the city+street name duo. Check
          // all known combinations on each entry and keep the ones that are valid.
          // If, in the future, other combinations are found to contain relevant
          // street name data, include them here.      
          R.chain(R.juxt([
            R.props(["is_in:city", "name"]),
            R.props(["addr:city", "addr:street"])
          ])),
          R.reject(R.any(R.isNil)),
          // Pass the transformed chunk to the next stage.      
          out => callback(null, out)
        )(chunk)
    }))
    .on("data", R.pipe(
      R.uniqBy(R.join("-")),
      R.map(s => streets.write(",\n" + stringify(s)))
    ))
    .on("finish", () => {
      streets.write("]")
      streets.close()
    })
}

export const parseOsmData = (country) => R.pipe(
  readRaw,
  // Skip the osm modified date
  R.tail,
  // Strip affixes and replace with equivalents;  keep city unchanged
  R.map(R.adjust(1, R.compose(equivalentStreet(country), stripAffixes(country)))),
  // Even without the previous step, but moreso after it, there will be
  // identical [city, name] entries. I've decided to allow only a single
  // eponym per city, even though there might be eponyms for streets, squares
  // or other landmarks representing the same person, all in the same city.
  // This is a fair defense against misspelled streets or ones tagged multiple
  // times with slightly different affixes or equivalents, all in the same
  // city.  Counting all these would be a mistake.  Still, in some instances,
  // the city names themselves are spelled differently (with or without
  // cedilla, for example).
  R.uniqBy(R.join("-")),
  // The city name has served its purpose, discard it.
  R.map(R.prop(1)),
  // Count identical street names.
  R.groupBy(R.identity),
  R.mapObjIndexed(R.length),
  // Transform to [streetName, count] array
  R.toPairs,
  // Remove streets composed of numbers, letters or other names less than 3
  // characters to reduce the output file size; most than likely these do not
  // designate persons.  Note: it might not apply for China/Korea/Taiwan/etc.
  R.reject(R.compose(
    R.gte(3),
    R.length,
    R.prop(0))
  ),
  // Protect against garbage entries and very long files (lots of streets)
  R.reject(R.compose(
    R.gt(minStreetFrequency(country)),
    R.prop(1))
  ),
  // Sort by most frequent street names first.
  R.sortWith([R.descend(R.prop(1))]),
  hydrateStreets(country),
  // Add back the osm modified date
  R.prepend(R.head(readRaw(country))),
  writeCountry(country),    
)(country)

const hydrateStreets = (country) => streets =>
  fs.existsSync(countryFile(country)) ?
    R.pipe(
      readCountry,
      prevStreets =>
        R.map(entry =>
          R.pipe(
            R.find(R.compose(R.equals(R.head(entry)), R.head)),            
            // Add the existing link, if it exists.  When adding links by hand,
            // it might happen that the url is encoded during copy/paste
            // (russia/bulgaria/etc); make sure to save it as decoded to save
            // space and visuals.
            prevStreet => R.append(prevStreet ? decodeURI(prevStreet[2]) : "", entry)
          )(prevStreets),
          streets)
    )(country)
    : streets

// Gather all persons from all countries and make a summary of the most frequent
// persons and the total number of streets they appear on.
export const worldwideEponyms = () => R.pipe(
  R.compose(R.map(R.replace(".json", "")), fs.readdirSync),
  // Remove the last-updated line
  R.chain(R.compose(R.tail, readCountry)),
  // Keep name of persons only
  R.filter(R.compose(R.startsWith("http"), R.prop(2))),
  R.groupBy(R.prop(2)),  
  R.mapObjIndexed(R.juxt([R.length, R.reduce((acc, el) => acc + el[1], 0)])),
  R.toPairs,
  R.map(R.flatten),
  R.sortBy(R.prop(1)),
  R.reverse  
)(countriesPath)

// Check the `country`.json file for same link assigned to multiple entries.  If
// found, manually include them under a single person in the equivalents
// section.
export const linkDups = (country) => R.pipe(
  readCountry,    
  R.groupBy(R.prop(2)),
  R.mapObjIndexed(R.length),
  R.toPairs,
  R.reject(R.propEq(1, 1)),    
  R.reject(R.propEq('', 0))    
)(country)

export const linkDupsAll = () => R.pipe(  
  R.compose(R.map(R.replace(".json", "")), fs.readdirSync),  
  R.map(R.juxt([R.identity, linkDups])),
  R.reject(R.propEq([], 1)),
  R.map(R.head)
)(countriesPath)

// Check if, for the given country name, any of the links contain special
// characters or do not contain wikipedia urls. Return them, if they do
export const linksConsistency = R.pipe(
  readCountry,
  R.tail,
  R.map(R.prop(2)),
  R.reject(R.isEmpty),
  R.reject(R.compose(R.isEmpty, R.match(/%|^((?!wikipedia).)*$/i))),  
)

// Check if any of the countries fail to pass the link consistency
// checks. Return their names if the do not.
export const linksConsistencyAll = () => R.pipe(
  R.compose(R.map(R.replace(".json", "")), fs.readdirSync),
  R.map(R.juxt([R.identity, linksConsistency])),
  R.reject(R.propEq([], 1)),
  R.map(R.head)
)(countriesPath)
