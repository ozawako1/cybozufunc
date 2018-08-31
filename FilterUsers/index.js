/*
    "users": [
        {
	"id": "146",
	"code": "koichi.ozawa",
	"ctime": "2015-06-14T05:33:08Z",
	"mtime": "2018-07-18T02:10:11Z",
	"valid": true,
	"name": "小澤　浩一",
	"surName": "小澤",
	"givenName": "浩一",
	"surNameReading": "おざわ",
	"givenNameReading": "こういち",
	"localName": "",
	"localNameLocale": "ja",
	"timezone": "Asia/Tokyo",
	"locale": "ja",
	"description": "",
	"phone": "",
	"mobilePhone": "050-5236-3087",
	"extensionNumber": "80-701",
	"email": "koichi.ozawa@motex.co.jp",
	"callto": "",
	"url": "",
	"employeeNumber": "",
	"birthDate": null,
	"joinDate": null,
	"primaryOrganization": "27",
	"sortOrder": 4,
	"customItemValues": [
		{
			"code": "keihihutan",
			"value": "27E51611"
		},
		{
			"code": "keihimattansoshiki",
			"value": "開発管理課管理1グループ"
		},
		{
			"code": "shainbango",
			"value": "960350592"
		}
	]
}
    ]

*/
/*

*/
var documentClient = require("documentdb").DocumentClient;
var config = require("../conf/config.js");

var client = new documentClient(config.cosmosdb.endpoint, { "masterKey": config.cosmosdb.primaryKey });

var databaseUrl = `dbs/${config.cosmosdb.databaseid}`;
var collectionUrl = `${databaseUrl}/colls/${config.cosmosdb.collectionid}`;

var Promise = require('promise');

const RECENTLY_UPDATED = (1000 * 60 * 60 * 24);

function is_recent(itm) {
    var ret = false;

    if (( itm.valid == false ) ||
        ( itm.primaryOrganization == null ) ||
        ( itm.sortOrder == null )) {
        return ret;
    }

    var mod = new Date(itm.mtime);
    var now = new Date();
    var diff = now.getTime() - mod.getTime();

    //24時間以内の更新
//    if (diff < RECENTLY_UPDATED) {
        ret = true;
//    }

    return ret;
}


/**
 * Get the collection by ID, or create if it doesn't exist.
 */
function getCollection() {
    console.log(`Getting collection:\n${config.cosmosdb.collectionid}\n`);

    return new Promise((resolve, reject) => {
        client.readCollection(collectionUrl, (err, result) => {
            if (err) {
                reject(new Error("Could not find collection."));
            } else {
                resolve(result);
            }
        });
    });
}


/**
 * Query the collection using SQL
 */
function queryCollection(who) {
    console.log('Querying collection :' + config.cosmosdb.collectionid);

    var querystring = "select r.userId FROM root as r WHERE r.login_name = @who";

	var queryspec = {
        query: querystring,
        parameters: [{ name: '@who', value: who }]
    };

    return new Promise((resolve, reject) => {

        var queryiterator = client.queryDocuments(collectionUrl,queryspec);
        var found = queryiterator.hasMoreResults();

        if (found == false) {
            console.log("[" + who + "] not found. 1");
            reject(new Error("[" + who + "] Not found. 1"));
        }
        
        queryiterator.toArray((err, results) => {
            //ここでresultsのlengthを見るのは？だが、挙動から入れておく。
            if (err) {
                console.log("[" + who + "] not found. 2");
                reject(err);
            } else {
                for (var i = 0 ; i < results.length ; i++) {
                    let resultString = JSON.stringify(results[i]);
                    console.log('Query returned :' + resultString);
                }
                resolve(results);
            }
        });
    });
};


function add_garoon_id(item) {

    return getCollection()
            .then(() => queryCollection(item.code))
            .then((gids) => {
                if (gids.length > 0) {
                    item["garoon_id"] = gids[0].userId;
                }
                return item;
            });
}



module.exports = function (context, data) {
    context.log('Webhook was triggered!');

    if(data.method != "POST" || data.body.users === undefined) {        
        
        context.res = {
            status: 403,
            body: { "Error": "Invalid Arg."}
        }
        context.done();

    } else {

        var input = data.body.users;
        var incnt = input.length;
        var updatedusers = input.filter(item => is_recent(item));
        var promises = updatedusers.map(item => add_garoon_id(item));
        
        Promise.all(promises)
            .then((result) => {
                context.log("Input("+ incnt +") Modified(" + result.length +")");
                context.res = {
                    status: 200,
                    body: { "users": result }
                }
                context.done();
            })                
            .catch((err) => {
                context.log(err.message);
                context.res = {
                    status: 500,
                    body: { "Error": err.message }
                }       
                context.done();            
            });

    }
}
