var express = require('express');
var bodyParser = require('body-parser');
var compression = require('compression');
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({ host: 'localhost:9200' });
var app = express();
app.set('port', 3000);
app.use(compression());
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ limit: "5mb", extended: true }));

//pretty print
//app.set('json spaces', 2);


// Additional middleware which will set headers that we need on each request.
app.use(function (req, res, next) {
    // res.setHeader('Access-Control-Allow-Origin', '*');

    // Disable caching
    res.setHeader('Cache-Control', 'no-cache');
    next();
});

app.get('/esapi/indices', function (req, res) {
    client.indices.getAlias().then(function (resp) {
        var indices = [];
        for (var key in resp) {
            if (resp.hasOwnProperty(key))
                indices.push(key);
        }
        res.json({ "indices": indices });
    }, function (err) {
        res.json(err);
    });
});

app.get('/esapi/get', function (req, res) {
    client.get({
        index: req.query.index,
        type: req.query.type,
        id: req.query.id
    }).then(function (resp) {
        res.json(resp);
    }, function (err) {
        res.json(err);
    });
});

app.post('/esapi/search', function (req, res) {
    client.search({
        index: req.query.index,
        type: req.query.type,
        body: req.body.body
    }).then(function (resp) {
        var fieldLimit = req.body.fieldLimit;
        for (var i = 0; i < resp.hits.hits.length; i++) {
            // add recipients count
            if (resp.hits.hits[i]._source.recipients != null)
                resp.hits.hits[i]._source.recipientsCount = resp.hits.hits[i]._source.recipients.length;

            if (fieldLimit != null) {
                for (var j = 0; j < fieldLimit.length; j++) {
                    if (resp.hits.hits[i]._source[fieldLimit[j].field].length > fieldLimit[j].size)
                        resp.hits.hits[i]._source[fieldLimit[j].field] = resp.hits.hits[i]._source[fieldLimit[j].field].slice(0, fieldLimit[j].size);
                }
            }
        }
        res.json(resp);
    }, function (err) {
        res.json(err);
    });
});

app.post('/esapi/update', function (req, res) {
    var callUpdate = function (entry) {
        client.update({
            index: req.query.index,
            type: req.query.type,
            id: entry,
            body: req.body.body
        }).then(function (resp) {
            res.json(resp);
        }, function (err) {
            res.json(err);
        });
    };
    var isArray = req.body.id instanceof Array;
    if (isArray)
        req.body.id.forEach(callUpdate);
    else
        callUpdate(req.body.id);
});

app.post('/esapi/update/tag', function (req, res) {
    var q = req.query, b = req.body, count = 0;
    var ids = b.id instanceof Array ? b.id : [b.id];

    if (b.op !== "add" && b.op !== "remove") {
        res.status(400);
        res.send("Invalid inputs");
        return;
    }

    ids.forEach(function (entry) {
        client.get({
            index: q.index,
            type: q.type,
            id: entry
        }).then(function (resp) {
            var tags = resp._source.tags;
            var newTag = b.tag;
            var s = new Set(tags);
            b.op === "add" && s.add(newTag) || s.delete(newTag);
            client.update({
                index: q.index,
                type: q.type,
                id: entry,
                body: {
                    doc: {
                        tags: Array.from(s)
                    }
                }
            })
        }).then(function (resp) {
            if (ids.length <= ++count) {
                res.json(resp);
            }
        }).catch(function (err) {
            res.json(err);
        })
    });
});

app.get('/esapi/reindex', function (req, res) {
    var count = 0;
    client.search({
        index: req.query.from,
        scroll: '1m',
        search_type: 'scan',
        body: { query: { "match_all": {} } },
        sort: ["_doc"],
        size: 100
    }, function getMoreUntilDone(error, response) {
        var data = [];
        for (var i = 0; i < response.hits.hits.length; i++) {
            data.push({ index: { _index: req.query.to, _type: response.hits.hits[i]._type, _id: response.hits.hits[i]._id } });
            data.push(response.hits.hits[i]._source);
            count++;
        }
        
        // do bulk insert
        client.bulk({
            body: data
        }, function (err, resp) {
            if (response.hits.total !== count) {
                // now we can call scroll over and over
                client.scroll({
                    scrollId: response._scroll_id,
                    scroll: '1m'
                }, getMoreUntilDone);
            } else {
                res.json({ "status": "done" });
            }
        });
    });
});

app.listen(app.get('port'), function () {
    console.log('Server started: http://localhost:' + app.get('port') + '/');
});

