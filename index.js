'use strict';

const _ = require('lodash')
const fse = require('fs-extra')
const moment = require('moment')
const fm = require('front-matter')
const entities = require('entities')
var enml2html = require('enml2html') // use var for easy mock in mocha testing
const debug = require('debug')('everblog-adaptor-hexo')
const cheerio = require('cheerio')
const format = require('string-format')
const Promise = require('bluebird')

module.exports = function* (data) {
  const dist = process.cwd() + '/source/_posts/'
  fse.emptyDirSync(dist)

  for(let post of data.posts){
    const defaultFrontMatter = {
      title: post.title,
      date: formatDate(post.created),
      updated: formatDate(post.updated),
      tags: post.tags
    }
    debug('content -> %j', post.content)

    let contentMarkdown = enml2html(post.content, post.resources, data.$webApiUrlPrefix, post.noteKey)
    debug('contentMarkdown -> %j', contentMarkdown)

    let $ = cheerio.load(contentMarkdown)
    // Download all images and update the src attribute.
    const getNoteResource = Promise.promisify(data.noteStore.getResource, { context: data.noteStore })
    if (post.resources) {
      for (let res of post.resources) {
        let resData = yield getNoteResource(res.guid, true, false, true, false)
        var fileName = resData.attributes.fileName
        if (!fileName) {
          fileName = Date.now().toString()
        }
        // Some images don't have file name field.
        // Make sure each of them has a name.
        fileName = fileName.replace(/_/g, '')
        const imgFile = format('/images/{}/{}', post.title, fileName)
        fse.outputFileSync(format('{}/source/{}', process.cwd(), imgFile), new Buffer(resData.data.body), 'binary')
        const hash = bodyHashToString(resData.data.bodyHash)
        // Point src field to the resource's real location.
        // This does work if you deploy it to your hexo server.
        $(format('img[hash="{}"]', hash)).attr('src', imgFile)
      }
    }

    // longdesc and alt field will make the HTML show the picture name on page.
    // That is not expected for some inline pictures.
    // Just remove them.
    $('img').attr('longdesc', '')
    $('img').attr('alt', '')
    // Originally, they are inline-block, which will make the view is out of page scope.
    // Making it as block will force everything in scope.
    $('div').css('display', 'block')
    contentMarkdown = $.html()

    var info = fm.parse(contentMarkdown)
    _.merge(info.attributes, defaultFrontMatter)
    contentMarkdown = fm.stringify(info)

    const filename = dist + info.attributes.title + '.html'
    fse.outputFileSync(filename, contentMarkdown)
    debug('title -> %s, body -> %j', info.attributes.title, contentMarkdown)
  }
  debug('build success!')
}

function formatDate(timestamp) {
  return moment(timestamp).format('YYYY/M/DD HH:mm:ss')
}

function bodyHashToString(bodyHash) {
  let str = '';
  for (let i in bodyHash) {
    let hexStr = bodyHash[i].toString(16);
    if (hexStr.length === 1) {
      hexStr = '0' + hexStr;
    }
    str += hexStr;
  }
  return str;
}

