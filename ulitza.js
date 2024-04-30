import { program } from "commander"
import fs from "fs"
import * as R from "./ramda.js"
import * as F from "fluture"
import S from "sanctuary"
import chalk from "chalk"
import { countries, osmLink } from "./regions.js"
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
  htmlPageCountry,
  htmlPageWorldwide
} from "./generator.js"

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
  .action(country =>
    R.pipe(
      osmLink,
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
        (chalk.blue("Country unavailable, try one of:\n") + R.join(" | ", countries()))
        // ("country not found; see the list of available countries with the <countries> command")
        (R.always(`Downloading the latest osm data to osm_data/${country}...`)),
      console.log
    )(country))

program
  .command('extract <country>')
  .description("Extract a first, raw, version of all the street names for\
 the given <country>.")
  .action(extractOsmData)

program
  .command('update [country]')
  .description("Generate the eponym file for the given [country]. If [country]\
 is not specified, generate the eponym file containing the data for all countries.")
  .action(country => country ? parseOsmData(country) : statistics())

program
  .command('check [country]')
  .description("Verify if [country] has duplicate equivalent entries, duplicate urls or\
 consistent urls. If the [country] is not specified, return a list of all the\
 countries where such checks fail.")
  .action(country => {
    if (country) {
      handleCheck("Duplicate Equivalents", equivalentDups(country))
      handleCheck("Duplicate Links",       linkDups(country))
      handleCheck("Inconsistent Links",    linksConsistency(country))
    }
    else {
      handleCheck("Countries with duplicate equivalents", equivalentDupsAll())
      handleCheck("Countries with duplicate links",       linkDupsAll())
      handleCheck("Countries with inconsistent links",    linksConsistencyAll())
    }
  })

program
  .command('inspect <country> <regex>')
  .description("Inspect the <country> raw osm data. Useful in finding new osm tags\
 containing possible eponyms. Only needed if we're going to modify the generator.")
  .action(inspectOsmData)

program
  .command('html <country>')
  .description('Generate a html page for the given <country>.')
  .action(htmlPageCountry)

program
  .command('html-worldwide')
  .description('Generate a html page with the worldwide eponyms frequencies.')
  .action(htmlPageWorldwide)

program.parse()
