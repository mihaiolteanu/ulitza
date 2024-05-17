// There are two places to keep persons data. One is the list of street names
// for each country together with their frequency and the manually added
// wikipedia links, if any.

// The other place is a single persons.json file with extra details for each
// person, such as a summary, occupation and a link to a picture. These details
// are extracted from wikipedia using the above mentioned link.

// The list of occupations is extracted from the summary with a regex.
// occupations_extra is manually added for those persons where the regex returns
// nothing.

import * as R from "ramda"
import fs from 'fs-extra'
import {fileLocation, then, delay, read, write } from "./pills.js"

// Extracted, parsed and manually modified file for country.
export const personsCountryFile   = fileLocation("data/persons/countries", ".json")
export const personsCountryWrite  = R.compose(write, personsCountryFile)
export const personsCountryRead   = R.compose(read, personsCountryFile)
export const countriesWithPersons = () => R.pipe(  
  fs.readdirSync,
  R.map(R.replace(".json", ""))
)("data/persons/countries")


// Gather all persons from all countries and make a summary of the most frequent
// persons and the total number of streets they appear on.
export const personsWorldwide = () => R.pipe(
  countriesWithPersons,
  // Remove the last-updated line
  R.chain(R.compose(R.tail, personsCountryRead)),
  // Keep name of persons only
  R.filter(R.compose(R.startsWith("http"), R.prop(2))),
  R.groupBy(R.prop(2)),  
  R.mapObjIndexed(R.juxt([R.length, R.reduce((acc, el) => acc + el[1], 0)])),
  R.toPairs,
  R.map(R.flatten),
  R.sortBy(R.prop(1)),
  R.reverse
)()

// Check the `country`.json file for same link assigned to multiple entries.  If
// found, manually include them under a single person in the equivalents
// section.
export const linkDups = (country) => R.pipe(
  personsCountryRead,
  R.groupBy(R.prop(2)),
  R.mapObjIndexed(R.length),
  R.toPairs,
  R.reject(R.propEq(1, 1)),    
  R.reject(R.propEq('', 0))    
)(country)

export const linkDupsAll = R.pipe(  
  countriesWithPersons,
  R.map(R.juxt([R.identity, linkDups])),
  R.reject(R.propEq([], 1)),
  R.map(R.head)
)

// Return any links containing special characters for the given country or links
// other than wikipedia ones.
export const linksConsistency = R.pipe(
  personsCountryRead,
  R.tail,
  R.map(R.prop(2)),
  R.reject(R.isEmpty),
  R.reject(R.compose(R.isEmpty, R.match(/%|^((?!wikipedia).)*$/i))),  
)

// Check if any of the countries fail to pass the link consistency
// checks. Return their names if they do not.
export const linksConsistencyAll = R.pipe(
  countriesWithPersons,
  R.map(R.juxt([R.identity, linksConsistency])),
  R.reject(R.propEq([], 1)),
  R.map(R.head)
)


const writeWiki  = write("data/persons/persons.json")
export const readWiki   = () => read("data/persons/persons.json")

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
        R.propOr("../placeholder.png", "source")
      )(r),
      summary: R.propOr("", "extract")(r)
    }))
}

export const updateWiki = (country) => R.pipe(
  personsCountryRead,
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
  // Add or update the local wiki
  then(R.mergeAll),
  then(R.mergeDeepRight(readWiki())),
  then(writeWiki),
  then(occupationsUpdate)
)(country)

// Some keywords/occupations are subdomains of a higher domain, like a poet is a
// writer, too. Add those hight domains to the list of keywords
const addKeywordsEquivalents = keys => R.concat(keys,
  R.map(key => R.pipe(
    R.toPairs,  
    R.filter(R.pipe(
      R.last,
      R.includes(key)
    )),  
    R.map(R.head),  
    R.uniq
  )(categories), keys)) 

const occupationsFromSummary = (str) => R.pipe(
  // Avoid matching general when the word is generally, for example.
  R.map(k => str.match(new RegExp(" " + k + "( |,|\\.|;)", "i"))),
  R.filter(R.empty),
  // The matched string
  R.map(R.prop(0)),
  R.map(R.trim),
  R.map(R.replace(/(,|\.|;)/, "")),
  R.map(s => s.toLowerCase())
)(occupations)

// Update the "ocupations" list for each person.
// Useful when adding/removing entries in the ocupations or categories lists
export const occupationsUpdate = () => R.pipe(
  readWiki,
  R.map(e => R.assoc("occupations", occupationsFromSummary(e.summary), e)),
  writeWiki
)()

