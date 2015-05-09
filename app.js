"use strict";

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    superagent = require('superagent'),
    webhook = process.env.webhook,
    port = process.env.PORT || 3000,
    log = function log(msg, obj) {
        if (process.env.debug) {
            console.log(msg, obj);
        }
    };

app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.send('Hello World!');
});

//todo - should this check the branch too?
function buildShouldBePosted(build) {
    var ret = false;
    if (build.status === 'error') {
        log('build should be posted', build);
        ret = true;
    }

    return ret;
}

function getGithubUserInfo(build, callback) {
    var githubUserUrl = 'https://api.github.com/users/' + build.committer,
        data = {
            avatarUrl: 'http://placegoat.com/16',
            fullName: build.committer,
            email: ''
        };
    log('github user url', githubUserUrl);

    superagent.get(githubUserUrl)
        .end(function (err, res) {
            log('github user info', res.body);
            if (res && res.status === 200) {
                data.avatarUrl = res.body.avatar_url;
                data.fullName = res.body.name;
                data.email = res.body.email;
            }
            callback(null, data);
        });
}

function buildPayload(build, githubInfo) {
    var payload,
        commitMsg,
        messages = [
            'Avast ye harties! A build has busted!',
            'Shiver me timbers, someone broke the build!',
            'Ahoy me maties! Some salty dog broke the build!',
            'Arrrgh, I oughta make the land lubber that broke this build walk the plank!',
            'Ayyye, some scallywag has seen fit to break the build!'
        ];

    if (build.message.length > 125) {
        commitMsg = build.message.substr(0, 125) + '...';
    } else {
        commitMsg = build.message;
    }

    payload = {
        username: 'Codeship',
        icon_url: "https://slack.global.ssl.fastly.net/7bf4/img/services/codeship_48.png",
        attachments: [{
            fallback: githubInfo.fullName + ' broke the build in branch ' + build.branch + ' - ' + build.build_url,
            color: '#FF0000',
            pretext: messages[Math.floor(Math.random() * messages.length)],
            author_name: githubInfo.fullName,
            author_icon: githubInfo.avatarUrl,
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
                    value: commitMsg,
                    short: true
                }
            ]
        }]
    };

    log('payload', payload);
    return payload;
}

app.post('/', function (req, res) {
    var build,
        payload;

    if (req.body && req.body.build) {
        build = req.body.build;
        console.log('Received build - status: ' + build.status + ', build id: ' + build.build_id);

        if (buildShouldBePosted(build)) {
            getGithubUserInfo(build, function (err, githubInfo) {
                //resolve slack username here
                payload = buildPayload(build, githubInfo);

                superagent.post(webhook)
                    .send(payload)
                    .end(function (err, res) {
                        log('slack response', res.body);
                        if (err || res.status !== 200) {
                            console.log('Slack returned non 200 response code', res.body);
                            console.log(res.headers);
                            console.log('err', err);
                        }
                    });
            });
        }
    }

    res.end();  //dont need to send anything back
});

app.listen(port);