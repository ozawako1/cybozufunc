
var rp = require('request-promise');
var fs = require('fs');

const REG_FORMAT = /motex_zoom\d{1,2}@motex\.co\.jp/;

function get_email_address(notes){
    var email = "";

    var tmp = notes.match(REG_FORMAT);
    if (tmp != null){
        email = tmp[0];
    }

    return email;
}

module.exports = function (context, req) {

    context.log('GetZoomFacilities was triggered!');
        
    var options = {
        // 予定
        uri: process.env.MY_GARROON_SCHEDULE_URL,
        qs: { 
            limit: 1000 
        },
        headers: {
            "X-Cybozu-Authorization": process.env.MY_GAROON_AUTH_STRING
        },
        agentOptions: {
            pfx: fs.readFileSync(process.env.MY_GAROON_CERT),
            passphrase: process.env.MY_GAROON_CERT_PASS,
            securityOptions: 'SSL_OP_NO_SSLv3'
        },
        json: true  
    };


    rp(options)
    .then((body)    => {
        //zoomをnameに含む設備のみ抽出
        var arr = body.facilities.filter(facility => (facility.name.toLowerCase().indexOf("zoom") != -1));  
        arr.forEach(function(fa){
            fa.email = get_email_address(fa.notes);
        });      
        context.res = {
            'status': 200,
            'content-type': 'application/json',
            'body': arr
        }
        context.done();
    })
    .catch(function (err) {
        context.res = {
            status: err.StatusCode,
            body: err.message
        }
        context.done();
    });
        
}