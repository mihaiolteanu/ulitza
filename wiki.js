import * as R from './ramda.js'
import { readFile, writeFile } from "fs/promises"
import M from 'mustache'

const then = fn => pr => pr.then(fn);
const delay = ms => new Promise(res => setTimeout(res, ms))
// upcase first letter
const upCase = str => str.charAt(0).toUpperCase() + str.slice(1);

export const htmlPage = country => readFile(`./eponyms/${country}.json`, { encoding: "utf8"})
  .then(JSON.parse)
  .then(R.pipe(
    // Skip the date.
    R.tail,
    // Skip street names not named after a person
    R.reject(R.compose(R.isEmpty, R.prop(2))),    
    // Keep the count and the wiki url for each person and fetch extra info from
    // wikipedia based on the person's name from the url
    R.map(entry =>
      R.compose(wiki, R.prop(2))(entry)
        .then((v => ({count: entry[1], url: entry[2], ...v})))),
    v => Promise.all(v),
    // Gather all the data
    then(R.applySpec({
      country      : () => upCase(country),
      persons_count: R.length,
      streets_count: R.compose(R.sum, R.map(R.prop("count"))),
      persons:       R.identity
    })),
    // then(console.log),
    then(generatePage(country)),
  ))
  .catch(err => console.log(err))


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
  await delay((Math.random() + 20) * 200)
  return fetch(`https://${page_language}.wikipedia.org/api/rest_v1/page/summary/${page_name}`)
    .then(v => v.json())
    .then(r => ({
      name: R.replace(/_/g, " ", page_name),
      image: R.pipe(
        R.propOr("", "thumbnail"),
        R.propOr("../placeholder.png", "source"))
      (r),
      summary: R.propOr("", "extract")(r)
    }))
}


// Apply the html template to country and the list of persons and save it.
const generatePage = country => persons => 
  readFile("./template.html", { encoding: 'utf8' })  
    .then(template =>       
      writeFile(`./html/${country}.html`, M.render(template, persons), 'utf8'))



// console.log(
//   await wiki("https://en.wikipedia.org/wiki/Michael_the_Brave")
// )