// Count the number of occurence for all unique occupations
export const occupationsCount = (persons) => R.pipe(
  R.map(R.props(["occupations"])),
  R.map(R.flatten), 
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
      count: R.identity      
    })
  )(persons)),  
  R.values,
  R.sortBy(R.prop("count")),
  R.reverse,  
)(occupations)

export const occupationsMerge = (person) => {
  person.occupations = R.pipe(
    R.props(["occupations", "occupations_extra"]),
    R.flatten,
    addKeywordsEquivalents,
    R.flatten,
    R.reject(R.isNil),
    R.reject(R.includes([ignoredOccupations])),
    R.uniq
  )(person)
  return R.omit(["occupations_extra"], person)
}

// manually added
// psychologist
const ignoredOccupations = ["she", "female"]

const categories = {
  artist: ['actor', 'dramatist', 'film director', 'music', 'painter',
    'screenwriter', 'sculptor', 'theatre' ],
  military: ['admiral', 'colonel', 'commander', 'conquistador', 'general',
    'guerrilla figther', 'lieutenant', 'marshal', 'officer', 'privateer'],
  music: ['composer', 'conductor', 'guitarist', 'organist', 'singer',
    'songwriter', 'soprano', 'tenor', 'violonist'],
  religion: ['abbot', 'apostle', 'archbishop', 'bishop', 'cleric', 'monk',
    'nun', 'pastor', 'patriarch', 'prelate', 'saint', 'theologian' ],
  ruler: ['caliph', 'chancellor', 'count', 'duke', 'king', 'queen', 'sultan',
    'voivode'],
  scientist: [ 'agronomist', 'anatomist', 'archaeologist', 'architect',
  'astronomer', 'bacteriologist', 'biochemist', 'biologist', 'botanist',
    'chemist', 'entomologist', 'physicist', 'zoologist'],
  sport: [ 'athlete', 'bicycle racer', 'boxer', 'cyclist', 'footbaler',
    'gymnast', 'racing driver', 'runner', 'swimmer', 'tennis player'],
  woman: ['actress', 'duchess', 'female', 'noblewoman', 'nun', 'she', 'sister'],
  writer: ['dramatist', 'essayist', 'folklorist', 'historian', 'journalist',
    'novelist', 'philosopher', 'playwright', 'poet', 'publicist', 'translator'],
}

const occupations = ["abbot", "actor", "activist", "actress", "admiral", "agronomist",
  "alchemist", "anarchist", "anatomist", "apostle", "archaeologist",
  "archbishop", "architect", "artist", "astrologer", "astronomer", "athlete",
  "author", "aviator", "bacteriologist", "biochemist", "businessman",
  "biologist", "bishop", "botanist", "boxer", "caliph", "cartographer",
  "chancellor", "cleric", "colonel", "conductor", "commander", "composer",
  "conquistador", "cosmonaut", "chemist", "cyclist", "designer", "diplomat",
  "doctor", "dramatist", "duchess", "duke", "economist", "educator", "engineer",
  "emperor", "entomologist", "entrepreneur", "essayist", "ethnologist",
  "explorer", "female", "filmmaker", "film director", "folklorist",
  "footballer", "friar", "geographer", "geologist", "guerrilla fighter",
  "hajduk", "hero", "historian", "illustrator", "industrialist", "inventor",
  "organist", "jazz", "journalist", "judge", "jurist", "king", "knight",
  "lawyer", "legendary", "librarian", "linguist", "lieutenant", "magistrate",
  "marshal", "martyr", "mathematician", "mayor", "merchant", "microbiologist",
  "military", "missionary", "monk", "musician", "musicologist", "mythology",
  "nationalist", "naturalist", "navigator", "neurologist", "nobleman",
  "noblewoman", "novelist", "officer", "orator", "pastor", "painter",
  "partisan", "patriarch", "patriot", "pedagogue", "pharmacist",
  "philanthropist", "philologist", "philosopher", "photographer", "physician",
  "physicist", "pianist", "pilot", "playwright", "poet", "polymath",
  "politician", "preacher", "prelate", "president", "priest", "prince",
  "princess", "printmaker", "prime minister", "privateer", "professor",
  "publicist", "queen", "resistance fighter", "racing driver", "revolutionary",
  "risorgimento", "ruler", "sailor", "saint", "scholar", "scientist",
  "screenwriter", "sculptor", "she", "singer", "sociologist", "soldier",
  "songwriter", "soprano", "statesman", "sultan", "surgeon", "teacher", "tenor",
  "tennis player", "theatre", "theologian", "trade unionist", "union leader",
  "translator", "violinist", "voivode", "woman", "writer", "zoologist"
]
