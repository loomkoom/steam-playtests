const steamUser = require("steam-user");
const axios = require("axios");
const {Client, Intents, MessageEmbed} = require("discord.js")
const fs = require('fs');

const discClient = new Client({
    intents: [Intents.FLAGS.GUILD_MESSAGES,Intents.FLAGS.GUILD_MESSAGE_TYPING]
})
discClient.destroy();
discClient.login("NjE5ODk2NTc2NDk5OTA4NjE4.XXO6aQ.FPHqOIF5aX9gyhI3l4N0F0FLuls")
    .then(() => {
        console.info('[DISCORD] ->   logged in as ' + discClient.user.tag);
        // discClient.channels.cache.clear()
        // discClient.channels.fetch(954115013503750194)
        //     .then(channel => channel.send('test'))
    })

let client = new steamUser();


fs.readFile('key.txt', 'utf8', function (err, data) {
    if (err) {
        return console.log(err);
    }
    let logKey = data.trim()
    client.logOn({
        accountName: "loomkoom",
        password: "3XmUdrxPZkY5",
        loginKey: logKey,
        rememberPassword: true,

    });
});


client.setOptions({enablePicsCache: true, picsCacheAll: true, changelistUpdateInterval: 30000});


var g_sessionID;
client.on('webSession', function (sessionID, cookies) {
    g_sessionID = sessionID;
    axios.defaults.headers.Cookie = cookies
    console.log("Session: ", sessionID);


})
;

client.on('accountInfo', () => {
    console.log(`[STEAM]   ->   ${client.vanityURL} (${client.steamID.getSteamID64()}, ${client.steamID.getSteam2RenderedID()}, ${client.steamID.getSteam3RenderedID()})`);
});


client.on('loginKey', function (key) {
    console.log("loginKey: ", key);
    fs.writeFile('key.txt', key, {flag: 'w'}, err => {
    })
});

client.on('changelist', function (changeNumber, changeApps, changePackages) {
    fs.writeFile('change.txt', changeNumber.toString(), {flag: 'w'}, err => {
    })
    console.log(`-- Change - NEW: ${changeNumber}`);
    let msg = "---BETA\n"
    client.getProductInfo(changeApps, changePackages, {}, (err, apps, packages, unknownApps, unknownPackages) => {
        let out = [`*Changelist - <https://steamdb.info/changelist/${changeNumber}> (${changeApps.length} apps and ${changePackages.length} packages)`];
        let beta = []
        if (apps && Object.keys(apps).length) {
            for (let app of Object.keys(apps)) {
                let title = apps[app].appinfo.common ? (apps[app].appinfo.common.name || 'Unknown') : 'Unknown App';
                out.push(` - App: <https://steamdb.info/app/${app}> - ${title}`);
                if (!(apps[app].appinfo === undefined) && !(apps[app].appinfo.extended === undefined) && !(apps[app].appinfo.extended.betaforappid === undefined)) {
                    let parent = apps[app].appinfo.extended.betaforappid;
                    beta.push(`${app}, ${title} - beta for  ${parent}`);
                    const embed = new MessageEmbed()
                        .addFields(
                            {name: `${title} (${app})`, value: `Parent:\t${parent}`},
                            {name: '\u200B', value: '\u200B'},
                        )
                    var active = false;
                    axios.get(`https://store.steampowered.com/app/${parent}`).then(
                        resp => active = resp.data.indexOf('RequestPlaytestAccess') > 0);
                    if (active) {
                        embed.addField('Store Button', 'Active')
                        axios.post('https://store.steampowered.com/ajaxrequestplaytestaccess/' + app,
                            `sessionid=${g_sessionID}`,
                            {
                                validateStatus: (status) => {
                                    return (status >= 200 && status < 400 || status === 401);
                                }
                            })
                            .then(function (response) {
                                let responseText = response.data
                                let granted;
                                let success;
                                if (!responseText === false) {
                                    granted = responseText.granted;
                                    success = responseText.success;
                                }
                                if (granted === 1) {
                                    console.log(`New playtest requested: \n\t${title} \n\tparent: ${app}\n\t=> Instant Access`);
                                    embed.addField('New playtest requested', 'Instant Access')
                                } else if (granted === null) {
                                    console.log(`New playtest requested: \n\t${title} \n\tparent: ${app}\n\t=> Requested Access`);
                                    embed.addField('New playtest requested', 'Requested Access')
                                } else if (!success || success !== 1) {
                                    console.warn(`FAILED playtest request: \n\t${title} \n\tparent: ${app}\n\t=> response : ${responseText} -  (${response.status}: ${response.statusText})`);
                                }
                                embed.addField('Links', `[Store](https://store.steampowered.com/app/${app}) [SteamDB](https://steamdb.info/app/${app})`)

                            })
                            .catch(function (error) {
                                console.warn(error);
                            });
                    } else {
                        embed.addField('Store Button', 'None')
                    }
                    discClient.channels.resolve(276023946657136640).fetch(true)
                        .then(channel => channel.send({embeds: [embed]}));
                }
            }
        }

        if (packages && Object.keys(packages).length) {
            for (let pack of Object.keys(packages)) {
                out.push(` - package: <https://steamdb.info/sub/${pack}> - ${packages[pack].packageinfo ? (packages[pack].packageinfo.name || 'Unknown') : 'Unknown App'}`);
            }
        }

        if ((unknownApps && unknownApps.length) || (unknownPackages && unknownPackages.length)) {
            out.push(`${unknownApps.length} Unknown Apps and ${unknownPackages.length} Unknown Packages`);
        }

        console.log(out.join('\n'));
        console.log(beta.join('\n'));
    });
});


/* GREASEMONKEY
    GM_xmlhttpRequest ({
        method: "POST",
        url: 'https://store.steampowered.com/ajaxrequestplaytestaccess/'+appid,
        data: "sessionid=" + g_sessionID,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        onload: function(response)
        {console.log("Response: ",response)}
 */

/* BROWSER
    var req = new XMLHttpRequest();
    req.onload = response =>
            {console.log(response)};
    req.open("POST",
    'https://store.steampowered.com/ajaxrequestplaytestaccess/'+1925270);
    req.setRequestHeader( "Content-Type", "application/x-www-form-urlencoded");
    req.send("sessionid="+g_sessionID);
 */

/* AXIOS
    axios.defaults.headers.Cookie = g_cookies;
    axios.post("https://store.steampowered.com/ajaxrequestplaytestaccess/" + appid,
        `sessionid=${g_sessionID}`,
        {
    })
        .then(resp => {
            console.log("Response: ",resp.status,"\n",resp.headers,resp.config,"\n",resp.data)
        })
 */