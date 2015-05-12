"use strict";

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    superagent = require('superagent'),
    webhook = process.env.webhook,
    slackToken = process.env.slack_token,
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
                data.login = res.body.login;
            }
            callback(null, data);
        });
}

function getSlackUserList(callback) {
    superagent.get('https://slack.com/api/users.list')
        .query({token: slackToken})
        .end(function (err, res) {
            if (err) {
                return callback(err);
            }
            if (!res.body.ok) {
                return callback(res.body.error);
            }
            log('received slack user list:', res.body.members.length);
            callback(err, res.body.members);
        });
}

function resolveSlackUsername(params, callback) {
    function searchUsers(users, property, query) {
        var i,
            username;

        for (i = 0; i < users.length; i++) {
            if (users[i].profile[property] === query) {
                username =  users[i].name;
                break;
            }
        }
        return username;
    }

    function resolveManually(githubUsername) {
        var usernameList = {
            'katrina-fooda': 'katrina'
        };

        return usernameList[githubUsername];
    }

    getSlackUserList(function (err, users) {
        var slackUsername;
        if (err) {
            console.log('Error receiving slack users:', err);
            return callback(err, null);
        }

        if (params.email) {
            //parse users for email first
            slackUsername = searchUsers(users, 'email', params.email);
            log('Found slack by email:', slackUsername);
        }

        if (!slackUsername && params.fullname) {
            slackUsername = searchUsers(users, 'real_name', params.fullname);
            log('Found slack by real_name:', slackUsername);
        }

        if (!slackUsername) {
            slackUsername = resolveManually(params.githubUsername);
            log('Found slack manually', slackUsername);

            if (!slackUsername) {
                console.log('Couldn\'t find slack username', params);
            }
        }

        callback(null, slackUsername);
    });
}

function buildPayload(build, githubInfo, slackUsername) {
    var payload,
        commitMsg,
        messages = [
            'Avast ye harties! A build has run a rig!',
            'Shiver me timbers, someone\'s seen fit to break the build!',
            'Ahoy me maties! Some salty dog broke the build!',
            'Arrrgh, I oughta make the land lubber that broke this build walk the plank!',
            'Ayyye, some scallywag has seen fit to break the build!',
            'Blimey, that build was given no quarter. It\'s down Davey Jone\'s Locker now.'
        ],
        DMmessages = [
            'Arrgh, you broke this build, you scurvy dog!',
            'Fire in the hole! This build is goin\' down!',
            'Avast me matey, I\'ll have ye measured fer chains if you break another build!',
            'Sink me! This build is broke, I ought to make ye swab the deck!'
        ];

    if (build.message.length > 125) {
        commitMsg = build.message.substr(0, 125) + '...';
    } else {
        commitMsg = build.message;
    }

    payload = {
        username: 'Codeship',
        channel: slackUsername ? '@' + slackUsername : '#codeship',
        icon_url: "https://slack.global.ssl.fastly.net/7bf4/img/services/codeship_48.png",
        attachments: [{
            fallback: githubInfo.login + ' broke the build in branch ' + build.branch + ' - ' + build.build_url,
            color: '#FF0000',
            pretext: slackUsername ? DMmessages[Math.floor(Math.random() * DMmessages.length)] : messages[Math.floor(Math.random() * messages.length)],
            author_name: githubInfo.fullName,
            author_icon: githubInfo.avatarUrl,
            fields: [
                {
                    title: 'Branch',
                    value: '<https://github.com/' + build.project_name + '/tree/' + build.branch + '|' + build.branch + '>',
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

function postToSlack(payload) {
    superagent.post(webhook)
        .send(payload)
        .end(function (err, res) {
            if (err) {
                console.log('Slack webhook error', err);
            }
            log('slack response', res.body);
        });
}

app.post('/', function (req, res) {
    var build,
        DMPayload,
        channelPayload;

    if (req.body && req.body.build) {
        build = req.body.build;
        console.log('Received build - status: ' + build.status + ', build id: ' + build.build_id);

        if (buildShouldBePosted(build)) {
            getGithubUserInfo(build, function (err, githubInfo) {
                resolveSlackUsername({
                    email: githubInfo.email,
                    fullname: githubInfo.fullName,
                    githubUsername: githubInfo.login
                }, function (err, slackUsername) {
                    if (slackUsername) {
                        DMPayload = buildPayload(build, githubInfo, slackUsername);
                        log('DM payload', DMPayload);
                        postToSlack(DMPayload);
                    }

                    channelPayload = buildPayload(build, githubInfo);
                    log('channel payload', channelPayload);
                    postToSlack(channelPayload);
                });
            });
        }
    }

    res.end();  //dont need to send anything back
});

app.listen(port);