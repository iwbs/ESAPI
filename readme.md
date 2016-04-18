# ESAPI



## How to run
>node index.js
    
    
    
## get
>GET http://localhost:3000/esapi/get

Get email by id
>http://localhost:3000/esapi/get?id=AVMW41DO7ElizdihjPPm
    
    
    
## update
>POST http://localhost:3000/esapi/update

Update field by id
```json
{
    "id": "AVMW41DO7ElizdihjPPj",
    "body": {
        "doc": {
            "tags": ["banana"]
        }
    }
}
```


## search
>POST http://localhost:3000/esapi/search

List all emails
```json
{
	"body": {
		"size": 1000,
		"query": {
			"match_all": {}
		}
	}
}
```

Search emails with tags having at least "apple" or "orange"
```json
{
	"body": {
		"from": 0,
		"size": 20,
		"sort": [{
			"creationTime": {
				"order": "desc"
			}
		}],
		"query": {
			"bool": {
				"filter": {
					"terms": {
						"tags": ["apple", "orange"]
					}
				}
			}
		}
	}
}
```

Search emails with tags having both "apple" and "orange"
```json
{
	"body": {
		"from": 0,
		"size": 20,
		"sort": [{
			"creationTime": {
				"order": "desc"
			}
		}],
		"query": {
			"bool": {
				"filter": [{
					"term": {
						"tags": "apple"
					}
				},{
					"term": {
						"tags": "orange"
					}
				}]
			}
		}
	}
}
```

Search emails with tags having at least "apple" or "orange", and "body" field containing "dialog"
```json
{
	"body": {
		"from": 0,
		"size": 20,
		"sort": [{
			"creationTime": {
				"order": "desc"
			}
		}],
		"query": {
			"bool": {
				"must": [{
					"query_string": {
						"fields": ["body"],
						"query": "dialog"
					}
				}],
				"filter": {
					"terms": {
						"tags": ["apple", "orange"]
					}
				}
			}
		}
	}
}
```

Group sender's domain
```json
{
	"body": {
		"size": 0,
		"aggs": {
			"genders": {
				"terms": {
					"field": "sender.domain",
					"size": 100
				}
			}
		}
	}
}
```

*for details on fuzzy/proximity search syntax, go to https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html*


From top to bottom:
Sort "deliveryTime" descending
Sort score, default descending
must = AND
-"contractor.redflaggroup.com" must be in "recipients.domain" AND
-"redflaggroup.com" must be in "sender.domain"
should = OR, unless no must is specified
-"asdfasdfasdf" is in "body"
tags include "aaa" or "bbb" (at least one of them)
tags include "ccc"
docCreationTime > "2016-03-01"
deliveryTime > "2015-03-01"
```json
{
	"body": {
		"from": 0,
		"size": 20,
		"sort": [{
			"deliveryTime": {
				"order": "desc"
			}
		}, "_score"],
		"query": {
			"bool": {
				"must": [{
					"query_string": {
						"fields": ["recipients.domain"],
						"query": "contractor.redflaggroup.com"
					}
				}, {
					"query_string": {
						"fields": ["sender.domain"],
						"query": "redflaggroup.com"
					}
				}],
				"should": [{
					"query_string": {
						"fields": ["body"],
						"query": "asdfasdfasdf"
					}
				}],
				"filter": [{
					"terms": {
						"tags": ["aaa", "bbb"]
					}
				}, {
					"term": {
						"tags": "ccc"
					}
				}, {
					"range": {
						"docCreationTime": {
							"gte": "2016-03-01"
						}
					}
				}, {
					"range": {
						"deliveryTime": {
							"gte": "2015-03-01"
						}
					}
				}]
			}
		}
	}
}
```






### create index
curl -XPUT 'http://localhost:9200/avaya/'

### set mapping
curl -XPUT 'http://localhost:9200/avaya/email/_mapping' -d '{"email":{"properties":{"attachments":{"properties":{"content":{"type":"string"},"name":{"type":"string"},"path":{"type":"string"},"size":{"type":"long"},"type":{"type":"string"}}},"body":{"type":"string"},"bodyHTML":{"type":"string"},"creationTime":{"type":"date","format":"strict_date_optional_time||epoch_millis"},"deliveryTime":{"type":"date","format":"strict_date_optional_time||epoch_millis"},"docCreationTime":{"type":"date","format":"strict_date_optional_time||epoch_millis"},"recipients":{"properties":{"domain":{"type":"string","index":"not_analyzed"},"email":{"type":"string","index":"not_analyzed"},"name":{"type":"string"},"type":{"type":"string"}}},"sender":{"properties":{"domain":{"type":"string","index":"not_analyzed"},"email":{"type":"string","index":"not_analyzed"},"name":{"type":"string"}}},"sources":{"properties":{"company":{"type":"string"},"department":{"type":"string"},"fileName":{"type":"string"},"folderPath":{"type":"string"}}},"subject":{"type":"string"},"submitTime":{"type":"date","format":"strict_date_optional_time||epoch_millis"}}}}'