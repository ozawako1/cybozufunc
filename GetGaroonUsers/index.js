/*
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <Action>
      AdminGetUserIds
    </Action>
    <Security>
      <UsernameToken>
        <Username>???</Username>
        <Password>???</Password>
      </UsernameToken>
    </Security>
    <Timestamp>
      <Created>2018-08-12T14:45:00Z</Created>
      <Expires>2037-08-12T14:45:00Z</Expires>
    </Timestamp>
    <Locale>jp</Locale>
  </soap:Header>
  <soap:Body>
      <AdminGetUserIds>
    <parameters>
        <offset xmlns="">0</offset>
        <limit xmlns="">500</limit>
    </parameters>
      </AdminGetUserIds>
  </soap:Body>
</soap:Envelope>

*/

/* ID一覧
<returns> 
  <number_users>3</number_users> 
  <userId>6</userId> 
  <userId>7</userId> 
  <userId>8</userId> 
</returns>
*/

/*　IDごとの詳細
<returns> 
  <number_users>2</number_users> 
  <userDetail> 
    <userId>1</userId> 
    <login_name>Administrator</login_name> 
    <display_name>Administrator</display_name> 
  </userDetail> 
  <userDetail> 
    <userId>2</userId> 
    <login_name>A1</login_name> 
    <display_name>A1</display_name> 
  </userDetail> 
</returns>
*/

var rp = require('request-promise');
var fs = require('fs');
var xpath = require('xpath')
var dom = require('xmldom').DOMParser
var my_config = require("../conf/config.js");

var g_pfx = my_config.client_cert.pfx;

const TYPE_IDS = 1;
const TYPE_DETAIL = 2;


function get_userids(xml) {

    console.log("get userids");

    var doc = new dom().parseFromString(xml);
    var nodes = xpath.select("//userId", doc);

    var nextparam = "";
                
    return new Promise((resolve, reject) => {

        if (nodes.length == 0) {
            reject(new Error("No User Found."));
        }

        //連結する
        nodes.forEach(function(itm){
            nextparam += itm.toString();
        });

        resolve(nextparam);
    });

}

function get_userdetail(nextparam) {

    console.log("get user detail");

    var soapmsg = getsoapmsg(TYPE_DETAIL, nextparam);

    var options = {
        method: "POST",
        uri: "https://motex.s.cybozu.com/g/sysapi/admin/api.csp",
        agentOptions: {
            pfx: fs.readFileSync(g_pfx),
            passphrase: my_config.client_cert.password,
            securityOptions: 'SSL_OP_NO_SSLv3'
        },
        headers:{
            "Content-Type":"text/xml"
        },
        body:soapmsg
    };

    return rp(options);
}


function getsoapmsg(msg_type, parameters) {

    var action = "";
    var param = "";

    if (msg_type == TYPE_IDS) {
        action = "AdminGetUserIds";
        param = '<offset xmlns="">0</offset><limit xmlns="">500</limit>';
    } else if (msg_type == TYPE_DETAIL) {
        action = "AdminGetUserDetailByIds";
        param = parameters;
    }

    msg = 
        '<?xml version="1.0" encoding="UTF-8"?>'+
        '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">'+
            '<soap:Header>'+
                '<Action>'+ action +'</Action>'+
                '<Security>'+
                    '<UsernameToken>'+
                        '<Username>'+my_config.login.userid+'</Username>'+
                        '<Password>'+my_config.login.password+'</Password>'+
                    '</UsernameToken>'+
                '</Security>'+
                '<Timestamp>'+
                    '<Created>2018-08-12T14:45:00Z</Created>'+
                    '<Expires>2037-08-12T14:45:00Z</Expires>'+
                '</Timestamp>'+
                '<Locale>jp</Locale>'+
            '</soap:Header>'+
            '<soap:Body>'+
                '<' + action + '>'+
                    '<parameters>'+ param + '</parameters>'+
                '</' + action +'>'+
            '</soap:Body>'+
        '</soap:Envelope>';

    return msg;
}


module.exports = function (context, data) {

    context.log('Webhook was triggered!');

    context.log(data);

    if (config.env.runningon == "Local") {
        g_pfx = my_config.client_cert.pfxlocal;
    }

    var options = {
        method: "POST",
        uri: "https://motex.s.cybozu.com/g/sysapi/admin/api.csp",
        agentOptions: {
            pfx: fs.readFileSync(g_pfx),
            passphrase: my_config.client_cert.password,
            securityOptions: 'SSL_OP_NO_SSLv3'
        },
        headers:{
            "Content-Type":"text/xml"
        },
        body:getsoapmsg(TYPE_IDS)
    };

    context.log('Sending a request.');

    rp(options)
        .then((body)    => get_userids(body)) 
        .then((nextval) => get_userdetail(nextval))
        .then(function (xml) {

            var doc = new dom().parseFromString(xml);
            var nodes = xpath.select("//userDetail", doc);

            var arr = new Array();

            if (nodes.length > 0) {

                var parseString = require('xml2js').parseString;
                var parse_opt = { trim: true, explicitArray: false }
                
                nodes.forEach(function(itm){
                    parseString(itm, parse_opt, function (err, result) {
                        context.log(result);
                        arr.push(result.userDetail);
                    });
                });
                
            }

            context.res = {
                "status": 200,
                "Content-Type": "text/xml",
                "body": arr
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

