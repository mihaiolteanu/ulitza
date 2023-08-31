import { program } from "commander"
import fs from "fs"
import * as R from "./ramda.js"
import * as F from "fluture"
import S from "sanctuary"
import chalk from "chalk"
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

const handleCheck = (message, res) => R.ifElse(
  () => R.isEmpty(res),
  R.always("ignore"),
  () => console.log(chalk.blue(message + ":\n") + res.join("\n") + "\n")
)(res)

program
  .version("1.0")

program
  .command('download <country>')
  .description("Download the <country>-latest.osm.pbf file from geofabrik.de\
 to \"osm_data\". This file contains all the unprocessed street data.")
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
        (chalk.blue("Country unavailable, try one of:\n") + R.join(" | ", countries()))
        // ("country not found; see the list of available countries with the <countries> command")
        (R.always(`Downloading the latest osm data to osm_data/${country}...`)),
      console.log
    )(country))

program
  .command('extract <country>')
  .description("Parse and extract street data from an already existing\
 <country>-latest.osm.pbf file. This extracted data is still in raw form\
 and is used to manually inspect it for possible affixes before generating\
 the eponyms file. The output is saved to \"raw/<country>.json\"")  
  .action(extractOsmData)

program
  .command('update [country]')
  .description("Parse the raw/[country].json file and generate a list of street names\
 together with their number of occurences. The output of this command is saved to\
`eponyms/[country].json`. If this file already exist, the command adds, as a final step,\
 all the existing wikipedia links to the newly generated one. The generated file can be\
 manually modified to add new wikipedia links. If the [country] is not specified, generate\
 the eponyms.json and eponyms.min.json files containing all the eponyms for all the countries.")
  .action(country => country ? parseOsmData(country) : statistics())

program
  .command('check [country]')
  .description("Verify if [country] has duplicate equivalent entries, duplicate urls or\
 consistent urls. If the [country] is not specified, return a list of all the\
 countries where such checks fail. You can then rerun the command for every listed country.")
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


program.parse()
