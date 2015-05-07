"use strict";

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    superagent = require('superagent'),
    webhook = process.env.webhook,
    port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.send('Hello World!');
});

app.post('/', function (req, res) {
    var build,
        userAvatar,
        userFullName,
        payload;

    if (req.body && req.body.build) {
        build = req.body.build;
        console.log('received webhook', build);

        if (build.status === 'error') {
            //todo - check if we want to post this branch's error

            superagent.get('http://api.github.com/users/' + build.committer, function (err, res) {
                if (res.status !== 200) {
                    userAvatar = 'http://placegoat.com/16';
                    userFullName = build.committer;
                } else {
                    userAvatar = res.body.avatar_url;
                    userFullName = res.body.name;
                }

                payload = {
                    username: 'Codeship',
                    icon_emoji: ":codeship:",
                    attachments: [{
                        fallback: userFullName + ' broke the build in branch ' + build.branch + ' - ' + build.build_url,
                        color: '#FF0000',
                        pretext: 'A build has failed...',
                        author_name: userFullName,
                        author_icon: userAvatar,
                        fields: [
                            {
                                title: 'Commit Message',
                                value: build.message
                            },
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
                            }

                        ]
                    }]
                };

                console.log('slack payload', payload);

                superagent.post(webhook, payload, function (err, res) {
                    console.log(res);
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
//
//var build = {
//    build_url: 'https://codeship.com/projects/65216/builds/5539340',
//    commit_url: 'https://github.com/HighGroundInc/hgapp/commit/bbd9a495a6168ce1130719273141753e8982fa50',
//    short_commit_id: 'bbd9a',
//    project_full_name: 'HighGroundInc/hgapp',
//    commit_id: 'bbd9a495a6168ce1130719273141753e8982fa50',
//    project_id: 65216,
//    build_id: 5539340,
//    message: 'update result template',
//    status: 'testing',
//    committer: 'ge-stalt',
//    branch: 'feature/pulse-survey'
//}, github = {
//    "login": "ge-stalt",
//    "id": 5455331,
//    "avatar_url": "https://avatars.githubusercontent.com/u/5455331?v=3",
//    "gravatar_id": "",
//    "url": "https://api.github.com/users/ge-stalt",
//    "html_url": "https://github.com/ge-stalt",
//    "followers_url": "https://api.github.com/users/ge-stalt/followers",
//    "following_url": "https://api.github.com/users/ge-stalt/following{/other_user}",
//    "gists_url": "https://api.github.com/users/ge-stalt/gists{/gist_id}",
//    "starred_url": "https://api.github.com/users/ge-stalt/starred{/owner}{/repo}",
//    "subscriptions_url": "https://api.github.com/users/ge-stalt/subscriptions",
//    "organizations_url": "https://api.github.com/users/ge-stalt/orgs",
//    "repos_url": "https://api.github.com/users/ge-stalt/repos",
//    "events_url": "https://api.github.com/users/ge-stalt/events{/privacy}",
//    "received_events_url": "https://api.github.com/users/ge-stalt/received_events",
//    "type": "User",
//    "site_admin": false,
//    "name": "ge-stalt",
//    "company": "",
//    "blog": "",
//    "location": "",
//    "email": "kareem@highground.com",
//    "hireable": false,
//    "bio": null,
//    "public_repos": 10,
//    "public_gists": 0,
//    "followers": 4,
//    "following": 0,
//    "created_at": "2013-09-13T22:13:20Z",
//    "updated_at": "2015-04-27T16:49:29Z"
//}
