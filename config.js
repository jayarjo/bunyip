module.exports = {
	tester: 'yeti', // e.g. yeti or testswarm

	yeti: {
		url: "http://localhost:9000",
		loglevel: 'silent'
	},

	testswarm: {
		url: "SWARM_URL",
		testsurl: 'BASE_TESTS_URL', // this will be automatically prepended to all relative test urls
		username: 'USERNAME',
		authToken: 'TOKEN',
		pollInterval: 1000,
		timeout: 1000 * 60 * 15 // 15 minutes
	},

	browserstack: {
		username: "USERNAME",
		password: "PASSWORD",
		version: 2,
		timeout: 480
	},
	
	tunnel: {
		url: "KITE_URL",
		secret: "SECRET",
		cmd: "pagekite.py --clean --defaults --backend=http/<port>:<url>:<localhost>:<localport>:<secret>"
	}
};