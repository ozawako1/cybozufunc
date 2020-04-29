
var rp = require('request-promise');
var fs = require('fs');

/*
    {
      "subject": "【Cat＆An：保守サイト更新スケジュール】8月分",
      "start": {
        "dateTime": "2018-08-01T00:00:00+09:00",
        "timeZone": "Asia/Tokyo"
      },
      "end": {
        "dateTime": "2018-08-31T23:59:59+09:00",
        "timeZone": "Asia/Tokyo"
      },
      "attendees": [
        {
          "id": "59",
          "code": "tatsuya.sumiyama",
          "name": "住山　達也",
          "type": "USER"
        },
        {
          "id": "143",
          "code": "shuya.matsumura",
          "name": "松村　周也",
          "type": "USER"
        }
      ]
    }
*/

function get_offset(timezone){
    var offset = 0;
    if (timezone == "Asia/Tokyo") {
        offset = -9;
    }
    return offset; 
}

function format_time(m, d) {
    var m0 = ('00' + m).slice(-2);
    var d0 = ('00' + d).slice(-2);
    return m0 + ":" + d0;
}

function get_schedule(obj, isnow) {

    var events = obj.events;

    console.log(obj);
                
    return new Promise((resolve, reject) => {
        var n = new Date();
        if (events.length == 0) {
            reject(new Error("No schedule was given."));
        }

        //整形する
        var arr = events.filter(function(itm, idx){
            st = new Date(itm.start.dateTime);
            ed = new Date(itm.end.dateTime);
            if (isnow) {
                if ((st.getTime() < n.getTime()) && (n.getTime() < ed.getTime())) {
                    return true;
                }
            } else {
                return true;
            }
        });
        if (arr.length > 0) {  
            resolve(arr);
        }else {
            reject(new Error("No Schedule found."));
        }
    });

}


module.exports = function (context, req) {

    context.log('Webhook was triggered!');

//    var userid = req.body.garoonid;
//    var checknow = req.body.now;
//    context.log(req);
    var userid = req.query.garoonid;
    var checknow = req.query.now;

    context.log("request = [" + userid + "]");

    var sttime= new Date();
    var edtime = new Date();
    
    sttime.setHours(0,0,0);
    edtime.setHours(24,0,0);

    var options = {
        uri: 'https://motex.s.cybozu.com/g/api/v1/schedule/events',
        qs: {
            "orderBy": "start asc",
            "rangeStart": sttime.toISOString(),
            "rangeEnd": edtime.toISOString(),
            "target": userid,
            "targetType": "user",
            "fields": "subject,start,end,attendees,facilities"
        },
        headers: {
            "X-Cybozu-Authorization": process.env.MY_GAROON_AUTH_STRING
        },
        agentOptions: {
            pfx: fs.readFileSync(process.env.MY_GAROON_CERT),
            passphrase: process.env.MY_GAROON_CERT_PASS,
            securityOptions: 'SSL_OP_NO_SSLv3'
        },
        json: true // Automatically parses the JSON string in the response
    };

    context.log('Sending a request.');

    rp(options)
        .then((obj) => get_schedule(obj, checknow)) 
        .then(function (evts) {            
            context.res = {
                status: 200,
                body: { "events": evts }
            }
            context.done();
        })
        .catch(function (err) {
            context.res = {
                status: 500,
                body: { "Error": err.message + "|" + err.stack }
            }
            context.done();
        });
        
};
