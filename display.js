const { div, a, sup, span, input, b, button } = van.tags
import regions from "./regions.js"

const statistics = await fetch("http://192.168.1.8:8085/out/all.json")
  .then(s => s.json())

const regionsNames = R.map(R.head, regions)

// Return the `region` countries with at least one eponym
const countries = R.memoizeWith(R.identity, region =>
  R.pipe(
    R.filter(R.compose(R.equals(region), R.head)),
    R.flatten,
    // Pick all the countries
    R.tail,
    // Keep only countries that have at least one eponym
    R.filter(country =>
      R.pipe(
        R.map(R.head),
        R.find(R.equals(country)),
        R.complement(R.isNil)
      )(statistics)),
  )(regions))

const countryEponyms = country =>
  R.pipe(
    R.filter(R.compose(R.equals(country), R.head)),
    R.prop(0),
    R.prop(3),
    R.sortWith([sortDirection()(R.prop(1))]),    
  )(statistics) 

const eponymDisplayFormat = (eponym) =>  
  vLanguage.val === "EN" ? displayName(eponym[2]) : eponym[0]

const displayName = (link) =>
  R.pipe(
    decodeURI,
    R.split("/"),
    R.last,
    // Add non-line-breaking spaces and dashes to display the person name on a
    // single line
    R.split("_"),
    R.join(" "),
    // R.replace(/-/g, "‑")
  )(link)

// Return a list of all unique eponyms from all countries.
const allEponyms = R.memoizeWith(R.identity, () =>
  R.pipe(
    R.chain(R.prop(3)),
    R.map(R.prop(2)),
    R.groupBy(R.identity),
    R.mapObjIndexed(R.length),
    R.toPairs,
    // R.sortWith([vSort.val(R.prop(1))]),
    // Force the [eponym, count, link] format.
    // There is no translation for worlwide eponyms
    R.map(v => [(displayName(v[0])), v[1], v[0]]),
  )(statistics))

const capitalize = R.replace(/^./, R.toUpper)

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
      R.find(R.compose(R.equals(eponym), R.prop(2)), country[3])),
    R.map(R.head),
    R.map(capitalize)
  )(statistics)

// https://stackoverflow.com/questions/72704941/how-do-i-close-dialog-by-clicking-outside-of-it
const dialog = document.getElementById("showCountries")
dialog.addEventListener("click", ({ target: dialog }) => {  
  if (dialog.nodeName === 'DIALOG')
    dialog.close('dismiss')
})    

const Eponyms = (title, eponyms) =>
  span(
    div({ id: "eponyms-title" }, title),    
    R.map(eponym =>
      span({ class: "eponym" },
        a({
          href: eponym[2],
          target: "_blank"
        }, eponymDisplayFormat(eponym)),
        a({
          class: "eponymcount",
          onclick: () => {
            dialog.innerText = eponymOccurence(eponym[0]).join("   ")
            dialog.showModal()
          }
        }, sup(eponym[1]), " ")),
      eponyms))

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
    capitalize(country),
    countryEponyms(country))

const RegionCountries = R.memoizeWith(R.identity, (region) => span(
  R.map(country =>
    span({ class: "country" },
      a({
        onclick: () => {
          vCountry.val = country,
          vRegion.val = ""
        },
        href: `#${country}`,
        id: {
          deps: [vCountry],
          f: R.ifElse(
            R.equals(country), R.always("selected-country"), R.always("")
          )
        }
      }, capitalize(country) + " ")),
    countries(region))))

const Search = input({
  type: "search",  
  autofocus: "false",
  oninput: t => {    
    const value = t.target.value
    if (value.length > 2) {
      vSearchStr.val = t.target.value
    }    
    // Reset
    else vSearchStr.val = ".*"
  },
})

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
    }, capitalize(region)),
    regionsNames)  
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
id("search").replaceChildren(Search)
id("countries").appendChild(
  // Update shown countries on region change
  van.bind(vRegion, (vRegion) =>
    RegionCountries(vRegion)
))

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
