// A fixture of docs/redesign/prototypes/data/ with every day, for the tests: public/data/ holds only the days the database covers (trim-window.mjs).
// Through JSON, as the app gets it: the fixture script runs in its own context, whose arrays fail a strict deepEqual.
import { readFileSync } from 'node:fs'
import { convertFixture } from '../build-fixtures.mjs'
import { buildPlegmaLayout } from '../build-plegma-layout.mjs'

const data = new URL('../../../docs/redesign/prototypes/data/', import.meta.url)

export const fullData = (name) => name === 'plegma'
  ? buildPlegmaLayout(fullData('stories'))
  : JSON.parse(JSON.stringify(convertFixture(readFileSync(new URL(`${name}.js`, data), 'utf8'), `${name}.js`)[name]))
