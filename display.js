const { div, a, sup, span, input, b, table, tbody, thead, tr, th, td} = van.tags
import { statistics } from "./out/all.min.js"
import { regionsNames, regionCountries, countryDisplayName } from "./regions.js"

const taplog = R.tap(console.log)
const tapfn  = (_fn) => R.tap

const vRegion    = van.state("")
const vCountry   = van.state("")
const vSearchStr = van.state(".*")

// The standard eponym format:
// [count, [wiki_lang, wiki_name]]
const eponymCount   = R.head
const eponymArray   = R.tail 
const eponymDisplay = R.pipe(
  R.last,
  R.last,
  R.replace(/_/g, " "),
)
const eponymURL = R.pipe(
  R.last,
  l => `https://${l[0]}.wikipedia.org/wiki/${l[1]}`,
)

// The standard country format:
// [name, metadata, eponym, eponym, ....]
const skipNameAndMetadata = (country) =>
  R.chain(R.compose(R.tail, R.tail), country)

// Count the number of occurences for each eponym, for all countries worldwide
const allEponyms = R.memoizeWith(R.identity, () =>
  R.pipe(    
    skipNameAndMetadata,
    R.map(R.prop(1)),
    R.groupBy(R.identity),
    R.mapObjIndexed(R.length),
    R.toPairs,
    R.sortWith([R.descend(R.prop(1))]),
    // Transform back to standard eponym format (transformed into a string at
    // the groupBy stage above)
    R.map(R.adjust(0,
      R.juxt([R.take(2), R.drop(3)]),)),
    R.map(v => [v[1], v[0]]),    
  )(statistics))

// Return a list of countries where the given eponym appears in.
const eponymOccurence = (eponym) =>
  R.pipe(
    R.filter(R.find(R.compose(R.equals(eponymArray(eponym)), eponymArray))),    
    R.map(R.head),
    R.map(countryDisplayName),
    R.join(", ")
  )(statistics)

// https://stackoverflow.com/questions/72704941/how-do-i-close-dialog-by-clicking-outside-of-it
const dialog = document.getElementById("showCountries")
dialog.addEventListener("click", ({ target: dialog }) => {  
  if (dialog.nodeName === 'DIALOG')
    dialog.close('dismiss')
})

const Table = (data) => table(  
  tbody(data.map(row => tr(
    row.map(col => td(col)),
  ))))

const Eponyms = (title, eponyms, date) =>
  span(
    div({ id: "eponyms-country" }, title),
    // div({ class: "eponym-count"}, "123"),
    Table(
      R.map(eponym => [
        a({
          class: "eponym-count",
          onclick: () => {
            dialog.innerText = eponymOccurence(eponym)
            dialog.showModal()
          }
        }, eponymCount(eponym), " "),
        a({
          class: "eponym",
          href: eponymURL(eponym),
          target: "_blank"
        }, eponymDisplay(eponym)),
      ], eponyms)
    ),    
    div(date ? "Osm data from: " + date : "")
  )

const EponymsWorldwide = () =>
  Eponyms(
    "Worldwide",
    // Keep eponyms appearing in at least three countries only.
    R.reject(
      R.compose(R.gt(3), R.prop(0)),
      allEponyms()
    )
  )

const EponymsSearch = (regex) =>
  Eponyms(
    "Searching...",
    R.filter(
      R.compose(R.prop(0), R.match(new RegExp(regex, "i")), R.prop(0)),
      allEponyms()
    )
  )

const EponymsCountry = country =>
  Eponyms(    
    country[1],
    R.pipe(      
      R.filter(R.compose(R.equals(country[0]), R.head)),
      // Remove country name and metadata
      skipNameAndMetadata
    )(statistics),
    R.find(R.propEq(0, country[0]), statistics)[1])

const regionCountrisWithEponyms = (region) =>
  R.innerJoin(
    (a, b) => a[0] === b,
    regionCountries(region),
    R.map(R.head, statistics))

const RegionCountries = R.memoizeWith(R.identity, region => span(
  R.map(country =>
    span({ class: "country" },
      a({
        onclick: () => {
          vCountry.val = country,
          vRegion.val = ""
        },
        href: `#${country[0]}`,
        id: {
          deps: [vCountry],
          f: R.ifElse(
            R.equals(country), R.always("selected-country"), R.always("")
          )
        }
      }, country[1] + " ")),
    regionCountrisWithEponyms(region))))

const Regions = span(
  R.map(region =>
    a({
      href: `#${region}`,
      // Show/hide region on click
      onclick: () => vRegion.val =
        vRegion.val === region ? "" : region,
      id: {
        deps: [vRegion],
        f: R.ifElse(
          R.equals(region), R.always("selected-region"), R.always("")
        )
      }
    }, region),
    regionsNames())
)

const Logo = a({
  href: "#",
  onclick: () => {
    vRegion.val    = ""
    vCountry.val   = ""
    vSearchStr.val = ".*"
  }
}, "ulitza")


const id = (id) => document.getElementById(id)

// Display a unique count of eponyms
id("eponyms-total-unique").appendChild(
  R.pipe(
    R.length,
    e => e.toLocaleString('en', { useGrouping: true }),
    div
  )(allEponyms()))

id("regions").appendChild(Regions)
id("ulitsa").appendChild(Logo)
id("countries").appendChild(
  // Update shown countries on region change
  van.bind(vRegion, (vRegion) =>
    RegionCountries(vRegion)
))

// Replace the regions with a search input
// id("search-button").addEventListener("click", () => {
//   id("regions").style.display = "none"
//   id("search-input").style.display = "inline"
//   id("search-input").focus()
// })

// // Replace the search input with the regions
// id("search-input").addEventListener("focusout", (ev) => {
//   console.log(ev.target.class)
//   id("regions").style.display = "block"
//   id("search-input").style.display = "none"
//   vSearchStr.val = ".*"
// })

// id("search-input").addEventListener("input", (t) => {
//   if (t.target.value.length > 2)
//       vSearchStr.val = t.target.value
//     // Reset
//   else vSearchStr.val = ".*"
// })

// Display persons on country change
// If no country selected, display all persons
id("persons").appendChild(
  van.bind(vCountry, vSearchStr, (country, str) => {    
    if (str !== ".*")
      return EponymsSearch(str)
    else if (country !== "")
      return EponymsCountry(country)
    else return EponymsWorldwide()
  }))
