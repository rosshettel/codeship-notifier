"use strict";

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    superagent = require('superagent'),
    webhook = process.env.webhook,
    port = process.env.PORT || 3000,
    messages = [
        'Avast ye harties! A build has busted!',
        'Shiver me timbers, someone broke the build!',
        'Ahoy me maties! Some salty dog broke the build!',
        'Arrrgh, I oughta make the land lubber that broke this build walk the plank!',
        'Ayyye, some scallywag has seen fit to break the build!'
    ];

app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.send('Hello World!');
});

//todo - should this check the branch too?
function buildShouldBePosted(build) {
    var ret = false;
    if (build.status === 'error') {
        console.log('error build', build);
        ret = true;
    }

    return ret;
}

app.post('/', function (req, res) {
    var build,
        userAvatar,
        userFullName,
        payload;

    if (req.body && req.body.build) {
        build = req.body.build;
        console.log('received webhook', build.status);

        if (buildShouldBePosted(build)) {
            superagent.get('https://api.github.com/users/' + build.committer)
                .end(function (err, res) {
                    console.log('url', 'https://api.github.com/users/' + build.committer);
                    if (res && res.status !== 200) {
                        userAvatar = 'http://placegoat.com/16';
                        userFullName = build.committer;
                    } else {
                        userAvatar = res.body.avatar_url;
                        userFullName = res.body.name;
                    }

                    payload = {
                        username: 'Codeship',
                        icon_url: "https://slack.global.ssl.fastly.net/7bf4/img/services/codeship_48.png",
                        attachments: [{
                            fallback: userFullName + ' broke the build in branch ' + build.branch + ' - ' + build.build_url,
                            color: '#FF0000',
                            pretext: messages[Math.floor(Math.random() * messages.length)],
                            author_name: userFullName,
                            author_icon: userAvatar,
                            fields: [
                                {
                                    title: 'Branch',
                                    value: '<https://github.com/' + build.project_full_name + '/tree/' + build.branch + '|' + build.branch + '>',
                                    short: true
                                },
                                {
                                    title: 'Commit',
                                    value: '<' + build.commit_url + '|' + build.short_commit_id + '>',
                                    short: true
                                },
                                {
                                    title: 'Build',
                                    value: '<' + build.build_url + '|' + build.build_id + '>',
                                    short: true
                                },
                                {
                                    title: 'Commit Message',
                                    value: build.message,
                                    short: true
                                }
                            ]
                        }]
                    };

                    console.log('payload', payload);

                    superagent.post(webhook)
                        .send(payload)
                        .end(function (err, res) {
                            if (res.status !== 200) {
                                console.log('Slack returned non 200 response code', res.body);
                                console.log(res.headers);
                            }
                        });
                });
        }
    }

    res.end();  //dont need to send anything back
});

app.listen(port);