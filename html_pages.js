import * as R from "ramda"
import M from 'mustache'
import { readFile, writeFile } from "fs/promises"
import { occupationsCount, occupationsMerge, readWiki } from "./wiki.js"
import { personsWorldwide } from "./osm.js"
import { readCountry, availableCountries } from "./pills.js"

export const htmlPageCountry = country => R.pipe(
  readCountry,
  // Skip date and skip street names not named after a person
  R.tail,
  R.reject(R.compose(R.isEmpty, R.prop(2))),
  // Url first, count in second position, skip the name
  R.map(R.tail),
  R.map(R.reverse),
  htmlPage(country)
)(country)

export const htmlPageAllCountries = R.pipe(
  availableCountries,
  R.map(htmlPageCountry)
)

export const htmlPageWorldwide = () => R.pipe(
  personsWorldwide,
  // There are over 10000 entries, take out some of them
  R.filter(e => e[1] > 2),
  htmlPage("worldwide")
)()

// Generate an html page with all persons, wiki summary, wiki link and
// thumbnail for the given country
const htmlPage = country => entries => R.pipe(
  // Add extra info, like summary and image from the local wiki
  R.map(e => ({
    url: e[0],
    count: e[1],
    ...readWiki()[e[0]]
  })),  
  R.map(occupationsMerge),  
  // If the person is not in the local wiki, do not include it.
  R.filter(R.has("name")),  
  R.applySpec({
    country:       () => upCase(country),
    persons_count: R.length,
    streets_count: R.compose(R.sum, R.map(R.prop("count"))),
    occupations:   occupationsCount,
    // Sometimes the summary is too short and it looks weird on the page
    persons:       R.map(R.evolve({ summary: str => str.padEnd(100, '  ')}))
  }),  
  applyHtmlTemplate(country),
)(entries)

// Apply the html template to country and the list of persons and save it.
const applyHtmlTemplate = country => persons => 
  readFile("./data/template.html", { encoding: 'utf8' })  
    .then(template =>       
      writeFile(`./data/html/${country}.html`, M.render(template, persons), 'utf8'))

// upcase first letter
const upCase = str => str.charAt(0).toUpperCase() + str.slice(1);
