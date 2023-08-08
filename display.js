const { div, a, sup, span, input, b, button } = van.tags
import { metadata } from "./out/metadata.js"
import { statistics } from "./out/all.min.js"
import { regionsNames, regionCountries, countryDisplayName } from "./regions.js"

const taplog = R.tap(console.log) 

const eponymDisplay = R.compose(R.replace(/_/g, " "), R.last)

const eponymDisplayFormat = (eponym) =>  
  vLanguage.val === "EN" ? eponymDisplay(eponym[2]) : eponym[0]

// Return a list of all unique eponyms from all countries.
const allEponyms = R.memoizeWith(R.identity, () =>
  R.pipe(
    R.chain(R.prop(2)),    
    R.map(R.prop(2)),
    R.groupBy(R.identity),
    R.mapObjIndexed(R.length),
    R.toPairs,    
    // There is no translation for worlwide eponyms, so keep a 
    // [epony, count, [lang, eponym]] structure
    R.map(v => [
      eponymDisplay(R.split("|", R.replace(",", "|", v[0]))),
      v[1],
      R.split("|", R.replace(",", "|", v[0]))
    ]),    
  )(statistics))

const vRegion    = van.state("")
const vCountry   = van.state("")
const vLanguage  = van.state("EN")
const vSort      = van.state("down")
const vSearchStr = van.state(".*")

const sortDirection = () =>
  vSort.val === "up" ? R.ascend : R.descend

// Return a list of countries where the given eponym appears in.
const eponymOccurence = (eponym) =>
  R.pipe(
    R.filter(country =>
      R.find(R.propEq(2, eponym[2]), country[2])),    
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

const buildLink = l => `https://${l[2][0]}.wikipedia.org/wiki/${l[2][1]}`

const Eponyms = (title, eponyms, date) =>
  span(
    div({ id: "eponyms-country" }, title),
    id("info"),
    R.map(eponym =>
      span({ class: "eponym" },
        a({
          href: buildLink(eponym),
          target: "_blank"
        }, eponymDisplayFormat(eponym)),
        a({
          class: "eponymcount",
          onclick: () => {
            dialog.innerText = eponymOccurence(eponym)
            dialog.showModal()
          }
        }, sup(eponym[1]), " ")),
      eponyms),
    div(date ? "Osm data from: " + date : "")
  )

const EponymsWorldwide = () =>
  Eponyms(
    "Worldwide",
    // Keep eponyms appearing in at least three countries only.
    R.pipe(
      R.reject(R.compose(R.gt(3), R.prop(1))),
      R.sortWith([sortDirection()(R.prop(1))]),
    )(allEponyms())
  )

const EponymsSearch = (regex) =>
  Eponyms(
    "Searching...",
    R.pipe(
      R.filter(R.compose(R.prop(0), R.match(new RegExp(regex, "i")), R.prop(0))),
      R.sortWith([sortDirection()(R.prop(1))]),
    )(allEponyms()))

const EponymsCountry = country =>
  Eponyms(    
    country[1],
    R.pipe(      
      R.filter(R.compose(R.equals(country[0]), R.head)),
      R.path([0, 2]),
      R.sortWith([sortDirection()(R.prop(1))]),
    )(statistics),
    R.find(R.propEq(0, country[0]), metadata)[1])

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
    b
  )(allEponyms()))

id("regions").appendChild(Regions)
id("ulitsa").appendChild(Logo)
id("countries").appendChild(
  // Update shown countries on region change
  van.bind(vRegion, (vRegion) =>
    RegionCountries(vRegion)
))

// Replace the regions with a search input
id("search-button").addEventListener("click", () => {
  id("regions").style.display = "none"
  id("search-input").style.display = "inline"
  id("search-input").focus()
})

// Replace the search input with the regions
id("search-input").addEventListener("focusout", (ev) => {
  console.log(ev.target.class)
  id("regions").style.display = "block"
  id("search-input").style.display = "none"
  vSearchStr.val = ".*"
})

id("search-input").addEventListener("input", (t) => {
  if (t.target.value.length > 2)
      vSearchStr.val = t.target.value
    // Reset
  else vSearchStr.val = ".*"
})

id("language").addEventListener("click", () => {  
  if (vLanguage.val === "EN") {    
    id("english").style.display = "none"
    id("native").style.display = "inline"
    vLanguage.val = "native"    
  } else {
    id("english").style.display = "inline"
    id("native").style.display = "none"
    vLanguage.val = "EN"
  }
})

id("sort").addEventListener("click", () => {
    if (vSort.val === "down") {      
      id("arrow-up").style.display = "none"
      id("arrow-down").style.display = "inline"
      vSort.val = "up"
    }
    else {
      id("arrow-up").style.display = "inline"
      id("arrow-down").style.display = "none"
      vSort.val = "down"
    }    
  }
)

// Display persons on country change
// If no country selected, display all persons
id("persons").appendChild(
  van.bind(vCountry, vSearchStr, vLanguage, vSort, (country, str) => {    
    if (str !== ".*")
      return EponymsSearch(str)
    else if (country !== "")
      return EponymsCountry(country)
    else return EponymsWorldwide()
  }))
