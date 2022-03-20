const steamUser = require("steam-user");
const axios = require("axios");
const {Client, Intents, MessageEmbed} = require("discord.js")
const fs = require('fs');

let client = new steamUser();
const discClient = new Client({
    intents: [Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_TYPING]
})
client.setOptions({enablePicsCache: true, picsCacheAll: true, changelistUpdateInterval: 10000});

let config;
fs.readFile('config.json', 'utf8', function (err, data) {
    if (err) {
        return console.log(err);
    }
    config = JSON.parse(data);
    let steamCredentials = {
        accountName: config.steamUser, password: config.steamPass, loginKey: config.steamKey, rememberPassword: true,
    }
    client.logOn(steamCredentials);
    discClient.login(config.discord)
        .then(() => {
            console.info('[DISCORD] ->   logged in as ' + discClient.user.tag);
        })
});


let g_sessionID;
client.on('webSession', function (sessionID, cookies) {
    g_sessionID = sessionID;
    axios.defaults.headers.Cookie = cookies
    console.log("Session: ", sessionID);
});

client.on('loggedOn', () => {
    console.log(`[STEAM]   ->   ${client.vanityURL} (${client.steamID.getSteamID64()}, ${client.steamID.getSteam2RenderedID()}, ${client.steamID.getSteam3RenderedID()})`);
});


client.on('loginKey', function (key) {
    console.log("loginKey: ", key);
    config.steamKey = key;
    fs.writeFile('config.json', JSON.stringify(config), {flag: 'w'}, err => {
    })
});

client.once('changelist', function (changeNumber) {
    let lastChangeNumber;
    fs.readFile('config.json', 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        } else {
            lastChangeNumber = JSON.parse(data).changeNumber;
            lastChangeNumber = Math.max(parseInt(data), changeNumber - 5000)
        }
        client.getProductChanges(lastChangeNumber).then((result) => {
            fetchChanges(result.currentChangeNumber, result.appChanges, result.packageChanges)
        })
    })
})

client.on('changelist', function (changeNumber, changeApps, changePackages) {
    config.changeNumber = changeNumber;
    fs.writeFile('config.json', JSON.stringify(config), err => {
    })
    console.log(`-- Change - NEW: ${changeNumber}`);
    fetchChanges(changeNumber, changeApps, changePackages)
});

function fetchChanges(changeNumber, changeApps, changePackages) {
    client.getProductInfo(changeApps, changePackages).then(result => {
        let apps = result.apps;
        //let out = [`*Changelist - <https://steamdb.info/changelist/${changeNumber}> (${changeApps.length} apps and ${changePackages.length} packages)`];
        console.log(`*Changelist - <https://steamdb.info/changelist/${changeNumber}> (${changeApps.length} apps and ${changePackages.length} packages)`);
        let beta = []
        if (apps && Object.keys(apps).length) {
            for (let app of Object.keys(apps)) {
                let title = apps[app].appinfo.common ? (apps[app].appinfo.common.name || 'Unknown') : 'Unknown App';
                //out.push(` - App: <https://steamdb.info/app/${app}> - ${title}`);
                if (!(apps[app].appinfo === undefined) && !(apps[app].appinfo.extended === undefined) && !(apps[app].appinfo.extended.betaforappid === undefined)) {
                    let parent = apps[app].appinfo.extended.betaforappid;
                    beta.push(`${app}, ${title} - beta for  ${parent}`);
                    const embed = new MessageEmbed()
                        .addFields(
                            {
                                name: `${title} (${app})`,
                                value: `Parent: ${parent}\nRelease Date: <t:${apps[app].appinfo.common.steam_release_date}:D>`
                            })
                    axios.get(`https://store.steampowered.com/app/${parent}`).then(resp => {
                        let active = resp.data.indexOf('RequestPlaytestAccess') > 0;

                        embed.addField('Store Button: ', `${"Yes" ? active : "No"}`)
                        console.log(app in client.getOwnedApps(), app in client.picsCache.apps)
                        if (active && !client.ownsApp(app)) {
                            requestPlaytest(app, parent, title, embed);
                        }
                        let image = `http://cdn.akamai.steamstatic.com/steam/apps/${app}/${apps[app].appinfo.common.small_capsule.english}`
                        let icon = `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${app}/${apps[app].appinfo.common.icon}.jpg`
                        embed.setThumbnail(image)

                        discClient.channels.cache.get('954115013503750194').fetchWebhooks()
                            .then(webhook => webhook.first().send({
                                username: title,
                                avatarURL: icon,
                                embeds: [embed],
                            }))
                        //discClient.channels.fetch(276023946657136640)
                        //    .then(channel => channel.send({embeds: [embed]}));
                    });
                }
            }
        }

        // if (result.packages && Object.keys(result.packages).length) {
        //     for (let pack of Object.keys(result.packages)) {
        //         out.push(` - package: <https://steamdb.info/sub/${pack}> - ${result.packages[pack].packageinfo ? (result.packages[pack].packageinfo.name || 'Unknown') : 'Unknown App'}`);
        //     }
        // }
        //
        // if ((result.unknownApps && result.unknownApps.length) || (result.unknownPackages && result.unknownPackages.length)) {
        //     out.push(`${result.unknownApps.length} Unknown Apps and ${result.unknownPackages.length} Unknown Packages`);
        // }

        //console.log(out.join('\n'));
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