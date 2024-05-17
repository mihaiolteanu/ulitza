// Everything to do with downloading the latest osm.pbf data from openstreetmap,
// extracting street names, parsing street names and saving the output locally.

import { Transform } from "stream"
import fs from 'fs-extra'
import osm_parser from 'osm-pbf-parser'
import stringify from "json-stringify-pretty-compact"
import * as R from "ramda"
import { equivalentStreet } from "./equivalents.js"
import { stripAffixes } from "./affixes.js"
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


// Minimum frequency for a street name below which we ignore the said street.
export const minStreetFrequency = country => R.pipe(
  // All country names and street frequencies, for all regions
  () => R.pipe(
    R.chain(R.tail),  
    R.reduce(R.concat, [])
  )(regions),
  R.find(R.compose(R.equals(country), R.prop(0))),
  R.prop(1),  
)()

// In what region is the `country` in
export const countryRegion = (country) => R.pipe(
  R.find(R.find(R.find(c => c[0] === country))),
  R.head
)(regions)

// All regions and countries as they appear in the openstreetmap (osm) database,
// http://download.geofabrik.de/
const regions = [
  ["africa", [    
    ["algeria",                      3],
    ["angola",                       2],
    ["benin",                        2],
    ["botswana",                     2],
    ["burkina-faso",                 2],
    ["burundi",                      2],
    ["cameroon",                     2],
    ["canary-islands",               2],      
    ["central-african-republic",     2],
    ["chad",                         2],
    ["congo-brazzaville",            2],
    ["congo-democratic-republic",    2],      
    ["egypt",                        3],      
    ["ethiopia",                     2],
    ["ghana",                        2],
    ["guinea",                       2],
    ["ivory-coast",                  2],
    ["kenya",                        2],
    ["liberia",                      2],
    ["libya",                        2],
    ["madagascar",                   2],
    ["malawi",                       2],
    ["mali",                         2],
    ["morocco",                      2],
    ["mozambique",                   2],
    ["namibia",                      2],
    ["nigeria",                      2],
    ["senegal-and-gambia",           2],
    ["south-africa",                 2],
    ["sudan",                        2],
    ["tanzania",                     3],
    ["togo",                         2],
    ["tunisia",                      2],
    ["uganda",                       2],
    ["zambia",                       2],
    ["zimbabwe",                     2],
  ]],
  
  ["central-america", [
    ["belize",                       2],
    ["costa-rica",                   2],
    ["cuba",                         2],
    ["el-salvador",                  2],
    ["guatemala",                    2],
    ["haiti-and-domrep",             2],
    ["honduras",                     2],
    ["jamaica",                      2],
    ["nicaragua",                    2],
    ["panama",                       2],
  ]],
   
  ["north-america", [
    ["canada",                       3],
    ["greenland",                    2],
    ["mexico",                       3],
    ["us",                           3],
  ]],
   
  ["south-america", [
    ["argentina",                    3],
    ["bolivia",                      2],
    ["brazil",                       3],
    ["chile",                        3],
    ["colombia",                     2],
    ["ecuador",                      2],
    ["guyana",                       2],
    ["paraguay",                     2],
    ["peru",                         2],
    ["suriname",                     2],
    ["uruguay",                      3],
    ["venezuela",                    2],
  ]],
   
  ["asia", [
    ["afghanistan",                  2],
    ["armenia",                      3],
    ["azerbaijan",                   2],
    ["bangladesh",                   3],
    ["bhutan",                       2],
    ["cambodia",                     2],
    ["china",                        3],
    ["gcc-states",                   3],
    ["india",                        3],
    ["indonesia",                    3],
    ["iran",                         3],
    ["iraq",                         3],
    ["israel-and-palestine",         3],
    ["japan",                        3],
    ["jordan",                       3],
    ["kazakhstan",                   3],
    ["kyrgyzstan",                   2],
    ["laos",                         2],
    ["lebanon",                      2],
    ["malaysia-singapore-brunei",    3],
    ["mongolia",                     3],
    ["myanmar",                      3],
    ["nepal",                        3],
    ["north-korea",                  3],
    ["pakistan",                     3],
    ["philippines",                  3],
    ["russia",                       3],
    ["south-korea",                  3],
    ["sri-lanka",                    3],
    ["syria",                        3],
    ["taiwan",                       3],
    ["tajikistan",                   2],
    ["thailand",                     3],
    ["turkmenistan",                 3],
    ["uzbekistan",                   3],
    ["vietnam",                      3],
    ["yemen",                        2],
  ]],
  
  ["europe", [
    ["albania",                      2],
    ["andorra",                      2],
    ["austria",                      3],
    ["azores",                       2],
    ["belarus",                      3],
    ["belgium",                      2],
    ["bosnia-herzegovina",           2],
    ["bulgaria",                     3],
    ["croatia",                      3],
    ["cyprus",                       2],
    ["czech-republic",               3],
    ["denmark",                      3],
    ["estonia",                      3],
    ["faroe-islands",                2],
    ["finland",                      3],
    ["france",                       3],
    ["georgia",                      3],
    ["germany",                      3],
    ["great-britain",                3],
    ["greece",                       3],
    ["guernsey-jersey",              2],
    ["hungary",                      2],
    ["iceland",                      2],
    ["ireland-and-northern-ireland", 2],
    ["isle-of-man",                  2],
    ["italy",                        3],
    ["kosovo",                       2],
    ["latvia",                       3],
    ["liechtenstein",                2],
    ["lithuania",                    3],
    ["luxembourg",                   2],
    ["macedonia",                    2],
    ["malta",                        2],
    ["moldova",                      2],
    ["monaco",                       2],
    ["montenegro",                   2],
    ["netherlands",                  3],
    ["norway",                       3],
    ["poland",                       3],
    ["portugal",                     3],
    ["romania",                      2],
    ["russia",                       2],
    ["serbia",                       2],
    ["slovakia",                     2],
    ["slovenia",                     3],
    ["spain",                        3],
    ["sweden",                       3],
    ["switzerland",                  3],
    ["turkey",                       3],
    ["ukraine",                      3],
  ]],

  ["australia-oceania", [
    ["american-oceania",             2],
    ["australia",                    3],      
    ["fiji",                         2], 
    ["new-caledonia",                2],
    ["new-zealand",                  3],      
    ["papua-new-guinea",             2],
    ["polynesie-francaise",          2],      
  ]]
]
