import { program } from "commander"
import fs from "fs/promises"
import * as R from "./ramda.js"
import * as F from "fluture"
import S from "sanctuary"
import { allCountries, osmDownloadLink } from "./regions.js"
import { equivalentDups, equivalentDupsAll } from "./equivalents.js"
import { extractOsmData, parseOsmData, osmPath, inspectOsmData, linkDups, linkDupsAll } from "./generator.js"

program
  .version("1.0")

program
  .command("countries")
  .description("Display all available osm countries.")
  .action(R.compose(console.log, R.join("\n"), allCountries))


program
  .command('download <country>')
  .description("Fetch the latest osm pbf file for the given country")
  .action(country =>
    R.pipe(
      osmDownloadLink,
      // promises are not a vaild datatype for Maybe
      R.map(F.encaseP(fetch)),
      R.map(F.fork
        (console.log)
        (v => v.text()
          .then(data => fs.writeFile(osmPath(country), data)
          .catch(console.log)))),
      S.maybe
        ("country not found; see the list of available countries with the <country> command")
        (R.always(`downloading ${country} latest osm data...`)),
      console.log
    )(country))


program
  .command('extract <country>')
  .description("Extract the raw data for the given country")
  .action(extractOsmData)


program
  .command('inspect <country> <regex>')
  .description("Inspect the given country osm data")
  .action(inspectOsmData)


program
  .command('parse <country>')
  .description("Parse the given country")
  .action(parseOsmData)


program
  .command('eq-dups <country>')
  .description("Search for eponym duplicates for the given country")
  .action(R.compose(console.log, R.join("\n"), equivalentDups))


program
  .command('eq-dups-all')
  .description("Search for eponym duplicates for all countries")
  .action(equivalentDupsAll)


program
  .command('link-dups <country>')
  .description("Search for eponym link duplicates for the given country")
  // .action(R.compose(console.log, R.join("\n"), linkDups))
  .action(R.compose(console.log, linkDups))


program
  .command('link-dups-all')
  .description("Search for eponym link duplicates for all countries")
  // .action(R.compose(console.log, R.join("\n"), linkDupsAll))
  .action(R.compose(console.log, linkDupsAll))


program.parse()
