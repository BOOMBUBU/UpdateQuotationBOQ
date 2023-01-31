var axios = require('axios')
const sql = require('mssql')
const moment = require('moment')
var httpsProxyAgent = require("https-proxy-agent");
var db = require("../db.json");
var agent = new httpsProxyAgent(db["scg_proxy"]);
var fs = require('fs')
const config = {
    user: "apidev",
    password: 'Aa@1234560',
    server: '172.18.8.65', // You can use 'localhost\\instance' to connect to named instance
    database: 'SCMAPI',
    options: {
        encrypt: true,
        trustServerCertificate: true,
    }
}
start();

async function start() {
    let resute = await getQuotationID();
}

async function GetToken() {
    let url = "https://3g5esy7dpj.execute-api.ap-southeast-1.amazonaws.com/api/auth/login";
    let data = {
        "username": "fulfillment@system.com",
        "password": "VuFf@7{3"
    }
    const request = await axios(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        httpsAgent: agent,
        data: data,
    }).then((x) => {
        return x['data']
    })
    if (request.statusCode === 200) {
        return request.data?.result?.access_token;
    } else {
        return null;
    }
}

async function getQuotationBOQ(QuotationNumber) {
    let token = await GetToken();
    let key = "{QuotationNumber}";
    let sUrl = "https://3g5esy7dpj.execute-api.ap-southeast-1.amazonaws.com/quotations/{QuotationNumber}/json/bom-item";
    let _URL = sUrl.replace(key, QuotationNumber);
    await axios(_URL, {
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
        },
        httpsAgent: agent,
    }).then(async (x) => {
        await SaveData(x['data']);
    }).catch(async function (error) {
        if (error.response) {
            await SaveLog(QuotationNumber, error.response?.data?.message);
        }
    });
}

async function SaveData(value) {
    let item = value.detail || [];
    let q_id = value.ref_web_qt_no || null;

    await sql.connect(config);
    let arr = [];
    item.forEach(async (f) => {
        let _value = `('${q_id}','${f['line_id']}','${f['ns_internal_id']}','${f['ns_external_id']}','${f['item_name']}','${f['description']}','${f['quantity']}','${f['unit']}','${moment().format("YYYY-MM-DD HH:mm:ss")}')`;
        arr.push(_value);
    })
    try {
        let _value = arr.join(',');
        let qty = `insert into speedy_quotation_api (qt_no,line_id,ns_internal_id,ns_external_id,item_name,description,quantity,unit,download) 
        values ${_value}`;
        await sql.query(qty, (err, result) => {
            if (err) {
                SaveLog(q_id, err, q_id);
            }
        })
    } catch (error) {
        await SaveLog(q_id, error.message, q_id);
    }
}

async function getQuotationID() {
    try {
        await sql.connect(config);
        const data = await sql.query(`select [QO Number] as qt_no from vw_speedy_quotation_api_search`);
        let arr_q = data.recordset || [];
        for (let i = 0; i < arr_q.length; i++) {
            await getQuotationBOQ(arr_q[i]['qt_no']);
        }
        return { status: 'success' }
    } catch (error) {
        return { status: 'error', message: error.message }
    }
}

async function SaveLog(q_id, msg, item = null) {
    const path = './Log.txt';
    let text = moment().format("YYYY-MM-DD HH:mm:ss") + " " + q_id + " : " + (item ? '\n' + item + " : " : '') + msg + '\n';
    if (!fs.existsSync(path)) await fs.writeFileSync(path, "Error log" + '\n')
    await fs.appendFileSync(path, text);
}

