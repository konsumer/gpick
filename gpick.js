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
    console.error(`\nYou are trying to pick from '${branchFrom}' to itself.`)
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

    const list = blessed.list({
      height: '100%',
      width: '100%',
      interactive: true,
      invertSelected: true,

      tags: true,
      items: commitsDiff.map(c => `{red-fg}${c.oid}{/} - ${c.message} (${c.when}) <${c.author}>`)
    })
    list.focus()
    screen.append(list)
    screen.render()
  }
}

main()
