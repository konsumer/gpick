#!/usr/bin/env node

const git = require('isomorphic-git')
const fs = require('fs')
const dir = process.cwd()
const yargs = require('yargs/yargs')
const timeAgo = require('timeago.js')
const blessed = require('blessed')

// wrapping modulus
const mod = (n, m) => ((n % m) + m) % m

function parseCommits (log) {
  return log.map(item => {
    const oid = item.oid.substr(0, 7)
    const author = item.commit.author.name
    const timestamp = item.commit.author.timestamp
    const when = timeAgo.format(timestamp * 1000)
    const message = item.commit.message.trim()

    return {
      oid,
      message,
      timestamp,
      author,
      when
    }
  })
}

async function main () {
  const y = yargs(process.argv.slice(2))
    .usage('$0 <FROM> <TO> or just <TO>')
    .help()

  const branches = await git.listBranches({ fs, dir })
  if (branches.length < 2) {
    y.showHelp()
    console.error("\nYou only have one branch, so I can't pick for you.")
    process.exit(1)
  }

  let [branchFrom, branchTo] = y.argv._

  // if one argument, use it as TO
  if (!branchTo) {
    branchTo = branchFrom
    branchFrom = await git.currentBranch({ fs, dir })
  }

  if (!branchTo) {
    y.showHelp()
    console.error('\nI can\'t figure out the branch to pick to.')
    process.exit(1)
  }

  if (branchFrom === branchTo) {
    y.showHelp()
    console.error(`\nYou are trying to pick from '${branchFrom}' to itself. Use one of these: ${branches.filter(b => b !== branchFrom).join(', ')}`)
    process.exit(1)
  }

  const commitsFrom = parseCommits(await git.log({ fs, dir, ref: branchFrom }))
  const commitsTo = parseCommits(await git.log({ fs, dir, ref: branchTo }))
  const commitsDiff = commitsFrom.filter(f => !commitsTo.find(t => t.oid === f.oid))

  if (!process.stdout.isTTY) {
    console.log(commitsDiff.map(c => `${c.oid} - ${c.message} (${c.when}) <${c.author}>`).join('\n'))
    process.exit(0)
  } else {
    const screen = blessed.screen({ smartCSR: true })
    screen.title = `gpick ${branchFrom} ${branchTo}`
    screen.key(['escape', 'q', 'C-c'], (ch, key) => process.exit(0))

    const choices = new Set()

    const items = commitsDiff.map((c, i) => `${choices.has(i) ? '*' : ' '} {red-fg}${c.oid}{/red-fg} - ${c.message} {green-fg}(${c.when}){/green-fg} {blue-fg}<${c.author}>{/blue-fg}`)

    const list = blessed.list({
      width: '100%',
      invertSelected: false,
      style: {
        selected: { bg: 'white', fg: 'black' }
      },
      keys: true,
      mouse: true,
      tags: true,
      items
    })
    list.focus()
    screen.append(list)

    list.on('select', () => {
      choices.has(list.selected)
        ? choices.delete(list.selected)
        : choices.add(list.selected)
      const c = commitsDiff[list.selected]
      list.setItem(list.selected, `${choices.has(list.selected) ? '*' : ' '} {red-fg}${c.oid}{/red-fg} - ${c.message} {green-fg}(${c.when}){/green-fg} {blue-fg}<${c.author}>{/blue-fg}`)
      screen.render()
    })

    list.key(['space'], () => {

    })

    const infobar = blessed.box({
      width: '100%',
      height: 1,
      bottom: 0,
      tags: true,
      style: {
        fg: 'black',
        bg: 'grey'
      },
      content: '{center}Use esc to quit, arrows to navigate, enter to choose commits, space to cherry-pick.{/center}'
    })
    screen.append(infobar)

    screen.render()
  }
}

main()
