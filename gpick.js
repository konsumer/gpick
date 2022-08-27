const git = require('isomorphic-git')
const fs = require('fs')
const dir = process.cwd()
const yargs = require('yargs/yargs')
const timeAgo = require('timeago.js')

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
  const wrap = (await import('wrap-ansi')).default
  const colors = (await import('chalk')).default
  const stripAnsi = (await import('strip-ansi')).default

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

  const commitsFrom = parseCommits(await git.log({ fs, dir, depth: 1, branch: branchFrom }))
  const commitsTo = parseCommits(await git.log({ fs, dir, depth: 1, branch: branchTo }))

  for (const { oid, author, message, when } of commitsFrom) {
    let m = `${colors.red(oid)} - ${colors.white(message.replace(/\n/g, ' '))} ${colors.green('(' + when + ')')} ${colors.blueBright(`<${author}>`)}`
    if (stripAnsi(m).length > process.stdout.columns) {
      m = wrap(m, process.stdout.columns - 3).split('\n')[0] + '...'
    }
    if (!commitsTo.find(c => c.oid === oid)) {
      console.log(m)
    }
  }
}

main()
