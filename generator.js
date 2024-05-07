import {Transform} from "stream"
import path from "path"
import fs from 'fs-extra'
import osm_parser from 'osm-pbf-parser'
import stringify from "json-stringify-pretty-compact"
import * as R from "ramda"
import { equivalentStreet } from "./equivalents.js"
import {stripAffixes} from "./affixes.js"
import { minEponymFrequency } from "./regions.js"
import { readFile, writeFile } from "fs/promises"
import M from 'mustache'

export const osmPath = country => path.resolve("data/osm_data", country + "-latest.osm.pbf")
const inspectPath = country => path.resolve("out", country + "-inspect.json") 

// RW json data
const write = file => data =>
  fs.writeFileSync(file, stringify(data, { maxLength: 120 }))
const read = R.compose(JSON.parse, fs.readFileSync)

// RW out files
const rawPath      = path.resolve(fs.ensureDirSync("data/raw") || "raw")
const rawFile      = country => path.resolve(rawPath, country + ".json")
const readRaw      = country => read(rawFile(country))
const eponymsPath  = "data/countries"
const eponymsFile  = country => path.resolve(eponymsPath, country + ".json")
const writeEponyms = country => write(eponymsFile(country))
const readEponyms  = country => read(eponymsFile(country))
const writePersons = write("data/persons.json")
const readPersons  = () => read("data/persons.json")
  
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
    R.gt(minEponymFrequency(country)),
    R.prop(1))
  ),
  // Sort by most frequent street names first.
  R.sortWith([R.descend(R.prop(1))]),
  hydrateStreets(country),
  // Add back the osm modified date
  R.prepend(R.head(readRaw(country))),
  writeEponyms(country),    
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

// Gather all persons from all countries and make a summary of the most frequent
// persons and the total number of streets they appear on.
const worldwideEponyms = () => R.pipe(
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
)(eponymsPath)

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
)(eponymsPath)

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
)(eponymsPath)


const then = fn => pr => pr.then(fn);
const delay = ms => new Promise(res => setTimeout(res, ms))
// upcase first letter
const upCase = str => str.charAt(0).toUpperCase() + str.slice(1);

// Given a valid wikipedia url, return info about the page, such as name, image
// and a summary
const wiki = async url => {
  const page_name = R.compose(R.last, R.split("/"))(url)
  const page_language = R.pipe(
    R.split("//"),
    R.prop(1),
    R.split("."),
    R.head
  )(url)
  // Poor man's rate limiter to avoid the 200 requests / second limit for Wiki API
  // For really big countries, if this still doesn't work, temporarily remove
  // part of the streets in the country.json file and retrieve the data in pieces.
  await delay((Math.random() + 25) * 200)
  return fetch(`https://${page_language}.wikipedia.org/api/rest_v1/page/summary/${page_name}`)
    .then(v => v.json())
    .then(r => ({
      url,
      name: R.prop("title", r),
      image: R.pipe(
        R.propOr("", "thumbnail"),
        // Less popular wiki entries sometimes don't have a picture.
        R.propOr("../placeholder.png", "source"))
      (r),
      summary: R.propOr("", "extract")(r)
    }))
}

// Apply the html template to country and the list of persons and save it.
const applyHtmlTemplate = country => persons => 
  readFile("./data/template.html", { encoding: 'utf8' })  
    .then(template =>       
      writeFile(`./data/html/${country}.html`, M.render(template, persons), 'utf8'))

// Generate an html page with all the eponyms, wiki summary, wiki link and
// thumbnail for the given country
const htmlPage = country => entries => R.pipe(
  // Add extra info, like summary and image from the persons db  
  R.map(e => ({
    url: e[0],
    count: e[1],
    ...readPersons()[e[0]]
  })),  
  // Merge all keywords into `keywords`
  R.map(persons => {
    persons.keywords = R.pipe(
      R.props(["keywords", "keywords_extra"]),
      R.flatten,
      R.reject(R.isNil),
      R.uniq
    )(persons)
    return persons
  }),
  R.map(R.omit(["keywords_extra"])),  
  // If the person is not in the persons.json db, do not include it.
  R.filter(R.has("name")),  
  R.applySpec({
    country:       () => upCase(country),
    persons_count: R.length,
    streets_count: R.compose(R.sum, R.map(R.prop("count"))),
    keywords:      R.compose(keywordsCount, R.map(R.flatten), R.map(R.props(["keywords"]))),
    // Sometimes the summary is too short and it looks weird on the page
    persons:       R.map(R.evolve({ summary: str => str.padEnd(100, '  ')}))
  }),  
  applyHtmlTemplate(country),
)(entries)

export const htmlPageCountry = country => R.pipe(
  readEponyms,
  // Skip date and skip street names not named after a person
  R.tail,
  R.reject(R.compose(R.isEmpty, R.prop(2))),
  // Url first, count in second position, skip the name
  R.map(R.tail),
  R.map(R.reverse),
  htmlPage(country)
)(country)

export const htmlPageAllCountries = () => R.pipe(
  R.compose(R.map(R.replace(".json", "")), fs.readdirSync),  
  R.map(htmlPageCountry)
)(eponymsPath)

export const htmlPageWorldwide = () => R.pipe(
  worldwideEponyms,
  // There are over 10000 entries, take out some of them
  R.filter(e => e[1] > 2),
  htmlPage("worldwide")
)()

// manually added
// psychologist
const ignore = ["she", "female"]

