import {Transform} from "stream"
import path from "path"
import fs from 'fs'
import osm_parser from 'osm-pbf-parser'
import stringify from "json-stringify-pretty-compact"
import * as R from "ramda"
import { equivalentStreet } from "./equivalents.js"
import {stripAffixes} from "./affixes.js"

const { pipe, map, join, uniqBy, groupBy, mapObjIndexed, length, toPairs} = R

export const osmPath = country => path.resolve("osm_data", country + "-latest.osm.pbf")
const inspectPath = country => path.resolve("out", country + "-inspect.json") 

// RW json data
const write = file => data =>
  fs.writeFileSync(file, stringify(data, { maxLength: 120 }))
const read = R.compose(JSON.parse, fs.readFileSync)

// RW out files
const unsortedPath  = path.resolve("out", "unsorted") 
const unsortedFile  = country => path.resolve(unsortedPath, country + ".json")
const readUnsorted  = country => read(unsortedFile(country))
const eponymsPath   = path.resolve("out", "eponyms") 
const eponymsFile   = country => path.resolve(eponymsPath, country + ".json")
const writeEponyms  = country => write(eponymsFile(country))
const readEponyms   = country => read(eponymsFile(country))

const writeStats = (data) =>
  fs.writeFileSync(
    path.resolve("out", "all.js"),
    `export const statistics =` + stringify(data, { maxLength: 120 }))

const writeStatsMin = data =>
  fs.writeFileSync(
    path.resolve("out", "all.min.js"),
    `export const statistics=` + JSON.stringify(data))

// Get the file modified date from the OS; good enough to get a glimpse of the
// freshness of osm data; the alternative is to extract the modified date from
// the osm file (more complicated)
const modifiedDateOSM = country => R.pipe(
  unsortedFile,
  fs.statSync,
  f => f.mtime.toDateString().substring(4),
)(country)

// Explore the osm data.  I've used this to explore what osm fields contain
// street data.
export const inspectOsmData = (country, regex) => 
  fs.createReadStream(osmPath(country))
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
  const streets = fs.createWriteStream(unsortedFile(country))
  // Add metadata; only the osm last modified date, for now
  streets.write(`[["${modifiedDateOSM(country)}"]`)
  fs.createReadStream(osmPath(country))
    .pipe(new osm_parser())
    .pipe(new Transform({
      objectMode: true,
      transform: (chunk, _encoding, callback) =>
        pipe(
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
      uniqBy(join("-")),
      R.map(s => streets.write(",\n" + stringify(s)))
    ))
    .on("finish", () => {
      streets.write("]")
      streets.close()
    })
}

export const parseOsmData = (country) =>
  R.pipe(
    readUnsorted,
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
    uniqBy(join("-")),
    // The city name has server its purpose, discard it
    map(R.prop(1)),
    // Count identical street names.
    groupBy(R.identity),
    mapObjIndexed(length),
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
    // Remove streets that appear only once or twice; these are usually
    // (though not always) garbage; it also helps in keeping the output file
    // to a reasonable size.  Negative side effect: for small countries,
    // there might be no streets left.  Tried alternative: cut the number of
    // street to a hard-value, like 3000; negative side-effect: for
    // well-tagged countries, there are still meaningful person names in the
    // list.        
    R.reject(R.compose(
      R.gte(1),
      R.prop(1))
    ),
    // Sort by most frequent street names first.
    R.sortWith([R.descend(R.prop(1))]),
    hydrateStreets(country),
    // Add back the osm modified date
    R.prepend(R.head(readUnsorted(country))),
    writeEponyms(country),
    statistics,
  )(country)

const readCountry = R.pipe(
  eponymsFile,
  fs.readFileSync,
  JSON.parse
)

const hydrateStreets = (country) => streets =>
  fs.existsSync(eponymsFile(country)) ?
    R.pipe(
      readEponyms,
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

const statistics = () => R.pipe(
  R.compose(R.map(R.replace(".json", "")), fs.readdirSync),
  R.map(country =>
    R.pipe(
      readCountry,
      // Skip the osm modified date
      R.tail,
      R.filter(R.compose(R.startsWith("http"), R.prop(2))),
      // To reduce the output file size, replace the wikipedia link,
      // "https://en.wikipedia.org/wiki/Stephen_the_Great" with the page
      // language and person name only, [en, Stephen_the_Great].
      R.map(R.adjust(2, R.pipe(
        R.split("/"),
        R.props([2, 4]),
        v => [R.split(".", v[0])[0], v[1]])
      )),      
      eponyms => [
        country,
        // // osm modified date
        R.head(readCountry(country)),
        eponyms]
    )(country)),
  // Only include countries with at least one street
  R.reject(R.propEq([], 2)),
  R.tap(writeStats),
  writeStatsMin
)(eponymsPath)

// Check the `country`.json file for same link assigned to multiple entries.  If
// found, these should be included under a single person in the equivalents
// section.
export const linkDups = (country) =>
  R.pipe(
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
)(eponymsPath)
