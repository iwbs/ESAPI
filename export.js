'use strict';
var fs = require('fs');
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({ host: 'localhost:9200' });
var spawn = require('child_process').spawn;

var _index = 'spectris';
var _type = 'email';
var attachmentSrcFolder = '/opt/email/attachments/';
var outputFolder = '/u01/report/' + _index + '/' + _type + '/';

// create folders
try { fs.statSync('/u01/report/'); } catch (e) { fs.mkdirSync('/u01/report/'); }
try { fs.statSync('/u01/report/' + _index + '/'); } catch (e) { fs.mkdirSync('/u01/report/' + _index + '/'); }
try { fs.statSync('/u01/report/' + _index + '/' + _type + '/'); } catch (e) { fs.mkdirSync('/u01/report/' + _index + '/' + _type + '/'); }


client.search({
    index: _index,
    type: _type,
    body: {
        "size": 0,
        "aggs": {
            "result": {
                "terms": {
                    "field": "tags",
                    "size": 1000
                }
            }
        }
    }
}).then(function (tagResp) {
    let tags = tagResp.aggregations.result.buckets;
    for (let i = 0; i < tags.length; i++) {
        fs.mkdirSync(outputFolder + tags[i].key);
        fs.writeFileSync(outputFolder + tags[i].key + '/count.txt', tags[i].doc_count);
        fs.writeFileSync(outputFolder + tags[i].key + '/metadata.csv', 'id,sender,subject,creationTime,sources\n');
        client.search({
            index: _index,
            type: _type,
            body: {
                "from": 0,
                "size": 10000,
                "_source": ["sender", "subject", "creationTime", "sources"],
                "query": {
                    "bool": {
                        "filter": {
                            "term": {
                                "tags": tags[i].key
                            }
                        }
                    }
                }
            }
        }).then(function (mailResp) {
            let mails = mailResp.hits.hits;
            for (let j = 0; j < mails.length; j++) {
                let sources = [];
                for (let k = 0; k < mails[j]._source.sources.length; k++) {
                    sources.push(mails[j]._source.sources[k].fileName);
                }
                fs.appendFile(outputFolder + tags[i].key + '/metadata.csv',
                    mails[j]._id + ',' + mails[j]._source.sender.email + ',' + mails[j]._source.subject + ',' + mails[j]._source.creationTime + ',' + sources.join('|') + '\n'
                    , (err) => {
                        if (err) throw err;
                    });

                client.get({
                    index: _index,
                    type: _type,
                    id: mails[j]._id,
                    requestTimeout: Infinity
                }, function (error, response) {
                    let m = response._source;
                    let tos = [], ccs = [], attachments = [];
                    for (let l = 0; l < m.recipients.length; l++) {
                        if (m.recipients[l].type === 'to')
                            tos.push(m.recipients[l].name + ' ' + m.recipients[l].email);
                        else if (m.recipients[l].type === 'cc')
                            ccs.push(m.recipients[l].name + ' ' + m.recipients[l].email);
                    }
                    for (let l = 0; l < m.attachments.length; l++) {
                        attachments.push(m.attachments[l].name);
                    }
                    let subject = mails[j]._source.subject.replace(/[<>:"\/\\\|\?\*]/g, "");
                    if (subject.length > 100)
                        subject = subject.substring(0, 100) + '...';
                    let fileName = mails[j]._source.sender.name.replace(/[\/]/g, " ") + ' ' + mails[j]._source.sender.email + ' - [' + subject + '] - ' + mails[j]._source.creationTime;
                    //fs.mkdirSync(outputFolder + tags[i].key + '/' + fileName);
                    try { fs.statSync(outputFolder + tags[i].key + '/' + fileName); } catch (e) { fs.mkdirSync(outputFolder + tags[i].key + '/' + fileName); }
                    spawn('cp', ['-rf', attachmentSrcFolder + _index + '/' + mails[j]._id + '/.', outputFolder + tags[i].key + '/' + fileName]);
                    fs.writeFile(outputFolder + tags[i].key + '/' + fileName + '/' + fileName + '.txt',
                        '[Source]: ' + sources + '\n' +
                        '[Subject]: ' + m.subject + '\n' +
                        '[Date]: ' + m.creationTime + '\n' +
                        '[From]: ' + m.sender.name + ' ' + m.sender.email + '\n' +
                        '[To]: ' + tos + '\n' +
                        '[CC]: ' + ccs + '\n' +
                        '[Attachment]: ' + attachments + '\n' +
                        '[Body]: ' + m.body + '\n',
                        (err) => {
                            if (err) throw err;
                        });
                });
            }
        }, function (err) {
            console.log(err);
        });
    }
}, function (err) {
    console.log(err);
});
