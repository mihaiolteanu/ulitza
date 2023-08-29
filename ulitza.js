import { program } from "commander"
import fs from "fs"
import * as R from "./ramda.js"
import * as F from "fluture"
import S from "sanctuary"
import { countries, osmDownloadLink } from "./regions.js"
import { equivalentDups, equivalentDupsAll } from "./equivalents.js"
import {
  extractOsmData,
  parseOsmData,
  osmPath,
  inspectOsmData,
  linkDups,
  linksConsistency,
  linksConsistencyAll,
  linkDupsAll,
  statistics
} from "./generator.js"

program
  .version("1.0")

program
  .command("countries")
  .description("Display all available osm countries.")
  .action(R.compose(console.log, R.join("\n"), countries))


program
  .command('download <country>')
  .description("Fetch the latest osm pbf file for the given country")
  .action(country =>
    R.pipe(
      osmDownloadLink,
      link => link === "" ? S.Nothing : S.Just(link),
      // promises are not a vaild datatype for Maybe, use Fluture
      R.map(F.encaseP(fetch)),
      R.map(F.fork
        (console.log)
        (v => v.arrayBuffer()
          .then(Buffer.from)
          .then(buffer => fs.createWriteStream(osmPath(country)).write(buffer))
          .catch(console.log))),
      S.maybe
        ("country not found; see the list of available countries with the <countries> command")
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
  .command('statistics')
  .description("Generate the stats file for all the countries")
  .action(statistics)

const handleCheck = message => res => R.ifElse(
  () => R.isEmpty(res),
  R.always("ignore"),
  () => console.log(message + ":\n" + res.join("\n") + "\n")
)(res)

program
  .command('check <country>')
  .action(R.juxt([
    R.compose(handleCheck("Duplicate Equivalents"), equivalentDups),
    R.compose(handleCheck("Duplicate Links"),       linkDups),
    R.compose(handleCheck("Inconsistent Links"),    linksConsistency),
  ]))

program
  .command('check-all')
  .action(() => {
    handleCheck("Countries with duplicate equivalents")(equivalentDupsAll())
    handleCheck("Countries with duplicate links")      (linkDupsAll())
    handleCheck("Countries with inconsistent links")   (linksConsistencyAll())
  })


program
  .command('link-dups-all')
  .description("Search for eponym link duplicates for all countries")
  // .action(R.compose(console.log, R.join("\n"), linkDupsAll))
  .action(R.compose(console.log, linkDupsAll))


program.parse()
