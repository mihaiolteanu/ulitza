import {Transform} from "stream"
import path from "path"
import fs from 'fs'
import osm_parser from 'osm-pbf-parser'
import stringify from "json-stringify-pretty-compact"
import * as R from "ramda"
import * as S from "sanctuary"
import {equivalentStreet, equivalentDuplicates} from "./equivalents.js"
import {stripAffixes} from "./affixes.js"

const { pipe, map, join, uniqBy, groupBy, mapObjIndexed, length, toPairs} = R

// osm pbf file for the given country.  The file must be downloaded manually
// from https://download.geofabrik.de/
const osm = country => path.resolve("osm_data", country + "-latest.osm.pbf")

// Save `data` object containing streets info to the given `file` location
const write = file => data =>
  fs.writeFileSync(file, stringify(data, { maxLength: 120 }))
const writeMin = file => data => 
  fs.writeFileSync(file, JSON.stringify(data))

// Read and parse a json file 
const read = R.compose(JSON.parse, fs.readFileSync)

// Extracted pbf data, but unprocessed and  without equivalents or stripped affixes.
const unsortedPath  = path.resolve("out", "unsorted") 
const unsortedFile  = country => path.resolve(unsortedPath, country + ".json")
const writeUnsorted = country => write(unsortedFile(country))
const readUnsorted  = country => read(unsortedFile(country))

// Processed data, containing counts and urls for eponymous streets
const eponymsPath   = path.resolve("out", "eponyms") 
const eponymsFile   = country => path.resolve(eponymsPath, country + ".json")
const writeEponyms  = country => write(eponymsFile(country))
const readEponyms   = country => read(eponymsFile(country))

const writeStats    = write(path.resolve("out", "all.json"))
const writeStatsMin = writeMin(path.resolve("out", "all.min.json"))

const extractStreets = new Transform({
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
})

// Explore the osm data.  I've used this to explore what osm fields contain
// street data.
const inspect = (regex) => new Transform({
  objectMode: true,
  transform: (chunk, encoding, callback) =>
    R.pipe(
      R.map(JSON.stringify),
      R.filter(R.test(regex)),
      R.map(JSON.parse),
      // Ignore non-interesting fields
      R.map(R.omit(["id", "lat", "lon", "info", "refs"])),
      out => out.length > 0 ?
        fs.appendFileSync("./out/inspect-result.json", JSON.stringify(out, null, 2))
        : "ignore",
      () => callback(null, null)
    )(chunk)
})

const parseOsmData = (country) => {
  const streets = fs.createWriteStream(unsortedFile(country))
  // Add metadata; only the osm last modified date, for now
  streets.write(`[["${modifiedDateOSM(country)}"]`)
  fs.createReadStream(osm(country))
    .pipe(new osm_parser())
    .pipe(extractStreets)
    .on("data", R.pipe(
      uniqBy(join("-")),
      R.map(s => streets.write(",\n" + stringify(s)))
    ))
    .on("finish", () => {
      streets.write("]")
      streets.close()
    })
}

const parseUnsorted = (country) =>
  R.pipe(
    readUnsorted,
    // Skip the osm modified date
    R.tail, 
    // Keep the city name unchanged and clean up the street name (remove
    // affixes and find one single equivalent street for all streets that
    // name the same person)
    map(R.evolve({
      "0": R.identity,
      "1": R.compose(equivalentStreet(country), stripAffixes(country))
    })),
    // Join city and street name (by "-") and only allow a single person
    // name per city.  For example, if city C has Street M, Str M, School M,
    // etc., we will consider that the city only has one instance of M
    // (granted that Street, Str and School are all specified as affixes for
    // that country).  This is a fair defense against instances with a
    // single Street M, but tagged multiple times with slightly different
    // affixes or equivalents like Dr. M, King M, etc. Plus, some names are
    // indeed misspelled, as I cannot imagine official documents naming
    // streets in honor of this or that person spells wrongly their
    // names. Allowing just one person per city, together with the stripping
    // of affixes and replacing of equivalents fixes that.

    // Slight disadvantage: there might officially indeed be different
    // streets named after the same person, or the same person M names
    // streets, bridges, piazzas, schools, etc. and this approach will lump
    // them all togheter.
    uniqBy(join("-")),
    // Discard the city; keep only the street name
    map(R.prop(1)),
    // Count identical street names.
    groupBy(R.identity),
    mapObjIndexed(length),
    // Transform to [streetName, count] array
    R.toPairs,
    // Remove streets composed of numbers, letters or other names less than
    // 3 characters; most than likely these do not designate persons.  Note:
    // it might not apply for China/Korea/Taiwan/etc.
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
      R.gte(2),
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
const findDuplicateURLs = (country) =>
  R.pipe(
    readCountry,    
    R.groupBy(R.prop(2)),
    R.mapObjIndexed(R.length),
    R.toPairs,
    R.reject(R.propEq(1, 1)),    
    R.reject(R.propEq('', 0)),
  )(country)

statistics()
// parseOsm("spain")
// findDuplicateURLs("turkey")

// parseOsmData("turkey")
// parseUnsorted("turkey")

// console.log(
//   eponymsFile("romania")
// )



