"use strict";

var express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	Hipchat = require('node-hipchat'),
	HC = new Hipchat(process.env.hipchat_token),
	devRoomId = '534835',
	port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/', function (req, res) {
	res.send('Hello World!');
});

app.post('/', function (req, res) {
	var build;
	
	if (req.body && req.body.build) {
		build = req.body.build;
		console.log('received webhook', build);
		
		if (build.status === 'error') {
			//notifiy hipchat here
			HC.postMessage({
				room: devRoomId,
				from: 'Codeship',
				message: '(failed) ' + build.committer + ' broke the build on (branch) ' + build.branch,
				message_format: 'text',
				color: 'red'
			}, function (data, err) {
				console.log('sent message', err);
			});
		}
	}
	
	res.end();	//dont need to send anything back
});

app.listen(port);