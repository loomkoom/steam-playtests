const steamUser = require("steam-user");
const axios = require("axios");
const {Client, Intents, MessageEmbed} = require("discord.js")
const fs = require('fs');

let client = new steamUser();
const discClient = new Client({
    intents: [Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_TYPING]
})
client.setOptions({enablePicsCache: true, picsCacheAll: true, changelistUpdateInterval: 30000});
discClient.login("NjE5ODk2NTc2NDk5OTA4NjE4.XXO6aQ.FPHqOIF5aX9gyhI3l4N0F0FLuls")
    .then(() => {
        console.info('[DISCORD] ->   logged in as ' + discClient.user.tag);
        // discClient.channels.cache.clear()
        // discClient.channels.fetch(954115013503750194)
        //     .then(channel => channel.send('test'))
    })

let client = new steamUser();


fs.access('key.txt', (err, hasAccess) => {
        if (!hasAccess) {
            fs.writeFile('key.txt', '', err => {
            })
        }
    }
)
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


let g_sessionID;


var g_sessionID;
client.on('webSession', function (sessionID, cookies) {
    g_sessionID = sessionID;
    axios.defaults.headers.Cookie = cookies
    console.log("Session: ", sessionID);
});

})
;

client.on('loggedOn', () => {
    console.log(`[STEAM]   ->   ${client.vanityURL} (${client.steamID.getSteamID64()}, ${client.steamID.getSteam2RenderedID()}, ${client.steamID.getSteam3RenderedID()})`);
});


client.on('loginKey', function (key) {
    console.log("loginKey: ", key);
    fs.writeFile('key.txt', key, {flag: 'w'}, err => {
    })
});

client.on('changelist', function (changeNumber, changeApps, changePackages) {
    fs.writeFile('change.txt', changeNumber.toString(), err => {
    })
    console.log(`-- Change - NEW: ${changeNumber}`);
    fetchChanges(changeNumber, changeApps, changePackages)
});

function fetchChanges(changeNumber, changeApps, changePackages) {
    client.getProductInfo(changeApps, changePackages).then(result => {
        let apps = result.apps;
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
                            {name: '\u200B', value: '\u200B'})
                    axios.get(`https://store.steampowered.com/app/${parent}`).then(resp => {
                        let active = resp.data.indexOf('RequestPlaytestAccess') > 0;

                        embed.addField('Store Button: ', `${"Yes" ? active : "No"}`)
                        console.log(app in client.getOwnedApps(), app in client.picsCache.apps)
                        if (active && !(app in client.getOwnedApps())) {
                            requestPlaytest(app, parent, title, embed);
                        }
                        discClient.channels.fetch(276023946657136640)
                            .then(channel => channel.send({embeds: [embed]}));
                    });
                }
            }
        }

        if (result.packages && Object.keys(result.packages).length) {
            for (let pack of Object.keys(result.packages)) {
                out.push(` - package: <https://steamdb.info/sub/${pack}> - ${result.packages[pack].packageinfo ? (result.packages[pack].packageinfo.name || 'Unknown') : 'Unknown App'}`);
            }
        }

        if ((result.unknownApps && result.unknownApps.length) || (result.unknownPackages && result.unknownPackages.length)) {
            out.push(`${result.unknownApps.length} Unknown Apps and ${result.unknownPackages.length} Unknown Packages`);
        }

        console.log(out.join('\n'));
        console.log(beta.join('\n'));
    });
}

function requestPlaytest(app, parent, title, embed) {
    console.log('Store Button: ', 'Active')
    axios.post('https://store.steampowered.com/ajaxrequestplaytestaccess/' + parent, `sessionid=${g_sessionID}`, {
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
                console.log(`New playtest requested (${app}) : \n\t${title} \n\tparent: ${parent}\n\t=> Instant Access`);
                embed.addField('New playtest requested', 'Instant Access')
            } else if (granted === null) {
                console.log(`New playtest requested (${app}): \n\t${title} \n\tparent: ${parent}\n\t=> Requested Access`);
                embed.addField('New playtest requested', 'Requested Access')
            } else if (!success || success !== 1) {
                console.warn(`FAILED playtest request (${app}): \n\t${title} \n\tparent: ${parent}\n\t=> response : ${responseText} -  (${response.status}: ${response.statusText})`);
            }
            embed.addField('Links: ', `[Store](https://store.steampowered.com/app/${app}) | [SteamDB - parent](https://steamdb.info/app/${parent}) | [SteamDB - app](https://steamdb.info/app/${app})`)

        })
        .catch(function (error) {
            console.warn(error);
        });
}