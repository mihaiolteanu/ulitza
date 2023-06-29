import {Transform} from "stream"
import path from "path"
import fs from 'fs'
import osm_parser from 'osm-pbf-parser'
import stringify from "json-stringify-pretty-compact"
import * as r from "ramda"
import * as R from "ramda"
import {equivalentStreet} from "./equivalents.js"
import {stripAffixes} from "./affixes.js"

const { pipe, filter, map, complement, has, props, join, uniqBy, groupBy,
     mapObjIndexed, takeLast, sortBy, length, toPairs, propOr, reject, compose, equals } = r


const pbf = (country) => path.resolve("pbfs", `${country}-latest.osm.pbf`)
const outPath = country => `./out-json/${country}.json`
const countryPath = country => "./out-json/" + country
const countriesPath = "./out-json"

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

const inspect = (regex) => new Transform({
  objectMode: true,
  transform: (chunk, encoding, callback) =>
    R.pipe(
      R.map(JSON.stringify),
      R.filter(R.test(regex)),
      R.map(JSON.parse),
      R.map(R.omit(["id", "lat", "lon", "info", "refs"])),
      out => out.length > 0 ?
        fs.appendFileSync("./test-india.json", JSON.stringify(out, null, 2))
        : "ignore",
      () => callback(null, null)
    )(chunk)
})

const parseOsm = (country) => {
  // Keep a list of all city/street names for the given country.
  const streets = []
  fs.createReadStream(pbf(country))
    .pipe(new osm_parser())    
    .pipe(extractStreets)
    // .pipe(inspect(/Gandhi/i))
    .on("data", map(s => streets.push(s)))    
    .on("finish", () => {
      pipe(
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
        // indeed misspelled, as I cannot imagine official documents nameing
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
        groupBy(r.identity),        
        mapObjIndexed(length),
        
        // Transform to an array of [streetName, count].
        toPairs,

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
        r.sortWith([r.descend(r.prop(1))]),
        hydrateStreets(country),
        saveStreets(country),
        () => console.log("Finished..")
      )(streets)
      // Update totals
      statistics4()      
    })
}

const allCountries = () =>
  R.pipe(
    fs.readdirSync,
    R.reject(R.includes("-raw.json")),
    R.reject(R.includes(".git")),
    R.reject(R.includes("world")),
    R.map(R.replace(".json", "")),
  )(countriesPath)

const readCountry = R.pipe(
  outPath,
  fs.readFileSync,
  JSON.parse
)

const hydrateStreets = (country) => streets =>
  fs.existsSync(outPath(country)) ?
    r.pipe(
      outPath,
      fs.readFileSync,
      JSON.parse,
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

const saveStreets = country => streets =>
  fs.writeFileSync(outPath(country), stringify(streets, {maxLength: 120}))  

const statistics4 = R.pipe(
  allCountries,
  R.map(country =>
    R.pipe(
      readCountry,
      R.filter(R.compose(R.startsWith("http"), R.prop(2))),
      names => [
        country,
        // Unique number of persons for this country
        names.length,
        // Total number of streets with person names
        R.reduce((acc, elem) => acc + elem[1], 0, names),
        // The streets themselves
        names
      ]
    )(country)),
  // Only include countries with at least one street
  R.reject(R.compose(R.equals(0), R.prop(1))),
  out => fs.writeFileSync("./out-statistics/statistics4.json", JSON.stringify(out, null, 2))
)

// Check the `country`.json file for same link assigned to multiple entries.  If
// found, these should be included under a single person in the equivalents
// section.
const findDuplicateURLs = (country) =>
  R.pipe(
    readCountry,    
    R.groupBy(R.prop(2)),
    R.mapObjIndexed(R.length),
    R.toPairs,
    R.reject(R.compose(R.equals(1), R.prop(1))),
    console.log
  )(country)

// statistics4()
parseOsm("spain")
// findDuplicateURLs("spain")



