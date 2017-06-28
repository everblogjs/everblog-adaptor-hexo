'use strict'

const fs = require('fs')
const should = require('should')
const co = require('co')
const cheerio = require('cheerio')
const rewire = require("rewire");
const fm = require('front-matter')
const format = require('string-format')
var processor = rewire('../index')

describe('generate html blog post based notes data', function () {
  it('note2html', function(){
    const data ={
      attributes: {
        title: "test, blog title"
      },
      webApiUrlPrefix: "test url prefix",
      noteStore: {
        getResource: function(a,b,c,d,e,callback){
          callback(null, resData)
        }
      },
      posts: [
        { // post with resources
          title: "test note title",
          created: 1498021041970,
          updated: 1498021041970,
          tags: [],
          resources: [
            { 
              guid: '123456',
            }
          ],
        },
        { // post without resources
          title: "test note title no resource",
          created: 1498021041970,
          updated: 1498021041970,
          tags: [],
          resources: null
        }
      ]
    }
    const resData = {
      attributes: {
        fileName: '__test_resource'
      },
      data: {
        bodyHash: [0],
        body: [12,34,56,78]
      }
    }

    processor.__set__("enml2html", function(a, b){
      if (b){ // has resource
        return `<div><img alt='123' longdesc='123' hash='00' src='http://web.test.com'></img></div>`
      }
      else { // no resource
        return `<div></div>`
      }
    });
    const dist = process.cwd() + '/source/_posts/';
    return (function(){
      return co(function*(){
        return yield processor(data)
      })
    }()).should.not.be.rejected()
      .should.be.fulfilled().then(function(){
        // verify
        data.posts.forEach(post => {
          let fileName = dist + post.title + '.html'
          fs.existsSync(fileName).should.be.true()
          let html = fs.readFileSync(fileName, 'utf-8')
          fm.test(html).should.be.true()
          let content = fm(html).body
          let $ = cheerio.load(content)
          $('img').should.exist
          $('img').each(function(){
            $(this).attr('longdesc').should.be.equal('')
            $(this).attr('alt').should.be.equal('')
            $(this).attr('src').should.startWith('/images/')
            $(this).attr('src').indexOf('_').should.equal(-1)
            fs.existsSync(format('{}/source/{}', process.cwd(), $(this).attr('src'))).should.be.true()
          })
        })
      })
  })
})
