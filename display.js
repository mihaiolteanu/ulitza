const { div, a, sup, span, input, b } = van.tags
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

const countryEponyms = R.memoizeWith(R.identity, country =>
  R.pipe(
    R.filter(R.compose(R.equals(country), R.head)),
    R.prop(0),
    R.prop(3),    
  )(statistics)) 

const displayName = (link) =>
  R.pipe(
    decodeURI,
    R.split("/"),
    R.last,
    // Add non-line-breaking spaces and dashes to display the person name on a
    // single line
    R.split("_"),
    R.join(" "),
    R.replace(/-/g, "‑")
  )(link)

// Return a list of all unique eponyms from all countries.
const allEponyms = R.memoizeWith(R.identity, () =>
  R.pipe(
    R.chain(R.prop(3)),
    R.map(R.prop(2)),
    R.groupBy(R.identity),    
    R.mapObjIndexed(R.length),
    R.toPairs,    
    R.sortWith([R.descend(R.prop(1))]),
    // Force the [eponym, count, link] format.
    R.map(v => [v[0], v[1], v[0]]),
    R.tap(console.log)
  )(statistics))

const capitalize = R.replace(/^./, R.toUpper)

const selectedRegion  = van.state("")
const selectedCountry = van.state("")
const searchStr       = van.state(".*")

document.getElementById("eponyms-total-unique").appendChild(
  R.pipe(
    R.length,
    e => e.toLocaleString('en', { useGrouping: true }),
    b
  )(allEponyms()))

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

const Search = input({
  type: "search",  
  size: "15",
  autofocus: "true",  
  oninput: t => {    
    const value = t.target.value
    if (value.length > 2) {
      searchStr.val = t.target.value
    }
    else if (value.length === 0) {
      document.getElementById("regions").replaceChildren(Regions)
    }
    // Reset
    else searchStr.val = ".*"
  },
})

const Eponyms = (title, eponyms) =>
  span(
    div({ id: "eponyms-title" }, title),
    R.map(eponym =>
      span({ class: "eponym" },
        a({
          href: eponym[2],
          target: "_blank"
        }, displayName(eponym[2])),
        a({
          class: "eponymcount",
          onclick: () => {
            dialog.innerText = eponymOccurence(eponym[0]).join("   ")
            dialog.showModal()
          }
        }, sup(eponym[1]), " ")),
      eponyms))

const EponymsWorldwide = R.memoizeWith(R.identity, () =>
  Eponyms(
    "Worldwide",
    // Keep eponyms appearing in at least three countries only.
    R.reject(
      R.compose(R.gt(3), R.prop(1)),
      allEponyms())))

const EponymsSearch = (regex) =>
  Eponyms(
    "Searching...",    
    R.filter(
      R.compose(R.prop(0), R.match(new RegExp(regex, "i")), R.prop(0)),
      allEponyms()))

const EponymsCountry = R.memoizeWith(R.identity, name =>    
  Eponyms(
    capitalize(name),
    countryEponyms(name)))

const RegionCountries = R.memoizeWith(R.identity, (region) => span(
  R.map(country =>
    span({ class: "country" },
      a({
        onclick: () => {
          selectedCountry.val = country,
          selectedRegion.val = ""
        },
        href: `#${country}`,
        id: {
          deps: [selectedCountry],
          f: R.ifElse(
            R.equals(country), R.always("selected-country"), R.always("")
          )
        }
      }, capitalize(country) + " ")),
    countries(region))))


// Display persons on country change
// If no country selected, display all persons
document.getElementById("persons").appendChild(
  van.bind(selectedCountry, searchStr, (selectedCountry, searchStr) => {    
    if (searchStr !== ".*")
      return EponymsSearch(searchStr)
    else if (selectedCountry !== "")
      return EponymsCountry(selectedCountry)
    else return EponymsWorldwide()
  }))


// Display countries on region change
document.getElementById("countries").appendChild(
  van.bind(selectedRegion, (selectedRegion) =>
    RegionCountries(selectedRegion)
))

const Regions = span(  
  R.map(region =>
    a({
      href: `#${region}`,
      onclick: () => selectedRegion.val =
        selectedRegion.val === region ? "" : region,
      id: {
        deps: [selectedRegion],
        f: R.ifElse(
          R.equals(region), R.always("selected-region"), R.always("")
        )
      }
    }, capitalize(region)),
    regionsNames),
  a({
    onclick: () =>
      document.getElementById("regions").replaceChildren(Search)
  },
    b("S"))
)

const Logo = a({
  href: "#",
  onclick: () => {
    selectedRegion.val = ""
    selectedCountry.val = ""
    searchStr.val = ".*"
  }
}, "ulitza")

// display regions
document.getElementById("regions").appendChild(Regions)
document.getElementById("ulitsa").appendChild(Logo)