const equivalents = {
  artist: ["music", "dramatist", "painter", "sculptor", "theatre", "film director", "screenwriter"],
  music: ["organist", "conductor", "singer", "songwriter", "soprano", "tenor", "violonist", "guitarist"],
  military: ["colonel", "general", "marshal", "commander", "privateer", "admiral", "lieutenant", "guerrilla figther", "officer"],
  writer: ["journalist", "poet", "novelist", "philosopher", "playwright", "historian", "folklorist", "translator", "publicist", "essayist", "dramatist"],
  woman: ["she", "noblewoman", "female", "nun", "sister", "duchess", "actress"],
  ruler: ["king", "queen", "voivode", "duke", "count", "sultan", "caliph"],
  religion: ["pastor", "theologian", "patriarch", "saint", "cleric", "abbot", "prelate", "bishop", "monk", "nun"],
  scientist: ["anatomist", "archaeologist", "bacteriologist", "biochemist", "physicist", "entomologist"],
  sport: ["athlete", "footbaler", "runner", "bicycle racer", "cyclist", "racing driver", "tennis player", "swimmer", "gymnast"]
}

const keywords = ["abbot", "actor", "activist", "actress", "admiral", "agronomist",
  "alchemist", "anarchist", "anatomist", "apostle", "archaeologist",
  "archbishop", "architect", "artist", "astrologer", "astronomer", "athlete",
  "author", "aviator", "bacteriologist", "biochemist", "businessman",
  "biologist", "bishop", "botanist", "boxer", "caliph", "cartographer",
  "chancellor", "cleric", "colonel", "conductor", "commander", "composer",
  "conquistador", "cosmonaut", "chemist", "cyclist", "designer", "diplomat",
  "doctor", "dramatist", "duchess", "duke", "economist", "educator", "engineer",
  "emperor", "entomologist", "entrepreneur", "essayist", "ethnologist",
  "explorer", "female", "filmmaker", "film director", "folklorist",
  "footballer", "friar", "general", "geographer", "geologist", "guerrilla fighter",
  "hajduk", "hero", "historian", "illustrator", "industrialist",
  "inventor", "organist", "jazz", "journalist", "judge", "jurist", "king",
  "knight", "lawyer", "legendary", "librarian", "linguist", "lieutenant",
  "magistrate", "marshal", "martyr", "mathematician", "mayor", "merchant",
  "microbiologist", "military", "missionary", "monk", "musician",
  "musicologist", "mythology", "nationalist", "naturalist", "navigator",
  "neurologist", "nobleman", "noblewoman", "novelist", "officer", "orator",
  "pastor", "painter", "partisan", "patriarch", "patriot", "pedagogue",
  "pharmacist", "philanthropist", "philologist", "philosopher", "photographer",
  "physician", "physicist", "pianist", "pilot", "playwright", "poet",
  "polymath", "politician", "preacher", "prelate", "president", "priest",
  "prince", "princess", "printmaker", "prime minister", "privateer",
  "professor", "publicist", "queen", "resistance fighter", "racing driver",
  "revolutionary", "risorgimento", "ruler", "sailor", "saint", "scholar",
  "scientist", "screenwriter", "sculptor", "she", "singer", "sociologist",
  "soldier", "songwriter", "soprano", "statesman", "sultan", "surgeon",
  "teacher", "tenor", "tennis player", "theatre", "theologian",
  "trade unionist", "union leader", "translator", "violinist", "voivode", "woman",
  "writer", "zoologist"
]

const updatePersonsDb = (country) => R.pipe(
  readEponyms,
  // Skip date
  R.tail,
  // Skip street names not named after a person
  R.reject(R.compose(R.isEmpty, R.prop(2))),
  // Send the url to wiki()
  R.map(R.compose(wiki, R.prop(2))),  
  v => Promise.all(v),
  // Use the name of the person as the key of the object. The object now
  // contains the image and the summary of that person, as see on wikipedia.
  then(R.map(w => ({
    [w.url]: R.omit(["url"], w)
  }))),
  // Add or update the persons db
  then(R.mergeAll),
  then(R.mergeDeepRight(readPersons())),
  then(writePersons),
  then(keywordsUpdate)
)(country)

const keywordsFromSummary = (str) => R.pipe(
  // Avoid matching general when the word is generally, for example.
  R.map(k => str.match(new RegExp(" " + k + "( |,|\\.|;)", "i"))),
  R.filter(R.empty),
  // The matched string
  R.map(R.prop(0)),
  R.map(R.trim),
  R.map(R.replace(/(,|\.|;)/, "")),
  R.map(s => s.toLowerCase())
)(keywords)

const keywordsUpdate = () => R.pipe(
  readPersons,
  R.map(e => R.assoc("keywords", keywordsFromSummary(e.summary), e)),
  writePersons
)()

// keywords - array of arrays of strings.
// Count the number of occurence for all the unique keywords
const keywordsCount = (keywords) => R.pipe(
  R.reject(R.isNil),
  R.flatten,
  R.reject(R.isNil),
  R.uniq,  
  a => R.zipObj(a, R.repeat(0, a.length)),  
  R.mapObjIndexed((_, key) => R.pipe(    
    R.map(R.includes(key)),
    
    R.count(R.equals(true)),
    R.applySpec({
      keyword: R.always(key),
      count: R.identity,      
      // percent: c => ((c / keywords.length) * 100).toFixed(1)
    })
  )(keywords)),  
  R.values,
  R.sortBy(R.prop("count")),
  R.reverse,  
)(keywords)
