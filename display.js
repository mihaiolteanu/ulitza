const { p, div, a, sup, span, h3, input, b } = van.tags

import regions from "./regions.js"

const statistics = await fetch("http://192.168.1.8:8085/out/all.json")
  .then(s => s.json())

const regionsNames = R.map(R.head, regions)

// Returns true if `country` has at least one street name, false otherwise
const countryHasData = (country) =>
  R.pipe(
    R.map(R.head),
    R.find(R.equals(country)),
    R.complement(R.isNil)    
  )(statistics)

// All relevant country names for the given `region`
const regionCountryNames = region =>
  R.pipe(
    R.filter(R.compose(R.equals(region), R.head)),    
    R.flatten,
    // The first entry is the region name
    R.tail,
    // Keep only countries that have some persons
    R.filter(countryHasData),
  )(regions)

const countryData = country =>
  R.filter(R.compose(R.equals(country), R.head), statistics)[0]

// const displayName = (link) =>
//   R.compose(R.join(" "), R.split("_"), R.last, R.split("/"), decodeURI)(link)

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

const allPersons = R.memoizeWith(R.identity, () =>
  R.pipe(
    R.chain(R.prop(3)),
    R.map(R.prop(2)),
    R.groupBy(R.identity),    
    R.mapObjIndexed(R.length),
    R.toPairs,
    R.sortWith([R.descend(R.prop(1))]),
  )(statistics))

// Keep persons appearing at least three or more times only.
const frontPagePersons = R.memoizeWith(R.identity, () =>
  R.reject(R.compose(R.gt(3), R.prop(1)), allPersons()))

const searchResultPersons = (regex) => 
  R.filter(R.compose(R.prop(0), R.match(new RegExp(regex, "i")), R.prop(0)),
           allPersons())  

const worldTotal = 
  R.pipe(
    R.map(R.props([1, 2])),
    R.reduce((acc, elem) => [acc[0] + elem[0], acc[1] + elem[1]], [0, 0]),
  )(statistics)

const capitalize = R.replace(/^./, R.toUpper)

const selectedRegion  = van.state("")
const selectedCountry = van.state("")
const searchStr       = van.state(".*")

document.getElementById("statistics").appendChild(
  div(
    b("🚹🚺 " + worldTotal[0].toLocaleString('en', { useGrouping: true }))
  )
)

const personCountries = (name) =>
  R.pipe(
    R.filter(country =>
      R.find(R.compose(R.equals(name), R.prop(2)), country[3])),
    R.map(R.head),
    R.map(capitalize)
  )(statistics)

// https://stackoverflow.com/questions/72704941/how-do-i-close-dialog-by-clicking-outside-of-it
const dialog = document.getElementById("showCountries")
dialog.addEventListener("click", ({ target: dialog }) => {
  if (dialog.nodeName === 'DIALOG')
    dialog.close('dismiss')
})    

const Persons = (persons) =>
  span(
    R.map(person =>
      span({ class: "person" },
        a({
          href: person[0],
          target: "_blank"
        }, displayName(person[0])),
        a({
          class: "personcount",          
          onclick: () => {
            dialog.innerText = personCountries(person[0]).join("   ")
            dialog.showModal()
          }
        },
          // "(" + person[1] + ") ",
          sup(person[1]),
          " "
        )),
      persons))

const FrontPagePersons = R.memoizeWith(R.identity, () =>
  span(
    b("🚹🚺 " + worldTotal[0].toLocaleString('en', { useGrouping: true })),
    h3("Worldwide"),
    Persons(frontPagePersons())
  ))

const SearchResultPersons = (regex) =>
  Persons(searchResultPersons(regex))

const CountryPersons = R.memoizeWith(R.identity, name => {
  const country = countryData(name)
  return span(
    div(h3(capitalize(country[0]))),
    Persons(country[3]))
})

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
    regionCountryNames(region))))


// Display persons on country change
// If no country selected, display all persons
document.getElementById("persons").appendChild(
  van.bind(selectedCountry, searchStr, (selectedCountry, searchStr) => {    
    if (searchStr !== ".*")
      return SearchResultPersons(searchStr)
    else if (selectedCountry !== "")
      return CountryPersons(selectedCountry)
    else return FrontPagePersons()
  }))


// Display countries on region change
document.getElementById("countries").appendChild(
  van.bind(selectedRegion, (selectedRegion) =>
    RegionCountries(selectedRegion)
))

// display regions
document.getElementById("regions").appendChild(
  span(
    R.map(region =>
      a({
        href: `#${region}`,
        onclick: () => {
          if (selectedRegion.val === region) {
            selectedRegion.val = ""            
          }            
          else
            selectedRegion.val = region
        },
        id: {
          deps: [selectedRegion],
          f: R.ifElse(
            R.equals(region), R.always("selected-region"), R.always("")
          )
        }
      }, capitalize(region)),
    regionsNames)))

// display search
document.getElementById("search").appendChild(
  input({
    type: "search",    
    oninput: t => {
      const value = t.target.value
      if (value.length > 2) {
        searchStr.val = t.target.value        
      }
      // Reset
      else searchStr.val = ".*"
    },    
  })
)

document.getElementById("ulitsa").appendChild(
  a({
    href: "#",
    onclick: () => {
      selectedRegion.val  = ""
      selectedCountry.val = ""
      searchStr.val       = ".*"
    }
  }, "ulitza")
)
