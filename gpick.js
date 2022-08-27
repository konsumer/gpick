const git = require('isomorphic-git')
const fs = require('fs')
const dir = process.cwd()

const branches = await git.listBranches({ fs, dir })

console.log(branches)

// const commits = await git.log({fs, dir, depth: 1})

