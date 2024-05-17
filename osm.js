import { Transform } from "stream"
import fs from 'fs-extra'
import osm_parser from 'osm-pbf-parser'
import stringify from "json-stringify-pretty-compact"
import * as R from "ramda"
import { equivalentStreet } from "./equivalents.js"
import { stripAffixes } from "./affixes.js"
import { minStreetFrequency, countryRegion } from "./regions.js"
import { personsCountryFile, personsCountryRead, personsCountryWrite} from "./persons.js"
import { fileLocation, read, then } from "./pills.js"


export const osmDownload = (country) => R.pipe(
  countryRegion,
  region => `http://download.geofabrik.de/${region}/${country}-latest.osm.pbf`,  
  fetch,
  then(v => v.arrayBuffer()),
  then(Buffer.from),
  then(buffer => fs.createWriteStream(osmPbfFile(country)).write(buffer)),  
)(country)


// Explore the osm data.  I've used this to explore what osm fields contain
// street data.
export const osmInspect = (country, regex) => fs.createReadStream(osmPbfFile(country))
  .on("open", () => fs.writeFileSync(osmInspectFile(country), "create new file"))
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
          fs.appendFileSync(osmInspectFile(country), JSON.stringify(out, null, 2))
          : "ignore",
        () => callback(null, null)
      )(chunk)
  }))

export const osmExtract = (country) => {
  const streets = fs.createWriteStream(osmRawFile(country))
  // Add metadata; only the osm last modified date, for now
  streets.write(`[["${osmPbfFileDate(country)}"]`)
  fs.createReadStream(osmPbfFile(country))
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

export const osmParse = (country) => R.pipe(
  R.compose(read, osmRawFile),
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
  R.prepend(R.compose(R.head, read, osmRawFile)(country)),
  personsCountryWrite(country),    
)(country)

// Add previously available wiki links, when available, for country streets
const hydrateStreets = country => streets =>
  fs.existsSync(personsCountryFile(country)) ?
    R.pipe(
      personsCountryRead,
      prevStreets =>
        R.map(entry =>
          R.pipe(
            R.find(R.compose(R.equals(R.head(entry)), R.head)),            
            // Add the existing link, if it exists.
            prevStreet => R.append(prevStreet ? decodeURI(prevStreet[2]) : "", entry)
          )(prevStreets),
          streets)
    )(country)
    : streets

// Downloaded osm pbf file
export const osmPbfFile = fileLocation("data/osm/pbf", ".osm.pbf")

// Temporary file used to explore the contents of the pbf file.
export const osmInspectFile = fileLocation("data/osm/inspect", ".json")

// Extracted but not processed output file for country
export const osmRawFile = fileLocation("data/osm/raw", ".json")

// Get the file modified date from the OS; good enough to get a glimpse of the
// freshness of osm data; the alternative is to extract the modified date from
// the osm file (more complicated)
export const osmPbfFileDate = country => R.pipe(
  osmPbfFile,
  fs.statSync,
  f => f.mtime.toDateString().substring(4),
)(country)
