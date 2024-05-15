import { program } from "commander"
import * as R from "ramda"
import chalk from "chalk"
import { equivalentDups, equivalentDupsAll } from "./equivalents.js"
import { htmlPageCountry, htmlPageWorldwide, htmlPageAllCountries } from "./html_pages.js"
import { downloadOsm, extractOsmData, inspectOsmData, parseOsmData, linkDups,
  linksConsistency, linkDupsAll, linksConsistencyAll } from "./osm.js"
import { occupationsUpdate, updateWiki } from "./wiki.js"

const handleCheck = (message, res) => R.ifElse(
  () => R.isEmpty(res),
  R.always("ignore"),
  () => console.log(chalk.blue(message + ":\n") + res.join("\n") + "\n")
)(res)

program
  .version("1.0")

program
  .command('download <country>')
  .description("Download the latest osm data for the given <country>.")
  .action(downloadOsm)

program
  .command('extract <country>')
  .description("Extract a first, raw, version of all the street names for <country>.")
  .action(extractOsmData)

program
  .command('inspect <country> <regex>')
  .description("Inspect the <country> raw osm data. Useful in finding new osm tags\
 containing possible streets. Only needed if we're going to modify the generator.")
  .action(inspectOsmData)

program
  .command('update <country>')
  .description("Generate the eponym file for <country>.")
  .action(parseOsmData)

program
  .command('check <country>')
  .description("Verify if <country> has duplicate equivalent entries, duplicate urls or\
 consistent urls.")
  .action(country => {
    handleCheck("Duplicate Equivalents", equivalentDups(country))
    handleCheck("Duplicate Links",       linkDups(country))
    handleCheck("Inconsistent Links",    linksConsistency(country))    
  })

program
  .command('check-all')
  .description("Check all countries for duplicate equivalent entries, duplicate\
  urls or consistent urls. Return a list of all the countries where such checks\
  fail, if any.")
  .action(() => {
    handleCheck("Countries with duplicate equivalents", equivalentDupsAll())
    handleCheck("Countries with duplicate links",       linkDupsAll())
    handleCheck("Countries with inconsistent links",    linksConsistencyAll())
  })

program
  .command('wiki <country>')
  .description('Extract/update info for <country>\'s persons from wikipedia and save them locally.')
  .action(updateWiki)

program
  .command('html <country>')
  .description('Generate a html page for the given <country>.')
  .action(htmlPageCountry)

program
  .command('html-all-countries')
  .description('Generate a html page for all countries in a single step.')
  .action(htmlPageAllCountries)

program
  .command('html-worldwide')
  .description('Generate a html page with the worldwide eponyms frequencies.')
  .action(htmlPageWorldwide)

program
  .command('occupations-update')
  .description('Update the occupations list for each person in the persons.json\
  file based on the specified "ocupations" and "categories" lists.')
  .action(occupationsUpdate)

program.parse()
