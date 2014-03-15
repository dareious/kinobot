var _ = require('underscore')._;

var pages = function(dbot) {
    return {
        '/imgur/random': function(req, res) {
            var quoteCat = dbot.db.quoteArrs[dbot.config.imgur.highscore],
                highScore = 0;
                
            if(quoteCat) {
                highScore = _.last(quoteCat);
            }

            res.render('imgurr', { "highscore" : highScore });
        },

        '/imgur/stats': function(req, res) {
            res.render('imgurstats', {
                'name': dbot.config.name,
                'totalHttpRequests': this.db.totalHttpRequests,
                'totalApiRequests': this.db.totalApiRequests,
                'totalImages': this.db.totalImages
            });
        }
    };
};

exports.fetch = function(dbot) {
    return pages(dbot);
};
