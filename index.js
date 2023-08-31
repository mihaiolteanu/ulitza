const { a, div, span } = van.tags
import { statistics } from "./eponyms.min.js"
import { regionsNames, regionCountries, countryDisplayName } from "./regions.js"

const taplog = R.tap(console.log)
const tapfn  = (_fn) => R.tap

const vRegion    = van.state("")
const vCountry   = van.state("")
const vSearchStr = van.state(".*")

// The standard eponym format:
// [count, [wiki_lang, wiki_name]]
const eponymCount   = R.head
const eponymArray   = R.last
const eponymRawName = R.compose(R.last, eponymArray)
const eponymDisplay = R.compose(R.replace(/_/g, " "), eponymRawName)
const eponymURL = R.pipe(
  R.last,
  l => `https://${l[0]}.wikipedia.org/wiki/${l[1]}`,
)

const countryGithubURL = country =>
  R.includes(country, ["Worldwide", "Search"])
    ? `https://github.com/mihaiolteanu/ulitza/blob/main/eponyms/`
    : `https://github.com/mihaiolteanu/ulitza/blob/main/eponyms/${country.toLowerCase()}.json`

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
    // Transform back to standard eponym format (modified into a string with the
    // groupBy above)
    R.map(R.adjust(0,
      R.juxt([R.take(2), R.drop(3)]),)),
    R.map(v => [v[1], v[0]]),    
  )(statistics))

// Return a list of countries where the given eponym appears in.
const eponymOccurence = (eponym) =>
  R.pipe(
    R.filter(R.find(
      R.compose(R.equals(eponymArray(eponym)), eponymArray))),    
    R.map(R.head),
    R.map(countryDisplayName),
    R.join(", ")
  )(statistics)

const Eponyms = (title, eponyms, date) =>
  span(
    div({ id: "country" },
      a({ target: "_blank", href: countryGithubURL(title) }, title)),
    div({ id: "persons" },
      R.map(eponym => div(
        a({
          class: "eponym",
          href: eponymURL(eponym),
          target: "_blank"
        }, eponymDisplay(eponym)),
        " (",
        a({
          class: "eponym-count",
          onclick: () => {
            id("showCountries").innerText = eponymOccurence(eponym)
            id("showCountries").showModal()
          }
        }, eponymCount(eponym)),
        ") "
      ), eponyms)
    ),
    div({ id: "osm-data" }, date ? "Osm data from: " + date : "")
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
    "Search",
    R.filter(R.pipe(
      eponymRawName,
      R.match(new RegExp(regex, "i")),
      R.head
    ), allEponyms())
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
        id: {
          deps: [vCountry],
          f: R.ifElse(
            R.equals(country), R.always("selected-country"), R.always("")
          )
        }
      }, country[1] + " "),
      span(" | ")),
    regionCountrisWithEponyms(region))))

const Regions = span(
  R.pipe(
    R.intersperse(" | "),
    R.map(region =>
      region === " | " ? region :
        span(
          a({
            class: "region",
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
        )),
  )(regionsNames())
)

const id = (id) => document.getElementById(id)

id("regions").appendChild(Regions)

id("ulitza").addEventListener("click", () => {
  vRegion.val = ""
  vCountry.val = ""
  vSearchStr.val = ".*"
})

id("countries").appendChild(
  // Update shown countries on region change
  van.bind(vRegion, (vRegion) =>
    RegionCountries(vRegion)
))
id("showCountries").addEventListener("click",
  id("showCountries").close)

// Replace the regions with the search input
id("search").addEventListener("click", () => {
  id("regions").style.display = "none"
  id("search-input").style.display = "inline"
  id("cancel-search").style.display = "inline"
  id("search").style.display = "none"  
  id("search-input").focus()
  id("search-input").value = ""
})

// // Replace the search input with the regions
id("cancel-search").addEventListener("click", () => {
  id("regions").style.display = "inline"
  id("search-input").style.display = "none"
  id("cancel-search").style.display = "none"
  id("search").style.display = "inline"
  vSearchStr.val = ".*"
})

id("search-input").addEventListener("input", (t) => {
  if (t.target.value.length > 2)
    vSearchStr.val = t.target.value
  else if (t.target.value.length === 0)
    id("cancel-search").dispatchEvent(new Event("click"))
  // Reset
  else vSearchStr.val = ".*"
})

// Display persons on country change
// If no country selected, display all persons
id("content").appendChild(
  van.bind(vCountry, vSearchStr, (country, str) => {    
    if (str !== ".*")
      return EponymsSearch(str)
    else if (country !== "")
      return EponymsCountry(country)
    else return EponymsWorldwide()
  }))

id("total-unique-eponyms").append(
  R.pipe(
    R.length,
    e => e.toLocaleString('en', { useGrouping: true }),  
  )(allEponyms()))
